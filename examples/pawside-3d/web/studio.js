(function () {
  'use strict';
  const $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)],
    { Motion, clamp, layout } = PawMotion;
  const { groups, preset, renderStyles, temperaments, normalize, cleanStyle, readFile, skinName, paletteFromFur } = PawLooks;
  const canvas = $('#scene'),
    desktop = window.pawDesktop,
    desk = !!desktop && location.search.includes('desktop');
  document.body.classList.toggle('desk', desk);
  let switchDuration = 0;
  const clock = () => performance.now() / 1000 - switchDuration;
  const names = { ink: '墨爪', chestnut: '栗酥' };
  const pets = Object.keys(names);
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
  const backgrounds = { oat: '#ffda75', sage: '#d4e6ad', blue: '#d7cdfd' };
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
      return true;
    } catch {
      return false;
    }
  }
  function draftOf(value) {
    return {
      ...cleanStyle(value),
      temperament: Object.hasOwn(temperaments, value?.temperament) ? value.temperament : 'calm',
      name: skinName(value?.name),
      preset: preset.some(p => p.key === value?.preset) ? value.preset : '',
    };
  }
  const library = get('skinStudio', {});
  const oldCoats = get('coats', {});
  const startPresets = { ink: preset.find(p => p.key === 'ink'), chestnut: preset[0] };
  function presetDraft(p) { return draftOf({ ...p, preset: p.key }); }
  const drafts = Object.fromEntries(pets.map(p => [p, library?.drafts?.[p]
    ? draftOf(library.drafts[p]) : oldCoats?.[p] ? draftOf({coat:oldCoats[p]}) : presetDraft(startPresets[p])]));
  function readVariants(values) {
    const result = {};
    for (const p of preset) if(values?.[p.key]) result[p.key] = draftOf(values[p.key]);
    return result;
  }
  let variants = readVariants(library?.variants);
  function readSaved(items) {
    if(!Array.isArray(items)) return [];
    return items.filter(item=>item && pets.includes(item.pet) && typeof item.key==='string')
      .map(item=>({...draftOf(item), pet:item.pet, key:item.key,
        renderStyle:Object.hasOwn(renderStyles,item.renderStyle)?item.renderStyle:'volume'}));
  }
  let saved = readSaved(library?.saved);
  const notice = (s) => {
    $('#status').textContent = s;
  };
  const view = new PawDrawing.StudioView($('#flat-canvas'), $('#volume-canvas'));
  const motion = new Motion();
  let id = 'ink',
    activeScript = null,
    scheduled = [],
    heldPointer = new Map(),
    mousePointer = null,
    rubPointer = null,
    physical = new Set(),
    review = false,
    lastLabel = '';
  const samples = new Map();
  let group = groups[0], activeSaved = '';
  let domCover = false,
    remoteCover = false;
  const covered = () => domCover || remoteCover;
  const frames = PawFrames.createFrameLoop(
    () => advance(clock()),
    () => activeScript ? 0 : motion.idleFrameRate(clock())
  );
  function now() {
    return review ? motion.t : clock();
  }
  function reset(t = now()) {
    scheduled = [];
    physical.clear();
    heldPointer.clear();
    mousePointer = null;
    rubPointer = null;
    motion.reset(t);
    if (covered()) motion.setPrivacy(true, t);
    frames.wake();
  }
  function stop() {
    activeScript = null;
    scheduled = [];
    $('[data-act=reference]').textContent = '键鼠回放';
    $('[data-act=demo]').textContent = '▶ 动作演示';
    $('[data-act=tempo]').textContent = '节奏对照';
  }
  function select(newId, persist = true) {
    if (!Object.hasOwn(names, newId)) newId = 'ink';
    id = newId;
    stop();
    reset();
    motion.profile = id;
    view.select(id);
    lastLabel = '';
    activeSaved = '';
    applyTemper();
    syncIdentity();
    $$('[data-pet]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.pet === id))
    );
    refreshEditor();
    $('#sample').hidden = !samples.has(id);
    if (samples.has(id))
      $('#sample').getContext('2d').drawImage(samples.get(id), 0, 0);
    if (persist) store('pet', id);
    notice('');
  }
  function applyTemper() {
    const profile=temperaments[view.mode==='paper'?'calm':drafts[id].temperament];
    motion.profile=view.mode==='paper'?'chestnut':id;
    motion.sleepAfter=profile.sleepAfter;
    motion.greetingDuration=profile.greeting;
    motion.nuzzleDuration=profile.nuzzle;
    $('#temper').value=drafts[id].temperament;
  }
  function basis() {return preset.find(p=>p.key===drafts[id].preset);}
  function syncIdentity() {
    if (view.mode==='paper') {
      $('#english').textContent=Paw2D.pet.name;
      $('#base-label').textContent='2D';
      $('#pet-breed').textContent='';
      return;
    }
    const base=basis();
    $('#english').textContent=drafts[id].name||base?.name||names[id];
    $('#base-label').textContent=base?.english||(id==='chestnut'?'Chestnut':'Ink');
    $('#pet-breed').textContent=base?.breed||(id==='chestnut'?'长毛猫':'短毛猫');
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (r.width && r.height) {
      view.resize(Math.round(r.width), Math.round(r.height));
      frames.wake();
    }
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
    inspect('desk');
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
      $('[data-act=reference]').textContent = '■ 停止回放';
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
    const liveHold = !document.hidden && !covered() && (physical.size > 0 || heldPointer.size > 0 || mousePointer !== null);
    motion.step(t, liveHold);
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
      if (![...heldPointer.values()].includes(code)) motion.up(code, t);
    }
    frames.wake();
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
    watchFrames();
  });
  function point(e) {
    const b = canvas.getBoundingClientRect();
    return [
      ((e.clientX - b.left) / b.width) * 2 - 1,
      1 - ((e.clientY - b.top) / b.height) * 2,
    ];
  }
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
    } else if (e.button === 0 && hit === 'head' && rubPointer === null) {
      rubPointer = e.pointerId;
      motion.beginPetting([x, y], t);
      canvas.setPointerCapture(e.pointerId);
    } else if (!systemOn && hit === 'mouse' && mousePointer === null) {
      mousePointer = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      motion.moveMouse(x, y, t, true);
      motion.setButtons(e.buttons, t);
      e.preventDefault();
    }
    frames.wake();
  });
  function lift(e) {
    if (e.pointerId === rubPointer) {
      rubPointer = null;
      motion.endPetting();
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
    frames.wake();
  }
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'])
    canvas.addEventListener(ev, lift);
  canvas.addEventListener('pointermove', (e) => {
    const pt = point(e), t = clock();
    if (e.pointerId === rubPointer) {
      if (motion.trackPetting(pt, view.hit(...pt) === 'head', t)) frames.wake();
      return;
    }
    if (activeScript || systemOn) return;
    if (e.pointerId === mousePointer) {
      // Button chords can change while the pointer remains captured.
      motion.setButtons(e.buttons, t);
      motion.moveMouse(...pt, t);
      frames.wake();
    } else if (e.pointerType !== 'touch' && !e.buttons && motion.observeCursor(...pt, t)) {
      frames.wake(true);
    }
  });
  canvas.addEventListener('pointerleave', () => motion.leaveCursor(clock()));
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
      frames.wake();
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
        frames.wake();
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
    $('#focus').setAttribute('aria-label', on ? '返回工作室' : '专注视图');
    $('#focus').title = on ? '返回工作室' : '专注视图';
    $('#focus').setAttribute('aria-pressed', String(on));
    canvas.focus();
  }
  $('#focus').onclick = () => focus(!document.body.classList.contains('focus'));
  function inspect(angle) {
    view.inspect(angle);
    $('#peek-face').textContent=view.inspection==='desk'?'看正脸':'看全身';
    for (const button of $$('[data-view]'))
      button.setAttribute('aria-pressed', String(button.dataset.view === view.inspection));
  }
  for (const button of $$('[data-view]'))
    button.onclick = () => {
      inspect(button.dataset.view);
      advance(now());
    };

  const dirtyLooks = new Set();
  let paintTimer = 0, persistTimer = 0;
  const linkCoat = $('#link-coat');
  linkCoat.checked = get('linkCoat', true) !== false;
  linkCoat.onchange = () => store('linkCoat', linkCoat.checked);
  function writeLooks() {
    clearTimeout(persistTimer);
    persistTimer = 0;
    rememberVariant();
    return store('skinStudio', { drafts, variants, saved });
  }
  function repaint() {
    clearTimeout(paintTimer);
    paintTimer = 0;
    for (const pet of dirtyLooks) view.skin(pet, drafts[pet]);
    dirtyLooks.clear();
    advance(now());
  }
  function editLook(pet = id, immediate = false) {
    dirtyLooks.add(pet);
    if (immediate) repaint();
    else if (!paintTimer) paintTimer = setTimeout(repaint, 45);
    clearTimeout(persistTimer);
    persistTimer = setTimeout(writeLooks, 220);
  }
  window.addEventListener('pagehide', () => {
    if (persistTimer) writeLooks();
  });

  function button(label) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    return element;
  }
  function rememberVariant() {
    for(const pet of pets) {
      const d=drafts[pet];
      if(d.preset) variants[d.preset]=draftOf(d);
    }
  }
  function applyPreset(p) {
    rememberVariant();
    drafts[p.pet]=variants[p.key]?draftOf(variants[p.key]):presetDraft(p);
    select(p.pet); editLook(p.pet,true);
    notice('已选「'+(drafts[p.pet].name||p.name)+'」。');
  }
  for (const p of preset) {
    const option=button(''), tile=document.createElement('span'), portrait=document.createElement('canvas'),
      copy=document.createElement('span'), title=document.createElement('strong'), breed=document.createElement('small');
    option.dataset.preset=p.key; option.className='preset-card';
    tile.className='portrait';tile.style.setProperty('--tile',p.paper);tile.setAttribute('aria-hidden','true');tile.append(portrait);
    copy.className='preset-copy';title.textContent=p.name;breed.textContent=p.breed;copy.append(title,breed);
    option.append(tile,copy);option.onclick=()=>applyPreset(p);
    $('#look-presets').append(option);
    PawDrawing.portrait(portrait,normalize(p.pet,p),p.pet==='chestnut');
  }
  function pane(key) {
    document.body.classList.toggle('editing',key==='edit');
    for(const section of $$('[data-panel]')) section.hidden=section.dataset.panel!==key;
    for(const tab of $$('[data-pane]')) tab.setAttribute('aria-pressed',String(tab.dataset.pane===key));
  }
  for(const tab of $$('[data-pane]')) tab.onclick=()=>{
    if(tab.dataset.pane==='edit' && view.mode==='paper' && !style('volume')) style('pixel');
    pane(tab.dataset.pane);
  };
  $('#open-collection').onclick=()=>{pane('collection');$('#skin-name').focus();};
  $('#quick-edit').onclick=()=>{
    if(view.mode==='paper' && !style('volume')) style('pixel');
    pane('edit');inspect('face');advance(now());
    if(matchMedia('(max-width:740px)').matches)document.querySelector('.work-grid').scrollIntoView();
  };
  $('#peek-face').onclick=()=>{inspect(view.inspection==='desk'?'face':'desk');advance(now());};
  pane('presets');
  for(const [key,profile] of Object.entries(temperaments))
    $('#temper').add(new Option(profile.label,key));
  $('#temper').onchange=(e)=>{drafts[id].temperament=e.target.value;applyTemper();writeLooks();};
  function style(mode,persist=true) {
    const frameTime=now();
    const ok=view.setStyle(mode);
    $('#fail').hidden=ok;
    if(!ok){
      $('#fail').textContent='Pawside 3D 需要 WebGL。启用浏览器硬件加速后可再次切换。';
      if(!review)switchDuration=performance.now()/1000-frameTime;
      notice('当前设备无法打开 Pawside 3D。');
      return false;
    }
    for(const b of $$('[data-style]'))b.setAttribute('aria-pressed',String(b.dataset.style===mode));
    for(const b of $$('[data-view=angle],[data-view=profile]'))b.hidden=mode!=='volume';
    const fixed=mode==='paper';
    $('#catalog-title').textContent=fixed?'2D 原插画':'角色图鉴';
    $('#catalog-count').hidden=fixed;
    $('#fixed-art').hidden=!fixed;
    $('#look-presets').hidden=fixed;
    $('#quick-edit').lastChild.textContent=fixed?'去 3D 捏脸':'捏捏这张脸';
    if(fixed && document.body.classList.contains('editing'))pane('presets');
    if(!fixed)for(const p of preset){
      const icon=$('[data-preset="'+p.key+'"] canvas');
      PawDrawing.portrait(icon,normalize(p.pet,p),p.pet==='chestnut',mode);
    }
    applyTemper();
    syncIdentity();
    inspect(view.inspection);
    if(persist)store('renderStyle',mode);
    fields();advance(frameTime);
    // Shader compilation on the first 3D frame can take longer than the idle-gap reset.
    if(!review)switchDuration=performance.now()/1000-frameTime;
    return true;
  }
  for(const b of $$('[data-style]'))b.onclick=()=>style(b.dataset.style);
  $('#mode-next').onclick=()=>{const modes=Object.keys(renderStyles),i=modes.indexOf(view.mode);
    if(!style(modes[(i+1)%modes.length]))style(modes[(i+2)%modes.length]);};
  const pixelFields=new Set(('headWidth headHeight headLift eyeWidth eyeHeight eyeSpace eyeLift eyeTilt eyeOpen pupilWidth glintSize eye eyeRight earLength earWidth earSpace earLift earAngle ear muzzleWidth noseWidth noseHeight noseLift whiskerLength whiskerSpread nose whisk bodyWidth bodyHeight shoulders hips pawWidth pawRound tailLength tailWidth tailLift paw pattern patternAmount patternShift bibAmount bibWidth bibHeight blaze muzzleMark sockLeft sockRight tailBands fur shade light stripe muzzle').split(' '));
  function visible(f){return view.mode==='volume'||(view.mode==="pixel"&&pixelFields.has(f.key));}
  for (const g of groups) {
    const tab = button(g.label);
    tab.dataset.group = g.key;
    tab.onclick = () => {
      group = g;
      fields();
    };
    $('#look-tabs').append(tab);
  }
  function refreshPreset() {
    for (const option of $$('[data-preset]'))
      option.setAttribute('aria-pressed', String(option.dataset.preset === drafts[id].preset));
  }
  function meter(f, value) {
    if (f.unit === '%') return Math.round(value*100) + '%';
    if (f.unit === '°') return value + '°';
    const x = Math.round(value*100);
    return x > 0 ? '+' + x : String(x);
  }
  function fields() {
    const { coat, form } = normalize(id, drafts[id]);
    const rows = [];
    if(!group.fields.some(visible))group=groups[0];
    $('#look-group-title').textContent = group.label;
    $('#coat-link').hidden = group.key !== 'colors';
    for (const tab of $$('[data-group]')) {
      tab.hidden=!groups.find(g=>g.key===tab.dataset.group).fields.some(visible);
      tab.setAttribute('aria-pressed', String(tab.dataset.group === group.key));
    }
    for (const f of group.fields.filter(visible)) {
      const row = document.createElement('label');
      row.className = 'look-field';
      const heading = document.createElement('div');
      const label = document.createElement('span');
      label.textContent = f.label;
      heading.append(label);
      const isColor = f.kind === 'color';
      const isRange = f.kind === 'range';
      const input = document.createElement(f.kind === 'select' ? 'select' : 'input');
      input.id = 'look-' + f.key;
      row.htmlFor = input.id;
      const output = document.createElement('output');
      if (isRange) {
        input.type = 'range';
        input.min = f.min;
        input.max = f.max;
        input.step = f.step;
        output.htmlFor = input.id;
        output.textContent = meter(f, form[f.key]);
        heading.append(output);
      } else if (isColor) {
        input.type = 'color';
      } else {
        for (const [value, name] of f.options) input.add(new Option(name, value));
      }
      input.value = isColor ? coat[f.key] : form[f.key];
      input.oninput = () => {
        const draft = drafts[id];
        if (f.key === 'eye' && !draft.coat.eyeRight)
          draft.coat.eyeRight = normalize(id, draft).coat.eyeRight;
        if (f.key === 'fur') setFur(draft, input.value);
        else if (isColor) draft.coat[f.key] = input.value;
        else draft.form[f.key] = isRange ? Number(input.value) : input.value;
        if (isRange) output.textContent = meter(f, Number(input.value));
        refreshPreset();
        editLook();
      };
      row.append(heading, input);
      rows.push(row);
    }
    $('#look-fields').replaceChildren(...rows);
  }
  function refreshSaved() {
    const pick = $('#pick-skin');
    pick.replaceChildren(new Option(saved.length ? '选择已保存的皮肤' : '还没有已保存的皮肤', ''));
    for (const look of saved)
      pick.add(new Option(look.name || names[look.pet], look.key));
    pick.value = activeSaved;
    $('#delete-skin').hidden = !activeSaved;
  }
  function refreshEditor() {
    $('#skin-name').value = drafts[id].name;
    syncIdentity();
    refreshSaved();
    refreshPreset();
    fields();
  }
  $('#skin-name').oninput = (e) => {
    drafts[id].name = skinName(e.target.value);
    syncIdentity();
    clearTimeout(persistTimer);
    persistTimer = setTimeout(writeLooks, 220);
  };
  $('#reset-group').onclick = () => {
    const draft = drafts[id];
    const base=basis();
    for (const f of group.fields.filter(visible)) {
      const key=f.kind==='color'?'coat':'form';
      if(base?.[key]?.[f.key]!==undefined) draft[key][f.key]=base[key][f.key];
      else delete draft[key][f.key];
    }
    refreshPreset();
    fields();
    editLook(id, true);
    notice('已重置「' + group.label + '」。');
  };
  $('#restore').onclick = () => {
    drafts[id] = basis()?presetDraft(basis()):draftOf({});
    activeSaved = '';
    applyTemper();syncIdentity();
    refreshEditor();
    editLook(id, true);
    notice('已恢复当前猫咪的默认外观。');
  };
  $('#keep-skin').onclick = () => {
    const draft = drafts[id];
    const name = draft.name || names[id] + '的皮肤';
    const prior = saved.find(p => p.key === activeSaved && p.pet === id && p.name === name);
    const key = prior?.key || (globalThis.crypto.randomUUID?.() ?? (Date.now() + '-' + Math.random()));
    const entry = { ...draftOf(draft), name, renderStyle:view.mode, pet: id, key };
    saved = [...saved.filter(p => p.key !== key), entry];
    draft.name = name;
    activeSaved = key;
    refreshEditor();
    $('#english').textContent = name;
    notice(writeLooks() ? '已保存「' + name + '」。' : '本机保存失败，可导出皮肤文件。');
  };
  $('#pick-skin').onchange = (e) => {
    const look = saved.find(p => p.key === e.target.value);
    if (!look) {
      activeSaved = '';
      refreshSaved();
      return;
    }
    drafts[look.pet] = draftOf(look);
    select(look.pet);
    style(look.renderStyle);
    activeSaved = look.key;
    refreshSaved();
    editLook(look.pet, true);
    notice('已载入「' + look.name + '」。');
  };
  $('#delete-skin').onclick = () => {
    const look = saved.find(p => p.key === activeSaved);
    if (!look || !window.confirm('删除已保存的「' + look.name + '」？')) return;
    saved = saved.filter(p => p.key !== activeSaved);
    activeSaved = '';
    refreshSaved();
    writeLooks();
    notice('已删除该收藏。');
  };
  function setFur(draft, hex) {
    const tones = linkCoat.checked ? paletteFromFur(hex) : { fur: hex };
    Object.assign(draft.coat, tones);
    for (const [key, value] of Object.entries(tones)) {
      const swatch = $('#look-' + key);
      if (swatch && swatch.value !== value) swatch.value = value;
    }
  }
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
    setFur(drafts[id], hex);
    refreshPreset();
    editLook();
    notice('已取色，可继续点击照片调整。');
  }
  let photoRead = 0;
  $('#photo').onchange = async (e) => {
    const file = e.target.files[0],
      pet = id;
    if (!file) return;
    const sequence = ++photoRead;
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
      if (pet !== id || sequence !== photoRead) return;
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
      if (sequence === photoRead) e.target.value = '';
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
  $('#snap').onclick = () => {
    repaint();
    view.surface.toBlob(blob=>{
      if(blob)download(blob,(drafts[id].name||names[id])+'-'+renderStyles[view.mode]+'.png');
    });
  };
  $('#save').onclick = () => {
    const name = drafts[id].name || names[id];
    const file = { format: 'pawside-three', version: 3, pet: id, name, renderStyle:view.mode,
      temperament:drafts[id].temperament, preset:drafts[id].preset, ...normalize(id, drafts[id]) };
    download(new Blob([JSON.stringify(file,null,2)], { type: 'application/json' }), name + '.pawside.json');
    notice('已导出完整皮肤。');
  };
  let fileRead = 0;
  $('#load').onchange = async (e) => {
    const sequence = ++fileRead, file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 16384) throw Error();
      const look = readFile(JSON.parse(await file.text()));
      if (sequence !== fileRead) return;
      drafts[look.pet] = draftOf(look);
      select(look.pet);
      if(look.renderStyle)style(look.renderStyle);
      editLook(look.pet, true);
      notice('已导入皮肤，可以继续编辑。');
    } catch {
      if (sequence === fileRead) notice('请选择工作室导出的皮肤 JSON。');
    } finally {
      if (sequence === fileRead) e.target.value = '';
    }
  };
  const arrival = new URLSearchParams(location.search);
  const incoming = !desktop && preset.find(p => p.key === arrival.get('preset'));
  if (incoming) {
    const fresh = presetDraft(incoming);
    const fur = arrival.get('fur');
    if (/^#[\da-f]{6}$/i.test(fur || '')) Object.assign(fresh.coat, paletteFromFur(fur));
    for (const [param, field] of [['head', 'headWidth'], ['ear', 'earLength']]) {
      const value = arrival.get(param);
      if (value && /^\d{2,3}$/.test(value)) fresh.form[field] = Number(value) / 100;
    }
    drafts[incoming.pet] = draftOf(fresh);
  }
  for (const p of pets)view.skin(p,drafts[p]);
  select(incoming?.pet || get('pet', 'ink'),false);
  resize();
  const priorStyle=get('renderStyle',null);
  const requestedStyle = incoming && arrival.get('style');
  const initialStyle = Object.hasOwn(renderStyles, requestedStyle)
    ? requestedStyle
    : priorStyle || (library?.drafts || Object.keys(oldCoats || {}).length ? 'volume' : 'paper');
  if(!style(initialStyle,false)){
    style('paper',false);
    $('#fail').hidden=false;
    $('#fail').textContent='当前设备已使用 2D。Pawside 3D 需要 WebGL。';
  }
  if (!priorStyle && !incoming) store('renderStyle', view.mode);
  if (incoming && view.mode!=='paper') {
    pane('edit');
    inspect('face');
    advance(now());
  }
  Paw2D.ready.then(()=>{
    if (view.mode==='paper') advance(now());
  }).catch(()=>{
    if (view.mode==='paper') {
      style('pixel',false);
      notice('2D 图片载入失败，已切到像素风。');
    }
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
        frames.wake();
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
        frames.wake();
        return;
      }
      if (e.type === 'mouse') {
        if (motion.moveMouse(e.x, e.y, t, e.click)) frames.wake();
        return;
      }
      key(e.code, e.type === 'down', e.repeat, t);
    });
    $('#system').onclick = () => desktop.toggleInput();
    $('#studio').onclick = () => desktop.studio();
    $('#quit').onclick = () => desktop.quit();
    $('#switch').onclick=()=>{
      if(view.mode==='paper' && !style('volume'))style('pixel');
      const i=preset.findIndex(p=>p.key===drafts[id].preset);
      applyPreset(preset[(i+1)%preset.length]);
    };
    window.addEventListener('storage', e=>{
      if(e.key==='pawside.3d.renderStyle'){
        const next=get('renderStyle','paper');if(next!==view.mode)style(next,false);
      }
      if(e.key==='pawside.3d.pet'){
        const next=get('pet','ink');if(next!==id)select(next,false);
      }
      if(e.key==='pawside.3d.skinStudio'){
        const next=get('skinStudio',{});
        variants=readVariants(next.variants);saved=readSaved(next.saved);
        for(const p of pets){
          const fresh=draftOf(next.drafts?.[p]);
          if(JSON.stringify(fresh)!==JSON.stringify(drafts[p])){
            drafts[p]=fresh;view.skin(p,fresh);
          }
        }
        applyTemper();syncIdentity();refreshEditor();advance(now());
      }
    });
  }
  // Deterministic film uses this same scene and input schedule, including native/keyboard handlers above.
  globalThis.pawReview = {
    begin(p, w, h, action = 'demo', renderStyle = 'volume') {
      if (covered()) return false;
      review = true;
      watchFrames();
      select(p, false);
      if(!style(renderStyle,false))return false;
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
        id, renderStyle:view.mode, preset:drafts[id].preset, temperament:drafts[id].temperament,
        held:[...motion.held.keys()], appearance:normalize(id,drafts[id]), script:activeScript,
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
        gaze: [...motion.gaze],
        cursorLook: motion.cursorLook,
        driver: THREE.REVISION,
      };
    },
    get view(){return view.active;},
  };
  function watchFrames() {
    frames.setEnabled(!review && !document.hidden);
  }
  watchFrames();
})();
