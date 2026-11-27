'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Motion, layout } = require('../web/motion.js');
function tick(m, end) {
  for (let t = m.t + 1 / 120; t < end; t += 1 / 120) m.step(t);
  m.step(end);
}
function typing(interval, count) {
  const m = new Motion();
  for (let i = 0; i < count; i++) {
    const t = i * interval,
      code = i % 2 ? 'KeyJ' : 'KeyA';
    tick(m, t);
    m.down(code, t);
    tick(m, t + 0.04);
    m.up(code, t + 0.04);
  }
  return m;
}
test('speed changes expression, travel time and paw height', () => {
  const slow = typing(0.61, 7),
    steady = typing(0.22, 10),
    fast = typing(0.1, 20);
  assert.deepEqual(
    [slow.mode, steady.mode, fast.mode],
    ['slow', 'steady', 'fast']
  );
  for (const param of ['duration', 'lift']) {
    assert.ok(slow.paws[1][param] > steady.paws[1][param]);
    assert.ok(steady.paws[1][param] > fast.paws[1][param]);
  }
  assert.ok(fast.drive > 0.9);
});
test('one long normal key stays on its own cap and does not inflate speed', () => {
  const m = new Motion();
  m.down('KeyA', 0);
  for (let i = 1; i <= 20; i++) {
    m.down('KeyA', i * 0.05, true);
    m.step(i * 0.05);
  }
  assert.equal(m.kps, 0.8);
  const k = layout.get('KeyA');
  assert.equal(m.paws[k.side].pos.x, k.x);
  assert.equal(m.paws[k.side].pos.z, k.z);
  m.up('KeyA', 1.01);
  tick(m, 2.5);
  assert.equal(m.mode, 'idle');
  assert.equal(m.kps, 0);
});
test('first Backspace draws a glance; holding escalates and release settles', () => {
  const m = typing(0.1, 20),
    start = 2;
  tick(m, start);
  m.down('Backspace', start);
  tick(m, 2.08);
  assert.equal(m.mode, 'glance');
  const side = layout.get('Backspace').side;
  const first = m.paws[side].start;
  tick(m, 4);
  assert.ok(m.paws[side].start > first + 1.6);
  assert.equal(m.mode, 'rage');
  m.up('Backspace', 4);
  tick(m, 5.7);
  assert.equal(m.mode, 'idle');
  assert.equal(m.kps, 0);
});
test('opposite key banks select different paws, including simultaneous chords', () => {
  const m = new Motion();
  m.down('KeyA', 0);
  m.down('KeyJ', 0);
  tick(m, 0.3);
  assert.ok(layout.get('KeyA').side !== layout.get('KeyJ').side);
  assert.deepEqual(
    new Set(m.paws.map((p) => p.code)),
    new Set(['KeyA', 'KeyJ'])
  );
});
test('double shift, sleep, wake and focus reset recover', () => {
  const m = new Motion();
  m.down('ShiftLeft', 0);
  m.up('ShiftLeft', 0.08);
  m.down('ShiftRight', 0.23);
  m.up('ShiftRight', 0.29);
  tick(m, 0.42);
  assert.equal(m.mode, 'hello');
  tick(m, 30);
  assert.equal(m.mode, 'sleep');
  m.down('KeyK', 30);
  tick(m, 30.45);
  assert.equal(m.mode, 'slow');
  m.reset(31);
  m.step(31);
  assert.equal(m.mode, 'idle');
  assert.equal(m.held.size, 0);
});
test('pointer reserves one paw for the mouse, Backspace still takes its own key', () => {
  const m = new Motion();
  m.moveMouse(0.5, 0.5, 0, true);
  m.down('KeyJ', 0.02);
  tick(m, 0.35);
  assert.ok(Math.abs(m.paws[0].pos.x + 2.32 - m.mouseOffset[0]) < 0.08);
  assert.equal(m.paws[1].code, 'KeyJ');
  m.down('Backspace', 0.36);
  tick(m, 0.45);
  assert.equal(m.mode, 'glance');
  assert.equal(m.paws[layout.get('Backspace').side].code, 'Backspace');
});

