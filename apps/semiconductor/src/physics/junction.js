/**
 * p-n перехід: збіднений шар і контактна різниця потенціалів.
 *
 * Що відбувається, коли p- і n-області стикаються. Електрони з n-області
 * дифундують у p-область (їх там мало) і рекомбінують із дірками; дірки
 * рухаються назустріч. Біля межі не лишається рухомих носіїв — лише
 * нерухомі іони домішок: від'ємні акцептори ліворуч, додатні донори праворуч.
 * Ці іони створюють електричне поле, спрямоване так, щоб зупинити дифузію.
 * Рівновага настає, коли поле точно компенсує дифузійний потік.
 *
 * Використовуємо наближення різкого переходу зі збідненим шаром: усередині
 * шару рухомих носіїв немає взагалі, за його межами кристал нейтральний.
 * Це стандартне навчальне наближення, і воно правильно передає головне —
 * кореневу залежність ширини від напруги.
 */

import { Q, SI } from "./constants.js";
import { intrinsicConcentration, thermalVoltage } from "./intrinsic.js";

/** Переведення см → мкм для підписів. */
export const CM_TO_UM = 1e4;

/**
 * Контактна різниця потенціалів V_bi = V_T·ln(N_a·N_d/n_i²) [В].
 * Для 10¹⁶/10¹⁶ при 300 К — 0,71 В. Саме тому кремнієвий діод «відкривається»
 * приблизно на 0,7 В: менша напруга не здатна зняти цей бар'єр.
 */
export function builtInVoltage({ na, nd, temperature }) {
  const ni = intrinsicConcentration(temperature);
  const vt = thermalVoltage(temperature);
  return vt * Math.log((na * nd) / (ni * ni));
}

/**
 * Геометрія збідненого шару при зовнішній напрузі `bias`
 * (додатна — пряме зміщення, від'ємна — зворотне).
 *
 * Ефективна напруга на переході V_eff = V_bi − U обрізана знизу на рівні 2·V_T.
 * Без обрізання при U → V_bi ширина йшла б у нуль, а поле — у нескінченність.
 * Фізично ж наближення збідненого шару там просто перестає працювати:
 * бар'єр стає порівнянним із тепловим розкидом енергій, і межа шару
 * розмивається. Тому замість тихого обрізання ставимо `valid: false`,
 * і UI чесно про це пише.
 */
export function depletion({ na, nd, temperature, bias = 0 }) {
  const vbi = builtInVoltage({ na, nd, temperature });
  const vt = thermalVoltage(temperature);
  const raw = vbi - bias;
  const valid = raw >= 2 * vt;
  const veff = Math.max(raw, 2 * vt);

  // W = √(2ε·V_eff/q · (1/N_a + 1/N_d))
  const width = Math.sqrt(((2 * SI.eps * veff) / Q) * (1 / na + 1 / nd));

  // Заряд по обидва боки однаковий: N_a·x_p = N_d·x_n. Тому вужчий бік —
  // той, де легування сильніше: там достатньо тонкого шару, щоб набрати заряд.
  const xn = (width * na) / (na + nd);
  const xp = (width * nd) / (na + nd);

  return {
    vbi,
    veff,
    valid,
    width,
    widthUm: width * CM_TO_UM,
    xn,
    xp,
    xnUm: xn * CM_TO_UM,
    xpUm: xp * CM_TO_UM,
    // Трикутний профіль поля: середнє = V_eff/W, максимум удвічі більший.
    fieldMax: (2 * veff) / width,
    capacitancePerArea: SI.eps / width, // Ф/см² — варікап
  };
}

/** Місткість переходу [Ф] для площі A. Основа варікапа: C ~ 1/√(V_bi − U). */
export function junctionCapacitance({ na, nd, temperature, bias, area }) {
  return depletion({ na, nd, temperature, bias }).capacitancePerArea * area;
}
