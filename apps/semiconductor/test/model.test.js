import test from "node:test";
import assert from "node:assert/strict";

import { snapshot, initialState } from "../src/physics/model.js";
import { MODE } from "../src/physics/constants.js";
import { DOPANT } from "../src/physics/doping.js";
import { CONTROLS } from "../src/data/controls.js";
import { CODEX, CODEX_BY_ID, TOPICS } from "../src/data/codex.js";
import { RULES, pickRule, describeState } from "../src/data/rules.js";
import { GOALS, achievedGoals } from "../src/data/goals.js";
import { diffSnapshots, placeholders } from "@edu/explain";

/**
 * Ловить подвоєні службові слова на стиках шаблону й хелпера.
 * Реальний випадок: times() вже повертає «у 700 разів», тому шаблон
 * «у ${times(...)} більше» давав «у у 700 разів більше».
 */
function assertNoDoubledWords(text, where) {
  const doubled = text.match(/\b(у|в|на|з|і|та|що|не)\s+\1\b/i);
  assert.equal(doubled, null, `${where}: подвоєне «${doubled?.[1]}» у тексті`);
}

/* ------------------------------- свіп сітки ------------------------------- */

function* crystalStates() {
  for (const temperature of [100, 200, 300, 450, 700]) {
    for (const dopant of [DOPANT.none, DOPANT.donor, DOPANT.acceptor]) {
      for (const doping of [1e12, 1e14, 1e16, 1e19]) {
        for (const suns of [0, 1e-3, 1, 10]) {
          for (const voltage of [0, 0.05, 1, 5]) {
            yield {
              ...initialState(),
              mode: MODE.crystal,
              temperature,
              dopant,
              doping,
              suns,
              voltage,
            };
          }
        }
      }
    }
  }
}

function* junctionStates() {
  for (const temperature of [100, 200, 300, 450, 700]) {
    for (const junctionNa of [1e14, 1e16, 1e19]) {
      for (const junctionNd of [1e14, 1e16, 1e19]) {
        for (const bias of [-10, -1, 0, 0.3, 0.6, 0.7, 1]) {
          yield {
            ...initialState(),
            mode: MODE.junction,
            temperature,
            junctionNa,
            junctionNd,
            bias,
          };
        }
      }
    }
  }
}

test("жоден стан не дає NaN, нескінченності чи від'ємної концентрації", () => {
  let count = 0;
  for (const state of [...crystalStates(), ...junctionStates()]) {
    const snap = snapshot(state);
    count += 1;
    for (const id of snap.order) {
      const readout = snap.readouts[id];
      assert.ok(readout, `у знімку немає показника "${id}"`);
      assert.ok(
        Number.isFinite(readout.value),
        `${id} = ${readout.value} при ${JSON.stringify(state)}`,
      );
      assert.ok(!readout.display.includes("NaN"), `${id}: "${readout.display}"`);
      assert.ok(!readout.display.includes("—"), `${id}: "${readout.display}"`);
    }
    for (const key of ["n", "p", "ni"]) {
      if (snap.values[key] !== undefined) {
        assert.ok(snap.values[key] > 0, `${key} ≤ 0 при ${JSON.stringify(state)}`);
      }
    }
    if (snap.mode === MODE.junction) {
      assert.ok(snap.values.widthUm > 0);
      assert.ok(snap.values.rs > 0);
    }
  }
  assert.ok(count > 1200, `перевірено лише ${count} станів`);
});

test("монотонності, які гравець мусить бачити", () => {
  const base = { ...initialState(), dopant: DOPANT.donor };

  // Сильніше легування — вища провідність.
  let prev = 0;
  for (const doping of [1e12, 1e14, 1e16, 1e18, 1e19]) {
    const sigma = snapshot({ ...base, doping }).values.sigma;
    assert.ok(sigma > prev, `σ не зросла при N = ${doping}`);
    prev = sigma;
  }

  // Пряме зміщення звужує шар, зворотне розширює.
  const j = { ...initialState(), mode: MODE.junction };
  let width = Infinity;
  for (const bias of [-10, -5, -1, 0, 0.3, 0.6]) {
    const next = snapshot({ ...j, bias }).values.widthUm;
    assert.ok(next < width, `шар не звузився при U = ${bias}`);
    width = next;
  }

  // Струм діода росте з напругою на всій шкалі регулятора.
  let current = -Infinity;
  for (let pos = 0; pos <= CONTROLS.bias.steps; pos += 1) {
    const next = snapshot({ ...j, bias: CONTROLS.bias.valueAt(pos) }).values.current;
    assert.ok(next >= current - 1e-18, `струм упав при позиції ${pos}`);
    current = next;
  }
});

