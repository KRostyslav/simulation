/**
 * Диспетчер сцени: тримає канву, вибирає, що малювати, і крутить кадри.
 *
 * Рухається тут лише одне — носії на схемі стенда. Усе інше перемальовується
 * з нуля зі знімка моделі, тому картинка не може «запам'ятати» старий стан
 * і розійтися з числами в панелі.
 */

import { createPixelCanvas, clear, PALETTE } from "@edu/pixel-ui";

import { MODE, VIEW } from "../physics/constants.js";
import { createCircuitScene } from "./circuit.js";
import { drawIvPlot, drawReversePlot } from "./plot.js";
import { drawFamily } from "./family.js";
import { drawScope } from "./scope.js";

export const WIDTH = 320;
export const HEIGHT = 192;

const PLOT_BOX = { x: 30, y: 8, w: WIDTH - 42, h: HEIGHT - 30 };

export function createScene({ parent }) {
  const pixel = createPixelCanvas({ width: WIDTH, height: HEIGHT, parent, maxScale: 4 });
  const circuit = createCircuitScene();
  const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");

  let snapshot = null;
  let view = VIEW.circuit;
  let logScale = false;
  let showTheory = false;
  let last = 0;
  let raf = 0;
  let data = null;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!snapshot) return;
    // Обрізання кроку: після повернення на вкладку dt міг би бути кілька
    // секунд, і носії стрибнули б через півсхеми.
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    draw(dt);
  }

  function draw(dt) {
    const { ctx } = pixel;
    clear(ctx, PALETTE.crystal, WIDTH, HEIGHT);

    if (snapshot.mode === MODE.rectifier) {
      data = drawScope(ctx, PLOT_BOX, snapshot);
      return;
    }
    if (view === VIEW.circuit) {
      data = null;
      circuit.draw(ctx, snapshot, dt, { reduced: reducedMotion?.matches ?? false });
      return;
    }
    if (snapshot.mode === MODE.breakdown) {
      data = drawReversePlot(ctx, PLOT_BOX, snapshot);
      return;
    }
    if (snapshot.mode === MODE.materials || snapshot.mode === MODE.temperature) {
      data = drawFamily(ctx, PLOT_BOX, snapshot, { showTheory });
      return;
    }
    data = drawIvPlot(ctx, PLOT_BOX, snapshot, {
      logScale: view === VIEW.analysis || logScale,
      withTheory: showTheory,
    });
  }

  return {
    canvas: pixel.canvas,
    box: PLOT_BOX,
    get data() {
      return data;
    },
    setSnapshot(next) {
      snapshot = next;
    },
    setView(next) {
      view = next;
    },
    setOptions({ log, theory }) {
      if (log != null) logScale = log;
      if (theory != null) showTheory = theory;
    },
    start() {
      if (!raf) raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
    /** Один кадр без циклу — для тестів рендера. */
    renderOnce(dt = 0.016) {
      draw(dt);
      return data;
    },
  };
}
