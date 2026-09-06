/**
 * Випрямляч. Тут перевіряється, що схема поводиться так, як велить ВАХ,
 * знята на стенді, — і що згладжування справді згладжує.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { DEVICE_BY_ID } from "../src/physics/devices.js";
import { rectifierWaveform } from "../src/physics/rectifier.js";

const si = DEVICE_BY_ID.si;
const base = { device: si, temperature: 300, amplitude: 10, load: 1000 };

test("без згладжування середня напруга близька до U_m/π, але менша", () => {
  const w = rectifierWaveform(base);
  const ideal = 10 / Math.PI;
  assert.ok(w.uMean < ideal, "ідеальний діод недосяжний: своє бере падіння на ньому");
  assert.ok(w.uMean > 0.75 * ideal, `${w.uMean} В — завелика втрата`);
});

test("на виході однопівперіодного випрямляча немає від'ємної напруги", () => {
  const w = rectifierWaveform(base);
  for (const u of w.uOut) assert.ok(u >= -1e-9, `просочилась напруга ${u}`);
  // Провідність триває менше половини періоду: діод відкривається не в нулі,
  // а лише коли миттєва напруга перевищить його поріг.
  assert.ok(w.conductionFraction < 0.5, `кут відсічки зник: ${w.conductionFraction}`);
});

test("втрата на діоді дорівнює тим самим 0,7 В, що виміряні на стенді", () => {
  const w = rectifierWaveform(base);
  assert.ok(w.dropMean > 0.4 && w.dropMean < 1.2, `${w.dropMean} В`);
});

test("мостова схема подвоює середню напругу", () => {
  const half = rectifierWaveform(base);
  const bridge = rectifierWaveform({ ...base, bridge: true });
  const ratio = bridge.uMean / half.uMean;
  assert.ok(ratio > 1.6 && ratio < 2.2, `відношення ${ratio}`);
  assert.ok(bridge.conductionFraction > 0.8, "у мості струм тече обидва півперіоди");
});

test("зі зростанням ємності пульсації монотонно спадають", () => {
  let previous = Infinity;
  for (const capacitance of [0, 10e-6, 47e-6, 100e-6, 470e-6, 1000e-6]) {
    const w = rectifierWaveform({ ...base, capacitance });
    assert.ok(
      w.rippleFactor < previous,
      `при C = ${capacitance * 1e6} мкФ пульсації не зменшились`,
    );
    previous = w.rippleFactor;
  }
});

test("велика ємність підтягує напругу до амплітуди мінус падіння на діоді", () => {
  const w = rectifierWaveform({ ...base, capacitance: 1000e-6 });
  assert.ok(w.uMean > 7.5, `${w.uMean} В — конденсатор мусить тримати заряд`);
  assert.ok(w.uMean < 10, "але вище за амплітуду напруга піднятись не може");
  assert.ok(w.rippleFactor < 0.05, `k_п = ${w.rippleFactor}`);
});

test("амплітуда нижча за поріг діода не дає ні струму, ні NaN", () => {
  const w = rectifierWaveform({ ...base, amplitude: 0.2 });
  assert.ok(w.uMean < 1e-3, "діод не відкрився");
  for (const value of [w.uMean, w.uRms, w.rippleFactor, w.uMax]) {
    assert.ok(Number.isFinite(value), `${value} замість числа`);
  }
});

test("усе скінченне на всій сітці параметрів", () => {
  for (const device of [DEVICE_BY_ID.si, DEVICE_BY_ID.ge]) {
    for (const amplitude of [1, 5, 15]) {
      for (const load of [100, 1000, 10000]) {
        for (const capacitance of [0, 47e-6, 470e-6]) {
          const w = rectifierWaveform({
            device,
            temperature: 300,
            amplitude,
            load,
            capacitance,
            samples: 60,
          });
          for (const key of ["uMean", "uRms", "uMax", "ripple", "rippleFactor"]) {
            assert.ok(Number.isFinite(w[key]), `${key} = ${w[key]}`);
          }
          for (const u of w.uOut) assert.ok(Number.isFinite(u));
        }
      }
    }
  }
});
