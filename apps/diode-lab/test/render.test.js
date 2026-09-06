/**
 * Рендер. Перевіряємо не «як виглядає», а те, що взагалі можна перевірити
 * автоматично: жодної нескінченної координати, жодного зациклення й жодної
 * виродженої шкали.
 *
 * Це не формальність. Виродження діапазону цілком реальне: поки в таблиці
 * одна точка, максимум дорівнює мінімуму, різниця стає нулем, і поділ 0/0
 * дав би NaN. У браузері це означає порожній графік без жодного повідомлення
 * про помилку, а в Брезенхемі — нескінченний цикл і мертво зависла вкладка.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { snapshot, initialState } from "../src/physics/model.js";
import { MODE } from "../src/physics/constants.js";
import { DEVICES } from "../src/physics/devices.js";
import { drawIvPlot, drawReversePlot, ivPlotData } from "../src/render/plot.js";
import { drawFamily } from "../src/render/family.js";
import { drawScope } from "../src/render/scope.js";
import { createCircuitScene } from "../src/render/circuit.js";
import { addPoint, emptyTable, seriesKey } from "../src/physics/measurements.js";
import { operatingPoint } from "../src/physics/circuit.js";

function strictContext(label) {
  let calls = 0;
  return {
    fillStyle: "",
    fillRect(x, y, w, h) {
      calls += 1;
      if (calls > 5e5) throw new Error(`${label}: рендер не завершується`);
      for (const [name, value] of [
        ["x", x],
        ["y", y],
        ["w", w],
        ["h", h],
      ]) {
        assert.ok(Number.isFinite(value), `${label}: ${name} = ${value}`);
      }
    },
    get calls() {
      return calls;
    },
  };
}

const BOX = { x: 30, y: 8, w: 278, h: 162 };

/** Таблиця з заданою кількістю точок, знятих без шуму — для передбачуваності. */
function tableWith(count, { deviceId = "si", temperature = 300 } = {}) {
  const device = DEVICES.find((d) => d.id === deviceId);
  const key = seriesKey({ deviceId, temperature });
  let table = emptyTable();
  for (let i = 0; i < count; i += 1) {
    const emf = 0.4 + (i * 2.4) / Math.max(1, count - 1);
    const op = operatingPoint({ device, temperature, emf, resistance: 1000 });
    table = addPoint(table, key, {
      voltage: Math.round(op.diodeVoltage * 1000) / 1000,
      current: op.current,
      counts: 500,
      resolutionU: 1e-3,
    });
  }
  return table;
}

test("ВАХ малюється при 0, 1, 2 і 40 точках", () => {
  for (const count of [0, 1, 2, 5, 40]) {
    for (const logScale of [false, true]) {
      const snap = snapshot(initialState(), tableWith(count));
      const ctx = strictContext(`ВАХ, ${count} точок, лог=${logScale}`);
      const data = drawIvPlot(ctx, BOX, snap, { logScale, withTheory: true });
      assert.ok(ctx.calls > 0, "щось таки мало намалюватись");
      assert.ok(Number.isFinite(data.yMin) && Number.isFinite(data.yMax));
      assert.ok(Number.isFinite(data.xMax) && data.xMax > 0);
    }
  }
});

test("шкала не вироджується навіть на одній точці", () => {
  for (const count of [0, 1, 2]) {
    const snap = snapshot(initialState(), tableWith(count));
    for (const logScale of [false, true]) {
      const data = ivPlotData(snap, { logScale });
      assert.ok(
        data.yMax > data.yMin,
        `${count} точок, лог=${logScale}: шкала [${data.yMin}, ${data.yMax}]`,
      );
      assert.ok(data.xMax > data.xMin);
    }
  }
});

test("схема стенда малюється при будь-якому струмі", () => {
  const scene = createCircuitScene();
  for (const emf of [0, 0.5, 2, 5, -5, -20]) {
    for (const deviceId of ["si", "ge", "zener"]) {
      const snap = snapshot({ ...initialState(), emf, deviceId });
      const ctx = strictContext(`схема E=${emf} ${deviceId}`);
      scene.draw(ctx, snap, 0.016, { reduced: false });
      assert.ok(ctx.calls > 0);
      // Той самий кадр із вимкненою анімацією теж мусить малюватись.
      scene.draw(ctx, snap, 0.016, { reduced: true });
    }
  }
});

test("зворотна вітка з двомасштабною віссю малюється й не вироджується", () => {
  for (const deviceId of ["si", "zener"]) {
    for (const count of [0, 4]) {
      const snap = snapshot(
        { ...initialState(), mode: MODE.breakdown, deviceId, emf: -8 },
        tableWith(count, { deviceId }),
      );
      const ctx = strictContext(`пробій ${deviceId}, ${count} точок`);
      const data = drawReversePlot(ctx, BOX, snap);
      assert.ok(data.forwardMax > 0 && data.reverseMax > 0);
      assert.ok(data.depth > data.vbr, "шкала мусить сягати за напругу пробою");
    }
  }
});

test("сімейство кривих малюється при різному числі серій", () => {
  let table = emptyTable();
  for (const count of [0, 1, 2]) {
    const snap = snapshot({ ...initialState(), mode: MODE.materials }, table);
    const ctx = strictContext(`сімейство, ${count} серій`);
    const data = drawFamily(ctx, BOX, snap, { showTheory: true });
    assert.ok(data.yMax > data.yMin);
    assert.equal(data.series.length, count);
    table =
      count === 0
        ? tableWith(8)
        : { ...table, ...tableWith(8, { deviceId: "ge" }) };
  }
});

test("осцилограма малюється з ємністю й без, і при закритому діоді", () => {
  for (const capacitance of [0, 100e-6]) {
    for (const amplitude of [0.2, 10]) {
      for (const bridge of [false, true]) {
        const snap = snapshot({
          ...initialState(),
          mode: MODE.rectifier,
          capacitance,
          amplitude,
          bridge,
        });
        const ctx = strictContext(`осцилограма C=${capacitance} U=${amplitude}`);
        const data = drawScope(ctx, BOX, snap);
        assert.ok(data.peak > 0, "масштаб не може бути нульовим");
        assert.ok(ctx.calls > 0);
      }
    }
  }
});

test("дані графіка кешуються за знімком — інакше підписи розійшлися б із кривою", () => {
  const snap = snapshot(initialState(), tableWith(10));
  const first = ivPlotData(snap, { logScale: true });
  const second = ivPlotData(snap, { logScale: true });
  assert.equal(first, second, "той самий знімок мусить дати той самий об'єкт");
  assert.notEqual(first, ivPlotData(snap, { logScale: false }));
});
