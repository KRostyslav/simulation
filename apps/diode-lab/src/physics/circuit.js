/**
 * Стенд: джерело ЕРС → обмежувальний резистор R → діод → амперметр.
 *
 * Головне спрощення, яке економить окремий розв'язувач: резистор R і власний
 * послідовний опір діода R_s увімкнені послідовно, а отже нерозрізненні для
 * рівняння. Тому робочу точку знаходить та сама бісекція з @edu/diode, якій
 * просто передано суму R_s + R. Напруга на самому діоді відновлюється потім
 * як U_перех + I·R_s.
 *
 * Навіщо взагалі резистор. Без нього ВАХ проходить майже вертикально: 0,75 В
 * дає міліампер, 0,85 В — уже десятки міліампер, і жодною ручкою в таку
 * характеристику не потрапити. Резистор перетворює це на керовану залежність,
 * і саме тому в справжній лабораторії його ставлять завжди.
 */

import { solveDiodeCurrent } from "@edu/diode";
import { deviceParameters } from "./devices.js";

/**
 * Робоча точка стенда при заданій ЕРС.
 *
 * Повертає й те, що покаже прилад, і те, чим струм зараз обмежений, —
 * щоб панель могла назвати механізм, а не тільки число.
 */
export function operatingPoint({ device, temperature, emf, resistance }) {
  const params = deviceParameters(device, temperature, emf);
  const { is, igen, rs, vt, breakdown } = params;

  const { current, junctionVoltage } = solveDiodeCurrent({
    voltage: emf,
    is,
    rs: rs + resistance,
    vt,
    igen,
    breakdown,
  });

  const diodeVoltage = junctionVoltage + current * rs;
  const resistorVoltage = current * resistance;

  let regime = "рівновага";
  if (emf < 0) {
    regime = junctionVoltage < -breakdown.vbr ? "пробій" : "зворотний струм";
  } else if (emf > 0) {
    const diffusion = is * Math.expm1(Math.min(junctionVoltage / vt, 700));
    const recombination = igen * Math.expm1(Math.min(junctionVoltage / (2 * vt), 700));
    if (current * (rs + resistance) > 0.5 * emf) regime = "обмежує резистор";
    else if (recombination > diffusion) regime = "рекомбінація";
    else regime = "дифузія";
  }

  return {
    current,
    diodeVoltage,
    junctionVoltage,
    resistorVoltage,
    power: Math.abs(current * diodeVoltage),
    regime,
    ...params,
  };
}

/**
 * Теоретична крива для накладання поверх точок студента.
 *
 * За замовчуванням крива НЕ показується: спершу студент має побачити свої
 * точки самі по собі й повірити їм. Крива, намальована наперед, перетворює
 * вимірювання на підганяння під відповідь.
 */
export function theoreticalCurve({
  device,
  temperature,
  from,
  to,
  points = 160,
  resistance = 0,
}) {
  const result = [];
  for (let i = 0; i <= points; i += 1) {
    const emf = from + ((to - from) * i) / points;
    const { current, diodeVoltage } = operatingPoint({
      device,
      temperature,
      emf,
      resistance,
    });
    result.push({ voltage: diodeVoltage, current });
  }
  return result;
}

/**
 * ЕРС, потрібна, щоб на діоді був заданий струм. Потрібна для завдань, де
 * струм тримають сталим, а міняють температуру: саме так вимірюють −2 мВ/К.
 */
export function emfForCurrent({ device, temperature, resistance, target }) {
  let lo = 0;
  let hi = 30;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const { current } = operatingPoint({ device, temperature, emf: mid, resistance });
    if (current < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Напруга на діоді при заданому струмі — те саме, але одразу з відповіддю. */
export function voltageAtCurrent({ device, temperature, resistance, target }) {
  const emf = emfForCurrent({ device, temperature, resistance, target });
  return operatingPoint({ device, temperature, emf, resistance }).diodeVoltage;
}
