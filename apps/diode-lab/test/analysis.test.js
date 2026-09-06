/**
 * Обробка результатів.
 *
 * Головні тести тут — кругові: генеруємо характеристику з ВІДОМИМИ n та I_s,
 * проганяємо крізь прилад і дивимось, що з них відновить студентська методика.
 * Саме так перевіряють методику вимірювання в реальній метрології.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { thermalVoltage } from "@edu/diode";
import {
  leastSquares,
  fitShockley,
  pickLinearRegion,
  decadeCheck,
  dynamicResistance,
  thresholdVoltage,
  thresholdByTangent,
  theoryMvPerDecade,
  compareSeries,
} from "../src/physics/analysis.js";
import { DEVICE_BY_ID } from "../src/physics/devices.js";
import { operatingPoint } from "../src/physics/circuit.js";
import {
  createInstrument,
  measure,
  VOLTMETER,
  AMMETER,
} from "../src/physics/instrument.js";
import { mulberry32, seedFrom } from "../src/physics/random.js";

/** Ідеальна серія без приладу: точно відома n і I_s. */
function idealSeries({ is = 1e-14, ideality = 1, temperature = 300, points = 20 } = {}) {
  const vt = thermalVoltage(temperature);
  const list = [];
  for (let i = 0; i < points; i += 1) {
    const voltage = 0.3 + (i * 0.4) / (points - 1);
    list.push({ voltage, current: is * Math.exp(voltage / (ideality * vt)) });
  }
  return list;
}

/** Серія, знята «руками» на віртуальному стенді, з усіма похибками приладу. */
function measuredSeries({ deviceId = "si", temperature = 300, resistance = 1000 } = {}) {
  const device = DEVICE_BY_ID[deviceId];
  const volt = createInstrument(VOLTMETER, 20240905);
  const amp = createInstrument(AMMETER, 424242);
  const list = [];
  for (let i = 0; i <= 24; i += 1) {
    const emf = 0.3 + (i * 2.7) / 24;
    const op = operatingPoint({ device, temperature, emf, resistance });
    const rng = mulberry32(seedFrom(i, emf, temperature));
    const u = measure(volt, op.diodeVoltage, rng);
    const a = measure(amp, op.current, rng);
    if (u.overload || a.overload) continue;
    list.push({
      voltage: u.display,
      current: a.display,
      counts: a.counts,
      resolutionU: u.resolution,
    });
  }
  return { list, device };
}

test("МНК на ідеальній прямій точний, а на одній точці чесно мовчить", () => {
  const fit = leastSquares([
    { x: 0, y: 1 },
    { x: 1, y: 3 },
    { x: 2, y: 5 },
  ]);
  assert.ok(Math.abs(fit.b - 2) < 1e-12);
  assert.ok(Math.abs(fit.a - 1) < 1e-12);
  assert.equal(fit.r2, 1);
  assert.equal(leastSquares([{ x: 1, y: 1 }]), null);
  assert.equal(leastSquares([]), null);
  // Вертикаль: нахилу не існує, і NaN тут неприпустимий.
  assert.equal(
    leastSquares([
      { x: 1, y: 1 },
      { x: 1, y: 5 },
    ]),
    null,
  );
});

test("на ідеальних точках методика відновлює n та I_s майже точно", () => {
  for (const ideality of [1, 1.5, 2]) {
    const fit = fitShockley(idealSeries({ ideality, is: 3e-14 }), { temperature: 300 });
    assert.ok(
      Math.abs(fit.ideality / ideality - 1) < 0.001,
      `n = ${fit.ideality} замість ${ideality}`,
    );
    assert.ok(Math.abs(fit.is / 3e-14 - 1) < 0.05, `I_s = ${fit.is}`);
  }
});

test("прилад майже не псує нахил, але псує струм насичення", () => {
  const { list, device } = measuredSeries();
  const region = pickLinearRegion(list, { temperature: 300, rs: 5 });
  const fit = fitShockley(region.used, { temperature: 300 });

  // Нахил відновлюється добре: коефіцієнт ідеальності близький до одиниці.
  assert.ok(fit.ideality > 0.95 && fit.ideality < 1.2, `n = ${fit.ideality}`);
  // А ось I_s відомий лише за порядком величини — і це головний висновок роботи.
  const trueIs = operatingPoint({
    device,
    temperature: 300,
    emf: 1,
    resistance: 1000,
  }).is;
  const ratio = fit.is / trueIs;
  assert.ok(ratio > 0.1 && ratio < 100, `I_s відхилився у ${ratio} разів`);
  assert.ok(fit.r2 > 0.99, `апроксимація мусить бути якісною, r² = ${fit.r2}`);
});

