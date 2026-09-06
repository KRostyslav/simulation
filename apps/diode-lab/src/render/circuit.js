/**
 * Схема стенда: джерело — резистор — амперметр — діод — вольтметр.
 *
 * Малюємо саме схему, а не «красиву картинку приладу»: студент має впізнати
 * те, що збиратиме на реальному столі, і мати змогу перемалювати її в зошит.
 * Тому позначення — за стандартом: джерело двома рисками, резистор
 * прямокутником, прилади кружками з літерами.
 *
 * Тексту на канві немає взагалі — усі літери й числа домальовує DOM-шар
 * поверх неї. Пікселі 320×192 просто не мають роздільності для читабельного
 * шрифту, а розтягнутий системний шрифт зруйнував би піксельний вигляд.
 */

import { PALETTE, rect, line, disc, ring, frame, triangle, dither } from "@edu/pixel-ui";

/** Точки схеми в координатах канви. Один раз названі — далі лише посилання. */
export const NODES = {
  left: 24,
  right: 292,
  top: 40,
  bottom: 150,
  source: { x: 24, y: 95 },
  resistor: { x: 96, y: 40, w: 56, h: 18 },
  ammeter: { x: 200, y: 40 },
  diode: { x: 292, y: 95 },
  voltmeter: { x: 214, y: 150 },
};

/**
 * Фаза руху носіїв. Живе між кадрами, як і частинки в сусідній лабораторії, —
 * це єдиний стан, який має право не перемальовуватись зі знімка.
 */
export function createCircuitScene() {
  let phase = 0;

  function draw(ctx, snapshot, dt, { reduced = false } = {}) {
    const { op } = snapshot;
    const n = NODES;

    /* --- дроти контуру --- */
    line(ctx, n.left, n.top, n.resistor.x, n.top, PALETTE.siCore);
    line(ctx, n.resistor.x + n.resistor.w, n.top, n.ammeter.x - 9, n.top, PALETTE.siCore);
    line(ctx, n.ammeter.x + 9, n.top, n.right, n.top, PALETTE.siCore);
    line(ctx, n.right, n.top, n.right, n.diode.y - 14, PALETTE.siCore);
    line(ctx, n.right, n.diode.y + 14, n.right, n.bottom, PALETTE.siCore);
    line(ctx, n.left, n.bottom, n.right, n.bottom, PALETTE.siCore);
    line(ctx, n.left, n.top, n.left, n.source.y - 10, PALETTE.siCore);
    line(ctx, n.left, n.source.y + 10, n.left, n.bottom, PALETTE.siCore);

    /* --- джерело: довга риска «плюс», коротка «мінус» --- */
    const s = n.source;
    const reversed = snapshot.emf < 0;
    const longFirst = !reversed;
    rect(ctx, s.x - 10, s.y - 10, 20, 2, longFirst ? PALETTE.siCore : PALETTE.siCore);
    rect(ctx, s.x - 5, s.y - 4, 10, 2, PALETTE.siCore);
    rect(ctx, s.x - 10, s.y + 2, 20, 2, PALETTE.siCore);
    rect(ctx, s.x - 5, s.y + 8, 10, 2, PALETTE.siCore);

    /* --- обмежувальний резистор --- */
    const r = n.resistor;
    rect(ctx, r.x, r.y - r.h / 2, r.w, r.h, PALETTE.crystal);
    frame(ctx, r.x, r.y - r.h / 2, r.w, r.h, PALETTE.siCore);

    /* --- амперметр і вольтметр --- */
    ring(ctx, n.ammeter.x, n.ammeter.y, 9, PALETTE.axis);
    ring(ctx, n.voltmeter.x, n.voltmeter.y, 9, PALETTE.axis);
    // Вольтметр висить паралельно діоду — саме так його й вмикають.
    line(ctx, n.voltmeter.x, n.voltmeter.y - 9, n.voltmeter.x, n.voltmeter.y - 20, PALETTE.axis);
    line(ctx, n.voltmeter.x, n.voltmeter.y - 20, n.right, n.voltmeter.y - 20, PALETTE.axis);
    line(ctx, n.voltmeter.x, n.voltmeter.y + 9, n.voltmeter.x, n.bottom, PALETTE.axis);

    /* --- діод: трикутник вістрям у бік провідності + риска катода --- */
    const d = n.diode;
    const open = op.current > 1e-9;
    triangle(ctx, d.x - 9, d.y - 9, d.x + 9, d.y - 9, d.x, d.y + 7, open ? PALETTE.hole : PALETTE.siCore);
    rect(ctx, d.x - 10, d.y + 8, 20, 2, PALETTE.siCore);
    // Пробій позначаємо, а не ховаємо: це окремий стан, у якому діод
    // проводить «навпаки», і студент має бачити, що це не поломка схеми.
    if (op.regime === "пробій") {
      dither(ctx, d.x - 12, d.y - 12, 24, 24, PALETTE.flashGen, 2);
    }

    /* --- носії, що біжать по контуру --- */
    if (!reduced) {
      // Швидкість — за логарифмом струму: між 1 пА і 10 мА десять порядків,
      // і в лінійному масштабі рух або стояв би, або зливався в смугу.
      const magnitude = Math.abs(op.current);
      const speed =
        magnitude > 1e-9 ? Math.min(60, 6 * (10 + Math.log10(magnitude))) : 0;
      phase = (phase + speed * dt * Math.sign(op.current || 1)) % 1000;
    }
    drawCarriers(ctx, phase, op);
  }

  return { draw, get phase() { return phase; } };
}

/** Носії на контурі: рівномірно розставлені точки, зсунуті на фазу. */
function drawCarriers(ctx, phase, op) {
  if (Math.abs(op.current) <= 1e-9) return;
  const n = NODES;
  const color = op.regime === "пробій" ? PALETTE.hole : PALETTE.electron;

  const path = [
    { x: n.left, y: n.top, to: { x: n.right, y: n.top } },
    { x: n.right, y: n.top, to: { x: n.right, y: n.bottom } },
    { x: n.right, y: n.bottom, to: { x: n.left, y: n.bottom } },
    { x: n.left, y: n.bottom, to: { x: n.left, y: n.top } },
  ];

  const spacing = 22;
  for (const seg of path) {
    const dx = seg.to.x - seg.x;
    const dy = seg.to.y - seg.y;
    const length = Math.abs(dx) + Math.abs(dy);
    const count = Math.floor(length / spacing);
    for (let i = 0; i < count; i += 1) {
      const t = ((i * spacing + (phase % spacing)) % length) / length;
      disc(ctx, seg.x + dx * t, seg.y + dy * t, 1, color);
    }
  }
}