/* --------------------------- регулятори як цілі --------------------------- */

test("кожна позиція кожного регулятора дає скінченне значення", () => {
  for (const [name, control] of Object.entries(CONTROLS)) {
    for (let pos = 0; pos <= control.steps; pos += 1) {
      const value = control.valueAt(pos);
      assert.ok(Number.isFinite(value), `${name}[${pos}] = ${value}`);
      assert.ok(!control.format(value).includes("NaN"), `${name}[${pos}]`);
    }
  }
});

test("positionOf обертає valueAt — повзунок відновлюється зі збереження", () => {
  for (const [name, control] of Object.entries(CONTROLS)) {
    for (let pos = 0; pos <= control.steps; pos += 1) {
      const back = control.positionOf(control.valueAt(pos));
      assert.equal(back, pos, `${name}: позиція ${pos} відновилась як ${back}`);
    }
  }
});

test("темрява — окрема позиція нуль, а не мале число", () => {
  assert.equal(CONTROLS.suns.valueAt(0), 0);
  assert.ok(CONTROLS.suns.valueAt(1) > 0);
});

/* ----------------------- цілісність навчальних даних ---------------------- */

test("кожен показник має пояснення й порожніх плейсхолдерів не лишилось", () => {
  for (const state of [...crystalStates()].slice(0, 200)) {
    const snap = snapshot(state);
    for (const id of snap.order) {
      const readout = snap.readouts[id];
      assert.ok(readout.why && readout.why.length > 20, `${id}: закоротке пояснення`);
      assert.ok(readout.formula, `${id}: немає формули`);
      assert.ok(readout.substituted, `${id}: немає підстановки`);
      assert.equal(placeholders(readout.substituted).length, 0, `${id}: лишились {плейсхолдери}`);
      assert.ok(CODEX_BY_ID[readout.codexRef], `${id}: посилання на статтю "${readout.codexRef}"`);
    }
  }
});

test("кожне правило коментаря посилається на наявні показники й статті", () => {
  const ids = new Set(RULES.map((rule) => rule.id));
  assert.equal(ids.size, RULES.length, "є правила з однаковими id");

  const crystal = snapshot({ ...initialState(), dopant: DOPANT.donor, suns: 1 });
  const junction = snapshot({ ...initialState(), mode: MODE.junction, bias: 0.5 });

  for (const rule of RULES) {
    assert.ok(CODEX_BY_ID[rule.codexRef], `правило "${rule.id}": стаття "${rule.codexRef}"`);
    for (const id of rule.readouts) {
      const known = id in crystal.readouts || id in junction.readouts;
      assert.ok(known, `правило "${rule.id}": невідомий показник "${id}"`);
    }
  }
});

