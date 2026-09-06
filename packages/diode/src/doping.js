/**
 * Домішкова провідність: скільки вільних електронів і дірок у кристалі.
 *
 * Модель бере одну домішку за раз і вважає її повністю іонізованою — при
 * кімнатній температурі це так із точністю до часток відсотка (енергія
 * іонізації фосфору в кремнії 0,045 еВ проти kT = 0,026 еВ). Виморожування
 * домішок при глибокому охолодженні модель не відтворює.
 */

import { intrinsicConcentration } from "./intrinsic.js";
import { SI } from "./constants.js";

export const DOPANT = {
  none: "none",
  donor: "donor", // Фосфор — п'ята валентність, віддає електрон → n-тип
  acceptor: "acceptor", // Бор — третя валентність, забирає електрон → p-тип
};

/** Час життя нерівноважних носіїв τ(N) [с] — домішки прискорюють рекомбінацію. */
export function carrierLifetime(dopingConcentration, material = SI) {
  return material.tau0 / (1 + dopingConcentration / material.nTau);
}

/**
 * Рівноважні концентрації n₀ і p₀ [см⁻³] з умов електронейтральності
 * (n + N_a = p + N_d) і закону діючих мас (n·p = n_i²).
 *
 * ЧИСЕЛЬНА ПАСТКА, через яку тут саме такий вигляд формул.
 * Основні носії рахуємо через корінь, а неосновні — ТІЛЬКИ як n_i²/основні.
 * Якби неосновні шукали як різницю (n − N_net), сталося б ось що: при
 * N_d = 10¹⁶ шукана p ≈ 6,4·10³, тобто 10⁻¹² від n. У float64 (≈16 значущих
 * цифр) така різниця ще виживає, але вже при N_d = 10¹⁹ шукана p ≈ 6,4
 * становить 10⁻¹⁸ від n — і різниця дає рівно нуль. Панель показала б
 * «дірок немає», що фізично неправда й ламає весь закон діючих мас.
 */
export function equilibriumCarriers({ temperature, dopant, doping, material = SI }) {
  const ni = intrinsicConcentration(temperature, material);
  const nd = dopant === DOPANT.donor ? doping : 0;
  const na = dopant === DOPANT.acceptor ? doping : 0;
  const net = nd - na;
  const half = net / 2;
  const root = Math.sqrt(half * half + ni * ni);

  if (net >= 0) {
    const n0 = half + root;
    return { n0, p0: (ni * ni) / n0, ni, nd, na, net };
  }
  const p0 = -half + root;
  return { n0: (ni * ni) / p0, p0, ni, nd, na, net };
}

/**
 * Повні концентрації з урахуванням освітлення.
 *
 * Світло народжує пари, тому Δn = Δp додається до обох. Наслідок: добуток n·p
 * стає БІЛЬШИМ за n_i². Закон діючих мас справедливий лише в рівновазі,
 * а освітлений кристал у ній не перебуває.
 */
export function carriers({ temperature, dopant, doping, excess = 0, material = SI }) {
  const base = equilibriumCarriers({ temperature, dopant, doping, material });
  const n = base.n0 + excess;
  const p = base.p0 + excess;
  return {
    ...base,
    n,
    p,
    excess,
    equilibrium: excess <= 0,
    type: n > p ? "n" : p > n ? "p" : "i",
  };
}
