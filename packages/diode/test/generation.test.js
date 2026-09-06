/**
 * Генерація в збідненому шарі. Головне, що тут перевіряється, — показник
 * степеня при n_i: саме він відрізняє «подвоєння на 10 К», яке студент
 * побачить на приладі, від «збільшення вп'ятеро», яке дала б ідеальна формула.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SI } from "../src/constants.js";
import { generationCurrent } from "../src/generation.js";
import { saturationCurrent } from "../src/diode.js";
import { intrinsicConcentration } from "../src/intrinsic.js";

const P = { na: 1e16, nd: 1e16, area: 1e-3, material: SI };

test("струм генерації пропорційний n_i, а не n_i²", () => {
  const a = generationCurrent({ ...P, temperature: 300 }).igen;
  const b = generationCurrent({ ...P, temperature: 310 }).igen;
  const ni = intrinsicConcentration(310) / intrinsicConcentration(300);
  // Відношення струмів має збігатися з відношенням n_i, а не з його квадратом.
  assert.ok(Math.abs(b / a / ni - 1) < 0.05, `${b / a} проти n_i-відношення ${ni}`);
  assert.ok(b / a > 1.8 && b / a < 2.8, `подвоєння на 10 К порушено: ${b / a}`);
});

test("ідеальний струм насичення росте вчетверо швидше — тому й потрібен інший механізм", () => {
  const isRatio =
    saturationCurrent({ ...P, temperature: 310 }).is /
    saturationCurrent({ ...P, temperature: 300 }).is;
  assert.ok(isRatio > 4, `I_s мав би зростати різкіше за I_г, а зріс лише в ${isRatio}`);
});

test("при зворотному зміщенні струм росте як корінь із напруги", () => {
  const at = (bias) => generationCurrent({ ...P, temperature: 300, bias }).igen;
  const zero = at(0);
  const deep = at(-10);
  // W ~ √(V_bi − U), тому при −10 В ширина зростає приблизно в 4 рази.
  assert.ok(deep > zero * 2, "зворотна вітка мусить помітно рости");
  assert.ok(deep < zero * 8, "але не вибухати: залежність кореневa, а не лінійна");
});

test("генераційний струм кремнію на порядки більший за ідеальний I_s", () => {
  const { igen } = generationCurrent({ ...P, temperature: 300 });
  const { is } = saturationCurrent({ ...P, temperature: 300 });
  assert.ok(igen / is > 100, `саме він і визначає реальну зворотну вітку: ${igen / is}`);
});
