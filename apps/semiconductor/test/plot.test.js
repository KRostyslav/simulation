import test from "node:test";
import assert from "node:assert/strict";

import { drawConductivityPlot, drawIvPlot } from "../src/render/plot.js";
import { snapshot, initialState } from "../src/physics/model.js";
import { MODE } from "../src/physics/constants.js";
import { DOPANT } from "../src/physics/doping.js";

const BOX = { x: 26, y: 10, w: 282, h: 162 };

/** Мінімальний контекст канви з запобіжником від нескінченного примітива. */
function stubContext() {
  let calls = 0;
  return {
    fillStyle: "",
    fillRect() {
      calls += 1;
      if (calls > 5e5) throw new Error("рендер не завершується");
    },
    get calls() {
      return calls;
    },
  };
}

test("шкала ВАХ ніколи не вироджується в нульовий діапазон", () => {
  // При глибокому охолодженні весь струм тоне під нижньою межею шкали.
  // Нульовий діапазон дав би поділ 0/0, координати-NaN і зациклений
  // Брезенхем — тобто мертве зависання вкладки.
  for (const temperature of [100, 120, 150, 300, 700]) {
    for (const doping of [1e14, 1e16, 1e19]) {
      const snap = snapshot({
        ...initialState(),
        mode: MODE.junction,
        temperature,
        junctionNa: doping,
        junctionNd: doping,
        bias: 0.5,
      });
      const range = drawIvPlot(stubContext(), BOX, snap, { logScale: true });
      assert.ok(range.yMax > range.yMin, `T=${temperature}, N=${doping}: ${JSON.stringify(range)}`);
      assert.ok(Number.isFinite(range.yMin) && Number.isFinite(range.yMax));
    }
  }
});

test("ВАХ у лінійній шкалі малюється в усіх станах", () => {
  for (const temperature of [100, 300, 700]) {
    for (const bias of [-10, -1, 0, 0.5, 1]) {
      const snap = snapshot({ ...initialState(), mode: MODE.junction, temperature, bias });
      const ctx = stubContext();
      const range = drawIvPlot(ctx, BOX, snap, { logScale: false });
      assert.ok(ctx.calls > 0, `нічого не намальовано при T=${temperature}, U=${bias}`);
      assert.ok(range.yMax > range.yMin);
    }
  }
});

test("графік провідності малюється при будь-якому легуванні й освітленні", () => {
  for (const dopant of [DOPANT.none, DOPANT.donor, DOPANT.acceptor]) {
    for (const doping of [1e12, 1e16, 1e19]) {
      for (const suns of [0, 10]) {
        const snap = snapshot({ ...initialState(), dopant, doping, suns });
        const ctx = stubContext();
        const range = drawConductivityPlot(ctx, BOX, snap);
        assert.ok(ctx.calls > 0);
        assert.ok(range.yMax > range.yMin, JSON.stringify(range));
      }
    }
  }
});
