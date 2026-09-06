/**
 * Каталог діодів на столі.
 *
 * Кожен прилад описаний лише тим, чим він фізично є: матеріал, легування,
 * площа переходу, товщина бази. Ні I_s, ні порогова напруга, ні напруга
 * пробою тут не задані числом — усе це рахує @edu/diode з наведених
 * параметрів. Інакше «дослідження» звелося б до читання константи, яку
 * автор вписав руками.
 *
 * Показово, що стабілітрон відрізняється від звичайного кремнієвого діода
 * ЛИШЕ легуванням: у 24 рази сильніше — і пробій замість 60 В настає при 5,7 В.
 */

import { SI, GE, thermalVoltage } from "@edu/diode";
import { saturationCurrent, seriesResistance } from "@edu/diode";
import { generationCurrent, breakdownAt } from "@edu/diode";

export const DEVICES = [
  {
    id: "si",
    label: "Кремнієвий Д226",
    short: "Si",
    material: SI,
    na: 1e16,
    nd: 1e16,
    area: 1e-3, // см²
    lengthCm: 0.005,
    note: "Випрямний кремнієвий діод. Відкривається приблизно при 0,7 В, зворотний струм — одиниці пікоампер.",
  },
  {
    id: "ge",
    label: "Германієвий Д9",
    short: "Ge",
    material: GE,
    na: 1e16,
    nd: 1e16,
    area: 3e-4,
    lengthCm: 0.005,
    note: "Германієвий діод. Поріг удвічі нижчий, зате зворотний струм у тисячі разів більший — і при нагріванні швидко зростає.",
  },
  {
    id: "zener",
    label: "Стабілітрон КС156",
    short: "VD ст",
    material: SI,
    na: 2.4e17,
    nd: 2.4e17,
    area: 1e-3,
    lengthCm: 0.005,
    note: "Той самий кремній, легований у 24 рази сильніше. Збіднений шар вужчий, поле в ньому більше — пробій настає вже при 5,7 В.",
  },
];

export const DEVICE_BY_ID = Object.fromEntries(DEVICES.map((d) => [d.id, d]));

/**
 * Усі параметри приладу при заданій температурі.
 *
 * `bias` потрібен генераційному струмові: ширина збідненого шару залежить
 * від прикладеної напруги, а з нею — і кількість пар, що народжуються всередині.
 * Саме тому зворотна вітка реального діода не горизонтальна.
 */
export function deviceParameters(device, temperature, bias = 0) {
  const { material, na, nd, area, lengthCm } = device;
  const vt = thermalVoltage(temperature);
  const { is, lp, ln } = saturationCurrent({ na, nd, temperature, area, material });
  const rs = seriesResistance({ na, nd, temperature, area, lengthCm, material });
  const { igen, ni, width } = generationCurrent({
    na,
    nd,
    temperature,
    area,
    bias,
    material,
  });
  const breakdown = breakdownAt({ na, nd, temperature, material });
  return { is, igen, rs, vt, ni, width, lp, ln, breakdown, material };
}
