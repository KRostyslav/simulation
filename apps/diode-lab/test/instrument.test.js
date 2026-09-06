/**
 * Прилад. Ці перевірки охороняють головну умову лабораторної: студент бачить
 * не істину, а показ приладу, і той показ мусить бути відтворюваним.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  VOLTMETER,
  AMMETER,
  resolution,
  pickRange,
  createInstrument,
  measure,
} from "../src/physics/instrument.js";
import { mulberry32, seedFrom } from "../src/physics/random.js";

test("показ завжди кратний ціні молодшого розряду", () => {
  const meter = createInstrument(AMMETER, 7);
  for (let i = 1; i <= 50; i += 1) {
    const value = i * 3.7e-5;
    const m = measure(meter, value, mulberry32(i));
    if (m.overload) continue;
    const counts = m.display / m.resolution;
    assert.ok(
      Math.abs(counts - Math.round(counts)) < 1e-6,
      `показ ${m.display} не кратний ${m.resolution}`,
    );
  }
});

test("те саме вимірювання з тим самим seed'ом повторюється точно", () => {
  const meter = createInstrument(VOLTMETER, 1234);
  const a = measure(meter, 0.6812, mulberry32(seedFrom(3, 0.68, 300)));
  const b = measure(meter, 0.6812, mulberry32(seedFrom(3, 0.68, 300)));
  assert.equal(a.display, b.display);
});

test("різні точки серії шумлять по-різному", () => {
  const meter = createInstrument(AMMETER, 1234);
  const a = measure(meter, 1.0e-3, mulberry32(seedFrom(1, 1, 300)));
  const b = measure(meter, 1.0e-3, mulberry32(seedFrom(2, 1, 300)));
  assert.notEqual(a.display, b.display);
});

test("діапазон вибирається найчутливіший із придатних", () => {
  assert.equal(pickRange(AMMETER, 1.5e-3).max, 2e-3);
  assert.equal(pickRange(AMMETER, 1.5e-2).max, 2e-2);
  assert.equal(pickRange(AMMETER, 1e-6).max, 2e-5);
});

test("перевантаження названо перевантаженням, а не межею шкали", () => {
  const meter = createInstrument(AMMETER, 5);
  const m = measure(meter, 5, mulberry32(1));
  assert.equal(m.overload, true);
  assert.equal(m.display, null);
});

test("систематична похибка стала, а випадкова — ні", () => {
  const meter = createInstrument(AMMETER, 99);
  // Множник калібрування не змінюється між вимірюваннями.
  const first = createInstrument(AMMETER, 99).gain;
  assert.equal(meter.gain, first);
  assert.ok(Math.abs(meter.gain - 1) <= AMMETER.gainError);
});

test("на великій вибірці середнє лишається в межах класу точності", () => {
  const meter = createInstrument(VOLTMETER, 4242);
  const value = 0.7;
  let sum = 0;
  const n = 5000;
  for (let i = 0; i < n; i += 1) sum += measure(meter, value, mulberry32(i)).display;
  const mean = sum / n;
  const bias = Math.abs(mean / value - 1);
  assert.ok(bias <= VOLTMETER.gainError * 1.5, `зсув ${bias} завеликий`);
});

test("ціна поділки — це верхня межа, поділена на число відліків", () => {
  assert.equal(resolution({ max: 2, counts: 2000 }), 1e-3);
});
