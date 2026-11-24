(function () {
  'use strict';
  const $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)],
    { Motion, clamp, layout } = PawMotion;
  const canvas = $('#scene'),
    desktop = window.pawDesktop,
    desk = !!desktop && location.search.includes('desktop');
  document.body.classList.toggle('desk', desk);
  const clock = () => performance.now() / 1000;
  const names = {
    ink: [
      '墨爪',
      'Ink Cat',
      '墨爪侧过身，把一只爪子搭上鼠标。开始打字，它会回头看键盘。按住退格，看它眯起金眼睛，用尾巴拍桌。',
    ],
    chestnut: [
      '栗酥',
      'Chestnut',
      '栗酥有耳尖毛、额头纹和蓬松的尾巴。它也会侧身握鼠标、低头找键。按退格时，耳朵向后压，尾尖甩下来。',
    ],
  };
  const states = {
    idle: '待机',
    private: '隐私 · 捂眼',
    anonymous: '匿名打字',
    glance: '看一眼退格',
    slow: '慢敲',
    steady: '连打',
    fast: '飞速打字',
    rage: '退格暴走',
    hello: '回应你',
    sleep: '打盹',
    mouse: '握鼠标',
  };
  const backgrounds = { oat: '#f1eee5', sage: '#dce6d5', blue: '#dbe7e9' };
  function get(key, value) {
    try {
      return JSON.parse(localStorage.getItem('pawside.3d.' + key)) ?? value;
    } catch {
      return value;
    }
  }
  function store(key, v) {
    try {
      localStorage.setItem('pawside.3d.' + key, JSON.stringify(v));
    } catch {}
  }
  function clean(o) {
    const out = {};
    for (const k of ['fur', 'shade', 'light', 'stripe', 'eye'])
      if (/^#[0-9a-f]{6}$/i.test(o?.[k] || '')) out[k] = o[k];
    return out;
  }
  const pref = get('coats', {}),
    coats = { ink: clean(pref?.ink), chestnut: clean(pref?.chestnut) },
    portraits = {};
  const notice = (s) => {
    $('#status').textContent = s;
  };
  let view;
  try {
    view = new PawScene.View(canvas);
  } catch (e) {
    $('#fail').hidden = false;
    $('#fail').textContent =
      '3D 场景需要 WebGL。请打开浏览器硬件加速后重新载入。';
    return;
  }
  const motion = new Motion();
  let id = 'ink',
    activeScript = null,
    scheduled = [],
    heldPointer = new Map(),
    mousePointer = null,
    physical = new Set(),
    review = false,
    lastLabel = '';
  const samples = new Map();
  let domCover = false,
    remoteCover = false;
  const covered = () => domCover || remoteCover;
  function now() {
    return review ? motion.t : clock();
  }
  function reset(t = now()) {
    scheduled = [];
    physical.clear();
    heldPointer.clear();
    mousePointer = null;
    motion.reset(t);
    if (covered()) motion.setPrivacy(true, t);
  }
  function stop() {
    activeScript = null;
    scheduled = [];
    $('[data-act=reference]').textContent = '▶ 原片复刻';
    $('[data-act=demo]').textContent = '▶ 动作演示';
    $('[data-act=tempo]').textContent = '▶ 表情对照';
  }
  function select(newId, persist = true) {
    if (!Object.hasOwn(names, newId)) newId = 'ink';
    id = newId;
    stop();
    reset();
    motion.profile = id;
    view.select(id);
    lastLabel = '';
    $('#english').textContent = names[id][1];
    $('#note').textContent = names[id][2];
    $$('[data-pet]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.pet === id))
    );
    $('#fur').value = coats[id].fur || PawScene.palettes[id].fur;
    $('#eye').value = coats[id].eye || PawScene.palettes[id].eye;
    $('#sample').hidden = !samples.has(id);
    if (samples.has(id))
      $('#sample').getContext('2d').drawImage(samples.get(id), 0, 0);
    if (persist) store('pet', id);
    notice('');
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (r.width && r.height)
      view.resize(Math.round(r.width), Math.round(r.height));
  }
  const ro = new ResizeObserver(() => {
    if (!review) resize();
  });
  ro.observe(canvas);
  function backdrop(k) {
    if (!Object.hasOwn(backgrounds, k)) k = 'oat';
    document.documentElement.style.setProperty('--stage', backgrounds[k]);
    $$('[data-bg]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.bg === k))
    );
    store('bg', k);
  }
  function script(action, t) {
    if (covered()) return;
    stop();
    reset(t);
    activeScript = action;
    const events = [];
    function tap(code, at, len = 0.1) {
      events.push([at, 'down', code], [at + len, 'up', code]);
    }
    const phrase = [
      'KeyA',
      'KeyJ',
      'KeyS',
      'KeyK',
      'KeyD',
      'KeyL',
      'KeyF',
      'KeyH',
      'KeyG',
      'KeyU',
    ];
    function run(start, duration, interval, offset = 0) {
      for (let j = 0; j * interval < duration; j++)
        tap(
          phrase[(j + offset) % phrase.length],
          start + j * interval,
          Math.min(0.13, interval * 0.8)
        );
    }
    if (action === 'reference') events.push(...PawReference.score());
    else if (action === 'demo') {
      for (const at of [0, 0.25, 0.55, 0.85, 1.18]) events.push([at, 'mouse']);
      run(1.37, 0.69, 0.48);
      run(2.06, 0.7, 0.2);
      run(2.8, 2.51, 0.095);
      tap('Backspace', 3.58, 0.13);
      tap('Backspace', 4.59, 0.14);
      tap('Backspace', 5.45, 0.49);
      tap('Backspace', 6.04, 0.15);
      for (const at of [6.2, 6.53, 6.9, 7.28]) events.push([at, 'mouse']);
      events.push([8.95, 'mouse'], [9.35, 'mouse'], [9.83, 'mouse']);
      tap('KeyA', 9.65, 0.16);
      events.push([10.6, 'hello'], [12.55, 'end']);
    } else if (action === 'tempo') {
      tap('KeyA', 0.18, 0.17);
      tap('KeyJ', 0.92, 0.16);
      tap('KeyS', 1.55, 0.16);
      run(2.16, 1.53, 0.218);
      run(3.9, 1.92, 0.091);
      tap('Backspace', 7.27, 0.13);
      tap('Backspace', 7.71, 0.61);
      events.push([10.72, 'end']);
    } else if (action === 'hands') {
      events.push(
        [0, 'mouse'],
        [0.48, 'buttons', 1],
        [1.24, 'buttons', 3],
        [1.96, 'buttons', 2],
        [2.65, 'buttons', 0],
        [2.86, 'buttons', 4],
        [3.22, 'buttons', 0]
      );
      for (const [at, x, y] of [
        [0.72, -0.35, -0.1],
        [0.87, 0.08, 0.1],
        [1.02, 0.52, 0.23],
        [1.17, 0.75, 0.35],
        [2.15, 0.14, 0.1],
        [2.34, -0.26, 0],
      ])
        events.push([at, 'track', [x, y]]);
      for (const at of [3.48, 3.6, 3.72, 3.84]) events.push([at, 'wheel', -1]);
      for (const at of [4.16, 4.28, 4.4, 4.52]) events.push([at, 'wheel', 1]);
      events.push([4.86, 'buttons', 1]);
      for (let j = 0; j < 8; j++)
        tap(['KeyJ', 'KeyK', 'KeyL'][j % 3], 5.08 + j * 0.15, 0.085);
      events.push([6.25, 'buttons', 0]);
      for (let j = 0; j < 10; j++)
        tap(['KeyA', 'KeyS', 'KeyD', 'KeyF'][j % 4], 7.55 + j * 0.145, 0.08);
      tap('Backspace', 9.48, 0.52);
      events.push([11.65, 'end']);
    } else if (action === 'mouse') {
      for (const at of [0, 0.28, 0.65, 1, 1.35]) events.push([at, 'mouse']);
      events.push([2.68, 'end']);
    } else if (action === 'rage') {
      tap('Backspace', 0.015, 0.37);
      tap('Backspace', 0.48, 0.35);
      events.push([2.1, 'end']);
    } else if (action === 'hello') {
      events.push([0, 'hello'], [1.8, 'end']);
    } else {
      run(
        0.035,
        2.8,
        action === 'slow' ? 0.66 : action === 'steady' ? 0.22 : 0.095
      );
      events.push([3.45, 'end']);
    }
    scheduled = events
      .sort((a, b) => a[0] - b[0])
      .map((e) => [t + e[0], ...e.slice(1)]);
    $('[data-act=demo]').textContent =
      action === 'demo' ? '■ 停止演示' : '▶ 动作演示';
    if (action === 'reference')
      $('[data-act=reference]').textContent = '■ 停止复刻';
    if (action === 'tempo') $('[data-act=tempo]').textContent = '■ 停止对照';
  }
  function advance(t) {
    while (scheduled.length && scheduled[0][0] <= t) {
      const [at, op, code] = scheduled.shift();
      if (op === 'down') motion.down(code, at);
      else if (op === 'up') motion.up(code, at);
      else if (op === 'mouse') motion.moveMouse(-0.78, -0.34, at, true);
      else if (op === 'track') motion.moveMouse(...code, at);
      else if (op === 'buttons') motion.setButtons(code, at);
      else if (op === 'wheel') motion.scroll(code, at);
      else if (op === 'hello') motion.greet(at);
      else stop();
    }
    motion.step(t);
    view.render(motion, t);
    if (motion.mode !== lastLabel) {
      $('#state').textContent = states[motion.mode];
      $('#state').classList.toggle('hot', motion.mode === 'rage');
      lastLabel = motion.mode;
    }
    const speed =
      motion.privacy || motion.mode === 'anonymous'
        ? '—'
        : motion.kps.toFixed(1) + ' 键 / 秒';
    if ($('#speed').textContent !== speed) $('#speed').textContent = speed;
  }
  function interrupt(t) {
    if (activeScript) {
      stop();
      reset(t);
    }
  }
  function key(code, down, repeat, t) {
    if (!layout.has(code)) return;
    interrupt(t);
    if (down) {
      physical.add(code);
      motion.down(code, t, repeat);
    } else {
      physical.delete(code);
      motion.up(code, t);
    }
  }
  let systemOn = false;
  function applyCover() {
    if (motion.privacy === covered()) return;
    stop();
    reset();
    advance(now());
  }
  function sensitive(el) {
    return Boolean(
      el?.closest?.(
        'input[type=password i],[data-private],input[autocomplete~="current-password" i],input[autocomplete~="new-password" i],input[autocomplete~="one-time-code" i]'
      )
    );
  }
  function syncLocalCover(event) {
    const protect =
      sensitive(document.activeElement) ||
      Boolean(event?.composedPath?.().some(sensitive));
    if (domCover !== protect) {
      domCover = protect;
      applyCover();
      if (desktop && !desk) desktop.local({ type: 'privacy', on: protect });
    }
    return protect;
  }
  document.addEventListener('focusin', syncLocalCover, true);
  document.addEventListener(
    'focusout',
    () => queueMicrotask(() => syncLocalCover()),
    true
  );
  new MutationObserver(() => syncLocalCover()).observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['type', 'autocomplete', 'data-private'],
  });
  for (const input of [$('#try-text'), $('#try-private')])
    input.addEventListener('blur', () => {
      input.value = '';
    });
  window.addEventListener('keydown', (e) => {
    if (syncLocalCover(e) || covered()) return;
    if (e.key === 'Escape' && document.body.classList.contains('focus')) {
      focus(false);
      return;
    }
    const typing = e.target === $('#try-text');
    if (
      (!typing &&
        e.target.closest('input,textarea,select,[contenteditable],summary')) ||
      e.metaKey ||
      e.ctrlKey ||
      e.altKey ||
      !layout.has(e.code) ||
      e.code === 'Tab'
    )
      return;
    if (
      e.target.closest('button,label') &&
      !typing &&
      ['Space', 'Enter'].includes(e.code)
    )
      return;
    if (!typing) e.preventDefault();
    key(e.code, true, e.repeat, clock());
    if (desktop && !desk)
      desktop.local({ type: 'down', code: e.code, repeat: e.repeat });
  });
  window.addEventListener('keyup', (e) => {
    if (syncLocalCover(e) || covered() || !physical.has(e.code)) return;
    key(e.code, false, false, clock());
    if (desktop && !desk) desktop.local({ type: 'up', code: e.code });
  });
  window.addEventListener('blur', () => {
    if (!systemOn) {
      stop();
      reset();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !systemOn) {
      stop();
      reset();
    }
  });
  function point(e) {
    const b = canvas.getBoundingClientRect();
    return [
      ((e.clientX - b.left) / b.width) * 2 - 1,
      1 - ((e.clientY - b.top) / b.height) * 2,
    ];
  }
  let rubPointer = null,
    rubDistance = 0,
    rubPoint = null;
  canvas.addEventListener('pointerdown', (e) => {
    const t = clock();
    interrupt(t);
    canvas.focus();
    const [x, y] = point(e);
    const hit = view.hit(x, y);
    if (e.button === 0 && layout.has(hit)) {
      motion.down(hit, t);
      heldPointer.set(e.pointerId, hit);
      canvas.setPointerCapture(e.pointerId);
    } else if (e.button === 0 && hit === 'head') {
      motion.greet(t);
      rubPointer = e.pointerId;
      rubPoint = [x, y];
      rubDistance = 0;
      canvas.setPointerCapture(e.pointerId);
    } else if (!systemOn && mousePointer === null) {
      mousePointer = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      motion.moveMouse(x, y, t, true);
      motion.setButtons(e.buttons, t);
      e.preventDefault();
    }
  });
  function lift(e) {
    if (e.pointerId === rubPointer) {
      rubPointer = null;
      rubPoint = null;
      rubDistance = 0;
    }
    const code = heldPointer.get(e.pointerId);
    if (code) {
      heldPointer.delete(e.pointerId);
      if (![...heldPointer.values()].includes(code) && !physical.has(code))
        motion.up(code, clock());
    }
    if (e.pointerId === mousePointer) {
      motion.setButtons(0, clock());
      mousePointer = null;
    }
  }
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'])
    canvas.addEventListener(ev, lift);
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === rubPointer && rubPoint) {
      const pt = point(e);
      if (view.hit(...pt) === 'head') {
        rubDistance += Math.min(
          0.09,
          Math.hypot(pt[0] - rubPoint[0], pt[1] - rubPoint[1])
        );
        if (rubDistance > 0.12) {
          motion.strokeHead(clock());
          rubDistance = 0;
        }
      } else rubDistance = 0;
      rubPoint = pt;
      return;
    }
    if (activeScript || systemOn || heldPointer.size) return;
    const t = clock();
    // Chorded mouse presses/releases arrive as pointermove while any button remains held.
    if (e.pointerId === mousePointer) motion.setButtons(e.buttons, t);
    if (e.pointerType !== 'touch') motion.moveMouse(...point(e), t);
  });
  if (!desk) canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (
        systemOn ||
        e.ctrlKey ||
        !e.deltaY ||
        Math.abs(e.deltaX) > Math.abs(e.deltaY)
      )
        return;
      e.preventDefault();
      const t = clock();
      interrupt(t);
      motion.moveMouse(...point(e), t, true);
      const unit = e.deltaMode === 1 ? 1 / 3 : e.deltaMode === 2 ? 3 : 1 / 80;
      motion.scroll(clamp(e.deltaY * unit, -3, 3), t);
    },
    { passive: false }
  );
  $$('[data-act]').forEach(
    (b) =>
      (b.onclick = () => {
        const t = clock();
        if (
          ['demo', 'tempo', 'reference'].includes(b.dataset.act) &&
          b.dataset.act === activeScript
        ) {
          stop();
          reset(t);
        } else script(b.dataset.act, t);
        canvas.focus();
      })
  );
  $$('[data-pet]').forEach(
    (b) =>
      (b.onclick = () => {
        select(b.dataset.pet);
        canvas.focus();
      })
  );
  $$('[data-bg]').forEach((b) => (b.onclick = () => backdrop(b.dataset.bg)));
  backdrop(get('bg', 'oat'));
  function focus(on) {
    document.body.classList.toggle('focus', on);
    $('#focus').textContent = on ? '返回工作室 ↙' : '专注视图 ↗';
    $('#focus').setAttribute('aria-pressed', String(on));
    canvas.focus();
  }
  $('#focus').onclick = () => focus(!document.body.classList.contains('focus'));
  function paint() {
    coats[id] = clean(coats[id]);
    view.skin(id, coats[id]);
    store('coats', coats);
    $('#fur').value = coats[id].fur || PawScene.palettes[id].fur;
    $('#eye').value = coats[id].eye || PawScene.palettes[id].eye;
  }
  function tint(hex) {
    const c = new THREE.Color(hex);
    for (const [k, n] of [
      ['shade', 0.72],
      ['light', 1.23],
      ['stripe', 0.53],
    ])
      coats[id][k] = '#' + c.clone().multiplyScalar(n).getHexString();
    coats[id].fur = hex;
    paint();
  }
  $('#fur').onchange = (e) => tint(e.target.value);
  $('#eye').onchange = (e) => {
    coats[id].eye = e.target.value;
    paint();
  };
  $('#restore').onclick = () => {
    coats[id] = {};
    samples.delete(id);
    $('#sample').hidden = true;
    paint();
    notice('已恢复原色。');
  };
  function sample(x, y) {
    const c = $('#sample'),
      g = c.getContext('2d'),
      rx = clamp(Math.round(x) - 2, 0, c.width - 5),
      ry = clamp(Math.round(y) - 2, 0, c.height - 5),
      pixels = g.getImageData(rx, ry, 5, 5).data,
      l = [[], [], []];
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i + 3] > 80)
        for (let j = 0; j < 3; j++) l[j].push(pixels[i + j]);
    if (!l[0].length) {
      notice('请点照片中有毛发的位置。');
      return;
    }
    const hex =
      '#' +
      l
        .map((ch) =>
          ch
            .sort((a, b) => a - b)
            [ch.length >> 1].toString(16)
            .padStart(2, '0')
        )
        .join('');
    tint(hex);
    notice('已取色，可继续点击照片调整。');
  }
  $('#photo').onchange = async (e) => {
    const file = e.target.files[0],
      pet = id;
    if (!file) return;
    let url;
    try {
      if (
        file.size > 16 * 1024 * 1024 ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      )
        throw Error('请选择 16 MB 以内的 JPG、PNG 或 WebP。');
      const im = new Image();
      url = URL.createObjectURL(file);
      im.src = url;
      await im.decode();
      if (pet !== id) return;
      const c = $('#sample'),
        g = c.getContext('2d'),
        scale = Math.min(c.width / im.width, c.height / im.height);
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(
        im,
        (c.width - im.width * scale) / 2,
        (c.height - im.height * scale) / 2,
        im.width * scale,
        im.height * scale
      );
      c.hidden = false;
      const copy = document.createElement('canvas');
      copy.width = c.width;
      copy.height = c.height;
      copy.getContext('2d').drawImage(c, 0, 0);
      samples.set(id, copy);
      sample(c.width * 0.5, c.height * 0.4);
    } catch (err) {
      notice(err.message);
    } finally {
      if (url) URL.revokeObjectURL(url);
      e.target.value = '';
    }
  };
  $('#sample').onclick = (e) => {
    const c = e.currentTarget,
      r = c.getBoundingClientRect();
    sample(
      ((e.clientX - r.left) / r.width) * c.width,
      ((e.clientY - r.top) / r.height) * c.height
    );
  };
  function download(blob, name) {
    const a = document.createElement('a'),
      url = URL.createObjectURL(blob);
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  $('#snap').onclick = () =>
    canvas.toBlob((blob) => {
      if (blob) download(blob, names[id][0] + '-瞬间.png');
    });
  $('#save').onclick = () => {
    download(
      new Blob(
        [
          JSON.stringify(
            { format: 'pawside-three', version: 1, pet: id, coat: coats[id] },
            null,
            2
          ),
        ],
        { type: 'application/json' }
      ),
      names[id][0] + '.pawside.json'
    );
    notice('已导出配色，可在另一台设备导入。');
  };
  $('#load').onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 8192) throw Error();
      const d = JSON.parse(await file.text());
      if (
        d.format !== 'pawside-three' ||
        d.version !== 1 ||
        !Object.hasOwn(names, d.pet) ||
        !d.coat ||
        Array.isArray(d.coat) ||
        typeof d.coat !== 'object' ||
        Object.keys(clean(d.coat)).length !== Object.keys(d.coat).length
      )
        throw Error();
      select(d.pet);
      coats[id] = clean(d.coat);
      paint();
      notice('已导入宠物配色。');
    } catch {
      notice('请选择工作室导出的宠物配色 JSON。');
    } finally {
      e.target.value = '';
    }
  };
  for (const p of Object.keys(names))
    if (Object.keys(coats[p]).length) view.skin(p, coats[p]);
  select(get('pet', 'ink'), false);
  resize();
  const thumbs = { ink: '@@INK@@', chestnut: '@@CHESTNUT@@' };
  $$('[data-pet]').forEach((b) => {
    const src = thumbs[b.dataset.pet];
    if (src.startsWith('data:')) b.querySelector('img').src = src;
    else b.querySelector('img').src = 'thumb-' + b.dataset.pet + '.png';
  });
  if (desktop) {
    desktop.onInput((e) => {
      const t = clock();
      if (e.type === 'status') {
        systemOn = e.enabled;
        remoteCover = false;
        view.privateKeys = systemOn;
        stop();
        reset(t);
        $('#system').textContent = systemOn ? '暂停系统响应' : '跟随系统键鼠';
        return;
      }
      if (e.type === 'privacy') {
        remoteCover = systemOn && e.on === true;
        applyCover();
        return;
      }
      if (covered()) return;
      if (e.type === 'activity') {
        interrupt(t);
        motion.anonymous(t, e.level);
        return;
      }
      if (e.type === 'reset') {
        stop();
        reset(t);
        return;
      }
      if (e.type === 'buttons' || e.type === 'wheel') {
        interrupt(t);
        if (e.type === 'buttons') motion.setButtons(e.mask, t);
        else motion.scroll(e.steps, t);
        return;
      }
      if (e.type === 'mouse') {
        motion.moveMouse(e.x, e.y, t, e.click);
        return;
      }
      key(e.code, e.type === 'down', e.repeat, t);
    });
    $('#system').onclick = () => desktop.toggleInput();
    $('#studio').onclick = () => desktop.studio();
    $('#quit').onclick = () => desktop.quit();
    $('#switch').onclick = () => select(id === 'ink' ? 'chestnut' : 'ink');
    window.addEventListener('storage', (e) => {
      if (e.key === 'pawside.3d.pet') select(get('pet', 'ink'), false);
      if (e.key === 'pawside.3d.coats') {
        const v = get('coats', {});
        for (const p of Object.keys(names)) {
          coats[p] = clean(v?.[p]);
          view.skin(p, coats[p]);
        }
        view.select(id);
      }
    });
  }
  // Deterministic film uses this same scene and input schedule, including native/keyboard handlers above.
  globalThis.pawReview = {
    begin(p, w, h, action = 'demo') {
      if (covered()) return false;
      review = true;
      select(p, false);
      view.resize(w, h, 1);
      motion.reset(0);
      script(action, 0);
      return true;
    },
    frame(t) {
      advance(t);
      return motion.mode;
    },
    snapshot() {
      return view.snapshot();
    },
    state() {
      return {
        id,
        mode: motion.mode,
        kps: motion.kps,
        rage: motion.rage,
        buttons: motion.buttons,
        wheel: motion.wheelAngle,
        scroll: motion.scrollSign,
        balance: motion.balance,
        paws: motion.paws.map((p) => ({ ...p.pos })),
        lookup: motion.lookup,
        landing: motion.landing,
        grip: motion.mouseLean,
        tail: motion.tailBeat,
        temper: motion.frustration,
        afterglow: motion.pique,
        protected: motion.privacy,
        nuzzle: motion.nuzzle,
        driver: THREE.REVISION,
      };
    },
    view,
  };
  let nextIdleFrame = 0;
  function loop() {
    if (!review) {
      const t = clock();
      const fps = activeScript ? 0 : motion.idleFrameRate(t);
      if (!fps || t + 0.001 >= nextIdleFrame) {
        advance(t);
        const interval = fps ? 1 / fps : 0;
        const late = t - nextIdleFrame;
        nextIdleFrame = fps ? t + interval - (Math.max(0, late) % interval) : t;
      }
    }
    requestAnimationFrame(loop);
  }
  loop();
})();
