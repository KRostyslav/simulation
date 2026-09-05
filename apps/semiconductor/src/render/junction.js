/**
 * Сцена p-n переходу.
 *
 * Головне, що має бути видно очима, — три речі:
 *  • у збідненому шарі немає рухомих носіїв, лише нерухомі іони;
 *  • шар несиметричний: слабше легований бік ширший, бо заряд по обидва
 *    боки однаковий (N_a·x_p = N_d·x_n);
 *  • пряме зміщення шар звужує, зворотне розширює — і не пропорційно
 *    напрузі, а як її корінь.
 */

import { PALETTE, rect, line, dashedLine, disc, ring, arrow, px, frame } from "@edu/pixel-ui";

/** Скільки пікселів на мікрометр — так, щоб типові 0,43 мкм були помітні. */
const PX_PER_UM = 93;

export function createJunctionScene(bounds) {
  const midX = Math.round(bounds.x + bounds.w / 2);

  function ionRow(ctx, x0, x1, y, color, positive) {
    const stepX = 11;
    for (let x = x0 + 4; x < x1 - 2; x += stepX) {
      ring(ctx, x, y, 3, color);
      rect(ctx, x - 1, y, 3, 1, color);
      if (positive) rect(ctx, x, y - 1, 1, 3, color);
    }
  }

  function carrierField(ctx, x0, x1, y0, y1, kind, density, offset) {
    if (x1 - x0 < 6) return;
    const count = Math.max(0, Math.min(26, density));
    for (let i = 0; i < count; i += 1) {
      // Детермінована псевдовипадкова сітка: та сама картина при тому самому
      // стані, тому зміни читаються як зміни, а не як мерехтіння.
      const t = (i * 0.6180339887 + offset) % 1;
      const x = Math.round(x0 + 3 + t * (x1 - x0 - 6));
      const y = Math.round(y0 + 3 + ((i * 7919) % Math.max(1, y1 - y0 - 6)));
      if (kind === "e") {
        disc(ctx, x, y, 2, PALETTE.electron);
        px(ctx, x - 1, y - 1, PALETTE.electronGlow);
      } else {
        ring(ctx, x, y, 2, PALETTE.hole);
      }
    }
  }

  /**
   * @param snapshot знімок моделі в режимі переходу
   * @param phase    фаза анімації 0…1 — рухає носії, що перетинають межу
   */
  function draw(ctx, snapshot, phase = 0) {
    const { widthUm, xpUm, xnUm, bias, current, valid } = snapshot.values;
    const { x, y, w, h } = bounds;

    const halfWidth = Math.max(1, Math.round((widthUm * PX_PER_UM) / 2));
    const share = xpUm / Math.max(1e-9, xpUm + xnUm);
    const leftEdge = Math.max(x + 2, midX - Math.round(halfWidth * 2 * share));
    const rightEdge = Math.min(x + w - 2, midX + Math.round(halfWidth * 2 * (1 - share)));

    // Дві області: p ліворуч, n праворуч.
    rect(ctx, x, y, w / 2, h, PALETTE.regionP);
    rect(ctx, x + w / 2, y, w / 2, h, PALETTE.regionN);

    // Збіднений шар.
    rect(ctx, leftEdge, y, rightEdge - leftEdge, h, PALETTE.depletion);
    line(ctx, leftEdge, y, leftEdge, y + h - 1, PALETTE.depletionEdge);
    line(ctx, rightEdge, y, rightEdge, y + h - 1, PALETTE.depletionEdge);
    if (!valid) {
      // Модель за межею застосовності — межі шару показуємо пунктиром.
      dashedLine(ctx, leftEdge, y, leftEdge, y + h - 1, PALETTE.curveAlt, 2, 3);
      dashedLine(ctx, rightEdge, y, rightEdge, y + h - 1, PALETTE.curveAlt, 2, 3);
    }

    // Нерухомі іони всередині шару: від'ємні акцептори ліворуч, додатні донори праворуч.
    ionRow(ctx, leftEdge, midX, y + Math.round(h * 0.3), PALETTE.acceptorIon, false);
    ionRow(ctx, leftEdge, midX, y + Math.round(h * 0.7), PALETTE.acceptorIon, false);
    ionRow(ctx, midX, rightEdge, y + Math.round(h * 0.3), PALETTE.donorIon, true);
    ionRow(ctx, midX, rightEdge, y + Math.round(h * 0.7), PALETTE.donorIon, true);

    // Рухомі носії — тільки поза шаром.
    carrierField(ctx, x, leftEdge, y, y + h, "h", 22, 0.11);
    carrierField(ctx, rightEdge, x + w, y, y + h, "e", 22, 0.37);

    // Внутрішнє поле: завжди від n до p, тобто справа наліво.
    const fieldY = y + Math.round(h / 2);
    if (rightEdge - leftEdge > 12) {
      arrow(ctx, rightEdge - 3, fieldY, rightEdge - leftEdge - 6, PALETTE.fieldArrow, -1);
    }

    // Потік носіїв через межу при прямому зміщенні: видимий струм.
    if (bias > 0 && current > 1e-9) {
      const travellers = Math.max(1, Math.min(8, Math.round(Math.log10(current / 1e-9) * 2)));
      for (let i = 0; i < travellers; i += 1) {
        const t = (phase + i / travellers) % 1;
        const px1 = Math.round(x + w - 4 - t * (w - 8));
        const py1 = y + 6 + ((i * 13) % (h - 12));
        disc(ctx, px1, py1, 2, PALETTE.electron);
        const px2 = Math.round(x + 4 + t * (w - 8));
        disc(ctx, px2, py1, 2, PALETTE.hole);
        if (t > 0.72) ring(ctx, px1, py1, 4, PALETTE.flashRec);
      }
    }

    // Зворотне зміщення: поодинокі неосновні носії, підхоплені полем.
    if (bias < 0) {
      const t = phase % 1;
      const py = y + Math.round(h * 0.5);
      disc(ctx, Math.round(rightEdge - t * (rightEdge - leftEdge)), py, 2, PALETTE.hole);
    }

    frame(ctx, x, y, w, h, PALETTE.axis);
  }

  /**
   * Профіль потенціального бар'єру під сценою.
   *
   * Показує те, чого не видно на самій сцені: бар'єр існує лише в межах
   * збідненого шару, а поза ним потенціал сталий. Пряме зміщення опускає
   * сходинку, зворотне піднімає — і одразу зрозуміло, чому струм так різко
   * несиметричний.
   */
  function drawPotential(ctx, box, snapshot) {
    const { veff, vbi } = snapshot.values;
    const { x, y, w, h } = box;

    rect(ctx, x, y, w, h, PALETTE.crystalDeep);

    const top = y + 3;
    const bottom = y + h - 4;
    // Масштаб фіксований за V_bi без зміщення, щоб сходинка «дихала»,
    // а не перенормовувалась щоразу під себе.
    const scale = (bottom - top) / Math.max(vbi * 1.6, 0.1);
    const stepHeight = Math.max(1, Math.min(bottom - top, Math.round(veff * scale)));

    const left = Math.max(x + 2, midX - Math.round(w * 0.18));
    const right = Math.min(x + w - 2, midX + Math.round(w * 0.18));

    // Ліворуч (p) потенціальна енергія електрона висока, праворуч (n) — низька.
    line(ctx, x + 2, top + (bottom - top - stepHeight), left, top + (bottom - top - stepHeight), PALETTE.curve);
    line(ctx, left, top + (bottom - top - stepHeight), right, bottom, PALETTE.curve);
    line(ctx, right, bottom, x + w - 3, bottom, PALETTE.curve);
    dashedLine(ctx, left, y, left, y + h - 1, PALETTE.grid, 1, 2);
    dashedLine(ctx, right, y, right, y + h - 1, PALETTE.grid, 1, 2);
  }

  return { draw, drawPotential, midX, pxPerUm: PX_PER_UM };
}
