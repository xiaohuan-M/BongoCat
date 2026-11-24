'use strict';
const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  screen,
  powerMonitor,
  systemPreferences,
  dialog,
} = require('electron');
const path = require('node:path');
const { layout } = require('../web/motion.js');
const { watchField } = require('./field-guard.cjs');

const entry = path.join(__dirname, '../web/index.html');
const prefs = {
  preload: path.join(__dirname, 'preload.cjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  backgroundThrottling: false,
};
let mini,
  studio,
  hook,
  listening = false;
let lastMouse = -Infinity,
  buttonMask = 0;
let stopProbe,
  pulseTimer,
  activity = 0,
  protectedExternal = false,
  studioPrivate = false;
function inside() {
  return Boolean(mini?.isFocused() || studio?.isFocused());
}
function updateCover() {
  activity = 0;
  const on = inside()
    ? Boolean(studio?.isFocused() && studioPrivate)
    : protectedExternal;
  send({ type: 'privacy', on });
}
function startPrivacy() {
  stopProbe = watchField((state) => {
    if (state === 'unknown') return;
    const on = state === 'protected';
    if (protectedExternal !== on) {
      protectedExternal = on;
      if (!inside()) updateCover();
    }
  });
  pulseTimer = setInterval(() => {
    const level = activity > 3 ? 3 : activity > 1 ? 2 : activity ? 1 : 0;
    activity = 0;
    if (level && listening && !inside() && !protectedExternal)
      send({ type: 'activity', level });
  }, 400);
}

function send(event) {
  if (mini && !mini.isDestroyed() && !mini.webContents.isDestroyed())
    mini.webContents.send('paw:input', event);
}
function stopInput() {
  if (listening) {
    listening = false;
    hook.stop();
  }
  stopProbe?.();
  stopProbe = null;
  clearInterval(pulseTimer);
  activity = 0;
  protectedExternal = false;
  buttonMask = 0;
  send({ type: 'status', enabled: false });
}
function connectInput() {
  if (hook) return;
  hook = require('uiohook-napi').uIOhook;
  // Outside the studio we do not inspect the key code or forward per-key events.
  hook.on('keydown', () => {
    if (listening && !inside() && !protectedExternal)
      activity = Math.min(4, activity + 1);
  });
  function point(event, click) {
    if (!listening) return;
    const now = performance.now();
    if (!click && now - lastMouse < 42) return;
    lastMouse = now;
    const pt = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(pt).bounds;
    const x = (2 * (pt.x - display.x)) / display.width - 1;
    const y = 1 - (2 * (pt.y - display.y)) / display.height;
    send({ type: 'mouse', x, y, click });
  }
  hook.on('mousemove', (event) => point(event, false));
  function updateButton(event, down) {
    if (!listening || ![1, 2, 3].includes(event.button)) return;
    const bit = 1 << (event.button - 1);
    buttonMask = down ? buttonMask | bit : buttonMask & ~bit;
    if (down) point(event, true);
    send({ type: 'buttons', mask: buttonMask });
  }
  hook.on('mousedown', (event) => updateButton(event, true));
  hook.on('mouseup', (event) => updateButton(event, false));
  hook.on('wheel', (event) => {
    if (!listening || event.direction !== 3 || !event.rotation) return;
    point(event, true);
    send({ type: 'wheel', steps: Math.max(-3, Math.min(3, event.rotation)) });
  });
}
async function toggleInput() {
  if (listening) return stopInput();
  if (
    process.platform === 'darwin' &&
    !systemPreferences.isTrustedAccessibilityClient(true)
  ) {
    await dialog.showMessageBox(mini, {
      type: 'info',
      message:
        '在系统设置中允许此应用使用辅助功能和输入监控，然后再点一次「跟随系统键鼠」。',
    });
    return;
  }
  try {
    connectInput();
    hook.start();
    listening = true;
    startPrivacy();
    send({ type: 'status', enabled: true });
  } catch (error) {
    stopInput();
    await dialog.showMessageBox(mini, {
      type: 'warning',
      message: '系统键鼠暂时无法连接。可以打开工作室，在窗口里打字。',
      detail: error.message,
    });
  }
}
function guard(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  for (const ev of ['blur', 'focus'])
    win.on(ev, () => {
      if (listening) {
        send({ type: 'reset' });
        updateCover();
      }
    });
  win.setMenuBarVisibility(false);
  return win;
}
function openStudio() {
  if (studio && !studio.isDestroyed()) {
    studio.restore();
    studio.focus();
    return;
  }
  studio = guard(
    new BrowserWindow({
      title: '爪边工作室',
      width: 1110,
      height: 780,
      minWidth: 400,
      minHeight: 400,
      webPreferences: prefs,
    })
  );
  studio.on('closed', () => {
    studio = null;
    studioPrivate = false;
    if (listening) updateCover();
  });
  studio.loadFile(entry).catch(() => studio?.close());
}
function createMini() {
  const area = screen.getPrimaryDisplay().workArea;
  const width = Math.min(420, area.width),
    height = Math.round(width / 1.46);
  mini = guard(
    new BrowserWindow({
      title: '爪边 Pawside',
      width,
      height,
      x: area.x + area.width - width - 18,
      y: area.y + area.height - height - 14,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      hasShadow: false,
      alwaysOnTop: true,
      webPreferences: prefs,
    })
  );
  mini.webContents.on('context-menu', () =>
    Menu.buildFromTemplate([
      {
        label: listening ? '暂停系统响应' : '跟随系统键鼠',
        click: toggleInput,
      },
      { label: '工作室', click: openStudio },
      { role: 'quit', label: '退出' },
    ]).popup({ window: mini })
  );
  mini.webContents.on('did-finish-load', () =>
    send({ type: 'status', enabled: listening })
  );
  mini.on('closed', () => {
    mini = null;
    app.quit();
  });
  mini.loadFile(entry, { query: { desktop: '1' } }).catch(() => app.quit());
}
// Only our focused studio's local DOM can identify the target of a specific key.
ipcMain.on('paw:local', (event, packet) => {
  if (
    !studio ||
    event.sender !== studio.webContents ||
    event.senderFrame !== studio.webContents.mainFrame ||
    !packet ||
    !studio.isFocused()
  )
    return;
  if (packet.type === 'privacy') {
    studioPrivate = packet.on === true;
    if (listening) updateCover();
  } else if (
    listening &&
    !studioPrivate &&
    ['down', 'up'].includes(packet.type) &&
    layout.has(packet.code)
  ) {
    send({
      type: packet.type,
      code: packet.code,
      repeat: packet.repeat === true,
    });
  }
});
app.setName('Pawside 3D');
for (const [channel, action] of [
  ['toggle', toggleInput],
  ['studio', openStudio],
  ['quit', () => app.quit()],
]) {
  ipcMain.on('paw:' + channel, (event) => {
    if (
      mini &&
      event.sender === mini.webContents &&
      event.senderFrame === mini.webContents.mainFrame
    )
      action();
  });
}
app.whenReady().then(() => {
  createMini();
  powerMonitor.on('suspend', stopInput);
  powerMonitor.on('lock-screen', stopInput);
});
app.on('will-quit', stopInput);
