import test from "node:test";
import assert from "node:assert/strict";

import {
  electronMobility,
  holeMobility,
  conductivity,
  driftVelocity,
  sampleElectrics,
  diffusionCoefficient,
} from "../src/physics/transport.js";
import { DOPANT, carriers } from "../src/physics/doping.js";
import { SI } from "../src/physics/constants.js";

function resistivityFor({ dopant, doping, temperature = 300, excess = 0 }) {
  const { n, p } = carriers({ temperature, dopant, doping, excess });
  const total = dopant === DOPANT.none ? 0 : doping;
  return (
    1 /
    conductivity({
      n,
      p,
      muN: electronMobility(total, temperature),
      muP: holeMobility(total, temperature),
    })
  );
}

test("рухливість у чистому кремнії збігається з табличною", () => {
  assert.ok(Math.abs(electronMobility(0, 300) - 1360) < 1);
  assert.ok(Math.abs(holeMobility(0, 300) - 461) < 1);
});

test("дірки повільніші за електрони приблизно втричі", () => {
  const ratio = electronMobility(1e16, 300) / holeMobility(1e16, 300);
  assert.ok(ratio > 2.5 && ratio < 3.2, `μₙ/μₚ = ${ratio}`);
});

test("легування знижує рухливість — іони домішок розсіюють носії", () => {
  assert.ok(electronMobility(1e19, 300) < electronMobility(1e14, 300) * 0.3);
});

test("нагрівання знижує рухливість — коливання ґратки розсіюють сильніше", () => {
  assert.ok(electronMobility(1e16, 600) < electronMobility(1e16, 300));
  assert.ok(electronMobility(1e16, 150) > electronMobility(1e16, 300));
});

test("питомий опір власного кремнію — сотні кілоом на сантиметр", () => {
  const rho = resistivityFor({ dopant: DOPANT.none, doping: 0 });
  assert.ok(rho > 2.5e5 && rho < 4.5e5, `ρ = ${rho}`);
});

test("контрольні точки з підручника: 10¹⁶ фосфору й бору", () => {
  const rhoN = resistivityFor({ dopant: DOPANT.donor, doping: 1e16 });
  const rhoP = resistivityFor({ dopant: DOPANT.acceptor, doping: 1e16 });
  assert.ok(rhoN > 0.4 && rhoN < 0.7, `ρ(n) = ${rhoN}`);
  assert.ok(rhoP > 1.1 && rhoP < 1.8, `ρ(p) = ${rhoP}`);
  // Той самий рівень легування, а опір p-типу помітно більший — через дірки.
  assert.ok(rhoP > rhoN * 2);
});

test("легування зменшує опір на порядки — головний ефект теми", () => {
  const clean = resistivityFor({ dopant: DOPANT.none, doping: 0 });
  const doped = resistivityFor({ dopant: DOPANT.donor, doping: 1e16 });
  assert.ok(clean / doped > 1e5, `лише в ${clean / doped} разів`);
});

test("провідність монотонно росте з легуванням", () => {
  let prev = 0;
  for (const doping of [1e12, 1e13, 1e14, 1e15, 1e16, 1e17, 1e18, 1e19]) {
    const sigma = 1 / resistivityFor({ dopant: DOPANT.donor, doping });
    assert.ok(sigma > prev, `немонотонність при N = ${doping}`);
    prev = sigma;
  }
});

test("провідність монотонно росте з освітленням", () => {
  let prev = 0;
  for (const suns of [0, 1e-3, 1e-2, 0.1, 1, 10]) {
    const sigma =
      1 / resistivityFor({ dopant: DOPANT.none, doping: 0, excess: suns * 2.5e15 });
    assert.ok(sigma > prev, `немонотонність при ${suns} сонць`);
    prev = sigma;
  }
});

test("дрейфова швидкість ніколи не перевищує швидкість насичення", () => {
  for (const field of [1, 100, 1e4, 1e6, 1e9]) {
    const v = driftVelocity(electronMobility(0, 300), field);
    assert.ok(v < SI.vSat, `v = ${v} при E = ${field}`);
  }
});

test("у слабкому полі дрейф лінійний: v = μE", () => {
  const mu = electronMobility(1e16, 300);
  const v = driftVelocity(mu, 1);
  assert.ok(Math.abs(v / mu - 1) < 1e-3, `v = ${v}, μE = ${mu}`);
});

test("співвідношення Ейнштейна: D = V_T·μ", () => {
  const d = diffusionCoefficient(1000, 300);
  assert.ok(Math.abs(d - 25.85) < 0.1, `D = ${d}`);
});

test("опір зразка = 100·ρ завдяки обраній геометрії", () => {
  const { n, p } = carriers({ temperature: 300, dopant: DOPANT.donor, doping: 1e16 });
  const e = sampleElectrics({
    n,
    p,
    muN: electronMobility(1e16, 300),
    muP: holeMobility(1e16, 300),
    voltage: 1,
  });
  assert.ok(Math.abs(e.resistance / e.resistivity - 100) < 1e-9);
  // Закон Ома має виконуватись точно.
  assert.ok(Math.abs(e.current * e.resistance - 1) < 1e-12);
});
