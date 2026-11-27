/* The three renderers share the motion driver and the studio's saved appearance. */
(function () {
  'use strict';
  function portrait(canvas, look, long, mode) {
    if (mode === 'pixel') {
      PawPixels.portrait(canvas, look, long);
      return;
    }
    canvas.width = 140;
    canvas.height = 114;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.translate(35, 37);
    ctx.scale(.43, .43);
    ctx.lineCap = ctx.lineJoin = 'round';
    PawArt.head(ctx, look, long, { anger:0, ear:0, open:1, gx:0, gy:0, tail:0 });
  }

  class StudioView {
    constructor(flat, depth) {
      this.flatCanvas = flat;
      this.depthCanvas = depth;
      this.twoD = new Paw2D.View(flat);
      this.pixel = new PawPixels.View(flat);
      this.active = this.twoD;
      this.mode = 'paper';
      this.id = 'ink';
      this.inspection = 'desk';
      this.drafts = new Map();
      this.pending = new Set();
      this.private = false;
      for (const id of ['ink', 'chestnut']) this.skin(id, {});
    }
    get surface() { return this.active.surface ?? this.depthCanvas; }
    set privateKeys(on) {
      this.private = on;
      this.twoD.privateKeys = on;
      this.pixel.privateKeys = on;
      if (this.volume) this.volume.privateKeys = on;
    }
    select(id) {
      this.id = id;
      this.pixel.select(id);
      if (this.mode === 'volume') this.applyDepth();
    }
    skin(id, draft) {
      this.drafts.set(id, draft);
      this.pixel.skin(id, draft);
      this.pending.add(id);
      if (this.mode === 'volume' && id === this.id) this.applyDepth();
    }
    applyDepth() {
      const draft = this.drafts.get(this.id);
      if (this.pending.delete(this.id)) this.volume.skin(this.id, draft);
      else this.volume.select(this.id, draft);
    }
    setStyle(mode) {
      if (!Object.hasOwn(PawLooks.renderStyles, mode)) return false;
      if (mode === 'volume') {
        if (!this.volume) {
          try {
            this.volume = new PawScene.View(this.depthCanvas, {
              id: this.id,
              appearance: this.drafts.get(this.id),
            });
            this.pending.delete(this.id);
          }
          catch { return false; }
        }
        this.volume.privateKeys = this.private;
      }
      this.mode = mode;
      this.active = mode === 'volume' ? this.volume : mode === 'pixel' ? this.pixel : this.twoD;
      this.flatCanvas.hidden = mode === 'volume';
      this.depthCanvas.hidden = mode !== 'volume';
      this.select(this.id);
      this.inspect(this.inspection);
      if (this.size) this.active.resize(...this.size);
      return true;
    }
    inspect(pose) {
      this.inspection = this.mode !== 'volume' && ['angle', 'profile'].includes(pose) ? 'face' : pose;
      this.active.inspect(this.inspection);
    }
    resize(...dimensions) {
      this.size = dimensions;
      this.active.resize(...dimensions);
    }
    hit(x,y) { return this.active.hit(x,y); }
    render(m,t) { this.active.render(m,t); }
    snapshot() { return this.active.snapshot(); }
  }
  window.PawDrawing = { StudioView, portrait };
})();
