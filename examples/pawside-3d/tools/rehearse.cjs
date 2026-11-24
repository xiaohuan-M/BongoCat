// Same score as the studio's 原片复刻 button. No recording, external service or audio required.
'use strict';
const assert = require('node:assert/strict');
const { Motion } = require('../web/motion.js');
const ref = require('../web/reference.js');
const tests = {
  grip: (m) => m.mouseLean > 0.8 && m.paws[0].pos.x < -2,
  type: (m) =>
    m.kps >= 3.2 && m.mouseLean < 0.2 && m.paws.every((p) => !!p.code),
  anger: (m) => m.rage > 0.45 && m.tailUntil > m.t,
  overlap: (m) => m.mouseLean > 0.85 && m.pique > 0.75 && m.tailBeat > 0.42,
  calmGrip: (m) => m.mouseLean > 0.8 && m.pique < 0.12,
  sit: (m) =>
    m.mode === 'idle' &&
    m.mouseLean < 0.03 &&
    m.paws.every((p) => p.pos.y < 0.18),
};
function rehearse(pet) {
  const m = new Motion(pet),
    events = ref.score(),
    results = [];
  let ei = 0,
    ci = 0;
  for (let i = 0; i <= Math.ceil(ref.duration * 120); i++) {
    const t = i / 120;
    while (ei < events.length && events[ei][0] <= t) {
      const [at, op, code] = events[ei++];
      if (op === 'mouse') m.moveMouse(-0.78, -0.34, at, true);
      if (op === 'down') m.down(code, at);
      if (op === 'up') m.up(code, at);
    }
    m.step(t);
    if (ci < ref.checks.length && t >= ref.checks[ci].at) {
      const cue = ref.checks[ci++];
      assert.ok(
        tests[cue.pose](m),
        pet +
          ' / ' +
          cue.name +
          ' at ' +
          t +
          ' / ' +
          JSON.stringify([m.mode, m.pique, m.mouseLean, m.tailBeat])
      );
      results.push(cue.at + 's ' + cue.name);
    }
  }
  return results;
}
if (require.main === module)
  for (const pet of ['ink', 'chestnut'])
    console.log(pet, rehearse(pet).join(' · '));
module.exports = { rehearse };
