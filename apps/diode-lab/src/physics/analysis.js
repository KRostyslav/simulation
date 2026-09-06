/**
 * Обробка результатів — власне те, що студент здає.
 *
 * Прийом, на якому все тримається: прологарифмувати формулу Шоклі. При
 * U ≫ V_T одиницею в дужках можна знехтувати, і експонента перетворюється
 * на пряму:
 *
 *     I = I_s·exp(U/(n·V_T))   →   lg I = lg I_s + U/(n·V_T·ln10)
 *
 * Тобто в координатах (U, lg I) характеристика діода — ПРЯМА. Її нахил дає
 * коефіцієнт ідеальності n, а точка перетину з віссю — струм насичення I_s.
 * Саме тому напівлогарифмічний папір лежить у кожній лабораторії.
 */

import { thermalVoltage } from "@edu/diode";
import { I_REF } from "./constants.js";

const LN10 = Math.LN10;

/**
 * Незважений метод найменших квадратів для прямої y = a + b·x.
 *
 * Незважений — свідомо: студент на папері рахує саме так, і завдання моделі —
 * відтворити його розрахунок, а не показати кращий. Ваги за похибкою кожної
 * точки були б формально правильніші, але тоді результат на екрані перестав
 * би збігатися з тим, що виходить на папері, і довіру до всієї роботи
 * було б утрачено.
 *
 * На одній точці повертає null, а не NaN: одна точка не визначає прямої,
 * і чесніше сказати «даних мало», ніж показати «n = NaN».
 */
export function leastSquares(points) {
  const n = points.length;
  if (n < 2) return null;

  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  const mx = sx / n;
  const my = sy / n;

  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of points) {
    const dx = p.x - mx;
    const dy = p.y - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  // Усі точки на одній вертикалі — нахилу не існує.
  if (sxx === 0) return null;

  const b = sxy / sxx;
  const a = my - b * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);

  // Стандартні похибки коефіцієнтів через залишкову дисперсію.
  const residual = Math.max(0, syy - b * sxy);
  const sigma2 = n > 2 ? residual / (n - 2) : 0;
  const sigmaB = Math.sqrt(sigma2 / sxx);
  const sigmaA = Math.sqrt(sigma2 * (1 / n + (mx * mx) / sxx));

  return { a, b, sigmaA, sigmaB, r2, count: n };
}

/**
 * Вибір лінійної ділянки — крок, який студенти найчастіше пропускають,
 * а потім дивуються, чому n вийшов 1,6.
 *
 * Відкидаємо три групи точок, і кожна відкидається зі своєї причини:
 *
 *  — U < 4·V_T (близько 100 мВ): там exp(U/V_T) − 1 ще не дорівнює
 *    експоненті, одиниця в дужках не мала, і логарифмування неправомірне;
 *  — показ менший за 20 одиниць молодшого розряду: там уже не характеристика
 *    діода, а дискретність АЦП;
 *  — спад на власному опорі більший за 5 % напруги: там ВАХ гнеться до
 *    прямої закону Ома, і нахил перестає бути експоненційним.
 */
export function pickLinearRegion(points, { temperature, rs = 0, minPoints = 4 } = {}) {
  const vt = thermalVoltage(temperature);
  const used = [];
  const rejected = [];

  for (const p of points) {
    if (!(p.voltage > 0)) {
      rejected.push({ ...p, reason: "зворотна вітка" });
      continue;
    }
    if (!(p.current > 0)) {
      rejected.push({ ...p, reason: "амперметр показує нуль" });
      continue;
    }
    if (p.voltage < 4 * vt) {
      rejected.push({ ...p, reason: "мала напруга: одиниця в дужках ще не мала" });
      continue;
    }
    if (p.counts != null && p.counts < 20) {
      rejected.push({ ...p, reason: "на межі роздільності приладу" });
      continue;
    }
    if (rs > 0 && p.current * rs > 0.05 * p.voltage) {
      rejected.push({ ...p, reason: "завеликий струм: заважає послідовний опір" });
      continue;
    }
    used.push(p);
  }

  return {
    used,
    rejected,
    enough: used.length >= minPoints,
    decades:
      used.length >= 2
        ? Math.log10(used[used.length - 1].current / used[0].current)
        : 0,
  };
}

/**
 * Апроксимація прямої вітки: з нахилу — коефіцієнт ідеальності,
 * з відрізка — струм насичення.
 *
 *     n = 1/(b·V_T·ln10),   I_s = 10^a,   ΔU на декаду = 1/b
 *
 * При n = 1 і 300 К декада коштує V_T·ln10 = 59,5 мВ — те саме «правило
 * 60 мілівольт», яке студент має підтвердити власними числами.
 */
export function fitShockley(points, { temperature }) {
  const vt = thermalVoltage(temperature);
  const usable = points.filter((p) => p.current > 0);
  const fit = leastSquares(
    usable.map((p) => ({ x: p.voltage, y: Math.log10(p.current) })),
  );
  if (!fit) return null;

  const ideality = 1 / (fit.b * vt * LN10);
  return {
    ...fit,
    ideality,
    // Похибка n через похибку нахилу: n ~ 1/b, тому δn/n = δb/b.
    sigmaIdeality: Math.abs(ideality) * (fit.sigmaB / Math.abs(fit.b)),
    is: 10 ** fit.a,
    mvPerDecade: 1000 / fit.b,
    vt,
    from: usable[0]?.voltage ?? null,
    to: usable[usable.length - 1]?.voltage ?? null,
  };
}

