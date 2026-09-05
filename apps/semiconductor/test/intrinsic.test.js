import test from "node:test";
import assert from "node:assert/strict";

import {
  bandGap,
  intrinsicConcentration,
  thermalVoltage,
  crossoverTemperature,
} from "../src/physics/intrinsic.js";

test("тепловий потенціал при 300 К — класичні 0,02585 В", () => {
  const vt = thermalVoltage(300);
  assert.ok(Math.abs(vt - 0.02585) / 0.02585 < 0.005, `V_T = ${vt}`);
});

test("ширина забороненої зони кремнію при 300 К ≈ 1,12 еВ", () => {
  const eg = bandGap(300);
  assert.ok(eg > 1.11 && eg < 1.13, `Eg = ${eg}`);
});

test("заборонена зона звужується з нагріванням", () => {
  assert.ok(bandGap(600) < bandGap(300));
  assert.ok(bandGap(300) < bandGap(100));
});

test("власна концентрація при 300 К дорівнює виміряним 1,0·10¹⁰ см⁻³", () => {
  const ni = intrinsicConcentration(300);
  assert.ok(Math.abs(ni - 1e10) / 1e10 < 0.01, `n_i = ${ni}`);
});

test("власна концентрація монотонно росте по всій сітці температур", () => {
  let prev = 0;
  for (let t = 100; t <= 700; t += 5) {
    const ni = intrinsicConcentration(t);
    assert.ok(Number.isFinite(ni) && ni > prev, `немонотонність при T = ${t}`);
    prev = ni;
  }
});

test("порядок величини n_i(600 К) відповідає літературі", () => {
  const ni = intrinsicConcentration(600);
  assert.ok(ni > 1e15 && ni < 1e17, `n_i(600) = ${ni}`);
});

test("нагрівання на 100 К змінює n_i на порядки, а не на відсотки", () => {
  const ratio = intrinsicConcentration(400) / intrinsicConcentration(300);
  assert.ok(ratio > 100, `зросло лише в ${ratio} разів`);
});

test("температура переходу до власної провідності для N = 10¹⁴", () => {
  const t = crossoverTemperature(1e14);
  assert.ok(t > 400 && t < 550, `T = ${t}`);
  // Перевіряємо сам корінь: n_i(T) справді дорівнює заданій концентрації.
  assert.ok(Math.abs(intrinsicConcentration(t) - 1e14) / 1e14 < 1e-6);
});

test("для сильного легування перехід недосяжний регулятором", () => {
  // Верхня межа пошуку — 700 К, верх температурного повзунка. Підказка
  // «нагрій до T» має сенс тільки для досяжної T.
  assert.equal(crossoverTemperature(1e17), null);
  assert.equal(crossoverTemperature(1e19), null);
  assert.ok(crossoverTemperature(1e16) < 700);
});
