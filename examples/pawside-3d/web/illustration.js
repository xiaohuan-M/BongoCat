/* Drawing helpers and compact catalog portraits. */
(function () {
  'use strict';
  const { clamp } = PawMotion;
  const paths = new Map();
  function path(g, data, fill, stroke, width = 1) {
    let shape = paths.get(data);
    if (!shape) { shape = new Path2D(data); paths.set(data, shape); }
    if (fill) { g.fillStyle = fill; g.fill(shape); }
    if (stroke) { g.lineWidth = width; g.strokeStyle = stroke; g.stroke(shape); }
    return shape;
  }
  function oval(g, x, y, rx, ry, fill, stroke, width = 1) {
    g.beginPath();
    g.ellipse(x, y, Math.max(.05, rx), Math.max(.05, ry), 0, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.lineWidth = width; g.strokeStyle = stroke; g.stroke(); }
  }
  function mix(a, b, t) {
    const n = parseInt(a.slice(1), 16), m = parseInt(b.slice(1), 16);
    let value = 0;
    for (const shift of [16, 8, 0]) {
      const from = (n >> shift) & 255, to = (m >> shift) & 255;
      value = value * 256 + Math.round(from + (to - from) * t);
    }
    return '#' + value.toString(16).padStart(6, '0');
  }
  const paper = '#fff0dc', graphite = '#343131';
  const edge = c => mix(c.shade, graphite, .46);
  const fur = c => mix(c.fur, paper, .24);
  const tabby = c => mix(c.stripe, fur(c), .29);
  const longFace = 'M -35 -25 C -24 -40 8 -43 28 -32 Q 42 -24 44 -12 Q 46 -6 51 -3 L 45 -3 Q 48 3 51 8 L 45 6 Q 47 15 42 21 L 40 16 Q 30 34 5 35 Q -16 36 -33 23 Q -33 29 -40 33 Q -39 25 -40 19 L -47 24 Q -44 17 -46 9 L -53 13 Q -48 6 -45 -1 L -51 0 Q -44 -6 -43 -13 Q -39 -21 -35 -25 Z';
  const shortFace = 'M -41 -16 C -32 -38 12 -44 34 -28 Q 47 -19 46 2 Q 44 20 33 27 Q 17 39 -4 35 Q -32 33 -42 19 Q -51 6 -44 -9 Z';

  function ear(g, side, look, long, mood) {
    const { coat: c, form: f } = look;
    g.save();
    g.translate(side * (28 + 38 * f.earSpace) + 2, -27 - 25 * f.earLift);
    g.scale(side, 1);
    g.rotate((side < 0 ? -.25 : .055) + f.earAngle * .013 + mood.anger * .53 + mood.ear * .10);
    g.scale(f.earWidth * (side < 0 ? 1.09 : .92), f.earLength * .91);
    const outer = long
      ? 'M -15 6 Q -15 -12 3 -36 Q 9 -44 9 -51 L 15 -47 L 22 -52 Q 17 -44 20 -37 Q 25 -19 19 -5 Q 18 2 23 5 Q 15 7 12 4 Q 8 13 -5 12 Z'
      : 'M -15 7 Q -16 -11 -4 -26 Q 6 -39 14 -42 Q 18 -42 20 -35 Q 24 -17 18 4 Q 10 13 -7 11 Z';
    path(g, outer, fur(c), edge(c), 1.5);
    if (long) path(g, 'M 6 -41 Q 5 -47 -2 -51 Q 5 -53 10 -49 Q 12 -57 18 -60 L 16 -52 Q 20 -55 24 -55 Q 18 -50 19 -43 Q 12 -47 6 -41 Z', tabby(c));
    g.save();
    g.translate(1, 0);
    g.scale(.3 + .7 * f.earInside, 1);
    path(g, 'M -10 0 Q -7 -13 2 -24 Q 10 -35 14 -38 Q 18 -35 17 -22 Q 16 -13 12 -8 L 8 -11 L 9 -6 Q 3 -7 0 -1 Z', mix(c.ear, paper, .53));
    path(g, 'M -10 3 Q -7 -5 1 -7 L -1 -3 Q 4 -6 10 -4 L 5 0 Q 10 -1 13 2 Q 6 2 3 6 Z', mix(c.light, fur(c), .20));
    g.restore();
    if (f.pattern === 'point') path(g, 'M 7 -38 Q 11 -43 15 -44 Q 18 -39 19 -29 Q 14 -34 7 -31 Z', c.stripe);
    g.restore();
  }

  function markings(g, look) {
    const { coat: c, form: f } = look;
    g.save();
    g.globalAlpha = f.patternAmount;
    g.translate(f.patternShift * 23, 0);
    g.scale(f.patternScale, 1);
    if (f.pattern === 'tabby') {
      const pigment = tabby(c);
      path(g, 'M -22 -38 Q -8 -39 -3 -17 Q -12 -32 -21 -29 Z M -7 -41 Q 5 -39 8 -17 Q 1 -26 0 -31 Q -3 -35 -7 -36 Z M 5 -43 Q 19 -38 18 -21 Q 12 -26 12 -31 Q 9 -36 5 -37 Z M 18 -41 Q 30 -37 30 -26 Q 24 -33 18 -35 Z', pigment);
      path(g, 'M -54 4 Q -38 -10 -28 -4 Q -40 -2 -45 5 Z M -51 10 Q -40 -2 -25 1 Q -34 4 -42 13 Z M -46 19 Q -36 7 -25 7 Q -32 12 -39 18 Z M 45 -7 Q 36 -8 32 -4 Q 42 -4 49 3 Z M 49 6 Q 38 0 34 3 Q 41 6 45 12 Z', pigment);
    }
    if (f.pattern === 'calico' || f.pattern === 'patch') {
      path(g, 'M -61 -53 L -5 -48 Q 7 -36 -7 -22 Q -18 -15 -23 -5 Q -30 10 -57 9 Z', f.pattern === 'calico' ? c.light : c.stripe);
      path(g, 'M 58 -47 L 33 -44 Q 21 -37 23 -24 Q 25 -15 39 -11 Q 49 -6 59 1 Z', c.stripe);
    }
    if (f.pattern === 'point') {
      const point = g.createRadialGradient(8, 11, 5, 8, 8, 45);
      point.addColorStop(0, c.stripe);
      point.addColorStop(.52, mix(c.stripe, fur(c), .28));
      point.addColorStop(1, fur(c));
      oval(g, 6, 4, 48, 38, point);
    }
    g.restore();
    if (f.blaze > .01 || f.pattern === 'tuxedo') {
      g.save();
      g.translate(7, 0);
      g.scale(.25 + f.blaze, 1);
      path(g, 'M -2 -23 Q 3 -15 5 -4 Q 7 6 16 19 Q 7 26 0 24 Q -14 25 -19 19 Q -7 8 -5 -2 Z', mix(c.light, fur(c), .12));
      g.restore();
    }
  }

  function eye(g, side, look, mood) {
    const { coat: c, form: f } = look;
    const isNear = side < 0, iris = isNear ? c.eye : c.eyeRight;
    const rim = mix(c.shade, '#211f1e', .72), open = mood.open * f.eyeOpen;
    g.save();
    g.translate((isNear ? -13 : 25) + side * 36 * f.eyeSpace, (isNear ? -5 : -10) - 23 * f.eyeLift);
    g.rotate((isNear ? .27 : -.18) - side * f.eyeTilt * .013 + side * mood.anger * .3);
    g.scale(f.eyeWidth * (isNear ? 1.14 : .87), f.eyeHeight * (isNear ? 1 : 1.04));
    if (open < .17) {
      path(g, 'M -12 1 Q -2 -4 11 0', null, rim, 1.75);
    } else {
      g.scale(1, Math.max(.19, open));
      const fill = mix(iris, '#e3bd67', .28);
      const shape = path(g, 'M -12 -1 C -8 -11 2 -12 8 -7 Q 14 -3 12 4 Q 10 9 3 9 Q -7 9 -12 2 Q -13 0 -12 -1 Z', fill, rim, 1.3 + .20 * f.eyeTaper);
      g.save();
      g.clip(shape);
      const px = (isNear ? 3.7 : 2.8) + mood.gx * 4.2, py = 1 + mood.gy * 2.5;
      if (f.irisDetail > .15) oval(g, px - .45, py + .1, 6.5, 8.3, mix(fill, '#edd691', .30));
      oval(g, px, py, (4.2 + (mood.hunt || 0) * 2.7) * f.pupilWidth, 7.8 * f.pupilHeight, '#26251f');
      if (f.glintStrength > .03) oval(g, px - 1.8, py - 3.2, .93 * f.glintSize, 1.20 * f.glintSize, mix(fill, '#fff9dc', Math.min(1, f.glintStrength)));
      g.restore();
      path(g, 'M -12 -1 C -8 -11 2 -12 8 -7 Q 11 -5 12 -2', null, rim, 1.39 + .22 * f.eyeTaper);
    }
    g.restore();
  }

  function head(g, look, long, mood) {
    const { coat: c, form: f } = look, ink = edge(c), pigment = fur(c);
    g.save();
    g.scale(.93 * f.headWidth * (.90 + .10 * f.cheeks), f.headHeight * (.91 + .09 * f.forehead));
    ear(g, -1, look, long, mood);
    ear(g, 1, look, long, mood);
    const outline = path(g, long ? longFace : shortFace, pigment, ink, 1.45);
    g.save();
    g.clip(outline);
    path(g, 'M -53 -25 Q -30 -47 4 -41 Q 27 -39 34 -24 Q 9 -38 -15 -29 Q -30 -24 -43 -8 Z', mix(pigment, c.light, .30));
    path(g, 'M -52 2 Q -37 16 -21 15 Q -1 34 24 27 Q 40 20 47 7 L 54 41 L -52 44 Z', mix(pigment, c.shade, .22));
    markings(g, look);
    g.save();
    g.translate(7, -27 * f.noseLift);
    g.scale((.64 + .36 * f.jaw) * f.muzzleWidth, 1);
    const muzzle = mix(pigment, c.muzzle, .48 + .30 * clamp(f.muzzleMark, 0, 1.5));
    path(g, 'M -24 18 Q -23 12 -17 9 Q -11 5 -5 8 Q 0 10 4 7 Q 11 4 16 8 Q 24 12 24 18 Q 23 27 13 30 Q -2 35 -16 29 Q -24 25 -24 18 Z', muzzle);
    path(g, 'M -24 19 Q -15 30 1 28 Q 17 28 23 20 Q 21 29 12 31 Q -5 36 -19 28 Z', mix(muzzle, pigment, .40));
    g.restore();
    g.restore();
    for (const side of [-1, 1]) eye(g, side, look, mood);
    g.save();
    g.translate(8, 10 - 27 * f.noseLift);
    g.scale(f.muzzleWidth, 1);
    g.save();
    g.scale(f.noseWidth, f.noseHeight);
    path(g, 'M -4.8 -.4 Q -4.2 -2.6 0 -2.6 Q 4.6 -2.6 4.7 -.4 Q 2.5 2.6 .2 3.3 Q -2.4 2.5 -4.8 -.4 Z', mix(c.nose, graphite, .54));
    g.restore();
    g.save();
    g.translate(.2, 4);
    g.scale(f.mouthWidth, 1);
    path(g, 'M 0 -1 V 4 Q -2.4 7.8 -6.3 6.4 M 0 4 Q 2.5 8 6.2 6.2', null, ink, .97);
    if (mood.anger > .32) {
      path(g, 'M -5 5 Q 0 6 5 4 Q 7 14 1 16 Q -5 16 -5 5 Z', mix(c.nose, graphite, .59), ink, .8);
      path(g, 'M -5 6 L -2 7 L -4 11 Z M 3 6 L 5 5 L 5 10 Z', paper);
    }
    g.restore();
    g.restore();
    for (const side of [-1, 1]) {
      g.save();
      g.translate(8 + side * 14, 16 - 20 * f.whiskerLift);
      g.scale(side * f.whiskerLength, f.whiskerSpread);
      if (f.whiskerLength > .01) path(g, 'M 1 0 Q 12 -5 28 -4 M 1 3 Q 17 1 32 5 M 2 6 Q 16 9 26 14', null, mix(c.whisk, ink, .68), .81 * f.whiskerWidth);
      g.restore();
    }
    g.restore();
  }

  window.PawArt = { path, oval, mix, head };
})();