test("кожна зміна регулятора породжує коментар із живими числами", () => {
  const start = initialState();
  const scenarios = [
    ["dopant", { dopant: DOPANT.donor }],
    ["dopant", { dopant: DOPANT.none }],
    ["doping", { dopant: DOPANT.donor, doping: 1e18 }],
    ["temperature", { temperature: 500 }],
    ["temperature", { dopant: DOPANT.donor, temperature: 500 }],
    ["temperature", { dopant: DOPANT.donor, doping: 1e13, temperature: 650 }],
    ["suns", { suns: 1 }],
    ["voltage", { voltage: 3 }],
    ["mode", { mode: MODE.junction }],
    ["bias", { mode: MODE.junction, bias: 0.6 }],
    ["bias", { mode: MODE.junction, bias: -5 }],
    ["bias", { mode: MODE.junction, bias: 0 }],
    ["junctionNa", { mode: MODE.junction, junctionNa: 1e14 }],
    ["temperature", { mode: MODE.junction, temperature: 400 }],
  ];

  for (const [changedKey, patch] of scenarios) {
    const prevState = { ...start, ...patch, [changedKey]: start[changedKey] };
    const prev = snapshot(prevState);
    const next = snapshot({ ...start, ...patch });
    const rule = pickRule({
      prev,
      next,
      changedKey,
      changes: diffSnapshots(prev, next),
    });

    assert.ok(rule, `для зміни "${changedKey}" (${JSON.stringify(patch)}) немає правила`);
    const comment = rule.build({ prev, next, changedKey, changes: diffSnapshots(prev, next) });
    assert.ok(comment.headline.length > 10, `${rule.id}: порожній заголовок`);
    assert.ok(comment.mechanism.length > 60, `${rule.id}: закороткий механізм`);
    for (const text of [comment.headline, comment.mechanism]) {
      assert.ok(!text.includes("NaN"), `${rule.id}: NaN у тексті`);
      assert.ok(!text.includes("undefined"), `${rule.id}: undefined у тексті`);
      assert.ok(!text.includes("Infinity"), `${rule.id}: Infinity у тексті`);
      assertNoDoubledWords(text, rule.id);
    }
    // Тире в тексті шукати марно — воно ж звичайний розділовий знак. Замість
    // цього перевіряємо джерело: показники, з яких правило бере числа.
    for (const id of rule.readouts) {
      const readout = next.readouts[id] ?? prev.readouts[id];
      if (readout) assert.ok(Number.isFinite(readout.value), `${rule.id}: "${id}" не число`);
    }
  }
});

test("опис першого кадру відповідає реальному стану, а не типовому", () => {
  // Стан відновлюється з localStorage, тому перший кадр може показувати
  // що завгодно. Фіксований текст про «чистий кремній» тут був би прямою
  // неправдою — саме тому опис будується зі знімка.
  const cases = [
    [{}, /[Чч]истий кремній/],
    [{ dopant: DOPANT.donor, doping: 1e16 }, /n-типу/],
    [{ dopant: DOPANT.acceptor, doping: 1e16 }, /p-типу/],
    // Слабке легування — світло дає більше носіїв, ніж домішка.
    [{ dopant: DOPANT.donor, doping: 1e12, suns: 1 }, /Освітлений/],
    // Сильне легування — світло увімкнене, але тип провідності не змінює.
    [{ dopant: DOPANT.donor, doping: 1e16, suns: 1 }, /n-типу/],
    [{ mode: MODE.junction, bias: 0 }, /рівнова(г|з)/],
    [{ mode: MODE.junction, bias: 0.5 }, /прямим зміщенням/],
    [{ mode: MODE.junction, bias: -3 }, /зворотним зміщенням/],
  ];

  for (const [patch, pattern] of cases) {
    const description = describeState(snapshot({ ...initialState(), ...patch }));
    assert.match(description.headline, pattern, JSON.stringify(patch));
    assert.ok(description.mechanism.length > 80, `закороткий опис для ${JSON.stringify(patch)}`);
    assert.ok(CODEX_BY_ID[description.codexRef], `стаття "${description.codexRef}"`);
    for (const text of [description.headline, description.mechanism]) {
      assert.ok(!/NaN|undefined|Infinity/.test(text), `сміття в описі ${JSON.stringify(patch)}`);
      assertNoDoubledWords(text, JSON.stringify(patch));
    }
  }
});

test("опис легованого кристала не приписує домішці чужу заслугу", () => {
  // При 520 К і легуванні 10¹³ носіїв дає тепло, а не домішка. Текст
  // «домішка дає стільки-то носіїв» тут був би прямою неправдою.
  const hot = describeState(
    snapshot({ ...initialState(), dopant: DOPANT.donor, doping: 1e13, temperature: 520 }),
  );
  assert.match(hot.headline, /власна/);
  assert.ok(!hot.mechanism.startsWith("Домішка"), hot.mechanism);

  const cold = describeState(
    snapshot({ ...initialState(), dopant: DOPANT.donor, doping: 1e13, temperature: 300 }),
  );
  assert.match(cold.headline, /n-типу/);
  assert.match(cold.mechanism, /^Домішка/);
});

test("опис першого кадру не ламається в жодному стані сітки", () => {
  for (const state of [...crystalStates(), ...junctionStates()]) {
    const description = describeState(snapshot(state));
    assert.ok(description.headline.length > 10);
    assert.ok(!/NaN|undefined|Infinity/.test(description.headline + description.mechanism));
    assertNoDoubledWords(description.mechanism, JSON.stringify(state));
  }
});

