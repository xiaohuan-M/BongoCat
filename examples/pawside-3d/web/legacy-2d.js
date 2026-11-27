/* The original Maine Coon artwork and its arm and eye landmarks are from the prior Pawside preview. */
(function () {
  'use strict';

  const source = new Image();
  source.src = Paw2DImage;
  const crop = [306, 151, 772, 919];
  const scale = .212;
  const catOrigin = [183, 227];
  const artOrigin = [552, 1056];
  const shoulders = [[414, 746], [675, 746]];
  const wrists = [[414, 879], [667, 885]];
  const forelegBounds = [[344, 728, 145, 208], [592, 731, 143, 211]];
  const paws = [
    'M414 740 C430 732 467 771 482 797 C483 812 449 831 457 848 C480 891 449 924 414 924 C369 925 347 892 363 852 C373 820 391 784 406 751 Z',
    'M674 740 C683 739 693 794 705 834 C727 886 717 913 686 926 C656 940 620 921 613 894 C601 870 627 847 619 835 C606 809 593 798 615 785 Z',
  ].map(shape => new Path2D(shape));
  const eyeLandmarks = [
    {
      bounds: [446, 434, 125, 96], center: [509, 486], travel: [28, 15],
      pupil: [538, 498, 18.4, 24.6, -.20],
      outline: 'M452 466 C459 446 493 434 519 439 C551 446 568 472 566 501 C558 526 534 528 508 524 C476 519 447 495 452 466 Z',
      iris: 'M464 470 C465 456 488 445 507 445 C531 445 550 463 558 484 C569 512 542 523 519 521 C492 520 463 499 464 470 Z',
      lid: 'M467 477 Q499 504 549 490',
    }, {
      bounds: [619, 415, 88, 94], center: [661, 464], travel: [20, 13],
      pupil: [680, 470, 13.3, 24.2, -.03],
      outline: 'M623 474 C622 451 640 422 666 419 C690 417 707 430 704 455 C702 482 684 502 659 506 C636 510 621 508 623 474 Z',
      iris: 'M630 470 C632 449 648 428 666 427 C684 425 697 440 697 460 C697 482 678 502 650 503 C632 502 628 492 630 470 Z',
      lid: 'M634 470 Q658 485 691 458',
    },
  ];
  const eyes = new Path2D(eyeLandmarks.map(eye => eye.outline).join(' '));
  const { clamp, ease, layout, mix } = PawMotion;
  const { oval, path } = PawArt;
  const pet = { name: '银虎斑缅因' };
  const backingColor = '#bcb7b5';
  const capDrop = 2;
  let artwork, sockets, eyeLayers, closedEyes;

  function plane([x, y, width, height] = crop) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, -x, -y);
    return ctx;
  }

  function masked(shape, bounds = crop) {
    const ctx = plane(bounds);
    ctx.clip(shape);
    ctx.drawImage(artwork, crop[0], crop[1]);
    return ctx.canvas;
  }

  function filledLayer(shape, pad) {
    const result = plane();
    result.fillStyle = backingColor;
    result.strokeStyle = backingColor;
    result.lineWidth = pad * 2;
    result.lineJoin = 'round';
    result.fill(shape);
    result.stroke(shape);
    result.globalCompositeOperation = 'destination-in';
    result.drawImage(artwork, crop[0], crop[1]);
    return result.canvas;
  }

  function eyeLayer(landmark) {
    const { bounds, outline, iris } = landmark;
    const [x, y, width, height] = bounds;
    const paint = plane(bounds);
    paint.clip(new Path2D(iris));
    const palette = paint.createLinearGradient(x, y, x + width, y + height);
    palette.addColorStop(0, '#cebf78');
    palette.addColorStop(1, '#c5b86a');
    paint.fillStyle = palette;
    paint.fillRect(...bounds);
    return {
      ...landmark, pigment: paint.canvas,
      original: masked(new Path2D(outline), bounds), mask: new Path2D(iris),
    };
  }

  const ready = source.decode().then(() => {
    const image = plane();
    image.drawImage(source, ...crop, crop[0], crop[1], crop[2], crop[3]);
    const data = image.getImageData(0, 0, crop[2], crop[3]);
    for (let alpha = 3; alpha < data.data.length; alpha += 4) {
      data.data[alpha] = Math.round(clamp((data.data[alpha] / 255 - .025) / .966) * 255);
    }
    image.putImageData(data, 0, 0);
    artwork = image.canvas;
    sockets = paws.map((shape, i) => ({
      cover: filledLayer(shape, 6), sprite: masked(shape, forelegBounds[i]),
    }));
    closedEyes = filledLayer(eyes, 5);
    eyeLayers = eyeLandmarks.map(eyeLayer);
  });
  ready.catch(() => {});

  function projection(x, y, z) {
    return { x: 196 + (x - .42) * (42 + (z - 1.2) * 3), y: 236 + (z - .9) * 26 - y * 43 };
  }

  // Keep the original ink and fur. Only the eyes are composited during a look or blink.
  function paintEyes(g, m, t) {
    const blink = (t + 1.38) % 4.3;
    const typing = m.held.size ? 1 : 1 - ease((m.t - m.lastStrike - .22) / .65);
    const focus = m.privacy ? 0 : Math.max(m.cursorLook, m.mouseLean, m.lookup, typing);
    const close = Math.max(m.sleep, m.nuzzle * .97, m.hello * .79, m.rage * .59,
      m.drive * .37, m.reliefBlink, blink < .19 ? Math.sin(blink / .19 * Math.PI) ** 2 : 0);
    if (focus < .009 && close < .016) return;
    const open = 1 - close;
    const squint = close >= .016;
    if (squint) g.drawImage(closedEyes, crop[0], crop[1]);
    for (const eye of eyeLayers) {
      const [x, y] = eye.bounds;
      const [cx, cy] = eye.center;
      if (open > .10) {
        g.save();
        if (squint) {
          g.translate(0, cy * (1 - open));
          g.scale(1, open);
          g.drawImage(eye.original, x, y);
        }
        if (focus >= .009) {
          const [px, py, width, height, angle] = eye.pupil;
          g.globalAlpha = ease(focus * 4);
          g.clip(eye.mask);
          g.drawImage(eye.pigment, x, y);
          g.fillStyle = '#2c2920';
          g.beginPath();
          g.ellipse(mix(px, cx + eye.travel[0] * m.gaze[0], focus),
            mix(py, cy - eye.travel[1] * m.gaze[1], focus),
            width * (1 + .16 * m.hunt - .25 * m.drive), height, angle, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
      }
      if (open < .29) {
        g.globalAlpha = 1 - ease((open - .10) / .19);
        path(g, eye.lid, null, '#595653', 4.4);
        g.globalAlpha = 1;
      }
    }
  }

  function keys(g, m, t) {
    path(g, 'M 103 232 H 287 Q 292 232 294 238 L 302 269 Q 305 276 298 277 H 92 Q 86 277 88 271 L 97 238 Q 98 232 103 232 Z',
      '#2c2b26', '#171714', 1.4);
    path(g, 'M 95 270 H 297 L 288 236 H 103 Z', '#e1d8bf');
    for (const k of layout.values()) {
      const depth = m.privacy ? 0 : m.keyDepth(k.code, t);
      const p = projection(k.x, .24, k.z);
      const w = k.width * (42 + (k.z - 1.2) * 3), y = p.y - 2.9 + depth * capDrop;
      const tint = depth > .15 ? '#f57d53' : ['Backspace','Escape','Enter','Space'].includes(k.code) ? '#f4bc70' : '#fff9e9';
      g.fillStyle = '#b4a78c';
      g.beginPath();
      g.roundRect(p.x - w / 2, y + .7, w, 6.7, .9);
      g.fill();
      g.fillStyle = tint;
      g.beginPath();
      g.roundRect(p.x - w / 2, y - .4, w, 5.6, .9);
      g.fill();
      if (k.label && !m.privacy) {
        g.fillStyle = '#665743';
        g.font = '3.65px monospace';
        g.textAlign = 'center';
        g.fillText(k.label, p.x, y + 3.8);
      }
    }
  }

  function mouse(g, m, t) {
    const center = { x: 69 + m.mouseOffset[0] * 29, y: 251 + m.mouseOffset[1] * 23 };
    g.save();
    g.translate(center.x, center.y);
    g.rotate(.43);
    oval(g, 0, 0, 10, 13.5, '#fff8e6', '#332e28', 1.3);
    g.globalAlpha = m.press[0];
    path(g, 'M -1 -11 Q -9 -11 -9 -1 H -1 Z', '#f5bb77');
    g.globalAlpha = m.press[1];
    path(g, 'M 1 -11 Q 9 -11 9 -1 H 1 Z', '#f5bb77');
    g.globalAlpha = 1;
    path(g, 'M 0 -9 V -2', null, '#392e2b', 1);
    if (t >= m.scrollUntil && m.press[2] < .02) {
      path(g, 'M 0 -7 V -4', null, '#e2904e', 2);
    } else {
      g.translate(0, m.press[2] * .8);
      g.fillStyle = m.press[2] > .20 ? '#b86a39' : '#e2904e';
      g.beginPath();
      g.roundRect(-1.25, -8, 2.5, 6, 1.15);
      g.fill();
      g.clip();
      g.strokeStyle = '#f9d699';
      g.lineWidth = .55;
      const pitch = 1.85;
      const phase = (m.wheelAngle * 2 % pitch + pitch) % pitch;
      for (let i = 0; i < 4; i++) {
        const y = -8.7 + i * pitch + phase;
        g.beginPath();
        g.moveTo(-.8, y);
        g.lineTo(.8, y);
        g.stroke();
      }
    }
    g.restore();
    if (t < m.scrollUntil) {
      g.fillStyle = '#594738';
      g.font = 'bold 12px monospace';
      g.fillText(m.scrollSign > 0 ? '↓' : '↑', center.x - 20, center.y);
    }
    return center;
  }

  // Bend the painted sleeve along the reach while keeping the paw pad in proportion.
  function drawForeleg(g, arm, side) {
    const [sx, sy] = shoulders[side], [wx, wy] = wrists[side];
    const [left, top, width, height] = forelegBounds[side];
    const { shoulder } = arm;
    const dx = arm.x - shoulder.x, dy = arm.y - shoulder.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const alongX = dx / distance, alongY = dy / distance;
    const acrossX = alongY * scale * (1 + .08 * arm.pressure);
    const acrossY = -alongX * scale * (1 + .08 * arm.pressure);
    const padScale = scale * (1 - .28 * arm.pressure);
    const bow = (side ? 1 : -1) * .064 * Math.min(94, distance) * arm.amount;
    const row = y => {
      const u = clamp((y - sy) / (wy - sy));
      const edge = left - mix(sx, wx, u);
      const curl = bow * Math.sin(u * Math.PI) ** 2;
      const end = Math.min(0, y - sy) * scale + Math.max(0, y - wy) * padScale;
      return {
        x: mix(shoulder.x, arm.x, u) + alongX * end + acrossX * edge + alongY * curl,
        y: mix(shoulder.y, arm.y, u) + alongY * end + acrossY * edge - alongX * curl,
      };
    };
    const cuts = [top, sy, sy + 25, sy + 51, wy - 49, wy - 25, wy, top + height];
    g.save();
    g.globalAlpha = arm.amount;
    let from = row(cuts[0]);
    for (let i = 1; i < cuts.length; i++) {
      const to = row(cuts[i]);
      const span = cuts[i] - cuts[i - 1];
      const overlap = i < cuts.length - 1 ? .5 : 0;
      g.save();
      g.transform(acrossX, acrossY, (to.x - from.x) / span, (to.y - from.y) / span, from.x, from.y);
      g.drawImage(sockets[side].sprite, 0, cuts[i - 1] - top, width, span + overlap, 0, 0, width, span + overlap);
      g.restore();
      from = to;
    }
    g.restore();
  }

  class View {
    constructor(surface) {
      this.surface = surface;
      this.ctx = surface.getContext('2d');
      this.pose = 'desk';
      this.privateKeys = false;
    }
    inspect(pose) { this.pose = pose; }
    resize(w, h, ratio = devicePixelRatio || 1) {
      this.width = w;
      this.height = h;
      this.ratio = Math.min(2, ratio, Math.sqrt(2000000 / (w * h)));
      const dw = Math.max(1, Math.round(w * this.ratio)), dh = Math.max(1, Math.round(h * this.ratio));
      if (this.surface.width !== dw || this.surface.height !== dh) {
        this.surface.width = dw;
        this.surface.height = dh;
      }
    }
    frame() {
      const face = this.pose === 'face';
      const zoom = face ? Math.min(this.width / 148, this.height / 135) : Math.min(this.width / 315, this.height / 277);
      return { zoom, left: this.width / 2 - (face ? 185 : 176) * zoom,
        top: this.height / 2 - (face ? 88 : 151) * zoom };
    }
    hit(x, y) {
      const { zoom, left, top } = this.frame();
      const px = ((x + 1) * this.width / 2 - left) / zoom, py = ((1 - y) * this.height / 2 - top) / zoom;
      if (this.pose !== 'face') {
        for (const key of layout.values()) {
          const point = projection(key.x, .24, key.z);
          if (Math.abs(point.x-px) <= key.width * (42 + (key.z - 1.2) * 3) / 2 && Math.abs(point.y-py) <= 3.7) return key.code;
        }
        if (this.mouse && Math.abs(this.mouse.x-px) <= 13 && Math.abs(this.mouse.y-py) <= 16) return 'mouse';
      }
      if (px > 136 && px < 241 && py > 34 && py < 142) return 'head';
      return null;
    }
    render(m, t) {
      if (!this.width || !artwork) return;
      const g = this.ctx, { zoom, left, top } = this.frame(), r = this.ratio;
      const face = this.pose === 'face';
      const time = m.t;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, this.surface.width, this.surface.height);
      g.setTransform(r*zoom, 0, 0, r*zoom, r*left, r*top);
      g.lineCap = g.lineJoin = 'round';
      g.imageSmoothingEnabled = true;

      const mouseCenter = { x: 69 + m.mouseOffset[0] * 29, y: 251 + m.mouseOffset[1] * 23 };
      const origin = [catOrigin[0] + m.head[0] * 3.0 - 4 * m.mouseLean, catOrigin[1] + m.sleep * 3 + m.landing * 1.4 - m.nuzzle * 2];
      const turn = .033 * m.cursorLook * m.head[0] - .095 * m.mouseLean +
        .065 * m.nuzzle * Math.sin(t * 6);
      const cos = Math.cos(turn), sin = Math.sin(turn);
      function screen([x, y]) {
        const dx = (x - artOrigin[0]) * scale, dy = (y - artOrigin[1]) * scale;
        return { x: origin[0] + dx * cos - dy * sin, y: origin[1] + dx * sin + dy * cos };
      }

      const active = m.paws.map((paw, i) => {
        if (face && !m.privacy) return null;
        const tuck = screen(wrists[i]), shoulder = screen(shoulders[i]);
        let target;
        let amount;
        let pressure = 0;
        if (m.privacy) {
          target = screen([i ? 664 : 511, i ? 465 : 488]);
          amount = 1;
        } else {
          amount = ease(Math.abs(paw.pos.z - .90) / .50);
          if (amount < .035) return null;
          target = projection(paw.pos.x, paw.pos.y, paw.pos.z);
          const contact = m.keyContact(paw, time);
          if (contact) {
            pressure = contact.depth * contact.weight;
            target.y += (contact.depth * capDrop - .54) * contact.weight;
          }
          const atMouse = (i === m.mouseSide ? m.mouseLean : 0) * clamp((-paw.pos.x - 1.25) / .85);
          const [left, right, middle] = m.press;
          const roll = time < m.scrollUntil ? Math.sin(m.wheelAngle * 4) : 0;
          target.x += (mouseCenter.x + 3 * (right - left) - target.x) * atMouse;
          target.y += (mouseCenter.y - 2 + Math.max(left, right, middle) * 1.5 + roll - target.y) * atMouse;
          pressure = Math.max(pressure, atMouse * Math.max(left, right, middle));
        }
        return { shoulder, x: mix(tuck.x, target.x, amount), y: mix(tuck.y, target.y, amount), amount, pressure };
      });
      if (!face) {
        oval(g, 185, 230, 68, 5, '#65482b1b');
        oval(g, 199, 275, 113, 5, '#65482b16');
      }
      g.save();
      g.translate(origin[0], origin[1]);
      g.rotate(turn);
      g.scale(scale, scale);
      g.translate(-artOrigin[0], -artOrigin[1]);
      g.drawImage(artwork, crop[0], crop[1]);
      for (let i=0; i<active.length; i++) {
        if (!active[i]) continue;
        g.globalAlpha = active[i].amount;
        g.drawImage(sockets[i].cover, crop[0], crop[1]);
      }
      g.globalAlpha = 1;
      paintEyes(g, m, t);
      g.restore();

      if (!face) {
        keys(g, m, time);
        this.mouse = mouse(g, m, time);
      }
      for (let i=0; i<active.length; i++) {
        const arm = active[i];
        if (arm) drawForeleg(g, arm, i);
      }
      if (!face && !m.privacy && !this.privateKeys) {
        for (const hit of m.hits.slice(-3)) {
          const age = time - hit.at, key = layout.get(hit.code);
          if (age < 0 || age > .46 || !key?.label) continue;
          const point = projection(key.x, .32, key.z);
          const y = point.y - 10 - age * 31;
          g.save();
          g.globalAlpha = 1 - age/.46;
          g.beginPath();
          g.roundRect(point.x-7, y-8, 14, 11, 2);
          g.fillStyle = '#fff8e5';
          g.fill();
          g.strokeStyle = '#342b24';
          g.stroke();
          g.fillStyle = '#342b24';
          g.font = 'bold 7px monospace';
          g.textAlign = 'center';
          g.fillText(key.label, point.x, y);
          g.restore();
        }
      }
    }
    snapshot() { return this.surface.toDataURL('image/png'); }
  }

  window.Paw2D = { View, ready, pet };
})();
