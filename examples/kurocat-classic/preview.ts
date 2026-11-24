import { KuroCatEngine } from './upstream/src/catEngine';
import { BUILTIN_WEB_CATS } from './upstream/website/src/builtinCats';
import { keyboardEventToVk } from './upstream/website/src/webKeyMap';

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
const password = document.querySelector<HTMLInputElement>('input[type=password]')!;
const engine = new KuroCatEngine(canvas, { embedded: true });
engine.setCatAppearance('black', BUILTIN_WEB_CATS.find(cat => cat.id === 'black')!);
engine.setKeyboardConfig('65', 'cat');
engine.start();

const keys = new Set<number>();
const buttons = new Set<string>();
const buttonName = (n: number) => ['left', 'middle', 'right'][n];
function releaseAll() {
  for (const key of keys) engine.onKeyUp(key);
  for (const button of buttons) engine.onMouseUp(button);
  keys.clear();
  buttons.clear();
}
window.addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { releaseAll(); engine.stop(); }
  else engine.start();
});
password.addEventListener('focus', () => { releaseAll(); engine.setPrivacyMode(true); });
password.addEventListener('blur', () => { password.value = ''; engine.setPrivacyMode(false); });
document.addEventListener('keydown', event => {
  if (event.isComposing || event.target === password || event.metaKey || event.ctrlKey || event.altKey || event.key === 'Tab') return;
  const vk = keyboardEventToVk(event);
  if (vk === null) return;
  if (event.target === canvas) event.preventDefault();
  keys.add(vk);
  engine.onKeyDown(vk, event.repeat);
});
document.addEventListener('keyup', event => {
  const vk = keyboardEventToVk(event);
  if (vk !== null && keys.delete(vk)) engine.onKeyUp(vk);
});
canvas.addEventListener('pointermove', event => {
  const r = canvas.getBoundingClientRect(), size = engine.getLogicalSize();
  const scale = Math.min(r.width*.86/size.w, r.height*.86/size.h);
  const w = scale*size.w, h = scale*size.h;
  const x = event.clientX-r.left, y = event.clientY-r.top;
  const nx = (x-(r.width-w)*.5)/w, ny = (y-(r.height-h)*.52)/h;
  engine.onWindowCursor(nx,ny,nx>=.30 && nx<=.72 && ny>=.14 && ny<=.52);
  engine.onPointerSpeedSample(event.clientX/1440,event.clientY/1440);
  engine.onGlobalMouseMove(x/r.width,y/r.height);
});
canvas.addEventListener('pointerdown', event => {
  const name = buttonName(event.button);
  if (!name) return;
  canvas.focus();
  canvas.setPointerCapture(event.pointerId);
  buttons.add(name);
  engine.onMouseDown(name);
});
window.addEventListener('pointerup', event => {
  const name = buttonName(event.button);
  if (buttons.delete(name)) engine.onMouseUp(name);
});
canvas.addEventListener('pointercancel', releaseAll);
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('wheel', () => engine.onMouseWheel(), { passive: true });
new ResizeObserver(() => engine.resize()).observe(canvas);
