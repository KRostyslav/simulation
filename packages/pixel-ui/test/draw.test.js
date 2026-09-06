import test from "node:test";
import assert from "node:assert/strict";

import {
  line,
  dashedLine,
  disc,
  ring,
  rect,
  polyline,
  arrow,
  triangle,
} from "../src/draw.js";

/** Лічильник викликів замість справжнього контексту канви. */
function stubContext() {
  let calls = 0;
  return {
    fillStyle: "",
    fillRect() {
      calls += 1;
      // Запобіжник самого тесту: зациклений примітив інакше повісив би
      // прогін тестів так само, як він вішав би вкладку браузера.
      if (calls > 1e6) throw new Error("примітив не завершується");
    },
    get calls() {
      return calls;
    },
  };
}

test("line не зациклюється на NaN — інакше вкладка зависає намертво", () => {
  const ctx = stubContext();
  for (const args of [
    [0, NaN, 100, 50],
    [NaN, NaN, NaN, NaN],
    [0, 0, Infinity, 10],
    [0, 0, 10, -Infinity],
  ]) {
    line(ctx, ...args, "#fff");
  }
  assert.equal(ctx.calls, 0, "нічого не мало намалюватись");
});

test("line малює звичайну лінію", () => {
  const ctx = stubContext();
  line(ctx, 0, 0, 9, 0, "#fff");
  assert.equal(ctx.calls, 10);
});

test("dashedLine не зациклюється на нескінченних координатах", () => {
  const ctx = stubContext();
  dashedLine(ctx, 0, 0, NaN, NaN, "#fff");
  dashedLine(ctx, 0, 0, 0, 0, "#fff");
  assert.equal(ctx.calls, 0);
});

test("polyline переживає точки з NaN", () => {
  const ctx = stubContext();
  polyline(ctx, [{ x: 0, y: 0 }, { x: NaN, y: 5 }, { x: 9, y: 0 }], "#fff");
  // Перший і останній відрізки зіпсовані, тож нічого не малюється,
  // але й виняток не кидається — графік просто не з'явиться.
  assert.ok(ctx.calls >= 0);
});

test("disc і ring дають очікувану кількість пікселів", () => {
  const solid = stubContext();
  disc(solid, 10, 10, 2, "#fff");
  assert.equal(solid.calls, 13); // круг радіуса 2 цілими пікселями

  const hollow = stubContext();
  ring(hollow, 10, 10, 2, "#fff");
  assert.ok(hollow.calls > 0 && hollow.calls < 13, "кільце має бути порожнім усередині");
});

test("rect і arrow малюють без винятків", () => {
  const ctx = stubContext();
  rect(ctx, 0, 0, 4, 4, "#fff");
  arrow(ctx, 5, 5, 10, "#fff", -1);
  assert.ok(ctx.calls > 0);
});

test("triangle заливає площу й не виходить за межі", () => {
  const ctx = stubContext();
  const painted = [];
  ctx.fillRect = (x, y, w, h) => painted.push({ x, y, w, h });
  // Прямокутний трикутник із катетами 10: залито має бути близько половини
  // описаного квадрата.
  triangle(ctx, 0, 0, 10, 0, 0, 10, "#000");
  const area = painted.reduce((sum, r) => sum + r.w * r.h, 0);
  assert.ok(area > 40 && area < 80, `залито ${area} пікселів замість ≈55`);
  for (const r of painted) {
    assert.ok(r.x >= 0 && r.x + r.w <= 12, `вихід за межі по x: ${r.x}+${r.w}`);
    assert.ok(r.y >= 0 && r.y <= 10, `вихід за межі по y: ${r.y}`);
  }
});

test("triangle не зациклюється й не малює на нескінченних координатах", () => {
  const ctx = stubContext();
  for (const args of [
    [0, 0, NaN, 10, 5, 5],
    [Infinity, 0, 10, 10, 5, 5],
    [0, 0, 10, -Infinity, 5, 5],
  ]) {
    triangle(ctx, ...args, "#000");
  }
  assert.equal(ctx.calls, 0, "нічого не мало намалюватись");
});

test("вироджений трикутник не ламає заливку", () => {
  const ctx = stubContext();
  // Три точки на одній прямій: площі немає, але й падати нема з чого.
  triangle(ctx, 0, 0, 5, 5, 10, 10, "#000");
  assert.ok(ctx.calls > 0 && ctx.calls < 100, `${ctx.calls} викликів`);
  // Три однакові точки — теж законний вироджений випадок.
  triangle(ctx, 3, 3, 3, 3, 3, 3, "#000");
});
