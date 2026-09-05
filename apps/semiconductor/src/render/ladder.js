/**
 * Логарифмічна драбина концентрацій.
 *
 * Найшвидший спосіб побачити закон діючих мас. На осі log₁₀ рівність
 * n·p = nᵢ² перетворюється на log n + log p = 2·log nᵢ — тобто мітка nᵢ
 * завжди стоїть РІВНО ПОСЕРЕДИНІ між мітками n і p. Скільки б гравець
 * не легував, середина не рухається; рухаються лише кінці, і завжди
 * симетрично. Жодне текстове формулювання не пояснює це так швидко.
 */

import { PALETTE, rect, line, dashedLine, disc, px } from "@edu/pixel-ui";

const MIN_EXP = 2;
const MAX_EXP = 20;

export function createLadder(bounds) {
  function xFor(value) {
    if (!(value > 0)) return bounds.x;
    const exp = Math.log10(value);
    const t = (exp - MIN_EXP) / (MAX_EXP - MIN_EXP);
    return Math.round(bounds.x + Math.max(0, Math.min(1, t)) * (bounds.w - 1));
  }

  function draw(ctx, { n, p, ni, doping = 0, equilibrium = true }) {
    // Вісь піднята від низу смуги, щоб під нею вмістилися підписи декад
    // (їх малює DOM-шар, див. ui/labels.js).
    const baseY = bounds.y + bounds.h - 14;

    rect(ctx, bounds.x, bounds.y, bounds.w, bounds.h, PALETTE.crystalDeep);
    line(ctx, bounds.x, baseY, bounds.x + bounds.w - 1, baseY, PALETTE.axis);

    // Декади осі: кожен степінь десятки — засічка, кожен четвертий — довша.
    for (let exp = MIN_EXP; exp <= MAX_EXP; exp += 1) {
      const x = xFor(10 ** exp);
      const long = (exp - MIN_EXP) % 4 === 0;
      line(ctx, x, baseY, x, baseY + (long ? 3 : 1), long ? PALETTE.axis : PALETTE.grid);
    }

    // Симетрія n ↔ p відносно nᵢ — те, заради чого драбина й існує.
    const xn = xFor(n);
    const xp = xFor(p);
    const xi = xFor(ni);
    if (equilibrium) {
      dashedLine(ctx, Math.min(xn, xp), baseY - 9, Math.max(xn, xp), baseY - 9, PALETTE.dim);
      line(ctx, xi, baseY - 12, xi, baseY - 6, PALETTE.dim);
    }

    if (doping > 0) {
      const xd = xFor(doping);
      dashedLine(ctx, xd, baseY - 4, xd, baseY - 14, PALETTE.donorIon, 1, 1);
    }

    // Мітки. nᵢ малюємо першою, щоб n і p лягли поверх, коли вони збігаються.
    disc(ctx, xi, baseY - 4, 2, PALETTE.dim);
    disc(ctx, xp, baseY - 4, 2, PALETTE.hole);
    px(ctx, xp, baseY - 4, PALETTE.holeGlow);
    disc(ctx, xn, baseY - 4, 2, PALETTE.electron);
    px(ctx, xn, baseY - 4, PALETTE.electronGlow);
  }

  return { draw, xFor, minExp: MIN_EXP, maxExp: MAX_EXP };
}
