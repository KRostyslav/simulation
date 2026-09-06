/**
 * Зворотний пробій. Головне навчальне твердження, яке тут закріплено:
 * стабілітрон — це не окремий прилад, а той самий кремнієвий перехід,
 * лише сильніше легований.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SI, GE } from "../src/constants.js";
import { bandGap } from "../src/intrinsic.js";
import {
  breakdownVoltage,
  breakdownTempCoefficient,
  breakdownAt,
} from "../src/breakdown.js";
import { diodePoint } from "../src/diode.js";

test("напруга пробою кремнію при 10¹⁶ — близько 60 В", () => {
  const v = breakdownVoltage({ na: 1e16, nd: 1e16 });
  assert.ok(v > 55 && v < 70, `отримано ${v} В`);
});

test("сильніше легування знижує напругу пробою", () => {
  const weak = breakdownVoltage({ na: 1e15, nd: 1e15 });
  const strong = breakdownVoltage({ na: 1e17, nd: 1e17 });
  assert.ok(strong < weak, "вужчий шар — сильніше поле — ранній пробій");
  assert.ok(weak / strong > 5, `різниця замала: ${weak} проти ${strong}`);
});

test("германій пробивається раніше за кремній при тому самому легуванні", () => {
  const si = breakdownVoltage({ na: 1e16, nd: 1e16, material: SI });
  const ge = breakdownVoltage({ na: 1e16, nd: 1e16, material: GE });
  assert.ok(ge < si, "вужчу зону легше іонізувати");
});

test("стабілітрон — це той самий кремній, легований у 24 рази сильніше", () => {
  const { vbr, tcv } = breakdownAt({ na: 2.4e17, nd: 2.4e17 });
  assert.ok(vbr > 5 && vbr < 6.5, `V_проб = ${vbr} В, очікували близько 5,6 В`);
  // Саме на цій напрузі механізми змінюють один одного, і ТКН проходить нуль.
  assert.ok(Math.abs(tcv) < 1e-4, `ТКН мусить бути майже нульовим, а він ${tcv}`);
});

test("знак температурного коефіцієнта розрізняє два механізми", () => {
  const eg = bandGap(300, SI);
  assert.ok(breakdownTempCoefficient(2, eg) < 0, "тунельний пробій: ТКН від'ємний");
  assert.ok(breakdownTempCoefficient(30, eg) > 0, "лавинний пробій: ТКН додатний");
  const low = breakdownAt({ na: 1e18, nd: 1e18 });
  const high = breakdownAt({ na: 1e15, nd: 1e15 });
  assert.equal(low.kind, "тунельний");
  assert.equal(high.kind, "лавинний");
});

test("за точкою пробою струм зростає на порядки, до неї — ні", () => {
  const bd = breakdownAt({ na: 2.4e17, nd: 2.4e17 });
  const p = { na: 2.4e17, nd: 2.4e17, temperature: 300, area: 1e-3, breakdown: bd };
  const before = Math.abs(diodePoint({ ...p, voltage: -(bd.vbr - 1) }).current);
  const after = Math.abs(diodePoint({ ...p, voltage: -(bd.vbr + 1) }).current);
  assert.ok(after / before > 1e3, `злам замалий: ${before} → ${after}`);
  assert.equal(diodePoint({ ...p, voltage: -(bd.vbr + 1) }).limitedBy, "пробій");
});

test("без параметра breakdown пробою немає зовсім", () => {
  const p = { na: 2.4e17, nd: 2.4e17, temperature: 300, area: 1e-3, voltage: -20 };
  const plain = diodePoint(p);
  assert.ok(Math.abs(plain.current) < 1e-12, "ідеальна модель тримає будь-яку напругу");
  assert.equal(plain.limitedBy, "струм насичення");
});
