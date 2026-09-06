/**
 * Модель вимірювального приладу — те, заради чого ця робота взагалі має сенс.
 *
 * Якби амперметр показував істинний струм, обробка результатів була б
 * підстановкою в формулу з наперед відомою відповіддю. Реальний прилад
 * спотворює показ трьома різними за природою способами, і кожен по-своєму
 * псує саме той результат, який студент рахує:
 *
 *  1. СИСТЕМАТИЧНА похибка (клас точності) — сталий множник. Вона зсуває
 *     всю пряму lg I(U) паралельно вгору або вниз, тобто спотворює I_s,
 *     майже не чіпаючи нахилу. Тому коефіцієнт ідеальності виходить точним,
 *     а струм насичення — лише за порядком величини. Це не дефект моделі,
 *     а головний висновок роботи.
 *  2. ВИПАДКОВА похибка — шум останніх розрядів. Її можна давити: більше
 *     точок, метод найменших квадратів.
 *  3. ДИСКРЕТНІСТЬ — прилад цифровий і не може показати менше за одиницю
 *     молодшого розряду. Тому три-чотири найменші точки серії не містять
 *     сигналу взагалі, і їх треба відкинути, а не тягнути в апроксимацію.
 */

import { mulberry32, gaussian } from "./random.js";

export const VOLTMETER = {
  id: "voltmeter",
  label: "Вольтметр",
  unit: "В",
  ranges: [
    { max: 2, counts: 2000 },
    { max: 20, counts: 2000 },
    { max: 200, counts: 2000 },
  ],
  gainError: 0.005, // клас точності 0,5 %
  noiseCounts: 2,
};

export const AMMETER = {
  id: "ammeter",
  label: "Амперметр",
  unit: "А",
  ranges: [
    { max: 2e-5, counts: 2000 },
    { max: 2e-4, counts: 2000 },
    { max: 2e-3, counts: 2000 },
    { max: 2e-2, counts: 2000 },
    { max: 2e-1, counts: 2000 },
  ],
  gainError: 0.01,
  noiseCounts: 3,
};

/** Ціна молодшого розряду на цьому діапазоні. */
export function resolution(range) {
  return range.max / range.counts;
}

/**
 * Автовибір діапазону: найчутливіший із тих, що ще вміщають значення.
 * Якщо не вміщає жоден — це перевантаження, і прилад мусить сказати про це
 * прямо, а не мовчки показати межу шкали.
 */
export function pickRange(meter, value) {
  const magnitude = Math.abs(value);
  return meter.ranges.find((range) => magnitude <= range.max) ?? null;
}

/**
 * Конкретний екземпляр приладу.
 *
 * Множник калібрування виводиться з seed'а один раз і живе весь сеанс.
 * Саме так поводиться справжній прилад: він не «трохи бреше щоразу
 * по-різному», він стабільно зміщений, поки його не повірять заново.
 */
export function createInstrument(meter, seed) {
  const rng = mulberry32(seed);
  const gain = 1 + meter.gainError * (rng() * 2 - 1);
  return { meter, gain, seed };
}

/**
 * Одне вимірювання: істинне значення → те, що видно на табло.
 * Порядок операцій відтворює порядок фізичних причин: спершу прилад
 * підсилює з похибкою, потім до сигналу домішується шум, і аж наприкінці
 * АЦП округлює те, що вийшло.
 */
export function measure(instrument, trueValue, rng) {
  const { meter, gain } = instrument;
  const range = pickRange(meter, trueValue * gain);
  if (!range) {
    return { display: null, resolution: null, range: null, overload: true };
  }

  const step = resolution(range);
  const noise = gaussian(rng) * ((meter.noiseCounts * step) / 3);
  const raw = trueValue * gain + noise;
  const display = Math.round(raw / step) * step;

  return {
    display,
    resolution: step,
    range,
    overload: false,
    // Скільки одиниць молодшого розряду в показі: менше за 20 — сигналу
    // фактично немає, і точку не варто брати в апроксимацію.
    counts: Math.abs(display) / step,
  };
}
