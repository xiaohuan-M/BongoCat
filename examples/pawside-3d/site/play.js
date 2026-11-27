'use strict';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const clock = () => performance.now() / 1000;
const { Motion, layout } = PawMotion;
const { preset, normalize, paletteFromFur, temperaments } = PawLooks;
const names = {
  idle: '待机', slow: '慢敲', steady: '连打', fast: '飞速打字',
  glance: '看退格', rage: '退格暴走', hello: '回应你', sleep: '打盹', mouse: '握鼠标',
};
const modes = $$('.style-card');
const controls = new Map($$('[data-key]').map(button => [button.dataset.key, button]));
const play = $('#play');
const surface = $('#play-canvas');
const stage = $('#play-stage');
const state = $('#action-state');
const cast = $('#cast');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const supportsCanvas = Boolean(surface.querySelector('canvas').getContext('2d'));

if (supportsCanvas) start();

function start() {
  const motion = new Motion();
  const view = createView(surface);
  const edits = new Map();
  const picks = { volume: 'ink', pixel: 'creamcoon' };
  const pressed = new Map();
  const pointerInputs = new Map();
  const facePanel = $('#face-panel');
  const faceSurface = $('#face-canvas');
  const headInput = $('#head');
  const earInput = $('#ear');
  const furInput = $('#fur');
  let mode = 'paper', current, art, face, faceMotion, faceVisible = false;
  let faceRequest = 0, editorFallback = false;
  let active = true, mousePointer, rubPointer, volumeReady;
  let styleRequest = 0, lastLabel = '';
  const frames = PawFrames.createFrameLoop(() => draw(clock()), () => motion.idleFrameRate(clock()));
  const editableMode = () => mode === 'paper' ? 'volume' : mode;
  const editorMode = () => editorFallback ? 'pixel' : editableMode();

  function createView(container) {
    const [flat, volume] = container.querySelectorAll('canvas');
    return new PawDrawing.StudioView(flat, volume);
  }

  function resize(part, container) {
    if (container.clientWidth && container.clientHeight)
      part.resize(container.clientWidth, container.clientHeight);
  }

  function skin() {
    const edit = edits.get(current.key) || {};
    const coat = edit.fur ? { ...current.coat, ...paletteFromFur(edit.fur) } : current.coat;
    const form = { ...current.form };
    if (edit.head != null) form.headWidth = edit.head / 100;
    if (edit.ear != null) form.earLength = edit.ear / 100;
    return { coat, form };
  }

  async function redrawFace() {
    if (!faceVisible) return;
    const request = ++faceRequest;
    let target = editorMode();
    if (target === 'volume') {
      try { await loadVolume(); }
      catch {
        if (request !== faceRequest) return;
        editorFallback = true;
        target = 'pixel';
      }
      if (request !== faceRequest || !faceVisible) return;
    }
    if (!face) {
      face = createView(faceSurface);
      face.inspect('face');
      faceMotion = new Motion(current.pet);
      faceMotion.reset(0);
    }
    if (face.mode !== target && !face.setStyle(target)) {
      editorFallback = true;
      face.setStyle('pixel');
    }
    facePanel.dataset.ink = face.mode;
    face.skin(current.pet, art);
    face.select(current.pet);
    resize(face, faceSurface);
    face.render(faceMotion, .1);
    faceSurface.classList.add('is-ready');
    updateControls();
  }

  function updateControls() {
    const { coat, form } = normalize(current.pet, art);
    headInput.value = Math.round(form.headWidth * 100);
    earInput.value = Math.round(form.earLength * 100);
    $('#head-value').value = headInput.value + '%';
    $('#ear-value').value = earInput.value + '%';
    furInput.value = coat.fur;
    const query = new URLSearchParams({ preset: current.key, style: editorMode() });
    const edit = edits.get(current.key);
    if (edit) {
      for (const [key, value] of Object.entries(edit)) query.set(key, value);
    }
    $('#continue-studio').href = 'studio/?' + query;
  }

  function redrawLook() {
    art = skin();
    view.skin(current.pet, art);
    view.select(current.pet);
    updateControls();
    redrawFace();
    draw(clock());
  }

  function applyCast() {
    cast.value = picks[editableMode()];
    current = preset.find(item => item.key === cast.value);
    const fixed = mode === 'paper';
    cast.closest('label').hidden = fixed;
    $('#cast-title').textContent = fixed ? Paw2D.pet.name : current.name;
    $('#cast-breed').textContent = fixed ? '2D' : current.breed;
    $('#face-title').textContent = current.name;
    motion.profile = fixed ? 'chestnut' : current.pet;
    const temperament = temperaments[fixed ? 'calm' : current.temperament];
    motion.sleepAfter = temperament.sleepAfter;
    motion.greetingDuration = temperament.greeting;
    motion.nuzzleDuration = temperament.nuzzle;
    for (const style of ['volume', 'pixel']) {
      const p = preset.find(item => item.key === picks[style]);
      $('.style-card[data-mode="' + style + '"] img').src = 'assets/' + p.key + '-' + style + '.webp';
      $('#' + style + '-card-pet').textContent = p.name;
    }
    clearInput();
    redrawLook();
  }

  function draw(time) {
    if (!current) return;
    motion.step(time, pressed.size > 0 || mousePointer != null);
    view.render(motion, reducedMotion.matches && (motion.mode === 'idle' || motion.mode === 'sleep') ? .20 : time);
    const label = names[motion.mode] || names.idle;
    if (label !== lastLabel) {
      state.textContent = label;
      lastLabel = label;
    }
  }

  function watchFrames() {
    frames.setEnabled(active && !document.hidden);
  }

  function applyInk(next) {
    mode = next;
    editorFallback = false;
    stage.dataset.ink = mode;
    for (const button of modes) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    applyCast();
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(Error('Script could not load')); };
      document.head.append(script);
    });
  }

  function loadVolume() {
    volumeReady ||= (async () => {
      if (!window.THREE) await loadScript('studio/vendor/three.min.js');
      if (!window.PawScene) await loadScript('studio/scene.js');
    })().catch(error => {
      volumeReady = null;
      throw error;
    });
    return volumeReady;
  }

  async function switchInk(next) {
    const request = ++styleRequest;
    const notice = $('#play-error');
    notice.hidden = true;
    play.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    play.tabIndex = -1;
    play.focus({ preventScroll: true });
    try {
      if (next === 'volume') await loadVolume();
      if (next === 'paper') await Paw2D.ready;
      if (request !== styleRequest) return;
      if (!view.setStyle(next)) throw Error('WebGL unavailable');
      applyInk(next);
      surface.classList.add('is-ready');
    } catch {
      if (request !== styleRequest) return;
      notice.textContent = next === 'paper' ? '2D 图片暂时无法载入。' : 'Pawside 3D 需要 WebGL。可以继续使用 2D 或像素风。';
      notice.hidden = false;
    }
  }

  function beginKey(code, source, repeat = false) {
    let holders = pressed.get(code);
    if (!holders) {
      holders = new Set();
      pressed.set(code, holders);
    }
    if (!holders.size || repeat) motion.down(code, clock(), repeat);
    holders.add(source);
    controls.get(code)?.classList.add('is-down');
    frames.wake();
  }

  function endKey(code, source) {
    const holders = pressed.get(code);
    if (!holders?.delete(source) || holders.size) return;
    pressed.delete(code);
    motion.up(code, clock());
    controls.get(code)?.classList.remove('is-down');
    frames.wake();
  }

  function clearInput() {
    for (const code of pressed.keys()) controls.get(code)?.classList.remove('is-down');
    pressed.clear();
    pointerInputs.clear();
    mousePointer = undefined;
    rubPointer = undefined;
    motion.reset(clock());
    frames.wake();
  }

  function point(event) {
    const bounds = surface.getBoundingClientRect();
    return [
      (event.clientX - bounds.left) / bounds.width * 2 - 1,
      1 - (event.clientY - bounds.top) / bounds.height * 2,
    ];
  }

  function startPointer(event, code) {
    pointerInputs.set(event.pointerId, code);
    event.currentTarget.setPointerCapture(event.pointerId);
    beginKey(code, event.pointerId);
  }

  function endPointer(event) {
    const code = pointerInputs.get(event.pointerId);
    if (code) {
      pointerInputs.delete(event.pointerId);
      endKey(code, event.pointerId);
    }
    if (mousePointer === event.pointerId) {
      mousePointer = undefined;
      motion.setButtons(0, clock());
      frames.wake();
    }
    if (rubPointer === event.pointerId) {
      rubPointer = undefined;
      motion.endPetting();
    }
  }

  for (const [code, button] of controls) {
    button.addEventListener('pointerdown', event => {
      if (event.button === 0) startPointer(event, code);
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      button.addEventListener(event, endPointer);
    button.addEventListener('click', event => {
      if (event.detail !== 0) return;
      const press = Symbol(code);
      beginKey(code, press);
      setTimeout(() => endKey(code, press), 115);
    });
  }

  surface.addEventListener('pointerdown', event => {
    const coords = point(event);
    const hit = view.hit(...coords);
    const time = clock();
    if (event.button === 0 && layout.has(hit)) startPointer(event, hit);
    else if (event.button === 0 && hit === 'head' && rubPointer === undefined) {
      rubPointer = event.pointerId;
      surface.setPointerCapture(event.pointerId);
      motion.beginPetting(coords, time);
      frames.wake();
    } else if (hit === 'mouse' && mousePointer === undefined) {
      mousePointer = event.pointerId;
      surface.setPointerCapture(event.pointerId);
      motion.moveMouse(...coords, time, true);
      motion.setButtons(event.buttons, time);
      frames.wake();
      if (event.button === 1) event.preventDefault();
    }
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
    surface.addEventListener(event, endPointer);
  surface.addEventListener('pointermove', event => {
    const coords = point(event), time = clock();
    if (event.pointerId === rubPointer) {
      if (motion.trackPetting(coords, view.hit(...coords) === 'head', time)) frames.wake();
    } else if (event.pointerId === mousePointer) {
      const moved = motion.moveMouse(...coords, time);
      const changed = (event.buttons & 7) !== motion.buttons;
      if (changed) motion.setButtons(event.buttons, time);
      if (moved || changed) frames.wake();
    } else if (event.pointerType !== 'touch' && !event.buttons && motion.observeCursor(...coords, time)) {
      frames.wake(true);
    }
  });
  surface.addEventListener('pointerleave', () => motion.leaveCursor(clock()));
  surface.addEventListener('contextmenu', event => {
    if (view.hit(...point(event)) === 'mouse') event.preventDefault();
  });
  surface.addEventListener('wheel', event => {
    if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const coords = point(event);
    if (view.hit(...coords) !== 'mouse') return;
    event.preventDefault();
    const time = clock();
    const factor = event.deltaMode === 1 ? 1 / 3 : event.deltaMode === 2 ? 3 : 1 / 80;
    motion.moveMouse(...coords, time, true);
    motion.scroll(PawMotion.clamp(event.deltaY * factor, -3, 3), time);
    frames.wake();
  }, { passive: false });
  window.addEventListener('keydown', event => {
    if (!active || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey ||
        event.target.closest('input, textarea, select, [contenteditable]') ||
        !/^(Key[A-Z]|Digit[0-9]|Backspace|Shift(?:Left|Right))$/.test(event.code)) return;
    if (event.code === 'Backspace') event.preventDefault();
    beginKey(event.code, 'keyboard', event.repeat);
  });
  window.addEventListener('keyup', event => endKey(event.code, 'keyboard'));
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInput();
    watchFrames();
  });

  $('#pet-cat').addEventListener('click', () => {
    motion.strokeHead(clock());
    frames.wake();
  });
  cast.addEventListener('change', () => {
    picks[editableMode()] = cast.value;
    editorFallback = false;
    applyCast();
  });
  for (const button of modes) button.addEventListener('click', () => switchInk(button.dataset.mode));
  for (const input of [headInput, earInput, furInput]) {
    input.addEventListener('input', () => {
      const edit = edits.get(current.key) || {};
      edit[input.id] = input.type === 'range' ? input.valueAsNumber : input.value;
      edits.set(current.key, edit);
      redrawLook();
    });
  }
  $('#reset-face').addEventListener('click', () => {
    edits.delete(current.key);
    redrawLook();
  });

  const size = new ResizeObserver(() => {
    resize(view, surface);
    if (faceVisible) redrawFace();
    if (active) frames.wake();
    else draw(clock());
  });
  size.observe(surface);
  size.observe(faceSurface);
  const visibility = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.target === play) {
        active = entry.isIntersecting;
        watchFrames();
      } else {
        faceVisible = entry.isIntersecting;
        if (faceVisible) redrawFace();
      }
    }
  }, { threshold: .12 });
  visibility.observe(play);
  visibility.observe(facePanel);
  resize(view, surface);
  applyCast();
  Paw2D.ready.then(() => {
    draw(clock());
    surface.classList.add('is-ready');
  }).catch(() => {
    $('#play-error').textContent = '2D 图片暂时无法载入。可切换到 Pawside 3D 或像素风。';
    $('#play-error').hidden = false;
  });
  watchFrames();
}
