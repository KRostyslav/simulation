/**
 * Графіки лабораторної роботи.
 *
 * Головна відмінність від графіка в підручнику: тут крива не намальована
 * наперед. На полі стоять ТОЧКИ, які студент зняв сам, і пряма, яку по них
 * провів метод найменших квадратів. Теоретична крива вмикається окремим
 * чекбоксом і за замовчуванням вимкнена — інакше вимірювання перетворюється
 * на підганяння під готову відповідь.
 */

import {
  PALETTE,
  rect,
  line,
  dashedLine,
  disc,
  ring,
  plotAxes,
  polyline,
} from "@edu/pixel-ui";

import { theoreticalCurve } from "../physics/circuit.js";

/**
 * Перетворювач «фізичні величини → пікселі».
 *
 * Обидва діапазони примусово ненульові. Виродження цілком реальне: поки
 * записана одна точка, максимум дорівнює мінімуму, різниця стає нулем,
 * і поділ 0/0 дав би NaN — а NaN у Брезенхемі означає нескінченний цикл
 * і мертво зависла вкладка.
 */
export function makeMapper(box, xRange, yRange) {
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
 * Дані графіка рахуються раз на знімок і кешуються за його ідентичністю.
 *
 * Причина не тільки в швидкодії. Підписи осей — це DOM-елементи, і вони
 * мусять називати ТОЙ САМИЙ діапазон, у якому намальована крива. Якби межі
 * рахувались окремо для канви й окремо для підписів, вони б розійшлися,
 * і графік почав би брехати підписами.
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

/** Округлення межі до «людського» числа, щоб підписи осей були читабельні. */
function niceCeil(value) {
  if (!(value > 0)) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  for (const step of [1, 2, 5, 10]) {
    if (value <= step * base) return step * base;
  }
  return 10 * base;
}

/**
 * Дані ВАХ: точки студента, теоретична крива й межі шкал.
 * `logScale` перемикає вісь струму на логарифмічну — саме в ній експонента
 * Шоклі стає прямою.
 */
export function ivPlotData(snapshot, { logScale = false, withTheory = false } = {}) {
  return memo(snapshot, `iv:${logScale}:${withTheory}`, () => {
    const { points, device, temperature, resistance, analysis } = snapshot;
    const forward = points.filter((p) => p.current > 0);

    const theory = withTheory
      ? theoreticalCurve({
          device,
          temperature,
          from: 0,
          to: Math.max(3, snapshot.emf),
          points: 120,
          resistance,
        }).filter((p) => p.current > 0)
      : [];

    const all = [...forward, ...theory];
    const currents = all.map((p) => p.current);
    const voltages = all.map((p) => p.voltage);

    // Поки точок немає — показуємо типову шкалу кремнієвого діода, щоб поле
    // не було порожнім прямокутником без жодних орієнтирів.
    const xMax = voltages.length
      ? Math.ceil((Math.max(...voltages) + 0.04) * 20) / 20
      : 1;
    const yTop = currents.length ? Math.max(...currents) : 1e-3;
    const yBottom = currents.length ? Math.min(...currents) : 1e-9;

    /*
     * Лінійний графік починається з нуля — так ВАХ малюють у підручнику, і
     * тільки так видно, що до порога струму практично немає. А в
     * логарифмічному нуля на осі струмів однаково немає, зате вся робоча
     * ділянка лежить у вузькому інтервалі напруг: якби вісь і там починалася
     * з нуля, точки збилися б у праву третину поля, і нахил — головне, заради
     * чого будують цей графік, — розгледіти було б неможливо.
     */
    const xMin =
      logScale && voltages.length
        ? Math.max(0, Math.floor((Math.min(...voltages) - 0.04) * 20) / 20)
        : 0;

    return {
      points: forward,
      theory,
      fit: analysis.fit,
      region: analysis.region,
      logScale,
      xMin,
      xMax,
      yMin: logScale ? Math.floor(Math.log10(yBottom) - 0.3) : 0,
      yMax: logScale ? Math.ceil(Math.log10(yTop) + 0.3) : niceCeil(yTop),
      unit: "А",
    };
  });
}

const toY = (data, current) =>
  data.logScale ? Math.log10(Math.max(current, 1e-30)) : current;

/** ВАХ за точками студента. */
export function drawIvPlot(ctx, box, snapshot, options = {}) {
  const data = ivPlotData(snapshot, options);
  const map = makeMapper(box, [data.xMin, data.xMax], [data.yMin, data.yMax]);

  rect(ctx, box.x, box.y, box.w, box.h, PALETTE.crystalDeep);

  // Сітка: у логарифмі — по декадах, у лінійній шкалі — чотири поділки.
  if (data.logScale) {
    for (let l = Math.ceil(data.yMin); l <= data.yMax; l += 1) {
      const { y } = map(0, l);
      dashedLine(ctx, box.x, y, box.x + box.w - 1, y, PALETTE.grid, 1, 3);
    }
  } else {
    for (let i = 1; i < 4; i += 1) {
      const { y } = map(0, data.yMin + ((data.yMax - data.yMin) * i) / 4);
      dashedLine(ctx, box.x, y, box.x + box.w - 1, y, PALETTE.grid, 1, 3);
    }
  }
  plotAxes(ctx, box, PALETTE.axis, 4, 4);

  // Теоретична крива — тьмяна й позаду: вона тут гість, а не господар.
  if (data.theory.length > 1) {
    polyline(
      ctx,
      data.theory.map((p) => map(p.voltage, toY(data, p.current))),
      PALETTE.dim,
    );
  }

  // Пряма методу найменших квадратів по відібраних точках.
  const fit = data.fit;
  if (fit && data.logScale && data.region?.used.length >= 2) {
    const a = data.region.used[0].voltage;
    const b = data.region.used[data.region.used.length - 1].voltage;
    const pa = map(a, fit.a + fit.b * a);
    const pb = map(b, fit.a + fit.b * b);
    line(ctx, pa.x, pa.y, pb.x, pb.y, PALETTE.curveAlt);
    // Межі ділянки, взятої в апроксимацію: студент має бачити, що саме
    // програма порахувала, а що відкинула.
    for (const x of [a, b]) {
      const { x: px } = map(x, 0);
      dashedLine(ctx, px, box.y, px, box.y + box.h - 1, PALETTE.fieldArrow, 2, 3);
    }
  }

  // Точки студента. Взяті в апроксимацію — залиті, відкинуті — кільцями.
  const used = new Set(data.region?.used ?? []);
  for (const p of data.points) {
    const { x, y } = map(p.voltage, toY(data, p.current));
    if (used.has(p)) disc(ctx, x, y, 2, PALETTE.marker);
    else ring(ctx, x, y, 2, PALETTE.dim);
  }

  // Поточна робоча точка — жива, рухається разом із регулятором.
  const op = snapshot.op;
  if (op.current > 0 && op.diodeVoltage > 0) {
    const { x, y } = map(op.diodeVoltage, toY(data, op.current));
    ring(ctx, x, y, 4, PALETTE.curve);
    disc(ctx, x, y, 1, PALETTE.curve);
  }

  return data;
}

/**
 * Зворотна вітка з двомасштабною віссю струму.
 *
 * Прийом із підручника, і без нього ніяк: прямий струм — міліампери,
 * зворотний — мікроампери й менше. В одному масштабі вся зворотна вітка
 * злилася б із віссю, і пробою просто не було б видно. Тому верхня половина
 * поля — прямий струм, нижня — зворотний, кожна зі своїм масштабом,
 * і підписи чесно називають обидва.
 */
export function reversePlotData(snapshot) {
  return memo(snapshot, "reverse", () => {
    const { points, device, temperature, resistance, op } = snapshot;
    const reverse = points.filter((p) => p.voltage < 0);
    const forward = points.filter((p) => p.voltage > 0);

    const vbr = op.breakdown.vbr;
    const depth = Math.max(niceCeil(vbr * 1.4), 5, ...reverse.map((p) => -p.voltage));
    const reverseMax = Math.max(
      niceCeil(Math.max(1e-6, ...reverse.map((p) => Math.abs(p.current)))),
      1e-6,
    );
    const forwardMax = Math.max(
      niceCeil(Math.max(1e-3, ...forward.map((p) => p.current))),
      1e-3,
    );

    const theory = theoreticalCurve({
      device,
      temperature,
      from: -depth,
      to: 1,
      points: 140,
      resistance,
    });

    return { reverse, forward, theory, depth, reverseMax, forwardMax, vbr };
  });
}

export function drawReversePlot(ctx, box, snapshot) {
  const data = reversePlotData(snapshot);
  const zeroY = box.y + Math.round(box.h * 0.35);

  rect(ctx, box.x, box.y, box.w, box.h, PALETTE.crystalDeep);

  /* Дві різні шкали струму, зшиті по осі нуля. */
  const mapX = (u) => box.x + ((u + data.depth) / (data.depth + 1)) * (box.w - 1);
  const mapY = (i) => {
    if (i >= 0) {
      const top = box.y + 2;
      return zeroY - (Math.min(i, data.forwardMax) / data.forwardMax) * (zeroY - top);
    }
    const bottom = box.y + box.h - 2;
    return (
      zeroY + (Math.min(-i, data.reverseMax) / data.reverseMax) * (bottom - zeroY)
    );
  };

  dashedLine(ctx, box.x, zeroY, box.x + box.w - 1, zeroY, PALETTE.grid, 2, 2);
  const zeroX = mapX(0);
  dashedLine(ctx, zeroX, box.y, zeroX, box.y + box.h - 1, PALETTE.grid, 2, 2);
  plotAxes(ctx, box, PALETTE.axis, 4, 2);

  polyline(
    ctx,
    data.theory.map((p) => ({ x: mapX(p.voltage), y: mapY(p.current) })),
    PALETTE.dim,
  );

  // Вертикаль напруги пробою — те, що студент шукає в цьому режимі.
  const bx = mapX(-data.vbr);
  dashedLine(ctx, bx, box.y, bx, box.y + box.h - 1, PALETTE.fieldArrow, 2, 3);

  for (const p of [...data.reverse, ...data.forward]) {
    disc(ctx, mapX(p.voltage), mapY(p.current), 2, PALETTE.marker);
  }

  const op = snapshot.op;
  if (op.current !== 0) {
    ring(ctx, mapX(op.diodeVoltage), mapY(op.current), 4, PALETTE.curve);
  }

  return data;
}
