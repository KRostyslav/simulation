/**
 * Графіки. Обидва — класичні рисунки з підручника, але живі: на кривій
 * завжди стоїть точка поточного стану, і вона рухається разом із повзунком.
 *
 * ln σ (1000/T) — та сама пряма, яку в підручнику малюють для визначення
 * ширини забороненої зони: її нахил дорівнює −E₉/2k. Для контрасту поруч
 * іде ρ(T) міді — щоб було видно, що метал поводиться протилежно.
 *
 * ВАХ у логарифмічній шкалі перетворює експоненту Шоклі на пряму з нахилом
 * 60 мВ на декаду струму — головну кількісну ознаку справного діода.
 */

import { PALETTE, rect, line, dashedLine, disc, ring, plotAxes, polyline } from "@edu/pixel-ui";

import { intrinsicConcentration } from "../physics/intrinsic.js";
import { carriers } from "../physics/doping.js";
import { electronMobility, holeMobility, conductivity } from "../physics/transport.js";
import { ivCurve } from "../physics/diode.js";

const T_MIN = 100;
const T_MAX = 700;

/**
 * Перетворювач «фізичні величини → пікселі канви».
 *
 * Обидва діапазони примусово роблено ненульовими. Виродження цілком реальне:
 * при 100 К увесь прямий струм діода лежить нижче нижньої межі шкали, всі
 * логарифми обрізаються в одне значення, і різниця y1 − y0 стає нулем.
 * Поділ 0/0 дав би NaN, і графік малювався б координатами-NaN.
 */
function makeMapper(box, xRange, yRange) {
  const [x0, x1] = xRange;
  const [y0, y1] = yRange;
  const dx = x1 - x0 || 1;
  const dy = y1 - y0 || 1;
  return (x, y) => ({
    x: box.x + ((x - x0) / dx) * (box.w - 1),
    y: box.y + box.h - 1 - ((y - y0) / dy) * (box.h - 1),
  });
}

/**
 * Дані кривої рахуються один раз на знімок і кешуються за його ідентичністю.
 *
 * Дві причини. Перша — швидкодія: ВАХ це 200 точок по 100 ітерацій бісекції,
 * і перераховувати їх 60 разів на секунду, поки гравець нічого не чіпає,
 * марно. Друга важливіша — підписи осей мусять називати ТОЙ САМИЙ діапазон,
 * у якому намальована крива. Якби межі рахувались окремо для малювання
 * й окремо для підписів, вони могли б розійтися.
 */
const cache = new WeakMap();

function memo(snapshot, key, build) {
  let perSnapshot = cache.get(snapshot);
  if (!perSnapshot) {
    perSnapshot = new Map();
    cache.set(snapshot, perSnapshot);
  }
  if (!perSnapshot.has(key)) perSnapshot.set(key, build());
  return perSnapshot.get(key);
}

/* --------------------------- провідність від T --------------------------- */

/**
 * σ(T) для поточного легування — та сама формула, що й у панелі.
 * `doped` уже враховує відсутність домішки (там нуль), тому окремої
 * перевірки на DOPANT.none тут не треба.
 *
 * Надлишок від світла беремо сталим по всій кривій: насправді τ і сам
 * трохи залежить від температури, але це другорядний ефект, а крива має
 * показувати саме залежність кількості носіїв від T.
 */
function conductivityAt(temperature, { dopant, doped, excess }) {
  const { n, p } = carriers({ temperature, dopant, doping: doped, excess });
  return conductivity({
    n,
    p,
    muN: electronMobility(doped, temperature),
    muP: holeMobility(doped, temperature),
  });
}

/** Крива σ(T) з межами шкали. Використовується і рендером, і підписами осей. */
export function conductivityPlotData(snapshot) {
  return memo(snapshot, "sigma", () => {
    const { dopant, doped, excess } = snapshot.values;
    const state = { dopant, doped, excess };

    const points = [];
    for (let t = T_MIN; t <= T_MAX; t += 4) {
      points.push({ inv: 1000 / t, log: Math.log10(conductivityAt(t, state)) });
    }

    const logs = points.map((point) => point.log);
    return {
      points,
      yMin: Math.floor(Math.min(...logs) - 0.4),
      yMax: Math.ceil(Math.max(...logs) + 0.4),
      xMin: 1000 / T_MAX,
      xMax: 1000 / T_MIN,
      tMin: T_MIN,
      tMax: T_MAX,
      unit: "См/см",
    };
  });
}

