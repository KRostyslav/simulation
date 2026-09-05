import test from "node:test";
import assert from "node:assert/strict";

import { createLattice, brokenBondCount } from "../src/render/lattice.js";
import { createLadder } from "../src/render/ladder.js";
import { createJunctionScene } from "../src/render/junction.js";
import { createParticles, particleTargets, visibleCount, motionFromSnapshot } from "../src/render/particles.js";
import { snapshot, initialState } from "../src/physics/model.js";
import { MODE } from "../src/physics/constants.js";
import { DOPANT } from "../src/physics/doping.js";

/**
 * Строгий контекст канви: падає на першій же нескінченній координаті.
 *
 * Саме так ловиться цілий клас помилок «рендер прочитав поле, якого в знімку
 * немає»: undefined тихо перетворюється на NaN, браузер малює порожнечу
 * без жодного попередження, а тут це видно одразу й із назвою тесту.
 */
function strictContext(label) {
  let calls = 0;
  return {
    fillStyle: "",
    fillRect(x, y, w, h) {
      calls += 1;
      if (calls > 5e5) throw new Error(`${label}: рендер не завершується`);
      for (const [name, value] of [
        ["x", x],
        ["y", y],
        ["w", w],
        ["h", h],
      ]) {
        assert.ok(Number.isFinite(value), `${label}: ${name} = ${value}`);
      }
    },
    get calls() {
      return calls;
    },
  };
}

const AREA = { x: 6, y: 6, w: 308, h: 140 };

test("ґратка малюється при будь-якій домішці й концентрації", () => {
  const lattice = createLattice(AREA);
  for (const dopant of [DOPANT.none, DOPANT.donor, DOPANT.acceptor]) {
    for (const doping of [0, 1e12, 1e16, 1e19]) {
      for (const ni of [1e-11, 1e10, 1e17]) {
        const ctx = strictContext(`ґратка ${dopant}/${doping}`);
        lattice.draw(ctx, { dopant, doping, broken: brokenBondCount(ni) });
        assert.ok(ctx.calls > 0);
      }
    }
  }
});

test("драбина концентрацій витримує весь діапазон, включно з нулем", () => {
  const ladder = createLadder({ x: 6, y: 154, w: 308, h: 36 });
  for (const [n, p, ni, doping] of [
    [1e10, 1e10, 1e10, 0],
    [1e19, 6.4, 1e10, 1e19],
    [1e-11, 1e-11, 1e-11, 0],
    [0, 0, 0, 0],
  ]) {
    const ctx = strictContext(`драбина ${n}/${p}`);
    ladder.draw(ctx, { n, p, ni, doping, equilibrium: true });
    assert.ok(ctx.calls > 0);
  }
});

test("сцена переходу малюється в усіх станах регулятора", () => {
  const scene = createJunctionScene(AREA);
  for (const temperature of [100, 300, 700]) {
    for (const doping of [1e14, 1e16, 1e19]) {
      for (const bias of [-10, -1, 0, 0.4, 0.71, 1]) {
        const snap = snapshot({
          ...initialState(),
          mode: MODE.junction,
          temperature,
          junctionNa: doping,
          junctionNd: doping,
          bias,
        });
        const ctx = strictContext(`перехід T=${temperature} U=${bias}`);
        scene.draw(ctx, snap, 0.5);
        scene.drawPotential(ctx, { x: 6, y: 154, w: 308, h: 36 }, snap);
        assert.ok(ctx.calls > 0);
      }
    }
  }
});

test("несиметричне легування не ламає геометрію шару", () => {
  const scene = createJunctionScene(AREA);
  for (const [na, nd] of [
    [1e14, 1e19],
    [1e19, 1e14],
  ]) {
    const snap = snapshot({ ...initialState(), mode: MODE.junction, junctionNa: na, junctionNd: nd });
    const ctx = strictContext(`несиметрія ${na}/${nd}`);
    scene.draw(ctx, snap, 0.2);
    assert.ok(ctx.calls > 0);
  }
});

test("частинки: кількість логарифмічна й обмежена", () => {
  assert.equal(visibleCount(1e7), 0, "нижче порогу носіїв не показуємо");
  assert.ok(visibleCount(1e10) > 0);
  // Кожні 10 разів більше концентрації дають фіксовану добавку точок.
  const step = visibleCount(1e12) - visibleCount(1e11);
  assert.ok(step >= 4 && step <= 5, `крок ${step} точок на декаду`);
  assert.ok(visibleCount(1e30) <= 60, "кількість має бути обмежена зверху");

  let prev = -1;
  for (let exp = 8; exp <= 22; exp += 1) {
    const count = visibleCount(10 ** exp);
    assert.ok(count >= prev, `немонотонність на 10^${exp}`);
    prev = count;
  }
});

test("частинкова система тримає парність носіїв і не переповнюється", () => {
  const particles = createParticles({ bounds: { x: 8, y: 8, w: 300, h: 130 } });
  const states = [
    { dopant: DOPANT.none, doping: 0, suns: 0 },
    { dopant: DOPANT.donor, doping: 1e19, suns: 0 },
    { dopant: DOPANT.acceptor, doping: 1e19, suns: 0 },
    { dopant: DOPANT.none, doping: 0, suns: 10 },
    { dopant: DOPANT.donor, doping: 1e12, suns: 0 },
  ];

  for (const patch of states) {
    const snap = snapshot({ ...initialState(), ...patch });
    const targets = particleTargets(snap);
    const motion = motionFromSnapshot(snap, { reduced: false });
    for (let i = 0; i < 120; i += 1) particles.update(0.016, targets, motion);

    const { electrons, holes, pairs, extra } = particles.counts;
    assert.ok(electrons + holes <= 200, "перевищено ліміт частинок");
    // Парні носії завжди йдуть парами: скільки електронів, стільки й дірок.
    const paired = Math.min(electrons, holes);
    assert.equal(pairs, paired, `парність порушено при ${JSON.stringify(patch)}`);
    // Непарні носії — рівно різниця, і саме їх компенсують нерухомі іони.
    assert.equal(Math.abs(electrons - holes), extra, "непарні носії не збігаються");

    const ctx = strictContext(`частинки ${JSON.stringify(patch)}`);
    particles.draw(ctx);
  }
});

test("режим зі зменшеним рухом зупиняє анімацію, але не рендер", () => {
  const snap = snapshot({ ...initialState(), voltage: 5 });
  const motion = motionFromSnapshot(snap, { reduced: true });
  assert.deepEqual(motion, { thermal: 0, driftE: 0, driftH: 0 });

  const moving = motionFromSnapshot(snap, { reduced: false });
  assert.ok(moving.thermal > 0);
  // Електрони йдуть до «плюса», дірки — у протилежний бік.
  assert.ok(moving.driftE > 0 && moving.driftH < 0);
  // Дірки повільніші за електрони — те саме μₙ/μₚ ≈ 3, що й у панелі.
  assert.ok(Math.abs(moving.driftE / moving.driftH) > 2.5);
});
