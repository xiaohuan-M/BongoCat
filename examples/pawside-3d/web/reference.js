// Estimated input from the visible poses in the supplied recording, in seconds.
// These are public rehearsal cues shared by both rigs, never captured keystrokes.
(function (root) {
  const duration = 17.257;
  const checks = [
    { at: 0.47, pose: 'grip', name: '侧身握鼠' },
    { at: 2.13, pose: 'type', name: '回身连打' },
    { at: 3.83, pose: 'anger', name: '低头锤键' },
    { at: 8.54, pose: 'overlap', name: '握鼠时拍尾' },
    { at: 13.58, pose: 'calmGrip', name: '尾巴平复' },
    { at: 15.3, pose: 'sit', name: '收爪坐好' },
  ];
  function score() {
    const cues = [];
    function tap(t, code, len) {
      cues.push([t, 'down', code], [t + len, 'up', code]);
    }
    const move = (t) => cues.push([t, 'mouse']);
    [0, 0.16, 0.34, 0.55, 0.76].forEach(move);
    const phrase = [
      'KeyA',
      'KeyJ',
      'KeyD',
      'KeyL',
      'KeyS',
      'KeyH',
      'KeyF',
      'KeyK',
    ];
    for (let i = 0; i < 40; i++) {
      const t = 1.1 + i * 0.107;
      tap(t, phrase[i % phrase.length], i % 4 === 0 ? 0.09 : 0.068);
    }
    for (const at of [2.4, 2.68, 3.46, 4.1, 4.82]) tap(at, 'Backspace', 0.09);
    tap(5.12, 'Backspace', 0.45);
    for (let at = 5.64; at < 13.15; at += 0.56) move(at);
    cues.push([duration, 'end']);
    return cues.sort((a, b) => a[0] - b[0]);
  }
  const api = { checks, duration, score };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PawReference = api;
})(globalThis);