test("довідник: посилання резолвляться, теми відомі, тексту достатньо", () => {
  const ids = new Set(CODEX.map((article) => article.id));
  assert.equal(ids.size, CODEX.length, "є статті з однаковими id");

  for (const article of CODEX) {
    assert.ok(TOPICS.includes(article.topic), `стаття "${article.id}": тема "${article.topic}"`);
    assert.ok(article.body.length >= 2, `стаття "${article.id}": закоротка`);
    for (const ref of article.see ?? []) {
      assert.ok(ids.has(ref), `стаття "${article.id}" посилається на неіснуючу "${ref}"`);
      assert.notEqual(ref, article.id, `стаття "${article.id}" посилається сама на себе`);
    }
  }

  // Усі три теми програми мають бути покриті.
  for (const topic of TOPICS) {
    assert.ok(CODEX.some((a) => a.topic === topic), `тема "${topic}" без статей`);
  }
});

test("цілі: перевірка працює, теорія є, посилання живі", () => {
  const ids = new Set(GOALS.map((goal) => goal.id));
  assert.equal(ids.size, GOALS.length, "є цілі з однаковими id");

  for (const goal of GOALS) {
    assert.ok(CODEX_BY_ID[goal.codexRef], `ціль "${goal.id}": стаття "${goal.codexRef}"`);
    assert.ok(goal.theory.length > 80, `ціль "${goal.id}": закоротка теорія`);
    assert.ok(goal.task.length > 10, `ціль "${goal.id}": нема формулювання`);
  }
});

test("початковий стан не виконує жодної цілі", () => {
  assert.deepEqual(achievedGoals(snapshot(initialState())), []);
});

test("кожна ціль досяжна", () => {
  const solutions = {
    dope1000: { dopant: DOPANT.donor, doping: 1e14 },
    pType1000: { dopant: DOPANT.acceptor, doping: 1e14 },
    backToIntrinsic: { dopant: DOPANT.donor, doping: 1e13, temperature: 650 },
    photoresistor: { dopant: DOPANT.none, doping: 0, suns: 1 },
    wideDepletion: { mode: MODE.junction, junctionNa: 1e14, junctionNd: 1e14, bias: -5 },
    forwardMilliamp: { mode: MODE.junction, temperature: 450, bias: 0.45 },
  };

  for (const goal of GOALS) {
    const patch = solutions[goal.id];
    assert.ok(patch, `для цілі "${goal.id}" немає перевіреного розв'язку`);
    const snap = snapshot({ ...initialState(), ...patch });
    assert.ok(achievedGoals(snap).includes(goal.id), `ціль "${goal.id}" не зараховується`);
  }
});

/* -------------------------------- підказки -------------------------------- */

test("модель сама повідомляє про свої межі", () => {
  const degenerate = snapshot({ ...initialState(), dopant: DOPANT.donor, doping: 1e19 });
  assert.ok(degenerate.warnings.some((w) => w.id === "degenerate"));

  const lit = snapshot({ ...initialState(), suns: 1 });
  assert.ok(lit.warnings.some((w) => w.id === "nonEquilibrium"));

  const hot = snapshot({
    ...initialState(),
    dopant: DOPANT.donor,
    doping: 1e13,
    temperature: 650,
  });
  assert.ok(hot.warnings.some((w) => w.id === "crossedOver"));

  const nearVbi = snapshot({ ...initialState(), mode: MODE.junction, bias: 0.72 });
  assert.ok(nearVbi.warnings.some((w) => w.id === "depletionInvalid"));

  // У штатному режимі жодних попереджень бути не повинно.
  assert.deepEqual(snapshot(initialState()).warnings, []);
});

test("тексти підказок не містять сміття", () => {
  for (const state of [...crystalStates(), ...junctionStates()]) {
    for (const warning of snapshot(state).warnings) {
      for (const text of [warning.title, warning.text]) {
        assert.ok(!text.includes("NaN"), `${warning.id}: NaN`);
        assert.ok(!text.includes("undefined"), `${warning.id}: undefined`);
      }
      assert.ok(CODEX_BY_ID[warning.codexRef], `${warning.id}: стаття "${warning.codexRef}"`);
    }
  }
});
