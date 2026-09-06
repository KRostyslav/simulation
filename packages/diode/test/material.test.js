/**
 * Параметри матеріалів. Германій доданий заради однієї навчальної тези:
 * поріг діода задає не «конструкція», а ширина забороненої зони.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SI, GE, MATERIALS } from "../src/constants.js";
import { bandGap, intrinsicConcentration } from "../src/intrinsic.js";
import { electronMobility, holeMobility } from "../src/transport.js";

const close = (got, want, rel, what) =>
  assert.ok(
    Math.abs(got / want - 1) <= rel,
    `${what}: ${got} проти очікуваного ${want} (допуск ${rel * 100} %)`,
  );

test("ширина забороненої зони при 300 К збігається з підручником", () => {
  close(bandGap(300, SI), 1.12, 0.01, "Eg кремнію");
  close(bandGap(300, GE), 0.66, 0.01, "Eg германію");
});

test("власна концентрація при 300 К збігається з таблицею", () => {
  close(intrinsicConcentration(300, SI), 1.0e10, 1e-12, "n_i кремнію");
  close(intrinsicConcentration(300, GE), 2.4e13, 1e-12, "n_i германію");
});

test("у германію носіїв на порядки більше в усьому робочому діапазоні", () => {
  for (let t = 250; t <= 400; t += 25) {
    const ratio = intrinsicConcentration(t, GE) / intrinsicConcentration(t, SI);
    assert.ok(ratio > 100, `при ${t} К відношення n_i лише ${ratio.toExponential(2)}`);
  }
});

test("з нагріванням перевага германію тане", () => {
  // Вузька зона дає велику n_i саме тому, що її легко подолати. Але й кремнію
  // при нагріванні долати її дедалі легше, тому відрив скорочується — і при
  // 500 К він уже менший за два порядки. Це та сама причина, з якої германієві
  // прилади витісняються кремнієвими скрізь, де буває гаряче.
  const at = (t) => intrinsicConcentration(t, GE) / intrinsicConcentration(t, SI);
  assert.ok(at(300) > at(400), "відношення мусить спадати з температурою");
  assert.ok(at(400) > at(500), "і спадати монотонно");
});

test("рухливість у слабко легованому германію вдвічі-втричі вища", () => {
  close(electronMobility(1e10, 300, GE), 3900, 0.02, "μₙ германію");
  close(holeMobility(1e10, 300, GE), 1900, 0.02, "μₚ германію");
  close(electronMobility(1e10, 300, SI), 1360, 0.02, "μₙ кремнію");
});

test("дефолтний матеріал — кремній, і MATERIALS містить обидва", () => {
  assert.equal(bandGap(300), bandGap(300, SI));
  assert.equal(MATERIALS.si, SI);
  assert.equal(MATERIALS.ge, GE);
});
