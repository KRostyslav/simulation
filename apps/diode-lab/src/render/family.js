/**
 * Сімейство характеристик — коли потрібно порівняти дві або кілька кривих.
 *
 * Використовується у двох режимах: «Si проти Ge» і «температура». В обох
 * випадках сенс однаковий: показати, що криві не перетинаються й не
 * змінюють форми, а просто зсунуті одна відносно одної вздовж осі напруг.
 * Саме цей зсув студент і вимірює.
 */

import {
  PALETTE,
  rect,
  dashedLine,
  disc,
  ring,
  plotAxes,
  polyline,
} from "@edu/pixel-ui";

import { makeMapper } from "./plot.js";
import { theoreticalCurve } from "../physics/circuit.js";
import { seriesList } from "../physics/measurements.js";
import { DEVICE_BY_ID } from "../physics/devices.js";

const COLORS = [PALETTE.curve, PALETTE.curveAlt, PALETTE.donorIon, PALETTE.acceptorIon];

/**
 * Усі серії таблиці, зведені на одне поле, у логарифмічній шкалі струму.
 * Логарифмічна — бо саме в ній видно, що криві паралельні: у лінійній вони
 * злилися б в одну майже вертикальну лінію.
 */
export function familyData(snapshot, { showTheory = false } = {}) {
  const series = seriesList(snapshot.table)
    .map((s, index) => ({
      ...s,
      device: DEVICE_BY_ID[s.deviceId],
      color: COLORS[index % COLORS.length],
      points: s.points.filter((p) => p.current > 0 && p.voltage > 0),
    }))
    .filter((s) => s.device && s.points.length > 0);

  const theory = showTheory
    ? series.map((s) => ({
        ...s,
        curve: theoreticalCurve({
          device: s.device,
          temperature: s.temperature,
          from: 0,
          to: 1.2,
          points: 90,
          resistance: snapshot.resistance,
        }).filter((p) => p.current > 0),
      }))
    : [];

  const all = series.flatMap((s) => s.points);
  const currents = all.map((p) => p.current);
  const voltages = all.map((p) => p.voltage);

  return {
    series,
    theory,
    // Шкала струму тут ЗАВЖДИ логарифмічна: тільки в ній видно, що криві
    // різних матеріалів паралельні. Прапорець потрібен підписам осей —
    // без нього вони назвали б показник степеня звичайним числом ампер.
    logScale: true,
    xMin: voltages.length
      ? Math.max(0, Math.floor((Math.min(...voltages) - 0.04) * 20) / 20)
      : 0,
    xMax: voltages.length
      ? Math.max(0.4, Math.ceil((Math.max(...voltages) + 0.04) * 20) / 20)
      : 1,
    yMin: currents.length ? Math.floor(Math.log10(Math.min(...currents)) - 0.3) : -9,
    yMax: currents.length ? Math.ceil(Math.log10(Math.max(...currents)) + 0.3) : -2,
  };
}

export function drawFamily(ctx, box, snapshot, options = {}) {
  const data = familyData(snapshot, options);
  const map = makeMapper(box, [data.xMin, data.xMax], [data.yMin, data.yMax]);

  rect(ctx, box.x, box.y, box.w, box.h, PALETTE.crystalDeep);
  for (let l = Math.ceil(data.yMin); l <= data.yMax; l += 1) {
    const { y } = map(0, l);
    dashedLine(ctx, box.x, y, box.x + box.w - 1, y, PALETTE.grid, 1, 3);
  }
  plotAxes(ctx, box, PALETTE.axis, 4, 4);

  for (const t of data.theory) {
    if (t.curve.length < 2) continue;
    polyline(
      ctx,
      t.curve.map((p) => map(p.voltage, Math.log10(p.current))),
      PALETTE.dim,
    );
  }

  for (const s of data.series) {
    const mapped = s.points.map((p) => map(p.voltage, Math.log10(p.current)));
    if (mapped.length > 1) polyline(ctx, mapped, s.color);
    for (const point of mapped) disc(ctx, point.x, point.y, 2, s.color);
  }

  // Поточна робоча точка — щоб було видно, до якої серії зараз дописуються точки.
  const op = snapshot.op;
  if (op.current > 0 && op.diodeVoltage > 0) {
    const { x, y } = map(op.diodeVoltage, Math.log10(op.current));
    ring(ctx, x, y, 4, PALETTE.marker);
  }

  return data;
}
