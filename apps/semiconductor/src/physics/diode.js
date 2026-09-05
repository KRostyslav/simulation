/**
 * Діод: вольт-амперна характеристика p-n переходу.
 *
 * Уся асиметрія діода — з однієї формули Шоклі: I = I_s·(exp(U/V_T) − 1).
 * При прямому зміщенні експонента вибухає, і струм росте на порядок кожні
 * 60 мВ. При зворотному вона швидко стає нулем, і лишається −I_s: крихітний
 * струм неосновних носіїв, яким однаково, яка там напруга, бо їх і так мало.
 */

import { Q, SAMPLE } from "./constants.js";
import { intrinsicConcentration, thermalVoltage } from "./intrinsic.js";
import { carrierLifetime } from "./doping.js";
import { electronMobility, holeMobility, diffusionCoefficient } from "./transport.js";
import { diffusionLength } from "./optical.js";

/**
 * Струм насичення I_s [А] — вся зворотна вітка ВАХ в одному числі.
 *
 * I_s = q·A·n_i²·(D_p/(L_p·N_d) + D_n/(L_n·N_a))
 *
 * Головне, що видно з формули: I_s ∝ n_i². Тому зворотний струм так різко
 * росте з температурою (у кремнієвого діода — приблизно вдвічі на кожні 10 К),
 * і тому сильніше легування його зменшує: неосновних носіїв стає менше.
 */
export function saturationCurrent({ na, nd, temperature, area = SAMPLE.areaCm2 }) {
  const ni = intrinsicConcentration(temperature);

  // Неосновні носії: у n-області це дірки, у p-області — електрони.
  const dp = diffusionCoefficient(holeMobility(nd, temperature), temperature);
  const dn = diffusionCoefficient(electronMobility(na, temperature), temperature);
  const lp = diffusionLength(dp, carrierLifetime(nd));
  const ln = diffusionLength(dn, carrierLifetime(na));

  const is = Q * area * ni * ni * (dp / (lp * nd) + dn / (ln * na));
  return { is, dp, dn, lp, ln, ni };
}

/**
 * Послідовний опір нейтральних областей [Ом].
 * Не косметика: саме він обмежує струм реального діода при великому зміщенні.
 * Без нього модель при U = 1 В і низькій температурі видала б струм у 10¹⁹ А.
 */
export function seriesResistance({ na, nd, temperature, area = SAMPLE.areaCm2 }) {
  const half = SAMPLE.lengthCm / 2;
  const rhoN = 1 / (Q * nd * electronMobility(nd, temperature));
  const rhoP = 1 / (Q * na * holeMobility(na, temperature));
  return ((rhoN + rhoP) * half) / area;
}

/**
 * Розв'язок неявного рівняння I = I_s·(exp((U − I·R_s)/V_T) − 1).
 *
 * Бісекцією, а не методом Ньютона: похідна експоненти на кілька порядків
 * різна на кінцях відрізка, і Ньютон розбігається. Бісекція за 100 ітерацій
 * доходить до машинної точності й не може розбігтися в принципі.
 *
 * Дужка вибрана фізично: при I = 0 напруга на самому переході дорівнює U
 * (струм максимально «хоче» текти), при I = U/R_s вона дорівнює нулю
 * (весь спад — на опорі). Розв'язок гарантовано між ними.
 *
 * expm1 замість exp(x) − 1 — принципово: при U = 1 мВ вираз exp(0,0387) − 1
 * у подвійній точності втрачає значущі цифри, і вся область малих напруг
 * перетворилася б на «струму немає».
 */
export function solveDiodeCurrent({ voltage, is, rs, vt, ideality = 1 }) {
  if (voltage === 0) return { current: 0, junctionVoltage: 0 };

  const scale = ideality * vt;
  const diffusionCurrent = (vj) => is * Math.expm1(Math.min(vj / scale, 700));

  let lo = Math.min(0, voltage / rs);
  let hi = Math.max(0, voltage / rs);

  for (let i = 0; i < 100; i += 1) {
    const mid = (lo + hi) / 2;
    // f(I) = I_дифузійний(U − I·R_s) − I; спадна за I, тому знак однозначний.
    if (diffusionCurrent(voltage - mid * rs) - mid > 0) lo = mid;
    else hi = mid;
  }

  const current = (lo + hi) / 2;
  return { current, junctionVoltage: voltage - current * rs };
}

/** Повна характеристика діода в одній точці. */
export function diodePoint({ na, nd, temperature, voltage, area = SAMPLE.areaCm2 }) {
  const vt = thermalVoltage(temperature);
  const { is, lp, ln } = saturationCurrent({ na, nd, temperature, area });
  const rs = seriesResistance({ na, nd, temperature, area });
  const { current, junctionVoltage } = solveDiodeCurrent({ voltage, is, rs, vt });

  let limitedBy = "рівновага";
  if (voltage < 0) limitedBy = "струм насичення";
  else if (voltage > 0) {
    // Якщо на опорі нейтральних областей гріється більш ніж чверть
    // прикладеної напруги, експонента вже не керує струмом: далі ВАХ
    // випрямляється в звичайну пряму закону Ома.
    limitedBy = current * rs > 0.25 * voltage ? "послідовний опір" : "дифузія";
  }

  return { current, junctionVoltage, is, rs, vt, lp, ln, limitedBy };
}

/** Точки ВАХ для графіка. */
export function ivCurve({ na, nd, temperature, from, to, points = 120, area }) {
  const vt = thermalVoltage(temperature);
  const { is } = saturationCurrent({ na, nd, temperature, area });
  const rs = seriesResistance({ na, nd, temperature, area });

  const result = [];
  for (let i = 0; i <= points; i += 1) {
    const voltage = from + ((to - from) * i) / points;
    const { current } = solveDiodeCurrent({ voltage, is, rs, vt });
    result.push({ voltage, current });
  }
  return result;
}

/**
 * Напруга, потрібна для заданого струму — для перевірки «60 мВ на декаду».
 * Оберненою формулою U = V_T·ln(I/I_s + 1) + I·R_s, точною за побудовою.
 */
export function voltageForCurrent({ current, is, rs, vt, ideality = 1 }) {
  return ideality * vt * Math.log(current / is + 1) + current * rs;
}
