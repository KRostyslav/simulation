/**
 * Знімок моделі й цілісність навчальних даних.
 *
 * Головний тест тут — свіп: жоден стан, у який студент може привести
 * застосунок регуляторами, не має давати NaN у показнику чи «—» там,
 * де мусить бути число. Побачити NaN у панелі гірше, ніж не побачити нічого:
 * учень вирішить, що зламався він, а не програма.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { assertReadoutMap } from "@edu/explain";

import { snapshot, initialState, compare } from "../src/physics/model.js";
import { MODE, RESISTORS } from "../src/physics/constants.js";
import { DEVICES } from "../src/physics/devices.js";
import { CODEX_BY_ID, CODEX, TOPICS } from "../src/data/codex.js";
import { PROTOCOL } from "../src/data/protocol.js";
import { TASKS } from "../src/data/tasks.js";
import { RULES } from "../src/data/rules.js";
import { collectWarnings } from "../src/data/guards.js";
import { CONTROLS } from "../src/data/controls.js";
import { addPoint, emptyTable, seriesKey } from "../src/physics/measurements.js";
import { operatingPoint } from "../src/physics/circuit.js";
import {
  createInstrument,
  measure,
  VOLTMETER,
  AMMETER,
} from "../src/physics/instrument.js";
import { mulberry32, seedFrom } from "../src/physics/random.js";

/** Серія, знята «студентом» — потрібна майже кожному тесту нижче. */
function fillSeries(table, { deviceId = "si", temperature = 300, resistance = 1000 } = {}) {
  const device = DEVICES.find((d) => d.id === deviceId);
  const volt = createInstrument(VOLTMETER, 777);
  const amp = createInstrument(AMMETER, 999);
  const key = seriesKey({ deviceId, temperature });
  let next = table;
  for (let i = 0; i <= 20; i += 1) {
    const emf = 0.3 + (i * 2.7) / 20;
    const op = operatingPoint({ device, temperature, emf, resistance });
    const rng = mulberry32(seedFrom(i, emf, temperature));
    const u = measure(volt, op.diodeVoltage, rng);
    const a = measure(amp, op.current, rng);
    if (u.overload || a.overload) continue;
    next = addPoint(next, key, {
      voltage: u.display,
      current: a.display,
      counts: a.counts,
      resolutionU: u.resolution,
    });
  }
  return next;
}

test("жоден стан не дає NaN у показниках", () => {
  let states = 0;
  for (const mode of Object.values(MODE)) {
    for (const device of DEVICES) {
      for (const temperature of [250, 300, 350, 400]) {
        for (const resistance of [22, 220, 1000, 10000]) {
          for (const emf of [-20, -5, 0, 0.3, 0.7, 1.5, 5]) {
            const state = {
              ...initialState(),
              mode,
              deviceId: device.id,
              temperature,
              resistance,
              emf,
            };
            const snap = snapshot(state);
            assertReadoutMap(snap.readouts);
            for (const [id, readout] of Object.entries(snap.readouts)) {
              assert.ok(
                !String(readout.display).includes("NaN"),
                `${id}: «${readout.display}» у режимі ${mode}`,
              );
              assert.ok(
                !String(readout.display).includes("undefined"),
                `${id}: «${readout.display}»`,
              );
            }
            states += 1;
          }
        }
      }
    }
  }
  assert.ok(states > 1200, `перевірено лише ${states} станів`);
});

test("порожня таблиця не ламає обробку, а чесно каже «даних немає»", () => {
  const snap = snapshot(initialState());
  assert.equal(snap.analysis.fit, null);
  assert.equal(snap.readouts.ideality.display, "—");
  assert.equal(snap.readouts.threshold.display, "—");
  assert.deepEqual(collectWarnings(snap), []);
});