/** Скільки мілівольт коштує декада струму в ідеальному діоді при цій T. */
export function theoryMvPerDecade(temperature, ideality = 1) {
  return 1000 * ideality * thermalVoltage(temperature) * LN10;
}

/** Перевірка правила «60 мВ на декаду». */
export function decadeCheck(fit, temperature) {
  if (!fit) return null;
  const theory = theoryMvPerDecade(temperature, 1);
  const deviation = (fit.mvPerDecade / theory - 1) * 100;
  let verdict = "збігається";
  if (deviation > 15) verdict = "завелика";
  else if (deviation < -15) verdict = "замала";
  return { measured: fit.mvPerDecade, theory, deviation, verdict };
}

/**
 * Динамічний опір r = ΔU/ΔI у точці — центральною різницею за СУСІДНІМИ точками.
 *
 * Чому не «по двох далеких точках, так зручніше». ВАХ експоненційна, і хорда
 * завжди положіша за дотичну: взявши точки через цілу декаду, студент
 * отримає опір, завищений у півтора рази. Помилка тим більша, чим ширший
 * інтервал, і саме тому диференціальні величини рахують по сусідніх точках.
 */
export function dynamicResistance(points, index) {
  if (index <= 0 || index >= points.length - 1) return null;
  const before = points[index - 1];
  const after = points[index + 1];
  const du = after.voltage - before.voltage;
  const di = after.current - before.current;
  if (!(Math.abs(di) > 0)) return null;
  return { r: du / di, du, di, at: points[index] };
}

/** Крива r(I) для графіка — по всіх внутрішніх точках серії. */
export function dynamicResistanceCurve(points) {
  const result = [];
  for (let i = 1; i < points.length - 1; i += 1) {
    const r = dynamicResistance(points, i);
    if (r && r.r > 0) result.push({ current: points[i].current, r: r.r });
  }
  return result;
}

/**
 * Порогова напруга за опорним струмом: інтерполяція по lg I до 1 мА.
 *
 * Логарифмічна інтерполяція, а не лінійна: між двома сусідніми точками
 * характеристика — експонента, і в координатах lg I вона пряма, тому
 * інтерполяція там точна, а не наближена.
 */
export function thresholdVoltage(points, { iRef = I_REF } = {}) {
  const list = points.filter((p) => p.current > 0).sort((a, b) => a.current - b.current);
  if (list.length < 2) return null;

  const below = [...list].reverse().find((p) => p.current <= iRef);
  const above = list.find((p) => p.current >= iRef);
  if (!below || !above) {
    return { voltage: null, extrapolated: true, iRef };
  }
  if (below === above) return { voltage: below.voltage, extrapolated: false, iRef };

  const t =
    (Math.log10(iRef) - Math.log10(below.current)) /
    (Math.log10(above.current) - Math.log10(below.current));
  return {
    voltage: below.voltage + t * (above.voltage - below.voltage),
    extrapolated: false,
    iRef,
  };
}

/**
 * Порогова напруга методом дотичної — другий шкільний спосіб.
 *
 * Проводимо дотичну в найкрутішій точці лінійної ВАХ і дивимось, де вона
 * перетинає вісь напруг. Метод дає систематично МЕНШЕ значення, ніж спосіб
 * за опорним струмом, і це не помилка: у діода немає «справжньої» порогової
 * напруги, є лише домовленість, як її міряти. Показати обидва результати
 * поруч — найкоротший спосіб це пояснити.
 */
export function thresholdByTangent(points) {
  const list = points.filter((p) => p.current > 0);
  if (list.length < 3) return null;

  let best = null;
  for (let i = 1; i < list.length - 1; i += 1) {
    const r = dynamicResistance(list, i);
    if (!r || !(r.r > 0)) continue;
    const slope = 1 / r.r; // dI/dU
    if (!best || slope > best.slope) {
      best = { slope, point: list[i] };
    }
  }
  if (!best) return null;

  // Дотична: I = slope·(U − U₀) → U₀ = U − I/slope.
  return {
    voltage: best.point.voltage - best.point.current / best.slope,
    at: best.point,
  };
}

/** Порівняння двох серій — основа завдань «Si проти Ge» і «−2 мВ/К». */
export function compareSeries(a, b, { iRef = I_REF } = {}) {
  const ua = thresholdVoltage(a.points, { iRef });
  const ub = thresholdVoltage(b.points, { iRef });
  if (!ua?.voltage || !ub?.voltage) return null;

  const deltaThreshold = ua.voltage - ub.voltage;
  const deltaT = a.temperature - b.temperature;
  return {
    deltaThreshold,
    thresholdA: ua.voltage,
    thresholdB: ub.voltage,
    deltaT,
    // мВ на кельвін — має вийти близько −2 для будь-якого кремнієвого діода.
    mvPerKelvin: deltaT === 0 ? null : (deltaThreshold * 1000) / deltaT,
  };
}

/**
 * Напруга пробою з точок зворотної вітки: беремо напругу, при якій струм
 * уперше перевищив умовний поріг у 1 % від найбільшого зворотного струму серії.
 * Саме так її і знаходять на практиці — за зламом характеристики.
 */
export function breakdownFromPoints(points) {
  const reverse = points
    .filter((p) => p.voltage < 0)
    .sort((a, b) => b.voltage - a.voltage); // від нуля вглиб
  if (reverse.length < 3) return null;

  const peak = Math.max(...reverse.map((p) => Math.abs(p.current)));
  if (!(peak > 0)) return null;
  const knee = reverse.find((p) => Math.abs(p.current) > 0.01 * peak);
  return knee ? { vbr: Math.abs(knee.voltage), at: knee } : null;
}
