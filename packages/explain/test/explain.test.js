import test from "node:test";
import assert from "node:assert/strict";

import { makeReadout, makeChange } from "../src/readout.js";
import { substitute, placeholders } from "../src/substitute.js";
import { sci, smart, decimal, superscript, withPrefix, decades } from "../src/format.js";
import { diffSnapshots } from "../src/diff.js";

test("Readout не створюється без пояснення", () => {
  assert.throws(
    () => makeReadout({ id: "sigma", label: "Провідність", value: 1 }),
    /без пояснення/,
  );
});

test("Readout не створюється без id або назви", () => {
  assert.throws(() => makeReadout({ label: "Х", value: 1, why: "бо" }), /без id/);
  assert.throws(() => makeReadout({ id: "x", value: 1, why: "бо" }), /без назви/);
});

test("terms без шаблону підстановки — помилка", () => {
  assert.throws(
    () =>
      makeReadout({
        id: "x",
        label: "Х",
        value: 1,
        why: "бо",
        formula: "x = a",
        terms: { a: "1" },
      }),
    /немає шаблону substitution/,
  );
});

test("підстановка без символьної формули — помилка", () => {
  assert.throws(
    () =>
      makeReadout({
        id: "x",
        label: "Х",
        value: 1,
        why: "бо",
        substitution: "x = {a}",
        terms: { a: "1" },
      }),
    /немає символьної формули/,
  );
});

test("плейсхолдер без значення — помилка, а не сміття в тексті", () => {
  assert.throws(
    () =>
      makeReadout({
        id: "x",
        label: "Х",
        value: 1,
        why: "бо",
        formula: "x = a·b",
        substitution: "x = {a}·{b}",
        terms: { a: "2" },
      }),
    /немає значень для: b/,
  );
});

test("коректний Readout підставляє числа у формулу", () => {
  const readout = makeReadout({
    id: "sigma",
    label: "Питома провідність",
    symbol: "σ",
    value: 2.0,
    unit: "См/см",
    why: "Провідність — це кількість носіїв, помножена на їхню рухливість",
    formula: "σ = q·(n·μₙ + p·μₚ)",
    substitution: "σ = 1,60·10⁻¹⁹ · ({n} · {muN} + {p} · {muP}) = {sigma} См/см",
    terms: { n: "1,00·10¹⁶", muN: "1248", p: "6,40·10³", muP: "437", sigma: "2,00" },
    codexRef: "conductivity",
  });

  assert.equal(readout.substituted.includes("{"), false);
  assert.match(readout.substituted, /1248/);
  assert.equal(readout.formula, "σ = q·(n·μₙ + p·μₚ)");
  assert.equal(readout.display, "2,00");
});

test("Readout заморожений — знімок не можна змінити заднім числом", () => {
  const readout = makeReadout({ id: "x", label: "Х", value: 1, why: "бо" });
  assert.throws(() => {
    readout.value = 5;
  }, TypeError);
});

test("Change не створюється без причини", () => {
  assert.throws(() => makeChange({ id: "sigma", from: 1, to: 2 }), /без пояснення/);
  const change = makeChange({ id: "sigma", from: 1, to: 2, reason: "нагрівання" });
  assert.equal(change.target, "sigma");
});

test("невідомий tone відхиляється", () => {
  assert.throws(
    () => makeReadout({ id: "x", label: "Х", value: 1, why: "бо", tone: "рожевий" }),
    /невідомий tone/,
  );
});

test("substitute і placeholders", () => {
  assert.deepEqual(placeholders("{a} + {b} + {a}").sort(), ["a", "b"]);
  assert.equal(substitute("{a} + {b}", { a: 1, b: 2 }), "1 + 2");
});

test("наукова нотація з українською комою й надрядковим степенем", () => {
  assert.equal(sci(1e16), "1,00·10¹⁶");
  assert.equal(sci(1.602176634e-19), "1,60·10⁻¹⁹");
  assert.equal(sci(0), "0");
  assert.equal(superscript(-19), "⁻¹⁹");
  assert.equal(decimal(0.5, 2), "0,50");
});

test("округлення мантиси не викидає її за межу декади", () => {
  // 9,999e15 → мантиса 10,00 була б неправильною записом.
  assert.equal(sci(9.999e15), "1,00·10¹⁶");
});

test("smart обирає читабельну нотацію", () => {
  assert.equal(smart(1248), "1248");
  assert.equal(smart(1e16), "1,00·10¹⁶");
  assert.equal(smart(0), "0");
});

test("приставки одиниць для струму", () => {
  assert.equal(withPrefix(5e-15, "А"), "5,00 фА");
  assert.equal(withPrefix(1.5e-3, "А"), "1,50 мА");
  assert.equal(withPrefix(0, "А"), "0 А");
});

test("decades вимірює зміну в порядках", () => {
  assert.equal(Math.round(decades(1e10, 1e16)), 6);
  assert.equal(decades(0, 10), 0);
});

test("diffSnapshots ранжує за порядками, а не за різницею", () => {
  const snap = (n, p) => ({
    readouts: {
      n: makeReadout({ id: "n", label: "n", value: n, why: "бо" }),
      p: makeReadout({ id: "p", label: "p", value: p, why: "бо" }),
    },
  });
  // n змінилась удвічі (0,3 декади), p — у 1000 разів (3 декади),
  // хоча абсолютна різниця у n на порядки більша.
  const changes = diffSnapshots(snap(1e16, 1e4), snap(2e16, 1e7));
  assert.equal(changes[0].id, "p");
  assert.equal(Math.round(changes[0].decades), 3);
});