test('cursor motion dilates pupils briefly and the glance leads the neck', () => {
  const m = new Motion();
  m.moveMouse(-0.4, 0, 0);
  tick(m, 0.05);
  m.moveMouse(0.7, 0.7, 0.05);
  tick(m, 0.12);
  assert.ok(m.hunt > 0.45);
  assert.ok(m.gaze[1] > m.head[1]);
  tick(m, 2.0);
  assert.ok(m.hunt < 0.01);
});
test('short Backspace lands with a label and leaves only a small tail flick', () => {
  const m = new Motion();
  m.down('Backspace', 0);
  assert.equal(m.hits.length, 1);
  assert.ok(m.hits[0].at > 0);
  tick(m, 0.16);
  assert.ok(m.tailBeat > 0.02 && m.tailBeat < 0.15);
  m.up('Backspace', 0.16);
  tick(m, 1.9);
  assert.equal(m.hits.length, 0);
  assert.ok(m.tailBeat < 0.06);
});

test('mouse chord retains the held side after the other lifts and keeps the paw during typing', () => {
  const m = new Motion();
  m.setButtons(1, 0);
  tick(m, 0.2);
  m.setButtons(3, 0.2);
  tick(m, 0.4);
  assert.ok(m.press[0] > 0.95 && m.press[1] > 0.95);
  m.setButtons(2, 0.4);
  tick(m, 2);
  assert.ok(m.press[0] < 0.01 && m.press[1] > 0.99);
  m.down('KeyJ', 2.01);
  tick(m, 2.25);
  assert.equal(m.paws[1].code, 'KeyJ');
  assert.ok(m.paws[0].pos.x < -2.4);
  assert.ok(m.mouseLean > 0.95);
  m.setButtons(0, 2.25);
  m.up('KeyJ', 2.25);
  tick(m, 4.2);
  assert.ok(m.press.every((v) => v < 0.01));
  assert.equal(m.mode, 'idle');
});
test('short middle click stays visible and wheel reverses without unrelated presses', () => {
  const m = new Motion();
  m.setButtons(4, 0.001);
  m.setButtons(0, 0.011);
  tick(m, 0.08);
  assert.ok(m.press[2] > 0.8 && m.press[0] === 0);
  m.scroll(-1, 0.1);
  tick(m, 0.38);
  assert.ok(m.wheelAngle < -0.6);
  const prev = m.wheelAngle;
  m.scroll(1, 0.39);
  tick(m, 0.65);
  assert.ok(m.wheelAngle > prev + 0.65);
  m.reset(1);
  assert.deepEqual(m.press, [0, 0, 0]);
  assert.equal(m.wheelAngle, 0);
});
test('repeated keys in one bank tuck the free paw then settle smoothly', () => {
  const m = new Motion();
  for (let j = 0; j < 5; j++) {
    const t = j * 0.15,
      code = j % 2 ? 'KeyS' : 'KeyD';
    tick(m, t);
    m.down(code, t);
    tick(m, t + 0.08);
    m.up(code, t + 0.08);
  }
  const side = layout.get('KeyS').side,
    idle = 1 - side;
  assert.ok(Math.abs(m.balance) > 0.8);
  assert.ok(m.paws[idle].pos.y > 0.86);
  const end = m.paws[idle].pos.y;
  tick(m, 0.77);
  assert.ok(m.paws[idle].pos.y > end - 0.13);
  tick(m, 1.8);
  assert.ok(Math.abs(m.balance) < 0.01 && m.paws[idle].pos.y < 0.16);
});

