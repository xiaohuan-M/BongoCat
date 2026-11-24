// Render only the built-in rehearsal. No desktop preload, native hooks, or user preferences.
'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const ref = require('../web/reference.js');
function verifyEarFraming(pet) {
  const { cat, camera } = pawReview.view;
  const point = new THREE.Vector3();
  for (const ear of cat.ears) {
    ear.traverse((node) => {
      if (!node.isMesh) return;
      const positions = node.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld).project(camera);
        if (point.y > 0.995 || Math.abs(point.x) > 0.995) {
          throw new Error(pet + ' upright ear extends beyond the desktop frame');
        }
      }
    });
  }
}
// Runs inside the isolated renderer before a reference take. Read the deformed
// sole and the moving key mesh so a change in either model can break the check.
function verifyKeyContacts(pet) {
  pawReview.begin(pet, 420, 288, 'reference');
  const view = pawReview.view;
  const motion = new PawMotion.Motion(pet);
  const transform = new THREE.Matrix4();
  for (const key of PawMotion.layout.values()) {
    motion.reset(0);
    motion.down(key.code, 0.02);
    for (let frame = 1; frame <= 11; frame++) motion.step(frame / 60);
    view.render(motion, 11 / 60);

    const cap = view.caps.get(key.code);
    const geometry = cap.batch.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    cap.batch.getMatrixAt(cap.index, transform);
    const bounds = geometry.boundingBox.clone().applyMatrix4(transform);
    const side = motion.paws.findIndex((paw) => paw.code === key.code);
    const leg = view.cat.arms[side];
    let clearance = Infinity;
    for (let i = 0; i < leg.pos.count; i++) {
      const x = leg.pos.getX(i), z = leg.pos.getZ(i);
      if (x >= bounds.min.x && x <= bounds.max.x && z >= bounds.min.z && z <= bounds.max.z)
        clearance = Math.min(clearance, leg.pos.getY(i) - bounds.max.y);
    }
    // About half a pixel in the reference take; allow a little pad compression.
    if (!(Math.abs(clearance) <= 0.009))
      throw new Error(pet + ' / ' + key.code + ' sole-to-cap gap: ' + clearance);
  }
}

async function capture() {
  const scriptIndex = process.argv.findIndex(
    (arg) => path.resolve(arg) === __filename
  );
  const base = path.resolve(
    scriptIndex < 0
      ? 'reference-frames'
      : process.argv[scriptIndex + 1] || 'reference-frames'
  );
  await fs.mkdir(base, { recursive: true });
  const out = await fs.mkdtemp(path.join(base, 'take-'));
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      partition: 'reference-session',
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  const result = [];
  try {
    await win.loadFile(path.join(__dirname, '..', 'web', 'index.html'));
    const run = (js) => win.webContents.executeJavaScript(js);
    for (const pet of ['ink', 'chestnut']) {
      await run('(' + verifyKeyContacts.toString() + ')(' + JSON.stringify(pet) + ')');
      await run(
        'pawReview.begin(' + JSON.stringify(pet) + ',720,520,"reference")'
      );
      let lastFrame = 0;
      for (const cue of ref.checks) {
        const frame = Math.round(cue.at * 30);
        const data = await run(
          '(()=>{for(let i=' +
            lastFrame +
            ';i<=' +
            frame +
            ';i++)pawReview.frame(i/30);return {png:pawReview.snapshot(),state:pawReview.state()};})()'
        );
        if (cue.pose === 'sit') {
          await run('(' + verifyEarFraming.toString() + ')(' + JSON.stringify(pet) + ')');
        }
        lastFrame = frame + 1;
        const file = pet + '-' + cue.pose + '.png';
        await fs.writeFile(
          path.join(out, file),
          Buffer.from(data.png.split(',')[1], 'base64')
        );
        result.push({
          pet,
          checkpoint: cue.pose,
          frame,
          seconds: frame / 30,
          file,
          mode: data.state.mode,
        });
      }
    }
    await fs.writeFile(
      path.join(out, 'frames.json'),
      JSON.stringify(result, null, 2)
    );
    console.log(out);
  } finally {
    win.destroy();
  }
}
app
  .whenReady()
  .then(capture)
  .then(() => app.quit())
  .catch((e) => {
    console.error(e.message);
    app.exit(1);
  });
