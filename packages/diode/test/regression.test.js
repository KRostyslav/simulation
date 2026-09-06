/**
 * Регресія переїзду: пакет мусить рахувати БІТОВО так само, як рахувала
 * фізика всередині apps/semiconductor до винесення.
 *
 * Тому тут assert.equal на double, а не порівняння з допуском. Допуск ловив би
 * лише грубу поломку, а небезпечна тут інша: непомітний зсув у останніх
 * розрядах від додавання нового доданка чи зміни порядку операцій. Числа зняті
 * з коду до переїзду й не мають права змінитися ніколи — якщо тест упав,
 * значить, дефолтний шлях більше не є ідеальною моделлю Шоклі.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  saturationCurrent,
  seriesResistance,
  diodePoint,
  ivCurve,
  voltageForCurrent,
} from "../src/diode.js";
import {
  intrinsicConcentration,
  bandGap,
  thermalVoltage,
  crossoverTemperature,
} from "../src/intrinsic.js";
import { electronMobility, holeMobility } from "../src/transport.js";
import { builtInVoltage, depletion } from "../src/junction.js";

const P = { na: 1e16, nd: 1e16, temperature: 300 };

test("струм насичення й послідовний опір — бітово ті самі", () => {
  const s = saturationCurrent(P);
  assert.equal(s.is, 4.80474206204176419e-15);
  assert.equal(s.dp, 1.13025360664308678e1);
  assert.equal(s.lp, 1.01365836393059097e-2);
  assert.equal(seriesResistance(P), 9.63865031015031661e1);
});

test("робочі точки ВАХ — бітово ті самі", () => {
  assert.equal(diodePoint({ ...P, voltage: 0.7 }).current, 4.73157403607258708e-4);
  assert.equal(diodePoint({ ...P, voltage: 1 }).current, 3.08294079253291272e-3);
  assert.equal(diodePoint({ ...P, voltage: -1 }).current, -4.80474206204176497e-15);
  assert.equal(diodePoint({ ...P, voltage: 0.3 }).current, 5.2655464457576607e-10);
  assert.equal(diodePoint({ ...P, voltage: 0.05 }).current, 2.84331221157200553e-14);
});

test("нуль напруги дає рівно нуль струму, а не майже нуль", () => {
  assert.equal(diodePoint({ ...P, voltage: 0 }).current, 0);
});

test("обернена формула — бітово та сама", () => {
  const { is } = saturationCurrent(P);
  const rs = seriesResistance(P);
  const u = voltageForCurrent({ current: 1e-3, is, rs, vt: thermalVoltage(300) });
  assert.equal(u, 7.70126269355283055e-1);
});

test("матеріальні величини кремнію — бітово ті самі", () => {
  assert.equal(intrinsicConcentration(300), 1.0e10);
  assert.equal(intrinsicConcentration(600), 3.508356435413368e15);
  assert.equal(bandGap(300), 1.12051923076923066);
  assert.equal(electronMobility(1e16, 300), 1.2479879239377467e3);
  assert.equal(holeMobility(1e16, 300), 4.37201615348600228e2);
  assert.equal(builtInVoltage(P), 7.14317151975946363e-1);
  assert.equal(depletion(P).width, 4.2982100353973398e-5);
  assert.equal(crossoverTemperature(1e13), 4.14276454039482587e2);
});

test("ivCurve дає ту саму сітку точок", () => {
  const got = ivCurve({ ...P, from: -1, to: 1, points: 4 }).map((p) => p.current);
  assert.deepEqual(got, [
    -4.804742062041765e-15, -4.804742042897452e-15, 0, 1.2004844375109916e-6,
    3.0829407925329127e-3,
  ]);
});

test("вимкнені механізми не змінюють арифметику", () => {
  const base = diodePoint({ ...P, voltage: 0.7 });
  const explicit = diodePoint({ ...P, voltage: 0.7, igen: 0, breakdown: null });
  assert.equal(explicit.current, base.current);
  assert.equal(explicit.junctionVoltage, base.junctionVoltage);
});
