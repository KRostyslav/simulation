/**
 * Панель показників і смуга попереджень.
 *
 * Рядки створюються один раз і лише оновлюються: перестворення DOM на
 * кожному кадрі скидало б розкриті пояснення, і читати їх було б неможливо.
 */

import { el, createReadoutRow } from "@edu/pixel-ui";

import { MODE } from "../physics/constants.js";

/** Які показники показувати в якому режимі — і в якому порядку. */
const LAYOUT = {
  [MODE.stand]: [
    ["Покази приладів", ["current", "diodeVoltage", "resistorVoltage", "power"]],
    ["Обробка результатів", ["ideality", "isMeasured", "mvPerDecade", "rDynamic", "threshold", "r2"]],
    ["Для порівняння", ["isTheory", "thresholdTheory"]],
  ],
  [MODE.materials]: [
    ["Покази приладів", ["current", "diodeVoltage"]],
    ["Обробка результатів", ["threshold", "ideality", "mvPerDecade"]],
    ["Для порівняння", ["thresholdTheory", "isTheory"]],
  ],
  [MODE.temperature]: [
    ["Покази приладів", ["current", "diodeVoltage"]],
    ["Обробка результатів", ["threshold", "mvPerDecade", "ideality"]],
    ["Для порівняння", ["thresholdTheory", "isTheory"]],
  ],
  [MODE.breakdown]: [
    ["Покази приладів", ["current", "diodeVoltage", "power"]],
    ["Пробій", ["vbr", "rDynamic"]],
  ],
  [MODE.rectifier]: [
    ["Вихід випрямляча", ["uMean", "rippleFactor", "dropMean"]],
  ],
};

export function createReadouts({ onCodex }) {
  const root = el("div", "readouts");
  const rows = new Map();
  const groups = new Map();

  function ensureGroup(title) {
    if (!groups.has(title)) {
      const box = el("section", "readouts__group");
      box.append(el("h3", "panel__title", title));
      const body = el("div", "readouts__body");
      box.append(body);
      groups.set(title, { box, body });
      root.append(box);
    }
    return groups.get(title);
  }

  function ensureRow(readout) {
    if (!rows.has(readout.id)) {
      const row = createReadoutRow({ readout, level: 3 });
      if (readout.codexRef) {
        const link = el("button", "ro__link", "Що це означає →");
        link.type = "button";
        link.addEventListener("click", () => onCodex?.(readout.codexRef));
        row.root.append(link);
      }
      rows.set(readout.id, row);
    }
    return rows.get(readout.id);
  }

  function update(snapshot) {
    const layout = LAYOUT[snapshot.mode] ?? LAYOUT[MODE.stand];
    const shown = new Set();

    for (const [title, ids] of layout) {
      const group = ensureGroup(title);
      for (const id of ids) {
        const readout = snapshot.readouts[id];
        if (!readout) continue;
        const row = ensureRow(readout);
        row.update(readout, 3);
        if (row.root.parentElement !== group.body) group.body.append(row.root);
        shown.add(id);
      }
      group.box.hidden = group.body.children.length === 0;
    }

    // Рядки, яких у цьому режимі немає, ховаємо, а не видаляємо: інакше
    // при поверненні в режим вони втратили б стан розкриття.
    for (const [id, row] of rows) row.root.hidden = !shown.has(id);
    for (const [title, group] of groups) {
      const visible = [...group.body.children].some((node) => !node.hidden);
      group.box.hidden = !visible;
      if (!layout.some(([name]) => name === title)) group.box.hidden = true;
    }
  }

  return { root, update };
}

/** Смуга попереджень під показниками. */
export function createWarnings({ onCodex }) {
  const root = el("div", "warnings");
  let signature = "";

  function update(warnings) {
    const next = warnings.map((w) => w.id).join("|");
    if (next === signature) return;
    signature = next;
    root.textContent = "";
    for (const warning of warnings) {
      const box = el("div", "warning");
      box.dataset.tone = warning.tone;
      box.append(el("strong", "warning__title", warning.title));
      box.append(el("p", "warning__text", warning.text));
      if (warning.codexRef) {
        const link = el("button", "warning__link", "Докладніше →");
        link.type = "button";
        link.addEventListener("click", () => onCodex?.(warning.codexRef));
        box.append(link);
      }
      root.append(box);
    }
  }

  return { root, update };
}
