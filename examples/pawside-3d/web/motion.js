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
  const V = (x, y, z) => ({ x, y, z }),
    rest = [V(-0.43, 0.145, 0.56), V(0.13, 0.145, 0.56)];
  class Motion {
    constructor(profile = 'ink') {
      this.profile = profile;
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
    strokeHead(t) {
      if (this.privacy) return;
      this.nuzzleUntil = t + 0.85;
      this.greet(t);
    }
    moveMouse(x, y, t, click = false) {
      if (this.privacy) return;
      if (!Number.isFinite(x + y)) return;
      if (
        !click &&
        this.lastMouse &&
        Math.abs(x - this.lastMouse[0]) + Math.abs(y - this.lastMouse[1]) <
          0.006
      )
        return;
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
      this.helloUntil = t + 1.65;
      this.lastInput = t;
    }
    rate(t) {
      while (this.timestamps.length && t - this.timestamps[0] >= 1.25)
        this.timestamps.shift();
      return this.timestamps.length / 1.25;
    }
    strike(side, key, t, rage = false) {
      const p = this.paws[side];
      this.sideCount =
        this.lastSide === side && t - p.start < 0.47
          ? Math.min(5, this.sideCount + 1)
          : 1;
      this.lastSide = side;
      p.from = { ...p.pos };
      p.dest = V(key.x, 0.239, key.z);
      p.start = t;
      const speed = clamp(this.rate(t) / 8);
      p.duration = rage ? 0.074 : mix(0.11, 0.067, speed);
      p.lift = rage ? 0.55 : mix(0.39, 0.15, speed);
      p.code = key.code;
      p.linger = t + p.duration + 0.058;
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
      const k = layout.get(code);
      if (!k) return;
      if (this.held.has(code) || repeat) {
        if (code === 'Backspace' && this.held.has(code)) {
          this.rageUntil = Math.max(this.rageUntil, t + 0.78);
          this.lastInput = t;
        }
        return;
      }
      this.held.set(code, t);
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
      const side = (this.buttons || this.mouseUntil > t) && !rage ? 1 : k.side;
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
    idleFrameRate(t) {
      if (
        this.held.size ||
        this.buttons ||
        t - this.lastInput < 2.2 ||
        t < this.tailUntil + 0.6
      )
        return 0;
      return this.sleep > 0.97 ? 12 : 30;
    }
    step(t) {
      if (t < this.t || t - this.t > 2.5) {
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
          ? ease((t - this.lastInput - 25) / 2.5)
          : 0,
        5,
        dt
      );
      const heldErase = this.held.get('Backspace');
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
        this.strike(
          layout.get('Backspace').side,
          layout.get('Backspace'),
          t,
          true
        );
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
      for (let i = 0; i < 2; i++) {
        const p = this.paws[i],
          u = clamp((t - p.start) / p.duration);
        if (u < 1) {
          const a = ease(u);
          p.pos = V(
            mix(p.from.x, p.dest.x, a),
            mix(p.from.y, p.dest.y, a) + Math.sin(Math.PI * u) * p.lift,
            mix(p.from.z, p.dest.z, a)
          );
        } else if (
          t < p.linger ||
          (p.code && this.held.has(p.code) && !(pointer && i === 0))
        ) {
          p.pos = { ...p.dest };
        } else {
          const a = rest[i];
          const hover = clamp((0.61 - (t - this.lastStrike)) / 0.31);
          let point = V(
            a.x + (i ? 1 : -1) * 0.12 * hover,
            a.y + (0.73 - 0.2 * busy) * hover,
            a.z + 0.19 * hover
          );
          if (pointer && i === 0) {
            const [left, right, middle] = this.press;
            const rolling =
              t < this.scrollUntil ? Math.sin(this.wheelAngle * 3) * 0.052 : 0;
            point = V(
              -2.32 + this.mouseOffset[0] + 0.14 * (left - right),
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
      const target =
        t - this.lastInput < 2
          ? this.focus
          : [0.17 * Math.sin(t * 0.71), 0.1 * Math.sin(t * 0.83)];
      const f = [
        mix(target[0], 0, this.lookup),
        mix(target[1], 0.96, this.lookup),
      ];
      for (let i = 0; i < 2; i++) {
        this.gaze[i] = smooth(this.gaze[i], f[i], 18, dt);
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
  const api = { Motion, layout, clamp, ease, mix };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PawMotion = api;
})(globalThis);
