/**
 * Диспетчер сцени: тримає канву, вибирає, що малювати, і крутить кадри.
 *
 * Частинкова система — єдине, що живе між кадрами; усе інше перемальовується
 * з нуля зі знімка моделі. Тому картинка не може «запам'ятати» старий стан
 * і розійтися з числами в панелі.
 */

import { createPixelCanvas, clear, crystalTint, PALETTE, rect } from "@edu/pixel-ui";

import { MODE } from "../physics/constants.js";
import { createLattice, brokenBondCount } from "./lattice.js";
import { createParticles, particleTargets, motionFromSnapshot } from "./particles.js";
import { createLadder } from "./ladder.js";
import { createJunctionScene } from "./junction.js";
import { drawConductivityPlot, drawIvPlot } from "./plot.js";

export const WIDTH = 320;
export const HEIGHT = 192;

export const VIEW = { scene: "scene", plot: "plot" };

const CRYSTAL_BOX = { x: 0, y: 0, w: WIDTH, h: 152 };
const BOTTOM_BOX = { x: 6, y: 154, w: WIDTH - 12, h: 36 };
const PLOT_BOX = { x: 26, y: 10, w: WIDTH - 38, h: HEIGHT - 30 };

export function createScene({ parent }) {
  const pixel = createPixelCanvas({ width: WIDTH, height: HEIGHT, parent, maxScale: 4 });
  const lattice = createLattice({ x: 6, y: 6, w: WIDTH - 12, h: CRYSTAL_BOX.h - 12 });
  const particles = createParticles({
    bounds: { x: 8, y: 8, w: WIDTH - 16, h: CRYSTAL_BOX.h - 16 },
  });
  const ladder = createLadder(BOTTOM_BOX);
  // Сцена переходу починається нижче за кристалічну: над нею потрібна смуга
  // під підписи «p-область», «n-область» і ширину шару, які інакше лягали б
  // просто на рамку сцени.
  const junction = createJunctionScene({ x: 6, y: 20, w: WIDTH - 12, h: CRYSTAL_BOX.h - 26 });

  const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");

  let snapshot = null;
  let view = VIEW.scene;
  let logIv = false;
  let phase = 0;
  let last = 0;
  let raf = 0;
  let plotRange = null;

  function drawCrystal(dt) {
    const { ctx } = pixel;
    clear(ctx, crystalTint(snapshot.values.temperature), WIDTH, HEIGHT);
    rect(ctx, 0, 0, WIDTH, CRYSTAL_BOX.h, PALETTE.crystal);

    lattice.draw(ctx, {
      dopant: snapshot.state.dopant,
      doping: snapshot.values.doped,
      broken: brokenBondCount(snapshot.values.ni),
    });

    particles.update(dt, particleTargets(snapshot), motionFromSnapshot(snapshot, {
      reduced: reducedMotion?.matches ?? false,
    }));
    particles.draw(ctx);

    ladder.draw(ctx, {
      n: snapshot.values.n,
      p: snapshot.values.p,
      ni: snapshot.values.ni,
      doping: snapshot.values.doped,
      equilibrium: snapshot.carrier.equilibrium,
    });
  }

  function drawJunction(dt) {
    const { ctx } = pixel;
    clear(ctx, PALETTE.void, WIDTH, HEIGHT);
    phase = (phase + dt * 0.45) % 1;
    junction.draw(ctx, snapshot, reducedMotion?.matches ? 0.35 : phase);
    junction.drawPotential(ctx, BOTTOM_BOX, snapshot);
  }

  function drawPlot() {
    const { ctx } = pixel;
    clear(ctx, PALETTE.void, WIDTH, HEIGHT);
    plotRange =
      snapshot.mode === MODE.junction
        ? drawIvPlot(ctx, PLOT_BOX, snapshot, { logScale: logIv })
        : drawConductivityPlot(ctx, PLOT_BOX, snapshot);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!snapshot) return;
    // Обрізаємо dt: після повернення на вкладку різниця може бути в секунди,
    // і система стрибнула б через усі проміжні стани одразу.
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;

    if (view === VIEW.plot) drawPlot();
    else if (snapshot.mode === MODE.junction) drawJunction(dt);
    else drawCrystal(dt);
  }

  return {
    canvas: pixel.canvas,

    setSnapshot(next) {
      // Зміна режиму означає інший кристал — старі носії до нього не належать.
      if (snapshot && snapshot.mode !== next.mode) particles.reset();
      snapshot = next;
    },

    setView(next) {
      view = next;
    },

    setLogIv(next) {
      logIv = next;
    },

    get plotRange() {
      return plotRange;
    },

    get boxes() {
      return { crystal: CRYSTAL_BOX, bottom: BOTTOM_BOX, plot: PLOT_BOX };
    },

    start() {
      if (!raf) raf = requestAnimationFrame(frame);
    },

    destroy() {
      cancelAnimationFrame(raf);
      raf = 0;
      pixel.destroy();
    },
  };
}
