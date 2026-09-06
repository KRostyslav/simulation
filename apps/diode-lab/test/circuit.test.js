/**
 * Стенд. Перевіряємо не «схоже на правду», а закони: Кірхгофа й монотонність.
 * Якщо вони виконуються, довіряти можна й проміжним числам.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { DEVICES, DEVICE_BY_ID } from "../src/physics/devices.js";
import { operatingPoint, theoreticalCurve } from "../src/physics/circuit.js";

test("закон Кірхгофа виконується на всій сітці станів", () => {
  for (const device of DEVICES) {
    for (const temperature of [250, 300, 350, 400]) {
      for (const resistance of [22, 220, 1000, 10000]) {
        for (const emf of [-20, -5, -1, 0.2, 0.5, 1, 3, 5]) {
          const op = operatingPoint({ device, temperature, emf, resistance });
          const sum = op.current * resistance + op.diodeVoltage;
          assert.ok(
            Math.abs(sum - emf) < 1e-9,
            `${device.id} E=${emf}: сума ${sum} замість ${emf}`,
          );
        }
      }
    }
  }
});

test("нульова ЕРС дає рівно нульовий струм", () => {
  for (const device of DEVICES) {
    const op = operatingPoint({ device, temperature: 300, emf: 0, resistance: 1000 });
    assert.equal(op.current, 0);
    assert.equal(op.diodeVoltage, 0);
    assert.equal(op.regime, "рівновага");
  }
});

test("струм монотонно зростає з ЕРС і спадає з опором", () => {
  const device = DEVICE_BY_ID.si;
  let previous = -Infinity;
  for (let emf = 0; emf <= 5; emf += 0.25) {
    const { current } = operatingPoint({ device, temperature: 300, emf, resistance: 1000 });
    assert.ok(current >= previous, `при E=${emf} струм пішов униз`);
    previous = current;
  }

  let last = Infinity;
  for (const resistance of [22, 47, 100, 470, 1000, 10000]) {
    const { current } = operatingPoint({ device, temperature: 300, emf: 3, resistance });
    assert.ok(current < last, `опір ${resistance} не зменшив струм`);
    last = current;
  }
});

test("за напругою пробою струм задає резистор, а не діод", () => {
  const device = DEVICE_BY_ID.zener;
  const resistance = 1000;
  const emf = -20;
  const op = operatingPoint({ device, temperature: 300, emf, resistance });
  const expected = (Math.abs(emf) - op.breakdown.vbr) / resistance;
  assert.ok(
    Math.abs(Math.abs(op.current) / expected - 1) < 0.15,
    `${op.current} проти очікуваного ${expected}`,
  );
  assert.equal(op.regime, "пробій");
});

test("жодного NaN чи нескінченності на всій сітці", () => {
  let states = 0;
  for (const device of DEVICES) {
    for (let t = 250; t <= 400; t += 25) {
      for (const resistance of [22, 100, 1000, 10000]) {
        for (let emf = -25; emf <= 5; emf += 0.5) {
          const op = operatingPoint({ device, temperature: t, emf, resistance });
          for (const [key, value] of Object.entries(op)) {
            if (typeof value !== "number") continue;
            assert.ok(
              Number.isFinite(value),
              `${device.id} E=${emf} T=${t}: ${key} = ${value}`,
            );
          }
          states += 1;
        }
      }
    }
  }
  assert.ok(states > 1000, `перевірено лише ${states} станів`);
});

test("теоретична крива впорядкована за напругою й скінченна", () => {
  const curve = theoreticalCurve({
    device: DEVICE_BY_ID.si,
    temperature: 300,
    from: -5,
    to: 3,
    points: 60,
  });
  assert.equal(curve.length, 61);
  for (let i = 1; i < curve.length; i += 1) {
    assert.ok(curve[i].voltage >= curve[i - 1].voltage, "напруга мусить зростати");
    assert.ok(Number.isFinite(curve[i].current));
  }
});
