/**
 * Описи регуляторів.
 *
 * Кожен регулятор зберігає ЦІЛУ позицію, а фізичне значення дає `valueAt`.
 * Для концентрацій шкала логарифмічна з кроком 0,1 декади: лінійний повзунок
 * від 10¹² до 10¹⁹ був би непридатним — уся цікава область від 10¹² до 10¹⁸
 * стиснулась би в перший піксель.
 */

import { sci, decimal } from "@edu/explain";

import { DOPANT } from "../physics/doping.js";

/** Логарифмічний повзунок: позиція i → 10^(from + i/perDecade). */
function logScale(fromExp, toExp, perDecade = 10) {
  const steps = Math.round((toExp - fromExp) * perDecade);
  return { steps, valueAt: (i) => 10 ** (fromExp + i / perDecade) };
}

const doping = logScale(12, 19);
const junctionDoping = logScale(14, 19);

export const CONTROLS = {
  temperature: {
    label: "Температура",
    hint: "Тепловий рух ґратки розриває ковалентні зв'язки. Кожен розрив дає пару «електрон + дірка».",
    steps: 120,
    valueAt: (i) => 100 + 5 * i,
    positionOf: (value) => Math.round((value - 100) / 5),
    format: (v) => `${v} К  (${Math.round(v - 273)} °C)`,
  },

  doping: {
    label: "Концентрація домішки",
    hint: "Один атом домішки на мільйон атомів кремнію (10¹⁶ см⁻³) змінює опір у сотні тисяч разів.",
    steps: doping.steps,
    valueAt: doping.valueAt,
    positionOf: (value) => Math.round(Math.log10(value) * 10 - 120),
    format: (v) => `${sci(v, 1)} см⁻³`,
  },

  suns: {
    // Позиція 0 — темрява. Окрема позиція, а не 10⁻⁴: нуль на логарифмічній
    // шкалі недосяжний, а вимикати світло гравець мусить уміти повністю.
    label: "Освітлення",
    hint: "Фотон із енергією понад 1,12 еВ вибиває електрон із зв'язку — так само, як тепло, але без нагрівання.",
    steps: 41,
    valueAt: (i) => (i === 0 ? 0 : 10 ** (-3 + (i - 1) / 10)),
    positionOf: (value) => (value <= 0 ? 0 : Math.round((Math.log10(value) + 3) * 10) + 1),
    format: (v) => (v === 0 ? "темрява" : `${sci(v, 1)} сонця`),
  },

  voltage: {
    label: "Напруга на зразку",
    hint: "Поле розганяє носії вздовж кристала. Це дрейф — повільне зміщення поверх хаотичного теплового руху.",
    steps: 100,
    valueAt: (i) => i / 20,
    positionOf: (value) => Math.round(value * 20),
    format: (v) => `${decimal(v, 2)} В`,
  },

  junctionNa: {
    label: "Легування p-області (бор)",
    hint: "Ліва половина кристала. Більше акцепторів — вищий бар'єр і вужчий збіднений шар із цього боку.",
    steps: junctionDoping.steps,
    valueAt: junctionDoping.valueAt,
    positionOf: (value) => Math.round(Math.log10(value) * 10 - 140),
    format: (v) => `${sci(v, 1)} см⁻³`,
  },

  junctionNd: {
    label: "Легування n-області (фосфор)",
    hint: "Права половина кристала. Заряд по обидва боки межі однаковий, тому сильніше легований бік завжди вужчий.",
    steps: junctionDoping.steps,
    valueAt: junctionDoping.valueAt,
    positionOf: (value) => Math.round(Math.log10(value) * 10 - 140),
    format: (v) => `${sci(v, 1)} см⁻³`,
  },

  bias: {
    // Шкала навмисно нерівномірна. Уся цікава фізика діода вміщається
    // в діапазон −1…+1 В, де струм змінюється на десять порядків; там крок
    // 10 мВ (шоста частина декади струму). Глибше в зворотний бік нічого
    // не відбувається — вітка горизонтальна, і там вистачає кроку 100 мВ.
    label: "Зміщення переходу",
    hint: "Додатна напруга (плюс на p-область) знижує бар'єр, від'ємна — піднімає.",
    steps: 290,
    valueAt: (i) =>
      i <= 90
        ? Math.round((-10 + i / 10) * 100) / 100
        : Math.round((-1 + (i - 90) / 100) * 100) / 100,
    positionOf: (value) =>
      value <= -1 ? Math.round((value + 10) * 10) : Math.round((value + 1) * 100) + 90,
    format: (v) =>
      v > 0 ? `+${decimal(v, 2)} В (пряме)` : v < 0 ? `${decimal(v, 2)} В (зворотне)` : "0,00 В",
  },
};

export const DOPANT_OPTIONS = [
  { value: DOPANT.none, label: "Немає", hint: "Чистий кремній — власна провідність" },
  { value: DOPANT.donor, label: "Фосфор (P)", hint: "П'ята валентність → зайвий електрон → n-тип" },
  { value: DOPANT.acceptor, label: "Бор (B)", hint: "Третя валентність → зайва дірка → p-тип" },
];

export const LEVEL_OPTIONS = [
  { value: "1", label: "Тільки числа", hint: "Показувати самі значення" },
  { value: "2", label: "+ механізм", hint: "Пояснення словами, чому величина саме така" },
  { value: "3", label: "+ формули", hint: "Формула символьно й із підставленими числами" },
];
