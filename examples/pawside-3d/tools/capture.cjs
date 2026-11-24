// Render only the built-in rehearsal. No desktop preload, native hooks, or user preferences.
'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const ref = require('../web/reference.js');
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