test("правило 60 мВ на декаду підтверджується виміряними точками", () => {
  const { list } = measuredSeries();
  const region = pickLinearRegion(list, { temperature: 300, rs: 5 });
  const check = decadeCheck(fitShockley(region.used, { temperature: 300 }), 300);
  assert.equal(check.verdict, "збігається");
  assert.ok(check.measured > 55 && check.measured < 70, `${check.measured} мВ/декаду`);
});

test("теоретична ціна декади залежить від коефіцієнта ідеальності", () => {
  assert.ok(Math.abs(theoryMvPerDecade(300, 1) - 59.5) < 1);
  assert.ok(Math.abs(theoryMvPerDecade(300, 2) - 119) < 2);
});

test("вибір лінійної ділянки відкидає саме те, що заважає", () => {
  const { list } = measuredSeries();
  const region = pickLinearRegion(list, { temperature: 300, rs: 5 });
  assert.ok(region.enough, "точок мусить вистачити");
  assert.ok(region.decades > 1.5, `ділянка коротка: ${region.decades} декади`);
  const reasons = new Set(region.rejected.map((r) => r.reason));
  assert.ok(reasons.size > 0, "щось таки мало бути відкинуте");
  for (const p of region.used) {
    assert.ok(p.current > 0 && p.voltage > 0);
    assert.ok(p.counts >= 20, "у ділянці не має бути точок на межі роздільності");
  }
});

test("узяти в апроксимацію зону послідовного опору — і n подвоїться", () => {
  // Маленький обмежувальний резистор пускає струм до сотні міліампер, і
  // більша частина серії опиняється там, де ВАХ уже випрямилась у пряму
  // закону Ома. Це найпоширеніша помилка обробки: формально точки є,
  // формально вони лягають на «пряму», а n виходить удвічі завищеним.
  const { list } = measuredSeries({ resistance: 22 });
  const narrow = pickLinearRegion(list, { temperature: 300, rs: 4.82 });
  const wide = list.filter((p) => p.current > 0 && p.voltage > 0.15);

  const nNarrow = fitShockley(narrow.used, { temperature: 300 });
  const nWide = fitShockley(wide, { temperature: 300 });

  assert.ok(nNarrow.ideality < 1.3, `на чистій ділянці n = ${nNarrow.ideality}`);
  assert.ok(nWide.ideality > 2, `з «хвостом» n = ${nWide.ideality}, а мало б поповзти вгору`);
  assert.ok(nWide.r2 < 0.9, `і апроксимація помітно гірша: r² = ${nWide.r2}`);
  assert.ok(nNarrow.r2 > 0.98, `а на чистій ділянці — добра: r² = ${nNarrow.r2}`);
});

test("динамічний опір: сусідні точки дають правду, далекі — ні", () => {
  const { list } = measuredSeries();
  const index = list.findIndex((p) => p.current > 5e-4);
  const near = dynamicResistance(list, index);
  const vt = thermalVoltage(300);
  const theory = vt / list[index].current;

  assert.ok(
    Math.abs(near.r / theory - 1) < 0.5,
    `за сусідніми точками ${near.r} проти теоретичних ${theory}`,
  );

  // Та сама похідна, взята через кілька точок, завищена: хорда експоненти
  // завжди положіша за дотичну.
  const far = list[index + 4];
  const back = list[index - 4];
  const chord = (far.voltage - back.voltage) / (far.current - back.current);
  assert.ok(chord > near.r, `хорда ${chord} мусить бути більшою за ${near.r}`);
});

test("порогова напруга: два законні методи дають різні числа", () => {
  const { list } = measuredSeries();
  const byCurrent = thresholdVoltage(list);
  const byTangent = thresholdByTangent(list);
  assert.ok(byCurrent.voltage > 0.6 && byCurrent.voltage < 0.75);
  assert.ok(byTangent.voltage < byCurrent.voltage, "дотична дає менше значення");
  assert.ok(byTangent.voltage > 0.4, "але не абсурдно мале");
});

test("германій дає поріг на 0,3…0,45 В нижчий за кремній", () => {
  const si = measuredSeries({ deviceId: "si" });
  const ge = measuredSeries({ deviceId: "ge" });
  const cmp = compareSeries(
    { points: si.list, temperature: 300 },
    { points: ge.list, temperature: 300 },
  );
  assert.ok(
    cmp.deltaThreshold > 0.3 && cmp.deltaThreshold < 0.45,
    `різниця ${cmp.deltaThreshold} В`,
  );
});

test("нагрівання зсуває пряму вітку приблизно на −2 мВ/К", () => {
  const cold = measuredSeries({ temperature: 300 });
  const hot = measuredSeries({ temperature: 340 });
  const cmp = compareSeries(
    { points: hot.list, temperature: 340 },
    { points: cold.list, temperature: 300 },
  );
  assert.ok(
    cmp.mvPerKelvin < -1.5 && cmp.mvPerKelvin > -2.5,
    `${cmp.mvPerKelvin} мВ/К`,
  );
});
