/**
 * Інваріант пояснення.
 *
 * Головна ідея пакета: **число не існує окремо від причини, чому воно таке,
 * і від формули, з якої воно отримане**. Тому показник створюється не як
 * `number`, а як `Readout` — і без поля `why` він просто не створиться.
 *
 * Навіщо так строго. У навчальному застосунку найгірша можлива помилка —
 * коли розрахунок змінили, а підпис під ним лишився старим. Учень довіряє
 * підпису й вивчає неправду. Тут це технічно неможливо: панель, живий
 * коментар і довідник рендерять той самий об'єкт, який повернула фізика.
 */

import { smart } from "./format.js";
import { placeholders, substitute } from "./substitute.js";

const TONES = new Set(["neutral", "good", "warn", "bad"]);

export function makeReadout({
  id,
  label,
  symbol,
  value,
  unit = "",
  display,
  why,
  formula,
  substitution,
  terms,
  codexRef,
  tone = "neutral",
}) {
  if (!id) throw new Error("Readout без id");
  if (!label) throw new Error(`Readout "${id}" без назви (label)`);
  if (!why) throw new Error(`Readout "${id}" без пояснення (why)`);
  if (!TONES.has(tone)) throw new Error(`Readout "${id}": невідомий tone "${tone}"`);
  if (terms && !substitution) {
    throw new Error(`Readout "${id}": є terms, але немає шаблону substitution`);
  }
  if (substitution && !formula) {
    throw new Error(`Readout "${id}": є підстановка, але немає символьної формули`);
  }
  if (substitution && !terms) {
    throw new Error(`Readout "${id}": є шаблон substitution, але немає terms`);
  }

  let substituted;
  if (substitution) {
    // substitute сам кине помилку, якщо якогось плейсхолдера немає в terms.
    substituted = substitute(substitution, terms);
  }

  return Object.freeze({
    id,
    label,
    symbol: symbol ?? "",
    value,
    unit,
    display: display ?? smart(value),
    why,
    formula: formula ?? null,
    substituted: substituted ?? null,
    codexRef: codexRef ?? null,
    tone,
  });
}

/**
 * Зміна показника між двома знімками. Так само не існує без причини:
 * «σ впала втричі» без «бо розсіяння на фононах зросло» нічого не вчить.
 */
export function makeChange({ id, target, from, to, reason, tone = "neutral" }) {
  if (!id) throw new Error("Change без id");
  if (!reason) throw new Error(`Зміна "${id}" без пояснення (reason)`);
  if (!TONES.has(tone)) throw new Error(`Зміна "${id}": невідомий tone "${tone}"`);
  return Object.freeze({ id, target: target ?? id, from, to, reason, tone });
}

/** Перевірка цілісності навчальних даних — використовується в тестах. */
export function assertReadoutMap(map) {
  for (const [key, readout] of Object.entries(map)) {
    if (readout.id !== key) {
      throw new Error(`Ключ "${key}" не збігається з readout.id "${readout.id}"`);
    }
    if (readout.substituted && placeholders(readout.substituted).length > 0) {
      throw new Error(`Readout "${key}": у підставленому рядку лишились плейсхолдери`);
    }
  }
  return true;
}