test("зі знятою серією з'являються всі результати обробки", () => {
  const table = fillSeries(emptyTable());
  const snap = snapshot(initialState(), table);
  assert.ok(snap.analysis.fit, "апроксимація мусить побудуватись");
  assert.notEqual(snap.readouts.ideality.display, "—");
  assert.notEqual(snap.readouts.mvPerDecade.display, "—");
  assert.notEqual(snap.readouts.threshold.display, "—");
  assertReadoutMap(snap.readouts);
});

test("кожне завдання досяжне, і жодне не виконане на старті", () => {
  const empty = snapshot(initialState());
  for (const task of TASKS) {
    assert.equal(
      task.check({ snapshot: empty }),
      false,
      `завдання «${task.title}» зараховане без жодного вимірювання`,
    );
  }

  // Стенд: дві декади й нормальний n.
  let table = fillSeries(emptyTable());
  let snap = snapshot(initialState(), table);
  assert.ok(TASKS.find((t) => t.id === "shockley").check({ snapshot: snap }));
  assert.ok(TASKS.find((t) => t.id === "decade").check({ snapshot: snap }));

  // Матеріали: додаємо германій.
  table = fillSeries(table, { deviceId: "ge" });
  snap = snapshot({ ...initialState(), mode: MODE.materials }, table);
  assert.ok(TASKS.find((t) => t.id === "materials").check({ snapshot: snap }));

  // Температура: та сама серія при 340 К.
  table = fillSeries(table, { temperature: 340 });
  snap = snapshot({ ...initialState(), temperature: 340 }, table);
  assert.ok(TASKS.find((t) => t.id === "temperature").check({ snapshot: snap }));

  // Пробій: точки зворотної вітки стабілітрона.
  const zener = DEVICES.find((d) => d.id === "zener");
  const key = seriesKey({ deviceId: "zener", temperature: 300 });
  let reverse = emptyTable();
  for (const emf of [-2, -3, -4, -5, -5.5, -6, -7, -9, -12]) {
    const op = operatingPoint({ device: zener, temperature: 300, emf, resistance: 1000 });
    reverse = addPoint(reverse, key, {
      voltage: Math.round(op.diodeVoltage * 1000) / 1000,
      current: op.current,
      counts: 1000,
      resolutionU: 1e-3,
    });
  }
  snap = snapshot(
    { ...initialState(), mode: MODE.breakdown, deviceId: "zener" },
    reverse,
  );
  assert.ok(
    TASKS.find((t) => t.id === "breakdown").check({ snapshot: snap }),
    `виміряно ${snap.analysis.breakdown?.vbr}, теорія ${snap.op.breakdown.vbr}`,
  );

  // Згладжування: велика ємність.
  snap = snapshot({
    ...initialState(),
    mode: MODE.rectifier,
    capacitance: 1000e-6,
    amplitude: 10,
    load: 1000,
  });
  assert.ok(TASKS.find((t) => t.id === "smoothing").check({ snapshot: snap }));
});

test("порівняння серій працює лише за наявності обох", () => {
  const table = fillSeries(fillSeries(emptyTable()), { deviceId: "ge" });
  const cmp = compare(
    table,
    { deviceId: "si", temperature: 300 },
    { deviceId: "ge", temperature: 300 },
  );
  assert.ok(cmp && cmp.deltaThreshold > 0.3);
  assert.equal(
    compare(table, { deviceId: "si", temperature: 300 }, { deviceId: "zener", temperature: 300 }),
    null,
  );
});

test("підказки з'являються там, де вони справді потрібні", () => {
  const hot = snapshot({ ...initialState(), emf: 5, resistance: 22 });
  const ids = collectWarnings(hot).map((w) => w.id);
  assert.ok(ids.includes("power"), "велика потужність мусить попередити");
  assert.ok(ids.includes("overload"), "струм понад 20 мА теж");

  const cold = snapshot({ ...initialState(), temperature: 395 });
  assert.ok(collectWarnings(cold).some((w) => w.id === "hot"));
});

