/**
 * Контрольні числа лабораторної роботи.
 *
 * Це найважливіший тест усієї апки: він стежить, щоб симуляція давала ті
 * самі значення, які студент має отримати за підручником. Якщо він упаде,
 * робота почне вчити неправди — а це гірше, ніж якби вона просто не
 * запускалася.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { DEVICE_BY_ID } from "../src/physics/devices.js";
import { operatingPoint, voltageAtCurrent } from "../src/physics/circuit.js";
import { I_REF } from "../src/physics/constants.js";

const at = (id, temperature = 300) =>
  voltageAtCurrent({
    device: DEVICE_BY_ID[id],
    temperature,
    resistance: 1000,
    target: I_REF,
  });

test("порогові напруги збігаються з підручником", () => {
  const si = at("si");
  const ge = at("ge");
  assert.ok(si > 0.6 && si < 0.75, `кремній: ${si} В замість ≈0,7 В`);
  assert.ok(ge > 0.2 && ge < 0.4, `германій: ${ge} В замість ≈0,3 В`);
});

test("різниця порогів Si та Ge — саме те, що студент має виміряти", () => {
  const delta = at("si") - at("ge");
  assert.ok(delta > 0.3 && delta < 0.45, `різниця ${delta} В поза очікуваною`);
});

test("пряма напруга падає приблизно на 2 мВ на кожен градус", () => {
  for (const id of ["si", "ge"]) {
    const slope = ((at(id, 310) - at(id, 300)) * 1000) / 10;
    assert.ok(slope > -2.5 && slope < -1.5, `${id}: ${slope} мВ/К замість ≈−2`);
  }
});

test("зворотний струм подвоюється на кожні 10 К", () => {
  const reverse = (id, temperature) =>
    Math.abs(
      operatingPoint({
        device: DEVICE_BY_ID[id],
        temperature,
        emf: -5,
        resistance: 1000,
      }).current,
    );
  for (const id of ["si", "ge"]) {
    for (const t of [280, 300, 320]) {
      const ratio = reverse(id, t + 10) / reverse(id, t);
      assert.ok(ratio > 1.8 && ratio < 2.8, `${id} при ${t} К: ×${ratio}`);
    }
  }
});

test("у германію зворотний струм на порядки більший", () => {
  const rev = (id) =>
    Math.abs(
      operatingPoint({ device: DEVICE_BY_ID[id], temperature: 300, emf: -5, resistance: 1000 })
        .current,
    );
  assert.ok(rev("ge") / rev("si") > 1e3, "саме тому германій витіснили з техніки");
});

test("стабілітрон пробивається біля 5,6 В, звичайний діод — ні", () => {
  const zener = DEVICE_BY_ID.zener;
  const { breakdown } = operatingPoint({
    device: zener,
    temperature: 300,
    emf: 0,
    resistance: 1000,
  });
  assert.ok(breakdown.vbr > 5 && breakdown.vbr < 6.5, `V_проб = ${breakdown.vbr} В`);

  const si = operatingPoint({
    device: DEVICE_BY_ID.si,
    temperature: 300,
    emf: 0,
    resistance: 1000,
  });
  assert.ok(si.breakdown.vbr > 40, "кремнієвий випрямний тримає десятки вольт");
});

test("напруга стабілізації майже не залежить від струму", () => {
  const device = DEVICE_BY_ID.zener;
  const a = operatingPoint({ device, temperature: 300, emf: -8, resistance: 1000 });
  const b = operatingPoint({ device, temperature: 300, emf: -20, resistance: 1000 });
  const currentRatio = b.current / a.current;
  const voltageChange = Math.abs(b.diodeVoltage - a.diodeVoltage);
  assert.ok(currentRatio > 4, "струм мусить зрости в рази");
  assert.ok(voltageChange < 0.5, `а напруга — майже ні, а змінилась на ${voltageChange} В`);
});
