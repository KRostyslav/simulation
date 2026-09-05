import test from "node:test";
import assert from "node:assert/strict";

import {
  diodePoint,
  saturationCurrent,
  seriesResistance,
  solveDiodeCurrent,
  voltageForCurrent,
  ivCurve,
} from "../src/physics/diode.js";
import { thermalVoltage } from "../src/physics/intrinsic.js";

const DIODE = { na: 1e16, nd: 1e16, temperature: 300 };

test("струм насичення — одиниці фемтоампер", () => {
  const { is } = saturationCurrent(DIODE);
  assert.ok(is > 1e-15 && is < 5e-14, `I_s = ${is}`);
});

test("струм насичення різко росте з температурою (бо ∝ n_i²)", () => {
  const cold = saturationCurrent(DIODE).is;
  const warm = saturationCurrent({ ...DIODE, temperature: 350 }).is;
  assert.ok(warm / cold > 100, `зріс лише в ${warm / cold} разів`);
});

test("сильніше легування зменшує зворотний струм", () => {
  assert.ok(saturationCurrent({ ...DIODE, na: 1e18, nd: 1e18 }).is < saturationCurrent(DIODE).is);
});

test("послідовний опір нейтральних областей — десятки ом", () => {
  const rs = seriesResistance(DIODE);
  assert.ok(rs > 30 && rs < 300, `R_s = ${rs}`);
});

test("при нульовій напрузі струм дорівнює нулю ТОЧНО", () => {
  // Перевірка того, що використано expm1: exp(0) − 1 у формулі дало б
  // машинний нуль лише випадково, а не за побудовою.
  assert.equal(diodePoint({ ...DIODE, voltage: 0 }).current, 0);
});

test("зворотна вітка виходить на −I_s і далі не змінюється", () => {
  const { current, is } = diodePoint({ ...DIODE, voltage: -1 });
  assert.ok(Math.abs(current / -is - 1) < 0.01, `I = ${current}, I_s = ${is}`);

  const deep = diodePoint({ ...DIODE, voltage: -10 }).current;
  assert.ok(Math.abs(deep / current - 1) < 0.01, "зворотний струм має бути майже сталим");
});

test("пряма вітка при 0,7 В дає частки міліампера", () => {
  // Модель описує ідеальний дифузійний діод (коефіцієнт неідеальності m = 1,
  // без рекомбінації в збідненому шарі). Реальний 1N4148 при 0,7 В дає
  // одиниці міліампер саме за рахунок рекомбінаційної складової, якої тут
  // немає, — тому сюди чекаємо на порядок менше. Головне для теми інше:
  // порядок величини правильний, і саме біля 0,7 В діод відкривається.
  const { current } = diodePoint({ ...DIODE, voltage: 0.7 });
  assert.ok(current > 1e-4 && current < 5e-3, `I = ${current}`);
});

test("класичні 60 мВ на декаду струму", () => {
  const { is, rs, vt } = diodePoint({ ...DIODE, voltage: 0.5 });
  // Беремо область, де струм уже великий за I_s, але ще не впирається в R_s.
  const u1 = voltageForCurrent({ current: 1e-9, is, rs, vt });
  const u2 = voltageForCurrent({ current: 1e-8, is, rs, vt });
  const perDecade = (u2 - u1) * 1000;
  assert.ok(perDecade > 55 && perDecade < 65, `${perDecade} мВ/декада`);
});

test("температурний коефіцієнт переходу −2 мВ/К при сталому струмі", () => {
  // rs: 0 — навмисно. Класичні −2 мВ/К стосуються напруги на САМОМУ переході.
  // Опір нейтральних областей теж росте з температурою (рухливість падає)
  // і частково компенсує це зниження; повний коефіцієнт зразка виходить
  // близько −1,2 мВ/К, і це не помилка, а вплив R_s.
  const at = (temperature) => {
    const point = diodePoint({ ...DIODE, temperature, voltage: 0.6 });
    return voltageForCurrent({ current: 1e-3, is: point.is, rs: 0, vt: point.vt });
  };
  const slope = (at(310) - at(300)) / 10;
  assert.ok(slope > -0.0025 && slope < -0.0015, `dU/dT = ${slope} В/К`);
});

test("розв'язок задовольняє вихідне рівняння Шоклі", () => {
  const vt = thermalVoltage(300);
  const { is } = saturationCurrent(DIODE);
  const rs = seriesResistance(DIODE);

  for (const voltage of [-5, -0.3, 0.1, 0.4, 0.7, 1.0]) {
    const { current, junctionVoltage } = solveDiodeCurrent({ voltage, is, rs, vt });
    const expected = is * Math.expm1(junctionVoltage / vt);
    const scale = Math.max(Math.abs(current), is);
    assert.ok(
      Math.abs(current - expected) / scale < 1e-8,
      `U = ${voltage}: I = ${current}, рівняння дає ${expected}`,
    );
  }
});

test("послідовний опір рятує від переповнення при великій напрузі", () => {
  for (const temperature of [100, 200, 300, 500, 700]) {
    const { current, limitedBy } = diodePoint({ ...DIODE, temperature, voltage: 1 });
    assert.ok(Number.isFinite(current), `NaN/∞ при T = ${temperature}`);
    // Струм не може перевищити U/R_s — весь спад тоді був би на опорі.
    assert.ok(current <= 1 / seriesResistance({ ...DIODE, temperature }) + 1e-12);
    assert.ok(["дифузія", "послідовний опір"].includes(limitedBy));
  }
  // При кімнатній температурі 1 В — це вже режим, обмежений опором:
  // майже половина напруги гріє нейтральні області, а не керує бар'єром.
  assert.equal(diodePoint({ ...DIODE, voltage: 1 }).limitedBy, "послідовний опір");
  assert.equal(diodePoint({ ...DIODE, voltage: 0.5 }).limitedBy, "дифузія");
});

test("ВАХ монотонна й проходить через нуль без розриву", () => {
  const curve = ivCurve({ ...DIODE, from: -2, to: 1, points: 200 });
  let prev = -Infinity;
  for (const point of curve) {
    assert.ok(Number.isFinite(point.current));
    assert.ok(point.current > prev - 1e-18, `немонотонність при U = ${point.voltage}`);
    prev = point.current;
  }
  const zero = curve.find((point) => Math.abs(point.voltage) < 1e-9);
  if (zero) assert.ok(Math.abs(zero.current) < 1e-15);
});

test("діод асиметричний: прямий струм на порядки більший за зворотний", () => {
  const forward = diodePoint({ ...DIODE, voltage: 0.7 }).current;
  const reverse = Math.abs(diodePoint({ ...DIODE, voltage: -0.7 }).current);
  assert.ok(forward / reverse > 1e9, `лише в ${forward / reverse} разів`);
});