export function drawConductivityPlot(ctx, box, snapshot) {
  const { dopant, doped, excess, temperature } = snapshot.values;
  const state = { dopant, doped, excess };
  const data = conductivityPlotData(snapshot);
  const { points, yMin, yMax } = data;
  const map = makeMapper(box, [data.xMin, data.xMax], [yMin, yMax]);

  rect(ctx, box.x, box.y, box.w, box.h, PALETTE.crystalDeep);
  for (let l = yMin; l <= yMax; l += 1) {
    const { y } = map(0, l);
    dashedLine(ctx, box.x, y, box.x + box.w - 1, y, PALETTE.grid, 1, 3);
  }
  plotAxes(ctx, box, PALETTE.axis, 4, Math.min(6, yMax - yMin));

  // Мідь для контрасту: ρ ∝ T, тобто σ ∝ 1/T — майже горизонтальна лінія,
  // яка тільки трохи спадає вліво. Нормуємо її до верху шкали.
  const copper = [];
  for (let t = T_MIN; t <= T_MAX; t += 20) {
    copper.push(map(1000 / t, yMax - 0.6 + Math.log10(300 / t)));
  }
  polyline(ctx, copper, PALETTE.dim);

  polyline(
    ctx,
    points.map((point) => map(point.inv, point.log)),
    PALETTE.curve,
  );

  const here = map(1000 / temperature, Math.log10(conductivityAt(temperature, state)));
  disc(ctx, here.x, here.y, 2, PALETTE.marker);
  ring(ctx, here.x, here.y, 4, PALETTE.marker);

  return data;
}

/* ---------------------------------- ВАХ ---------------------------------- */

/** Крива ВАХ із межами шкали — спільна для рендера й підписів осей. */
export function ivPlotData(snapshot, logScale) {
  return memo(snapshot, logScale ? "iv-log" : "iv-lin", () => {
    const { na, nd, temperature } = snapshot.values;

    if (logScale) {
      const curve = ivCurve({ na, nd, temperature, from: 0.05, to: 1, points: 140 });
      const logs = curve.map((point) => Math.log10(Math.max(point.current, 1e-18)));
      const yMin = Math.max(-18, Math.floor(Math.min(...logs)));
      // При глибокому охолодженні весь струм тоне під 10⁻¹⁸ А, і без цієї
      // межі верх шкали опинився б нижче низу або збігся з ним.
      const yMax = Math.max(yMin + 2, Math.ceil(Math.max(...logs)));
      return { curve, logs, yMin, yMax, xMin: 0.05, xMax: 1, logScale: true };
    }

    const curve = ivCurve({ na, nd, temperature, from: -1, to: 1, points: 200 });
    const maxCurrent = Math.max(...curve.map((point) => point.current), 1e-12);
    return {
      curve,
      yMin: -maxCurrent * 0.15,
      yMax: maxCurrent,
      xMin: -1,
      xMax: 1,
      logScale: false,
    };
  });
}

export function drawIvPlot(ctx, box, snapshot, { logScale = false } = {}) {
  const { bias, current } = snapshot.values;
  const data = ivPlotData(snapshot, logScale);

  rect(ctx, box.x, box.y, box.w, box.h, PALETTE.crystalDeep);

  if (logScale) {
    // Логарифмічна шкала: тільки пряма вітка, зате експонента стає прямою
    // з нахилом 60 мВ на декаду — це можна перевірити лінійкою.
    const { curve, logs, yMin, yMax } = data;
    const map = makeMapper(box, [0.05, 1], [yMin, yMax]);

    for (let l = yMin; l <= yMax; l += 2) {
      const { y } = map(0.05, l);
      dashedLine(ctx, box.x, y, box.x + box.w - 1, y, PALETTE.grid, 1, 3);
    }
    plotAxes(ctx, box, PALETTE.axis, 4, Math.min(6, (yMax - yMin) / 2));
    polyline(
      ctx,
      curve.map((point, i) => map(point.voltage, logs[i])),
      PALETTE.curve,
    );

    if (bias > 0.05 && current > 0) {
      const here = map(bias, Math.log10(current));
      disc(ctx, here.x, here.y, 2, PALETTE.marker);
      ring(ctx, here.x, here.y, 4, PALETTE.marker);
    }
    return data;
  }

  // Лінійна шкала: класичний вигляд ВАХ. Масштаб по струму беремо від
  // максимуму прямої вітки — зворотна на цьому тлі зливається з віссю,
  // і саме це головне враження: діод пропускає струм в один бік.
  const { curve, yMin, yMax } = data;
  const map = makeMapper(box, [-1, 1], [yMin, yMax]);

  const zero = map(0, 0);
  dashedLine(ctx, box.x, zero.y, box.x + box.w - 1, zero.y, PALETTE.grid, 1, 3);
  dashedLine(ctx, zero.x, box.y, zero.x, box.y + box.h - 1, PALETTE.grid, 1, 3);
  plotAxes(ctx, box, PALETTE.axis, 4, 4);

  polyline(
    ctx,
    curve.map((point) => map(point.voltage, point.current)),
    PALETTE.curve,
  );

  if (bias >= -1 && bias <= 1) {
    const here = map(bias, Math.max(yMin, current));
    disc(ctx, here.x, here.y, 2, PALETTE.marker);
    ring(ctx, here.x, here.y, 4, PALETTE.marker);
  }
  return data;
}
