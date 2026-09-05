import test from "node:test";
import assert from "node:assert/strict";

import { line, dashedLine, disc, ring, rect, polyline, arrow } from "../src/draw.js";

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
