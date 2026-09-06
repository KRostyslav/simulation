/**
 * Осцилограма випрямляча.
 *
 * Вісь нуля проходить посередині поля — інакше «півхвилі» не читаються як
 * півхвилі: без видимого нуля студент не бачить, що саме відрізав діод.
 * Вхідна синусоїда лишається на екрані разом із виходом, бо вся суть
 * випрямляння — у різниці між ними.
 */

import {
  PALETTE,
  rect,
  dashedLine,
  polyline,
  dither,
  plotAxes,
} from "@edu/pixel-ui";

export function scopeData(snapshot) {
  const wave = snapshot.wave;
  if (!wave) return null;
  const peak = Math.max(
    ...wave.uIn.map(Math.abs),
    ...wave.uOut.map(Math.abs),
    0.1,
  );
  return { wave, peak, periods: 2 };
}

export function drawScope(ctx, box, snapshot) {
  const data = scopeData(snapshot);
  if (!data) return null;
  const { wave, peak } = data;

  rect(ctx, box.x, box.y, box.w, box.h, PALETTE.crystalDeep);

  const zeroY = box.y + box.h / 2;
  const mapX = (i) => box.x + (i / (wave.t.length - 1)) * (box.w - 1);
  const mapY = (u) => zeroY - (u / peak) * (box.h / 2 - 2);

  // Сітка: горизонталі кожні 2 В, вертикалі — по півперіодах.
  for (let u = -Math.floor(peak); u <= peak; u += 2) {
    if (u === 0) continue;
    const y = mapY(u);
    if (y > box.y && y < box.y + box.h) {
      dashedLine(ctx, box.x, y, box.x + box.w - 1, y, PALETTE.grid, 1, 4);
    }
  }
  for (let k = 1; k < 4; k += 1) {
    const x = box.x + (k * (box.w - 1)) / 4;
    dashedLine(ctx, x, box.y, x, box.y + box.h - 1, PALETTE.grid, 1, 4);
  }

  plotAxes(ctx, box, PALETTE.axis, 4, 4);
  dashedLine(ctx, box.x, zeroY, box.x + box.w - 1, zeroY, PALETTE.axis, 3, 2);

  // Зона пульсацій: між максимумом і мінімумом вихідної напруги. Саме її
  // студент і має «затиснути» конденсатором до кількох відсотків.
  if (wave.uMax > wave.uMin + 1e-6) {
    const top = mapY(wave.uMax);
    const bottom = mapY(wave.uMin);
    dither(ctx, box.x + 1, top, box.w - 2, Math.max(1, bottom - top), PALETTE.grid, 3);
  }

  polyline(
    ctx,
    wave.uIn.map((u, i) => ({ x: mapX(i), y: mapY(u) })),
    PALETTE.curveAlt,
  );
  polyline(
    ctx,
    wave.uOut.map((u, i) => ({ x: mapX(i), y: mapY(u) })),
    PALETTE.curve,
  );

  // Рівень середньої напруги — те, що покаже вольтметр постійного струму.
  const meanY = mapY(wave.uMean);
  dashedLine(ctx, box.x, meanY, box.x + box.w - 1, meanY, PALETTE.donorIon, 4, 3);

  return { ...data, zeroY, mapY, mapX };
}