test("усі посилання на довідник резолвяться", () => {
  const refs = new Set();
  const snap = snapshot(initialState(), fillSeries(emptyTable()));
  for (const readout of Object.values(snap.readouts)) {
    if (readout.codexRef) refs.add(readout.codexRef);
  }
  for (const task of TASKS) refs.add(task.codexRef);
  for (const rule of RULES) refs.add(rule.codexRef);
  for (const warning of collectWarnings(snapshot({ ...initialState(), emf: 5, resistance: 22 }))) {
    refs.add(warning.codexRef);
  }
  for (const article of CODEX) {
    for (const see of article.see ?? []) refs.add(see);
  }

  for (const ref of refs) {
    assert.ok(CODEX_BY_ID[ref], `посилання на неіснуючу статтю «${ref}»`);
  }
});

test("довідник цілісний: теми, обсяг статей, унікальність", () => {
  const ids = new Set();
  for (const article of CODEX) {
    assert.ok(!ids.has(article.id), `дубльований id «${article.id}»`);
    ids.add(article.id);
    assert.ok(TOPICS.includes(article.topic), `тема «${article.topic}» не оголошена`);
    assert.ok(article.body.length >= 3, `стаття «${article.id}» закоротка`);
    for (const paragraph of article.body) {
      assert.ok(paragraph.length > 80, `надто короткий абзац у «${article.id}»`);
    }
  }
  // Кожна оголошена тема має містити хоча б одну статтю, інакше в довіднику
  // висів би порожній заголовок.
  for (const topic of TOPICS) {
    assert.ok(CODEX.some((a) => a.topic === topic), `тема «${topic}» порожня`);
  }
});

test("кроки протоколу ведуть у наявні режими й мають наповнення", () => {
  const modes = new Set(Object.values(MODE));
  for (const step of PROTOCOL.steps) {
    assert.ok(modes.has(step.mode), `крок «${step.id}» веде в режим «${step.mode}»`);
    assert.ok(step.what.length > 60, `крок «${step.id}» без опису дії`);
    if (step.preset?.deviceId) {
      assert.ok(
        DEVICES.some((d) => d.id === step.preset.deviceId),
        `крок «${step.id}» вимагає невідомий прилад`,
      );
    }
    if (step.preset?.resistance) {
      assert.ok(
        RESISTORS.includes(step.preset.resistance),
        `крок «${step.id}»: резистора ${step.preset.resistance} Ом немає в наборі`,
      );
    }
  }
  assert.ok(PROTOCOL.report.length >= 6);
  assert.ok(PROTOCOL.questions.length >= 6);
});

test("регулятори переводять значення в позицію і назад без втрат", () => {
  for (const control of Object.values(CONTROLS)) {
    for (let position = 0; position <= control.steps; position += 1) {
      const value = control.valueAt(position);
      assert.ok(Number.isFinite(value), `${control.id}: позиція ${position} → ${value}`);
      const back = control.positionOf(value);
      assert.ok(
        Math.abs(back - position) <= 1,
        `${control.id}: ${position} → ${value} → ${back}`,
      );
      assert.ok(!String(control.format(value)).includes("NaN"));
    }
  }
});

test("у текстах немає подвоєних слів", () => {
  const texts = [];
  for (const article of CODEX) texts.push(...article.body, article.title);
  for (const task of TASKS) texts.push(task.task, task.theory, task.title);
  for (const step of PROTOCOL.steps) texts.push(step.what, step.record ?? "", step.note ?? "");
  texts.push(PROTOCOL.goal, PROTOCOL.scheme, ...PROTOCOL.report, ...PROTOCOL.questions);

  for (const text of texts) {
    const doubled = text.match(/\b(\p{L}{2,})\s+\1\b/iu);
    assert.equal(doubled, null, `подвоєне слово «${doubled?.[1]}» у: ${text.slice(0, 70)}…`);
  }
});
