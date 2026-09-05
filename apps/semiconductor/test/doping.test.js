import test from "node:test";
import assert from "node:assert/strict";

import {
  DOPANT,
  carriers,
  equilibriumCarriers,
  conductivityRegime,
  carrierLifetime,
} from "../src/physics/doping.js";
import { intrinsicConcentration } from "../src/physics/intrinsic.js";

const DOPINGS = [1e12, 1e13, 1e14, 1e15, 1e16, 1e17, 1e18, 1e19];
const TEMPERATURES = [250, 300, 350, 400];

test("закон діючих мас n·p = n_i² виконується в усьому діапазоні", () => {
  for (const temperature of TEMPERATURES) {
    const ni = intrinsicConcentration(temperature);
    for (const dopant of [DOPANT.donor, DOPANT.acceptor]) {
      for (const doping of DOPINGS) {
        const { n, p } = carriers({ temperature, dopant, doping });
        const error = Math.abs((n * p) / (ni * ni) - 1);
        assert.ok(error < 1e-6, `n·p ≠ n_i² при T=${temperature}, N=${doping}: ${error}`);
      }
    }
  }
});

test("електронейтральність n + N_a = p + N_d", () => {
  for (const doping of DOPINGS) {
    const donor = carriers({ temperature: 300, dopant: DOPANT.donor, doping });
    assert.ok(Math.abs((donor.n - donor.p) / doping - 1) < 1e-6);

    const acceptor = carriers({ temperature: 300, dopant: DOPANT.acceptor, doping });
    assert.ok(Math.abs((acceptor.p - acceptor.n) / doping - 1) < 1e-6);
  }
});

test("неосновні носії не зникають при сильному легуванні", () => {
  // Саме через це неосновні рахуються як n_i²/основні, а не як різниця.
  const { n, p, ni } = carriers({ temperature: 300, dopant: DOPANT.donor, doping: 1e19 });
  assert.ok(p > 0 && Number.isFinite(p), `p = ${p}`);
  assert.ok(Math.abs(p - (ni * ni) / n) / p < 1e-9);

  // Документуємо, чому наївний шлях непридатний: різниця дає рівно нуль.
  const naive = n - 1e19;
  assert.equal(naive, 0);
});

test("чистий кремній: електронів і дірок порівну", () => {
  const { n, p, ni } = carriers({ temperature: 300, dopant: DOPANT.none, doping: 0 });
  assert.equal(n, p);
  assert.ok(Math.abs(n / ni - 1) < 1e-12);
});

test("донор і акцептор дзеркально симетричні", () => {
  const donor = carriers({ temperature: 300, dopant: DOPANT.donor, doping: 1e16 });
  const acceptor = carriers({ temperature: 300, dopant: DOPANT.acceptor, doping: 1e16 });
  assert.ok(Math.abs(donor.n / acceptor.p - 1) < 1e-12);
  assert.ok(Math.abs(donor.p / acceptor.n - 1) < 1e-12);
  assert.equal(donor.type, "n");
  assert.equal(acceptor.type, "p");
});

test("нагрівання повертає легований кристал до власної провідності", () => {
  const cold = carriers({ temperature: 300, dopant: DOPANT.donor, doping: 1e14 });
  const hot = carriers({ temperature: 650, dopant: DOPANT.donor, doping: 1e14 });

  assert.equal(conductivityRegime(cold), "домішкова");
  assert.equal(conductivityRegime(hot), "власна");
  // При високій температурі дірок стає майже стільки ж, скільки електронів.
  assert.ok(hot.p / hot.n > 0.9);
});

test("освітлення виводить кристал із рівноваги — закон діючих мас не діє", () => {
  const dark = carriers({ temperature: 300, dopant: DOPANT.donor, doping: 1e14 });
  const lit = carriers({
    temperature: 300,
    dopant: DOPANT.donor,
    doping: 1e14,
    excess: 1e15,
  });

  assert.equal(dark.equilibrium, true);
  assert.equal(lit.equilibrium, false);
  assert.ok(lit.n * lit.p > lit.ni * lit.ni * 100);
  // Світло додає однакову кількість електронів і дірок — пари.
  assert.ok(Math.abs(lit.n - dark.n - (lit.p - dark.p)) < 1);
});

test("сильна інжекція розмиває тип провідності", () => {
  const lit = carriers({
    temperature: 300,
    dopant: DOPANT.donor,
    doping: 1e12,
    excess: 1e16,
  });
  assert.equal(conductivityRegime(lit), "інжекція");
});

test("час життя носіїв падає з легуванням", () => {
  assert.ok(carrierLifetime(1e19) < carrierLifetime(1e14));
  assert.ok(carrierLifetime(0) > 0);
});

test("рівноважні концентрації не залежать від освітлення", () => {
  const base = equilibriumCarriers({ temperature: 300, dopant: DOPANT.donor, doping: 1e16 });
  const lit = carriers({ temperature: 300, dopant: DOPANT.donor, doping: 1e16, excess: 1e14 });
  assert.equal(base.n0, lit.n0);
});