test('key contacts survive same-bank overlap and release after a visible short tap', () => {
  const m = new Motion();
  m.down('KeyA', 0);
  m.up('KeyA', 0.012);
  m.down('KeyS', 0.035);
  tick(m, 0.07);
  assert.equal(m.keyDepth('KeyA', 0.07), 0);
  tick(m, 0.145);
  assert.ok(m.keyDepth('KeyA', 0.145) > 0.9);
  assert.ok(m.keyDepth('KeyS', 0.145) > 0.35);
  tick(m, 0.35);
  assert.equal(m.keyDepth('KeyA', 0.35), 0);
  assert.equal(m.keyDepth('KeyS', 0.35), 1);
  m.up('KeyS', 0.36);
  tick(m, 0.402);
  assert.ok(m.keyDepth('KeyS', 0.402) > 0 && m.keyDepth('KeyS', 0.402) < 1);
  tick(m, 0.5);
  assert.equal(m.contacts.size, 0);
});
test('release returns the paw to a previous held key without generating another strike', () => {
  const m = new Motion();
  const first = layout.get('KeyA'), second = layout.get('KeyS');
  assert.equal(first.side, second.side);
  m.down(first.code, 0);
  tick(m, 0.2);
  m.down(second.code, 0.2);
  tick(m, 0.41);
  const paw = m.paws[first.side], serial = m.hitSerial;
  assert.equal(paw.pos.x, second.x);
  m.up(second.code, 0.41);
  tick(m, 0.57);
  assert.equal(paw.pos.x, first.x);
  assert.equal(paw.pos.z, first.z);
  assert.equal(m.keyDepth(first.code, m.t), 1);
  assert.equal(m.hitSerial, serial);
  m.up(first.code, 0.57);
  tick(m, 0.61);
  const contact = m.keyContact(paw, m.t);
  assert.equal(contact.weight, 1);
  assert.ok(contact.depth < 1 && contact.depth > 0);
  tick(m, 0.78);
  assert.equal(m.keyContact(paw, m.t), null);
});

test('space uses alternating ends of the cap, reserving a paw when gripping the mouse', () => {
  const m = new Motion();
  const space = layout.get('Space');
  m.down(space.code, 0);
  tick(m, 0.19);
  assert.ok(m.paws[0].pos.x < space.x);
  m.up(space.code, 0.19);
  m.down(space.code, 0.27);
  tick(m, 0.45);
  assert.ok(m.paws[1].pos.x > space.x);
  m.up(space.code, 0.45);
  m.setButtons(1, 0.55);
  tick(m, 0.69);
  m.down(space.code, 0.69);
  tick(m, 0.9);
  assert.ok(m.paws[0].pos.x < -2);
  assert.ok(m.paws[1].pos.x > space.x);
  assert.equal(m.keyContact(m.paws[1], m.t).depth, 1);
});

test('a sprint followed by quiet lifts the gaze once, new input cancels it', () => {
  const m = typing(0.095, 20);
  tick(m, 2.35);
  assert.ok(m.lookup > 0.75 && m.gaze[1] > 0.35);
  m.down('KeyA', 2.36);
  tick(m, 2.57);
  assert.ok(m.lookup < 0.11);
  m.up('KeyA', 2.58);
  tick(m, 4.0);
  assert.ok(m.lookup < 0.02);
  const slow = typing(0.65, 3);
  tick(slow, 1.96);
  assert.equal(slow.lookup, 0);
});
test('ears follow a real landing and a paused clock resets transient poses', () => {
  const m = new Motion();
  m.down('KeyF', 0);
  const at = m.hits[0].at;
  tick(m, at - 0.01);
  assert.equal(m.landing, 0);
  tick(m, at + 0.04);
  assert.ok(m.landing > 0.42 && m.earBounce < m.landing);
  tick(m, at + 0.21);
  assert.ok(m.landing === 0 && m.earBounce > 0.02);
  m.step(4);
  assert.equal(m.contacts.size, 0);
  assert.equal(m.earBounce, 0);
});

test('quiet and sleeping pets render less, input and residual tail motion wake rendering', () => {
  const m = new Motion();
  tick(m, 4);
  assert.equal(m.idleFrameRate(4), 20);
  tick(m, 30);
  assert.equal(m.idleFrameRate(30), 12);
  m.setButtons(2, 30);
  assert.equal(m.idleFrameRate(30), 0);
  tick(m, 33);
  assert.equal(m.idleFrameRate(33), 0);
  m.setButtons(0, 33);
  m.down('Backspace', 33.1);
  tick(m, 35.7);
  m.up('Backspace', 35.7);
  tick(m, 38);
  assert.equal(m.idleFrameRate(38), 0);
  tick(m, 44);
  assert.equal(m.idleFrameRate(44), 20);
});

