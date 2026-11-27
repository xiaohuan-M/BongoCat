/* Use display frames for input. Between idle draws, let the browser sleep. */
(function (root) {
  'use strict';

  function createFrameLoop(render, rate) {
    let enabled = false, frame = null, timer = null, lastDraw = -Infinity;

    function request() {
      frame = requestAnimationFrame(tick);
    }

    function tick() {
      frame = null;
      if (!enabled) return;
      lastDraw = performance.now();
      render();
      if (!enabled || frame !== null) return;
      const fps = rate();
      if (!fps) {
        request();
        return;
      }

      // Enter the next display frame near the target interval, including time
      // spent drawing the last frame. Input can cancel this timer at any point.
      const delay = Math.max(0, 1000 / fps - (performance.now() - lastDraw) - 7);
      timer = setTimeout(() => {
        timer = null;
        if (enabled) request();
      }, delay);
    }

    function wake(ambient = false) {
      if (!enabled || frame !== null) return;
      if (ambient && performance.now() - lastDraw < 29) return;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      request();
    }

    function setEnabled(next) {
      if (enabled === next) return;
      enabled = next;
      if (enabled) {
        request();
      } else {
        if (frame !== null) cancelAnimationFrame(frame);
        if (timer !== null) clearTimeout(timer);
        frame = timer = null;
      }
    }

    return { setEnabled, wake };
  }

  root.PawFrames = { createFrameLoop };
})(globalThis);
