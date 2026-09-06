/**
 * Примітиви малювання. Усі координати — цілі числа в логічних пікселях.
 *
 * Текст на канві навмисно не малюється: підписи, цифри й пояснення живуть
 * у DOM поверх канви. Це дає коректну кирилицю, доступність і виділення тексту,
 * яких растровий шрифт на 5×7 пікселів не дав би.
 */

export function clear(ctx, color, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

export function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

/**
 * Лінія за Брезенхемом — рівна «пікселька» без згладжування.
 *
 * Перевірка на скінченність координат обов'язкова: цикл завершується за
 * умовою x === ex && y === ey, а з NaN вона не виконається НІКОЛИ. Одне
 * зіпсоване число (наприклад, поділ на нульовий діапазон у графіку) вішало б
 * вкладку намертво, без жодного повідомлення про помилку.
 */
export function line(ctx, x0, y0, x1, y1, color) {
  if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) {
    return;
  }
  ctx.fillStyle = color;
  let x = Math.round(x0);
  let y = Math.round(y0);
  const ex = Math.round(x1);
  const ey = Math.round(y1);
  const dx = Math.abs(ex - x);
  const dy = -Math.abs(ey - y);
  const sx = x < ex ? 1 : -1;
  const sy = y < ey ? 1 : -1;
  let err = dx + dy;

  for (;;) {
    ctx.fillRect(x, y, 1, 1);
    if (x === ex && y === ey) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Пунктир — межі областей, допоміжні рівні на графіках. */
export function dashedLine(ctx, x0, y0, x1, y1, color, on = 2, off = 2) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  if (!Number.isFinite(steps) || steps === 0) return;
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i += 1) {
    if (i % (on + off) >= on) continue;
    const t = i / steps;
    ctx.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 1, 1);
  }
}

/** Заповнений «круг» цілими пікселями — ядра атомів, носії заряду. */
export function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  const rr = r * r;
  for (let y = -r; y <= r; y += 1) {
    for (let x = -r; x <= r; x += 1) {
      if (x * x + y * y <= rr) ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
  }
}

/** Кільце в один піксель — електронна оболонка, підсвітка події. */
export function ring(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  const rr = r * r;
  const inner = (r - 1) * (r - 1);
  for (let y = -r; y <= r; y += 1) {
    for (let x = -r; x <= r; x += 1) {
      const d = x * x + y * y;
      if (d <= rr && d > inner) ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
  }
}

/**
 * Залитий трикутник — символ діода на схемі.
 *
 * Заливаємо порядковими рядками: для кожного цілого y знаходимо ліву й праву
 * межу перетину трикутника з цим рядком і малюємо між ними горизонталь.
 * Прийом старий, як растрова графіка, і тут він доречніший за canvas-шляхи:
 * `ctx.fill()` дав би згладжені краї, а на канві з масштабом ×3 напівпрозорий
 * піксель перетворюється на видиму сіру кайму й ламає піксельний вигляд.
 *
 * Нескінченні координати відкидаємо мовчки, як і решта примітивів: NaN тут
 * дав би нескінченний цикл, тобто мертве зависання вкладки.
 */
export function triangle(ctx, x0, y0, x1, y1, x2, y2, color) {
  const xs = [x0, x1, x2];
  const ys = [y0, y1, y2];
  if (![...xs, ...ys].every(Number.isFinite)) return;

  ctx.fillStyle = color;
  const top = Math.round(Math.min(...ys));
  const bottom = Math.round(Math.max(...ys));
  const edges = [
    [x0, y0, x1, y1],
    [x1, y1, x2, y2],
    [x2, y2, x0, y0],
  ];

  for (let y = top; y <= bottom; y += 1) {
    let left = Infinity;
    let right = -Infinity;
    for (const [ax, ay, bx, by] of edges) {
      const lo = Math.min(ay, by);
      const hi = Math.max(ay, by);
      if (y < Math.round(lo) || y > Math.round(hi)) continue;
      // Горизонтальне ребро дає одразу обидва свої кінці.
      const x = ay === by ? [ax, bx] : [ax + ((y - ay) * (bx - ax)) / (by - ay)];
      for (const value of x) {
        if (value < left) left = value;
        if (value > right) right = value;
      }
    }
    if (left > right) continue;
    const from = Math.round(left);
    const width = Math.round(right) - from + 1;
    ctx.fillRect(from, y, Math.max(1, width), 1);
  }
}

/**
 * Дизеринг шаховим візерунком — класичний піксельний прийом для градієнтів
 * і напівпрозорості без альфа-каналу (збіднений шар, зона поля, тінь).
 */
export function dither(ctx, x, y, w, h, color, density = 2) {
  ctx.fillStyle = color;
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      if ((i + j) % density === 0) ctx.fillRect(Math.round(x + i), Math.round(y + j), 1, 1);
    }
  }
}

/** Рамка в один піксель. */
export function frame(ctx, x, y, w, h, color) {
  rect(ctx, x, y, w, 1, color);
  rect(ctx, x, y + h - 1, w, 1, color);
  rect(ctx, x, y, 1, h, color);
  rect(ctx, x + w - 1, y, 1, h, color);
}

/** Горизонтальна стрілка — напрямок поля, дрейфу, дифузії. */
export function arrow(ctx, x, y, len, color, dir = 1) {
  const end = x + len * dir;
  line(ctx, x, y, end, y, color);
  for (let i = 1; i <= 2; i += 1) {
    px(ctx, end - i * dir, y - i, color);
    px(ctx, end - i * dir, y + i, color);
  }
}

/** Осі графіка: рамка + засічки. Підписи домальовує DOM-шар. */
export function plotAxes(ctx, box, color, ticksX = 4, ticksY = 4) {
  const { x, y, w, h } = box;
  line(ctx, x, y + h, x + w, y + h, color);
  line(ctx, x, y, x, y + h, color);
  for (let i = 1; i <= ticksX; i += 1) {
    const tx = Math.round(x + (w * i) / ticksX);
    line(ctx, tx, y + h, tx, y + h + 2, color);
  }
  for (let i = 1; i <= ticksY; i += 1) {
    const ty = Math.round(y + h - (h * i) / ticksY);
    line(ctx, x - 2, ty, x, ty, color);
  }
}

/** Ламана по масиву точок {x, y} у пікселях канви. */
export function polyline(ctx, points, color) {
  for (let i = 1; i < points.length; i += 1) {
    line(ctx, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y, color);
  }
}