test('both profiles complete every timed checkpoint in the reference score', () => {
  const { rehearse } = require('./rehearse.cjs');
  assert.deepEqual(rehearse('ink'), rehearse('chestnut'));
});
test('protected focus immediately erases previous keys, contact and speed, including after a clock gap', () => {
  const m = typing(0.1, 10);
  m.setPrivacy(true, 1);
  m.down('Backspace', 1.1);
  m.anonymous(1.2, 3);
  m.strokeHead(1.3);
  m.step(5);
  assert.equal(m.mode, 'private');
  assert.equal(m.held.size + m.contacts.size + m.hits.length + m.kps, 0);
  assert.equal(
    m.paws.every((p) => p.code === null),
    true
  );
  m.setPrivacy(false, 5.1);
  m.down('KeyF', 5.2);
  tick(m, 5.4);
  assert.equal(m.mode, 'slow');
});
test('anonymous rhythm uses free-space paw motion and never activates an actual key', () => {
  const m = new Motion();
  m.anonymous(0, 2);
  tick(m, 0.18);
  assert.equal(m.mode, 'anonymous');
  assert.equal(m.hits.length + m.held.size + m.contacts.size, 0);
  tick(m, 0.9);
  assert.equal(m.mode, 'idle');
});
test('a second erase escalates, sustained erase persists into mouse motion, rubbing relaxes', () => {
  const m = new Motion();
  m.down('Backspace', 0);
  m.up('Backspace', 0.09);
  m.down('Backspace', 0.3);
  tick(m, 0.42);
  assert.equal(m.frustration, 2);
  tick(m, 0.84);
  assert.equal(m.frustration, 4);
  m.up('Backspace', 0.86);
  m.moveMouse(-0.66, -0.32, 0.9, true);
  tick(m, 1.4);
  assert.ok(m.mouseLean > 0.9 && m.pique > 0.9);
  m.strokeHead(1.42);
  tick(m, 1.7);
  assert.ok(m.nuzzle > 0.7);
});

test('a live key survives a renderer stall and releases on the original cap', () => {
  const m = new Motion();
  m.down('KeyA', 0);
  m.step(.2);
  m.step(3.2, true);
  assert.equal(m.held.has('KeyA'), true);
  assert.equal(m.keyDepth('KeyA', 3.2), 1);
  m.up('KeyA', 3.21);
  m.step(3.4);
  assert.equal(m.held.size, 0);
  assert.equal(m.keyDepth('KeyA', 3.4), 0);
});

test('hover follows independently of hands, typing and the sleep countdown', () => {
  const m = new Motion('ink', { sleepAfter: 5 });
  tick(m, 3);
  assert.equal(m.observeCursor(.8, .6, 3), true);
  assert.equal(m.observeCursor(.804, .603, 3.01), false);
  tick(m, 3.3);
  assert.equal(m.mode, 'idle');
  assert.ok(m.gaze[0] > .60 && m.gaze[1] > .40);
  assert.ok(m.cursorLook > .8);
  assert.equal(m.idleFrameRate(3.3), 28);
  assert.equal(m.mouseLean, 0);
  assert.equal(m.lastInput, 0);
  assert.ok(m.paws.every(paw => paw.code === null));

  m.down('KeyF', 3.35);
  tick(m, 3.55);
  assert.equal(m.mode, 'slow');
  assert.ok(m.cursorLook < .25);
  assert.notEqual(m.gaze[0], .8);
  m.up('KeyF', 3.6);
  m.leaveCursor(3.62);
  tick(m, 4.45);
  assert.ok(m.cursorLook < .02);
  m.setPrivacy(true, 4.5);
  assert.equal(m.observeCursor(.8, .6, 4.6), false);
  assert.deepEqual(m.cursor, [0, 0]);

  const sleepy = new Motion('ink', { sleepAfter: 3 });
  for (let t = .1; t <= 8; t += .1) {
    sleepy.observeCursor(Math.sin(t * 8), .1, t);
    sleepy.step(t);
  }
  assert.equal(sleepy.lastInput, 0);
  assert.equal(sleepy.mode, 'sleep');
  assert.equal(sleepy.idleFrameRate(8), 12);
});

test('rubbing extends petting only while a captured pointer stays on the head', () => {
  const m = new Motion();
  m.beginPetting([0, .2], 1);
  const firstExpiry = m.nuzzleUntil;
  assert.equal(m.trackPetting([.07, .2], true, 1.1), false);
  assert.equal(m.trackPetting([.16, .2], false, 1.2), false);
  assert.equal(m.trackPetting([.10, .2], true, 1.3), false);
  assert.equal(m.trackPetting([.02, .2], true, 1.4), true);
  assert.ok(m.nuzzleUntil > firstExpiry);
  m.endPetting();
  assert.equal(m.trackPetting([.18, .2], true, 1.5), false);
});
