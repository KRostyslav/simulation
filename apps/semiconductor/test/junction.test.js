import test from "node:test";
import assert from "node:assert/strict";

import { builtInVoltage, depletion } from "../src/physics/junction.js";

const SYM = { na: 1e16, nd: 1e16, temperature: 300 };

test("контактна різниця потенціалів для 10¹⁶/10¹⁶ ≈ 0,71 В", () => {
  const vbi = builtInVoltage(SYM);
  assert.ok(vbi > 0.69 && vbi < 0.73, `V_bi = ${vbi}`);
});

test("сильніше легування піднімає бар'єр", () => {
  assert.ok(builtInVoltage({ na: 1e18, nd: 1e18, temperature: 300 }) > builtInVoltage(SYM));
});

test("нагрівання знижує бар'єр — саме тому діод відкривається раніше", () => {
  assert.ok(builtInVoltage({ ...SYM, temperature: 400 }) < builtInVoltage(SYM));
});

test("ширина збідненого шару без зміщення — частки мікрометра", () => {
  const { widthUm } = depletion(SYM);
  assert.ok(widthUm > 0.39 && widthUm < 0.47, `W = ${widthUm} мкм`);
});

test("зворотне зміщення розширює шар за кореневим законом", () => {
  const base = depletion(SYM);
  const reverse = depletion({ ...SYM, bias: -9 });
  const expected = Math.sqrt((base.vbi + 9) / base.vbi);
  const actual = reverse.width / base.width;
  assert.ok(Math.abs(actual / expected - 1) < 0.02, `W(−9)/W(0) = ${actual}, чекали ${expected}`);
});

test("пряме зміщення звужує шар", () => {
  assert.ok(depletion({ ...SYM, bias: 0.4 }).width < depletion(SYM).width);
});

test("баланс заряду: N_a·x_p = N_d·x_n", () => {
  const asym = { na: 1e15, nd: 1e17, temperature: 300 };
  const { xn, xp, width } = depletion(asym);
  assert.ok(Math.abs((asym.na * xp) / (asym.nd * xn) - 1) < 1e-10);
  assert.ok(Math.abs(xn + xp - width) / width < 1e-12);
  // Слабко легований бік забирає майже весь шар — це видно на сцені.
  assert.ok(xp / xn > 50);
});

test("максимальне поле узгоджене із зарядом збідненого шару", () => {
  const { fieldMax, xn } = depletion(SYM);
  // E_max = q·N_d·x_n/ε — те саме, що 2·V_eff/W для трикутного профілю.
  const fromCharge = (1.602176634e-19 * SYM.nd * xn) / (11.7 * 8.8541878128e-14);
  assert.ok(Math.abs(fieldMax / fromCharge - 1) < 0.01, `${fieldMax} проти ${fromCharge}`);
});

test("наближення чесно позначає власну межу біля V_bi", () => {
  const near = depletion({ ...SYM, bias: 0.71 });
  assert.equal(near.valid, false);
  assert.ok(Number.isFinite(near.width) && near.width > 0);
  assert.equal(depletion(SYM).valid, true);
});

test("місткість переходу спадає при зворотному зміщенні — основа варікапа", () => {
  const c0 = depletion(SYM).capacitancePerArea;
  const c9 = depletion({ ...SYM, bias: -9 }).capacitancePerArea;
  assert.ok(c9 < c0 / 3);
});
