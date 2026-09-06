/**
 * Описи регуляторів.
 *
 * Опис відокремлено від віджета навмисно: тут сказано, ЩО регулює величина
 * й у яких межах, а як саме вона виглядає на екрані — справа ui/controls.js.
 * Завдяки цьому межі й крок можна перевірити тестом, не запускаючи браузер.
 */

import { decimal, withPrefix } from "@edu/explain";

import { DEVICES } from "../physics/devices.js";
import { RESISTORS, LIMITS, MODE } from "../physics/constants.js";

/** Позиція повзунка → ЕРС. Крок 10 мВ біля нуля й грубіший на зворотній вітці. */
const EMF_STEPS = 350;

export function emfAt(position) {
  // 0…300 — пряма вітка від 0 до 3 В із кроком 10 мВ;
  // далі — зворотна, від −1 до −30 В із кроком 0,6 В.
  if (position <= 300) return Math.round(position) / 100;
  return -Math.round((position - 300) * 0.6 * 100) / 100;
}

export function emfPosition(value) {
  if (value >= 0) return Math.round(value * 100);
  return 300 + Math.round(-value / 0.6);
}

export const CONTROLS = {
  emf: {
    id: "emf",
    label: "ЕРС джерела",
    hint: "Праворуч від середини — зворотна вітка. Біля порогу рухайте повільно: кожні 60 мВ змінюють струм удесятеро.",
    steps: EMF_STEPS,
    valueAt: emfAt,
    positionOf: emfPosition,
    format: (value) => `${decimal(value, 2)} В`,
    modes: [MODE.stand, MODE.materials, MODE.temperature, MODE.breakdown],
  },
  resistance: {
    id: "resistance",
    label: "Обмежувальний резистор",
    hint: "Менший опір дає більший струм, але звужує придатну для обробки ділянку.",
    steps: RESISTORS.length - 1,
    valueAt: (position) => RESISTORS[Math.round(position)] ?? 1000,
    positionOf: (value) => {
      const index = RESISTORS.indexOf(value);
      return index >= 0 ? index : RESISTORS.indexOf(1000);
    },
    format: (value) => (value >= 1000 ? `${decimal(value / 1000, 1)} кОм` : `${value} Ом`),
    modes: [MODE.stand, MODE.materials, MODE.temperature, MODE.breakdown],
  },
  temperature: {
    id: "temperature",
    label: "Температура кристала",
    hint: "Пряма напруга падає приблизно на 2 мВ на кожен кельвін, зворотний струм подвоюється на кожні 10 К.",
    steps: LIMITS.temperature.max - LIMITS.temperature.min,
    valueAt: (position) => LIMITS.temperature.min + Math.round(position),
    positionOf: (value) => Math.round(value) - LIMITS.temperature.min,
    format: (value) => `${Math.round(value)} К (${Math.round(value - 273)} °C)`,
    modes: [MODE.stand, MODE.materials, MODE.temperature, MODE.breakdown, MODE.rectifier],
  },
  amplitude: {
    id: "amplitude",
    label: "Амплітуда на вході",
    hint: "Амплітуда синусоїди до випрямляча.",
    steps: 140,
    valueAt: (position) => 1 + Math.round(position) * 0.1,
    positionOf: (value) => Math.round((value - 1) / 0.1),
    format: (value) => `${decimal(value, 1)} В`,
    modes: [MODE.rectifier],
  },
  load: {
    id: "load",
    label: "Опір навантаження",
    hint: "Разом із ємністю задає сталу часу розряду: чим більший опір, тим повільніше просідає напруга.",
    steps: RESISTORS.length - 1,
    valueAt: (position) => RESISTORS[Math.round(position)] ?? 1000,
    positionOf: (value) => {
      const index = RESISTORS.indexOf(value);
      return index >= 0 ? index : RESISTORS.indexOf(1000);
    },
    format: (value) => (value >= 1000 ? `${decimal(value / 1000, 1)} кОм` : `${value} Ом`),
    modes: [MODE.rectifier],
  },
  capacitance: {
    id: "capacitance",
    label: "Ємність згладжувального конденсатора",
    hint: "Нуль означає, що конденсатора немає. Пульсації спадають, щойно R·C стає більшою за період.",
    steps: 50,
    // Логарифмічна шкала: від 1 до 1000 мкФ рівномірно за порядками, бо саме
    // так підбирають конденсатори — множенням, а не додаванням.
    valueAt: (position) => {
      if (position <= 0) return 0;
      const micro = 10 ** ((position - 1) / 16.4);
      return Math.round(micro * 10) / 10 * 1e-6;
    },
    positionOf: (value) => {
      if (!(value > 0)) return 0;
      return Math.round(Math.log10(value * 1e6) * 16.4) + 1;
    },
    format: (value) => (value > 0 ? withPrefix(value, "Ф") : "немає"),
    modes: [MODE.rectifier],
  },
};

export const DEVICE_OPTIONS = DEVICES.map((device) => ({
  value: device.id,
  label: device.short,
  hint: device.label,
}));

export const SCHEME_OPTIONS = [
  { value: "half", label: "Однопівперіодний", hint: "Один діод, працює один півперіод" },
  { value: "bridge", label: "Мостовий", hint: "Чотири діоди, працюють обидва півперіоди" },
];

/** Які регулятори показувати в цьому режимі. */
export function controlsFor(mode) {
  return Object.values(CONTROLS).filter((control) => control.modes.includes(mode));
}
