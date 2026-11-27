// All timestamps use seconds on a monotonic clock. The motion driver never stores typed text.
(function (root) {
  'use strict';
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ease = (x) => {
    x = clamp(x);
    return x * x * (3 - 2 * x);
  };
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, rate, dt) => mix(a, b, 1 - Math.exp(-rate * dt));
  const rows = [
    [
      ['Escape', 'esc', 1.1],
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((i) => ['Digit' + i, '' + i]),
      ['Minus', '−'],
      ['Equal', '='],
      ['Backspace', '⌫', 1.9],
    ],
    [
      ['Tab', 'tab', 1.45],
      ...'QWERTYUIOP'.split('').map((c) => ['Key' + c, c]),
      ['BracketLeft', '['],
      ['BracketRight', ']'],
      ['Backslash', '╲', 1.55],
    ],
    [
      ['CapsLock', 'caps', 1.65],
      ...'ASDFGHJKL'.split('').map((c) => ['Key' + c, c]),
      ['Semicolon', ';'],
      ['Quote', "'"],
      ['Enter', '↵', 2.35],
    ],
    [
      ['ShiftLeft', '⇧', 2.05],
      ...'ZXCVBNM'.split('').map((c) => ['Key' + c, c]),
      ['Comma', ','],
      ['Period', '.'],
      ['Slash', '/'],
      ['ShiftRight', '⇧', 1.65],
      ['ArrowUp', '↑', 1.3],
    ],
    [
      ['ControlLeft', 'ctrl', 1.35],
      ['MetaLeft', '⌘', 1.25],
      ['AltLeft', 'alt', 1.2],
      ['Space', '', 5.65],
      ['AltRight', 'alt', 1.2],
      ['ArrowLeft', '←', 1.1],
      ['ArrowDown', '↓', 1.1],
      ['ArrowRight', '→', 1.15],
    ],
  ];
  const layout = new Map();
  rows.forEach((row, j) => {
    const units = row.reduce((n, k) => n + (k[2] || 1), 0),
      pitch = 4.15 / units;
    let edge = 2.075;
    row.forEach(([code, label, w = 1]) => {
      const x = 0.42 + edge - (pitch * w) / 2,
        z = 2.42 - j * 0.265;
      layout.set(code, {
        code,
        label,
        x,
        z,
        width: w * pitch - 0.027,
        side: x >= 0.42 ? 1 : 0,
      });
      edge -= pitch * w;
    });
  });
  const paperDesk = { center: .28, scale: .87 };
  const paperLayout = new Map([...layout.values()].map(key => [key.code, {
    ...key,
    x: paperDesk.center - (key.x - .42) * paperDesk.scale,
    width: key.width * paperDesk.scale,
    side: 1 - key.side,
  }]));
  const V = (x, y, z) => ({ x, y, z }),
    rest = [V(-0.47, 0.123, 0.91), V(0.27, 0.123, 0.89)];
  const keyPalmHeight = 0.239;
  const mouseX = (side, compact) => compact
    ? paperDesk.center + (side ? 2.39 : -2.39)
    : side ? 3.16 : -2.32;
  class Motion {
    constructor(profile = 'ink', { mouseSide = 0, sleepAfter = 25, compact = false } = {}) {
      this.profile = profile;
      this.mouseSide = mouseSide;
      this.sleepAfter = sleepAfter;
      this.greetingDuration = 1.65;
      this.nuzzleDuration = .85;
      this.compact = compact;
      this.layout = compact ? paperLayout : layout;
      this.reset(0);
    }
    reset(t) {
      this.t = t;
      this.lastInput = t;
      this.lastStrike = -100;
      this.lastSprint = -100;
      this.lookup = 0;
      this.reliefBlink = 0;
      this.landing = 0;
      this.earBounce = 0;
      this.contacts = new Map();
      this.rageUntil = -100;
      this.privacy = false;
      this.anonUntil = -100;
      this.anonStart = t;
      this.nuzzle = 0;
      this.nuzzleUntil = -100;
      this.petTrail = null;
      this.petDistance = 0;
      this.lastErase = -100;
      this.grab = 0;
      this.mouseUntil = -1;
      this.helloUntil = -1;
      this.timestamps = [];
      this.held = new Map();
      this.kps = 0;
      this.drive = 0;
      this.rage = 0;
      this.sleep = 0;
      this.hello = 0;
      this.lastShift = -10;
      this.lastRepeat = -10;
      this.lastMouse = null;
      this.lastMouseAt = -100;
      this.mouseLean = 0;
      this.mouseOffset = [0, 0];
      this.buttons = 0;
      this.press = [0, 0, 0];
      this.pressUntil = [-1, -1, -1];
      this.scrollUntil = -1;
      this.scrollSign = 0;
      this.wheelTarget = this.wheelAngle = 0;
      this.lastSide = -1;
      this.lastSpaceSide = 1;
      this.sideCount = 0;
      this.balance = 0;
      this.hunt = 0;
      this.huntUntil = -100;
      this.tailBeat = 0;
      this.pique = 0;
      this.tailUntil = -100;
      this.frustration = 0;
      this.rageStart = -100;
      this.hits = [];
      this.hitSerial = 0;
      this.focus = [0, 0];
      this.cursor = [0, 0];
      this.cursorAt = -Infinity;
      this.cursorLook = 0;
      this.gaze = [0, 0];
      this.head = [0, 0];
      this.paws = rest.map((pos) => ({
        pos: { ...pos },
        from: { ...pos },
        dest: { ...pos },
        start: -10,
        duration: 0.12,
        linger: 0,
        code: null,
        lift: 0.24,
        returning: false,
      }));
    }
    setPrivacy(on, t) {
      if (Boolean(on) === this.privacy) return;
      this.reset(t);
      this.privacy = Boolean(on);
      this.step(t);
    }
    anonymous(t, level) {
      if (this.privacy) return;
      if (this.anonUntil < t) this.anonStart = t;
      this.anonLevel = level;
      this.anonUntil = t + 0.52;
      this.lastInput = t;
    }
    tapSide(side, t) {
      if (this.privacy) return;
      const p = this.paws[this.buttons || t < this.mouseUntil ? 1 - this.mouseSide : side];
      p.from = { ...p.pos };
      p.dest = V(p === this.paws[0] ? -.52 : .92, .27, 1.40);
      p.start = this.lastInput = t;
      p.duration = .105;
      p.linger = t + .17;
      p.code = null;
      p.lift = .25;
    }
    strokeHead(t) {
      if (this.privacy) return;
      this.nuzzleUntil = t + this.nuzzleDuration;
      this.greet(t);
    }
    beginPetting(point, t) {
      if (this.privacy) return;
      this.petTrail = point;
      this.petDistance = 0;
      this.strokeHead(t);
    }
    trackPetting(point, onHead, t) {
      if (!this.petTrail || this.privacy) return false;
      const dx = point[0] - this.petTrail[0], dy = point[1] - this.petTrail[1];
      this.petTrail = point;
      this.petDistance = onHead ? this.petDistance + Math.min(.08, Math.hypot(dx, dy)) : 0;
      if (this.petDistance < .115) return false;
      this.strokeHead(t);
      this.petDistance = 0;
      return true;
    }
    endPetting() {
      this.petTrail = null;
      this.petDistance = 0;
    }
    observeCursor(x, y, t) {
      if (this.privacy || !Number.isFinite(x + y)) return false;
      if (t - this.cursorAt < .28 && Math.hypot(x - this.cursor[0], y - this.cursor[1]) < .014) return false;
      this.cursor = [clamp(x, -1, 1), clamp(y, -1, 1)];
      this.cursorAt = t;
      return true;
    }
    leaveCursor(t) {
      this.cursorAt = Math.min(this.cursorAt, t - .53);
    }
    moveMouse(x, y, t, click = false) {
      if (this.privacy || !Number.isFinite(x + y)) return false;
      if (
        !click &&
        this.lastMouse &&
        Math.abs(x - this.lastMouse[0]) + Math.abs(y - this.lastMouse[1]) <
          0.006
      )
        return false;
      if (this.lastMouse && t - this.lastMouseAt < 0.25) {
        const travel = Math.hypot(x - this.lastMouse[0], y - this.lastMouse[1]);
        if (
          travel / Math.max(0.016, t - this.lastMouseAt) > 1.7 &&
          travel > 0.065
        )
          this.huntUntil = t + 0.6;
      }
      this.lastMouse = [x, y];
      this.mouseUntil = t + 1.22;
      this.lastMouseAt = t;
      this.lastInput = t;
      this.focus = [clamp(x, -1, 1), clamp(y, -1, 1)];
      return true;
    }
    setButtons(mask, t) {
      if (this.privacy) return;
      mask &= 7;
      if (mask === this.buttons) return;
      for (let i = 0; i < 3; i++) {
        const bit = 1 << i;
        if (mask & bit && !(this.buttons & bit)) this.pressUntil[i] = t + 0.13;
      }
      this.buttons = mask;
      this.lastInput = this.lastMouseAt = t;
      this.mouseUntil = t + 1.22;
    }
    scroll(steps, t) {
      if (this.privacy) return;
      if (!Number.isFinite(steps) || !steps) return;
      this.scrollSign = Math.sign(steps);
      this.scrollUntil = t + 0.32;
      this.wheelTarget =
        this.wheelAngle +
        clamp(this.wheelTarget - this.wheelAngle + steps * 0.8, -3, 3);
      this.lastInput = this.lastMouseAt = t;
      this.mouseUntil = t + 1.22;
    }
    greet(t) {
      if (this.privacy) return;
      this.helloUntil = t + this.greetingDuration;
      this.lastInput = t;
    }
    rate(t) {
      while (this.timestamps.length && t - this.timestamps[0] >= 1.25)
        this.timestamps.shift();
      return this.timestamps.length / 1.25;
    }
    aimAtKey(paw, key, side, t, duration, lift) {
      const offset = key.code === 'Space' ? key.width * (side ? 0.21 : -0.21) : 0;
      paw.from = { ...paw.pos };
      paw.dest = V(key.x + offset, keyPalmHeight, key.z);
      paw.start = t;
      paw.duration = duration;
      paw.lift = lift;
      paw.code = key.code;
      paw.linger = t + duration + 0.058;
      paw.returning = false;
    }
    strike(side, key, t, rage = false) {
      const p = this.paws[side];
      this.sideCount =
        this.lastSide === side && t - p.start < 0.47
          ? Math.min(5, this.sideCount + 1)
          : 1;
      this.lastSide = side;
      const speed = clamp(this.rate(t) / 8);
      this.aimAtKey(p, key, side, t, rage ? 0.074 : mix(0.11, 0.067, speed),
        rage ? 0.55 : mix(0.39, 0.15, speed));
      const at = t + p.duration;
      const previous = this.contacts.get(key.code);
      this.contacts.set(key.code, {
        at: previous && previous.at > t ? previous.at : at,
        released: Infinity,
      });
      this.hits.push({
        code: key.code,
        at,
        weight: rage ? 1.0 : mix(0.5, 0.79, speed),
        phase: ++this.hitSerial,
      });
      if (this.hits.length > 12) this.hits.shift();
    }
    down(code, t, repeat = false) {
      if (this.privacy) return;
      const k = this.layout.get(code);
      if (!k) return;
      if (this.held.has(code) || repeat) {
        if (code === 'Backspace' && this.held.has(code)) {
          this.rageUntil = Math.max(this.rageUntil, t + 0.78);
          this.lastInput = t;
        }
        return;
      }
      this.lastInput = this.lastStrike = t;
      if (code.startsWith('Shift')) {
        if (t - this.lastShift < 0.42) {
          this.greet(t);
          this.lastShift = -10;
        } else this.lastShift = t;
      } else this.lastShift = -10;
      this.timestamps.push(t);
      this.kps = this.rate(t);
      if (this.kps >= 6.4) this.lastSprint = t;
      const rage = code === 'Backspace';
      if (rage) {
        if (t - this.lastErase > 1.25) {
          this.rageStart = t;
          this.frustration = 0;
        }
        this.lastErase = t;
        this.frustration = Math.min(4, this.frustration + 1);
        this.tailUntil = t + [0, 0.38, 1.46, 3.55, 7.3][this.frustration];
        this.rageUntil = t + 1.04;
        this.lastRepeat = t;
      }
      if (!this.buttons && t - this.lastMouseAt > 0.24) this.mouseUntil = t;
      let side = k.side;
      if ((this.buttons || this.mouseUntil > t) && !rage) side = 1 - this.mouseSide;
      else if (code === 'Space') side = this.lastSpaceSide = 1 - this.lastSpaceSide;
      this.held.set(code, { at: t, side });
      this.strike(side, k, t, rage);
      this.focus = [k.x / 2, -0.72];
    }
    up(code, t) {
      if (this.privacy) return;
      if (!this.held.delete(code)) return;
      this.lastInput = t;
      const c = this.contacts.get(code);
      if (c) c.released = Math.max(c.at + 0.049, t);
    }
    keyDepth(code, t) {
      const c = this.contacts.get(code);
      if (!c || t < c.at) return 0;
      const down = ease((t - c.at) / 0.021);
      return down * (1 - ease((t - c.released) / 0.086));
    }
    keyContact(paw, t) {
      if (this.privacy || !paw.code) return null;
      const { pos, dest } = paw;
      const distance = Math.hypot(pos.x - dest.x, pos.y - dest.y, pos.z - dest.z);
      const weight = 1 - ease((distance - 0.018) / 0.14);
      return weight > 0 ? { weight, depth: this.keyDepth(paw.code, t) } : null;
    }
    idleFrameRate(t) {
      if (
        this.held.size ||
        this.buttons ||
        t - this.lastInput < 2.2 ||
        t < this.tailUntil + 0.6
      )
        return 0;
      if (this.sleep > .97 || this.privacy) return 12;
      if (this.cursorLook > .02 || (this.sleep < .35 && t - this.cursorAt < .6)) return 28;
      return 20;
    }
    step(t, inputStillHeld = false) {
      // The studio confirms live key and pointer holds across a slow renderer switch.
      // Blur, visibility loss and privacy entry still perform an explicit reset.
      if (t < this.t || (t - this.t > 2.5 && !inputStillHeld)) {
        const protectedField = this.privacy;
        this.reset(t);
        this.privacy = protectedField;
      }
      if (this.privacy) {
        this.t = t;
        this.mode = 'private';
        return this;
      }
      const dt = clamp(t - this.t, 0, 0.12);
      this.t = t;
      this.kps = this.rate(t);
      const anonymous = t < this.anonUntil;
      const active = this.held.size > 0 || t - this.lastStrike < 0.48;
      const targetDrive = anonymous
        ? 0.28 * this.anonLevel
        : active
          ? clamp((this.kps - 1) / 7)
          : 0;
      this.drive = smooth(
        this.drive,
        targetDrive,
        targetDrive > this.drive ? 12 : 5,
        dt
      );
      this.rage = smooth(
        this.rage,
        t < this.rageUntil ? [0, 0.24, 0.66, 0.88, 1][this.frustration] : 0,
        t < this.rageUntil ? 24 : 7,
        dt
      );
      this.hello = smooth(this.hello, Number(t < this.helloUntil), 7, dt);
      this.sleep = smooth(
        this.sleep,
        !this.held.size && !this.buttons
          ? ease((t - this.lastInput - this.sleepAfter) / 2.5)
          : 0,
        5,
        dt
      );
      const heldErase = this.held.get('Backspace')?.at;
      if (heldErase !== undefined && t - heldErase >= 0.28) {
        this.frustration = Math.max(
          this.frustration,
          t - heldErase > 0.49 ? 4 : 2
        );
        this.lastErase = t;
      }
      if (
        heldErase !== undefined &&
        t - heldErase >= 0.3 &&
        t - this.lastRepeat > 0.166
      ) {
        const erase = this.layout.get('Backspace');
        this.strike(erase.side, erase, t, true);
        this.lastRepeat = t;
        this.rageUntil = t + 0.75;
        this.tailUntil = Math.max(
          this.tailUntil,
          t + (this.frustration >= 4 ? 7.3 : 1.45)
        );
      }
      if (this.lastMouse) {
        this.mouseOffset[0] = smooth(
          this.mouseOffset[0],
          0.26 * clamp(this.lastMouse[0], -1, 1),
          12,
          dt
        );
        this.mouseOffset[1] = smooth(
          this.mouseOffset[1],
          -0.19 * clamp(this.lastMouse[1], -1, 1),
          12,
          dt
        );
      }
      const pointer =
        (this.buttons !== 0 || t < this.mouseUntil) &&
        !this.held.has('Backspace');
      for (let i = 0; i < 3; i++) {
        const target =
          Boolean(this.buttons & (1 << i)) || t < this.pressUntil[i];
        this.press[i] = smooth(
          this.press[i],
          Number(target),
          target ? 34 : 19,
          dt
        );
      }
      this.wheelAngle = smooth(this.wheelAngle, this.wheelTarget, 12, dt);
      const age = t - this.lastStrike;
      const sideBias = this.lastSide === 1 ? 1 : -1;
      this.balance = smooth(
        this.balance,
        sideBias *
          Math.min(1, this.sideCount / 3) *
          (1 - ease((age - 0.13) / 0.44)),
        14,
        dt
      );
      this.grab = smooth(
        this.grab,
        Number(this.buttons !== 0 && pointer),
        9,
        dt
      );
      this.nuzzle = smooth(this.nuzzle, Number(t < this.nuzzleUntil), 8, dt);
      this.hunt = smooth(
        this.hunt,
        Number(t < this.huntUntil && pointer),
        t < this.huntUntil ? 14 : 5,
        dt
      );
      this.mouseLean = smooth(
        this.mouseLean,
        Number(
          pointer && (this.buttons !== 0 || this.lastMouseAt >= this.lastStrike)
        ),
        pointer ? 9 : 7,
        dt
      );
      const beat = Math.max(
        0,
        Math.cos(((t - this.rageStart - 0.16) * 2 * Math.PI) / 0.54)
      );
      this.pique = smooth(
        this.pique,
        t < this.tailUntil
          ? [0, 0.08, 0.48, 0.8, 1][this.frustration] *
              ease((this.tailUntil - t) / 0.38)
          : 0,
        t < this.tailUntil ? 20 : 6,
        dt
      );
      this.tailBeat = beat ** 2 * this.pique;
      this.hits = this.hits.filter((h) => t - h.at < 0.58);
      for (const [code, c] of this.contacts)
        if (t > c.released + 0.09) this.contacts.delete(code);
      // The shoulder compresses on contact. The ears follow one beat later.
      this.landing = 0;
      for (const hit of this.hits) {
        const elapsed = t - hit.at;
        if (elapsed < 0 || elapsed > 0.19) continue;
        const pulse =
          ease(elapsed / 0.032) * (1 - ease((elapsed - 0.032) / 0.15));
        this.landing = Math.max(this.landing, hit.weight * pulse);
      }
      this.earBounce = smooth(this.earBounce, this.landing, 11, dt);
      const quiet = t - this.lastInput;
      const catchingBreath =
        this.held.size === 0 &&
        !pointer &&
        this.lastSprint === this.lastStrike &&
        t - this.lastSprint < 1.8 &&
        t > this.rageUntil &&
        t > this.helloUntil;
      this.reliefBlink = catchingBreath
        ? ease((quiet - 0.79) / 0.064) * (1 - ease((quiet - 0.854) / 0.14))
        : 0;
      const lift = catchingBreath
        ? ease((quiet - 0.19) / 0.25) * (1 - ease((quiet - 0.72) / 0.47))
        : 0;
      this.lookup = smooth(this.lookup, lift, lift > this.lookup ? 20 : 12, dt);
      const busy = active ? this.drive : 0;
      const heldBySide = [null, null];
      for (const [code, { side }] of this.held) heldBySide[side] = this.layout.get(code);
      for (let i = 0; i < 2; i++) {
        const p = this.paws[i];
        const onMouse = pointer && i === this.mouseSide;
        const heldKey = onMouse ? null : heldBySide[i];
        if (heldKey && t >= p.linger && (p.returning || p.code !== heldKey.code))
          this.aimAtKey(p, heldKey, i, t, 0.105, 0.21);
        const u = clamp((t - p.start) / p.duration);
        const release = this.contacts.get(p.code)?.released ?? -Infinity;
        const rebound = !heldKey && !onMouse && release < Infinity && t < release + 0.055;
        if (u < 1) {
          const a = ease(u);
          p.pos = V(
            mix(p.from.x, p.dest.x, a),
            mix(p.from.y, p.dest.y, a) + Math.sin(Math.PI * u) * p.lift,
            mix(p.from.z, p.dest.z, a)
          );
        } else if (
          t < p.linger ||
          heldKey?.code === p.code || rebound
        ) {
          p.pos = { ...p.dest };
        } else {
          p.returning = true;
          const a = rest[i];
          const hover = clamp((0.61 - (t - this.lastStrike)) / 0.31);
          let point = V(
            a.x + (i ? 1 : -1) * 0.12 * hover,
            a.y + (0.73 - 0.2 * busy) * hover,
            a.z + 0.19 * hover
          );
          if (onMouse) {
            const [left, right, middle] = this.press;
            const rolling =
              t < this.scrollUntil ? Math.sin(this.wheelAngle * 3) * 0.052 : 0;
            point = V(
              mouseX(this.mouseSide, this.compact) + this.mouseOffset[0] + 0.14 * (left - right),
              0.32 - 0.085 * Math.max(left, right, middle),
              1.81 + this.mouseOffset[1] + 0.11 * middle + rolling
            );
          } else if (this.rage > 0.22 && i === 1)
            point = V(-0.42, 0.4 + 0.22 * Math.sin(t * 21) ** 2, 1.04);
          else if (t - p.start < 0.18 && p.code)
            point = V(p.dest.x, p.dest.y + 0.2 - 0.11 * busy, p.dest.z);
          if (!pointer && i !== this.lastSide && this.sideCount >= 2) {
            const tuck = Math.abs(this.balance);
            point.x -= (i ? 1 : -1) * 0.21 * tuck;
            point.y += 0.28 * tuck;
            point.z -= 0.13 * tuck;
          }
          for (const axis of ['x', 'y', 'z'])
            p.pos[axis] = smooth(p.pos[axis], point[axis], 16, dt);
        }
      }
      if (anonymous) {
        for (let i = 0; i < 2; i++) {
          const wave =
            (1 +
              Math.cos(
                (t - this.anonStart) * (11 + 3 * this.anonLevel) + i * Math.PI
              )) /
            2;
          this.paws[i].pos = V(
            i ? 0.91 : -0.46,
            0.34 + 0.24 * wave,
            1.4 + 0.07 * wave
          );
        }
      }
      // Let the eyes linger at the mouse as the paws settle. Then release the
      // gaze gradually, so a resting cat does not snap back to a forward stare.
      const mouseWasLast = this.lastMouse && this.lastMouseAt >= this.lastStrike;
      const attention = 1 - ease((quiet - 1.8) / (mouseWasLast ? 2.4 : 0.65));
      const target = [
        mix(0.17 * Math.sin(t * 0.71), this.focus[0], attention),
        mix(0.10 * Math.sin(t * 0.83), this.focus[1], attention),
      ];
      const f = [
        mix(target[0], 0, this.lookup),
        mix(target[1], 0.96, this.lookup),
      ];
      // Passive cursor tracking leaves the desk, paws, and sleep timer alone.
      const following = !anonymous && !active && !pointer && this.sleep < .35
        ? (1 - ease((t - this.cursorAt - .50) / .72)) * (1 - ease(this.sleep / .35)) * (1 - .82 * this.lookup)
        : 0;
      this.cursorLook = smooth(this.cursorLook, following, following > this.cursorLook ? 15 : 8, dt);
      for (let i = 0; i < 2; i++) {
        this.gaze[i] = smooth(this.gaze[i], mix(f[i], this.cursor[i], following * .92), 18, dt);
        this.head[i] = smooth(this.head[i], this.gaze[i], 6, dt);
      }
      this.mode = anonymous
        ? 'anonymous'
        : this.rage > 0.18 && this.frustration >= 2
          ? 'rage'
          : this.rage > 0.085 && this.frustration === 1
            ? 'glance'
            : this.hello > 0.48
              ? 'hello'
              : this.sleep > 0.6
                ? 'sleep'
                : active
                  ? this.kps >= 6.4
                    ? 'fast'
                    : this.kps >= 3.2
                      ? 'steady'
                      : 'slow'
                  : pointer
                    ? 'mouse'
                    : 'idle';
      return this;
    }
  }
  const api = { Motion, layout, paperLayout, paperDesk, clamp, ease, mix, mouseX, keyPalmHeight };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PawMotion = api;
})(globalThis);
