/**
 * Діод: вольт-амперна характеристика p-n переходу.
 *
 * Уся асиметрія діода — з однієї формули Шоклі: I = I_s·(exp(U/V_T) − 1).
 * При прямому зміщенні експонента вибухає, і струм росте на порядок кожні
 * 60 мВ. При зворотному вона швидко стає нулем, і лишається −I_s: крихітний
 * струм неосновних носіїв, яким однаково, яка там напруга, бо їх і так мало.
 *
 * Поверх ідеальної формули додано два необов'язкові механізми — генерація
 * в збідненому шарі (`igen`) і зворотний пробій (`breakdown`). Обидва
 * вимкнені за замовчуванням і ввімкнені лише там, де вони потрібні для
 * навчальної задачі: увімкнений механізм змінює числа, а не уточнює їх,
 * і мовчки міняти під учнем те, що він щойно виміряв, не можна.
 */

import { Q, SAMPLE, SI } from "./constants.js";
import { intrinsicConcentration, thermalVoltage } from "./intrinsic.js";
import { carrierLifetime } from "./doping.js";
import {
  electronMobility,
  holeMobility,
  diffusionCoefficient,
  diffusionLength,
} from "./transport.js";

/**
 * Струм насичення I_s [А] — вся зворотна вітка ідеальної ВАХ в одному числі.
 *
 * I_s = q·A·n_i²·(D_p/(L_p·N_d) + D_n/(L_n·N_a))
 *
 * Головне, що видно з формули: I_s ∝ n_i². Тому зворотний струм так різко
 * росте з температурою, і тому сильніше легування його зменшує: неосновних
 * носіїв стає менше. Він же пояснює різницю Si та Ge: у германію n_i більша
 * у 2400 разів, отже I_s — у мільйони разів.
 */
export function saturationCurrent({
  na,
  nd,
  temperature,
  area = SAMPLE.areaCm2,
  material = SI,
}) {
  const ni = intrinsicConcentration(temperature, material);

  // Неосновні носії: у n-області це дірки, у p-області — електрони.
  const dp = diffusionCoefficient(holeMobility(nd, temperature, material), temperature);
  const dn = diffusionCoefficient(
    electronMobility(na, temperature, material),
    temperature,
  );
  const lp = diffusionLength(dp, carrierLifetime(nd, material));
  const ln = diffusionLength(dn, carrierLifetime(na, material));

  const is = Q * area * ni * ni * (dp / (lp * nd) + dn / (ln * na));
  return { is, dp, dn, lp, ln, ni };
}

/**
 * Послідовний опір нейтральних областей [Ом].
 * Не косметика: саме він обмежує струм реального діода при великому зміщенні.
 * Без нього модель при U = 1 В і низькій температурі видала б струм у 10¹⁹ А.
 */
export function seriesResistance({
  na,
  nd,
  temperature,
  area = SAMPLE.areaCm2,
  lengthCm = SAMPLE.lengthCm,
  material = SI,
}) {
  const half = lengthCm / 2;
  const rhoN = 1 / (Q * nd * electronMobility(nd, temperature, material));
  const rhoP = 1 / (Q * na * holeMobility(na, temperature, material));
  return ((rhoN + rhoP) * half) / area;
}

/**
 * Розв'язок неявного рівняння I = I_діода(U − I·R_s).
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
 *
 * Додаткові доданки стоять під `if`, а не помножені на нуль: додавання «+ 0»
 * до числа з плаваючою комою — операція не безкоштовна за точністю, і тут
 * важливо, щоб вимкнені механізми лишали арифметику рівно такою, якою вона
 * була без них.
 */
export function solveDiodeCurrent({
  voltage,
  is,
  rs,
  vt,
  ideality = 1,
  igen = 0, // префактор генераційно-рекомбінаційного струму, А (0 = вимкнено)
  breakdown = null, // { vbr, ibr, knee } (null = пробою немає)
}) {
  if (voltage === 0) return { current: 0, junctionVoltage: 0 };

  const scale = ideality * vt;
  const diffusionCurrent = (vj) => {
    let i = is * Math.expm1(Math.min(vj / scale, 700));
    // Рекомбінація в збідненому шарі: своя експонента з n = 2.
    if (igen > 0) i += igen * Math.expm1(Math.min(vj / (2 * vt), 700));
    // Пробій: різке коліно за V_проб. Функція лишається монотонно зростаючою
    // за vj, тому та сама бісекція працює без жодних змін.
    if (breakdown) {
      const over = -vj - breakdown.vbr;
      if (over > 0) i -= breakdown.ibr * Math.expm1(Math.min(over / breakdown.knee, 700));
    }
    return i;
  };

  let lo = Math.min(0, voltage / rs);
  let hi = Math.max(0, voltage / rs);

  for (let i = 0; i < 100; i += 1) {
    const mid = (lo + hi) / 2;
    // f(I) = I_діода(U − I·R_s) − I; спадна за I, тому знак однозначний.
    if (diffusionCurrent(voltage - mid * rs) - mid > 0) lo = mid;
    else hi = mid;
  }

  const current = (lo + hi) / 2;
  return { current, junctionVoltage: voltage - current * rs };
}

/**
 * Повна характеристика діода в одній точці.
 *
 * `recombination` і `breakdown` вмикають додаткові механізми. За замовчуванням
 * обидва вимкнені, і функція дає рівно ідеальну модель Шоклі з послідовним опором.
 */
export function diodePoint({
  na,
  nd,
  temperature,
  voltage,
  area = SAMPLE.areaCm2,
  lengthCm = SAMPLE.lengthCm,
  material = SI,
  ideality = 1,
  igen = 0,
  breakdown = null,
}) {
  const vt = thermalVoltage(temperature);
  const { is, lp, ln } = saturationCurrent({ na, nd, temperature, area, material });
  const rs = seriesResistance({ na, nd, temperature, area, lengthCm, material });
  const { current, junctionVoltage } = solveDiodeCurrent({
    voltage,
    is,
    rs,
    vt,
    ideality,
    igen,
    breakdown,
  });

  let limitedBy = "рівновага";
  if (voltage < 0) limitedBy = "струм насичення";
  else if (voltage > 0) {
    // Якщо на опорі нейтральних областей гріється більш ніж чверть
    // прикладеної напруги, експонента вже не керує струмом: далі ВАХ
    // випрямляється в звичайну пряму закону Ома.
    limitedBy = current * rs > 0.25 * voltage ? "послідовний опір" : "дифузія";
  }
  if (breakdown && junctionVoltage < -breakdown.vbr) limitedBy = "пробій";
  else if (igen > 0 && voltage > 0 && igen * Math.expm1(junctionVoltage / (2 * vt)) >
           is * Math.expm1(Math.min(junctionVoltage / (ideality * vt), 700))) {
    limitedBy = "рекомбінація";
  }

  return { current, junctionVoltage, is, rs, vt, lp, ln, igen, limitedBy };
}

/** Точки ВАХ для графіка. */
export function ivCurve({
  na,
  nd,
  temperature,
  from,
  to,
  points = 120,
  area,
  lengthCm,
  material = SI,
  ideality = 1,
  igen = 0,
  breakdown = null,
}) {
  const vt = thermalVoltage(temperature);
  const { is } = saturationCurrent({ na, nd, temperature, area, material });
  const rs = seriesResistance({ na, nd, temperature, area, lengthCm, material });

  const result = [];
  for (let i = 0; i <= points; i += 1) {
    const voltage = from + ((to - from) * i) / points;
    const { current } = solveDiodeCurrent({
      voltage,
      is,
      rs,
      vt,
      ideality,
      igen,
      breakdown,
    });
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
