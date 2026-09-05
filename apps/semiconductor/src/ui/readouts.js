/**
 * Панель показників.
 *
 * Рядки створюються за списком `order` зі знімка й оновлюються на місці,
 * поки склад показників не змінився. Перебудова DOM на кожному русі повзунка
 * згортала б розкриті пояснення — а саме заради них панель і існує.
 */

import { el, createReadoutRow } from "@edu/pixel-ui";

export function createReadoutPanel({ onCodex }) {
  const root = el("div", "readouts");
  const rows = new Map();
  let signature = "";
  let level = 2;

  function rebuild(snapshot) {
    root.replaceChildren();
    rows.clear();
    for (const id of snapshot.order) {
      const readout = snapshot.readouts[id];
      const row = createReadoutRow({ readout, level });
      if (readout.codexRef) {
        const link = el("button", "ro__link", "Докладніше в довіднику →");
        link.type = "button";
        link.addEventListener("click", () => onCodex(readout.codexRef));
        row.root.querySelector(".ro__body").append(link);
      }
      rows.set(id, row);
      root.append(row.root);
    }
  }

  function update(snapshot, nextLevel = level) {
    level = nextLevel;
    const next = snapshot.order.join("|");
    if (next !== signature) {
      signature = next;
      rebuild(snapshot);
    }
    for (const id of snapshot.order) {
      rows.get(id)?.update(snapshot.readouts[id], level);
    }
    root.dataset.level = String(level);
  }

  return { root, update };
}

/** Смуга попереджень про межі моделі. Порожня — і її не видно. */
export function createWarningPanel({ onCodex }) {
  const root = el("div", "warnings");
  root.setAttribute("aria-live", "polite");

  function update(snapshot) {
    root.replaceChildren();
    root.hidden = snapshot.warnings.length === 0;
    for (const warning of snapshot.warnings) {
      const item = el("div", "warning");
      item.dataset.tone = warning.tone;
      item.append(el("strong", "warning__title", warning.title));
      item.append(el("p", "warning__text", warning.text));
      if (warning.codexRef) {
        const link = el("button", "warning__link", "Чому так →");
        link.type = "button";
        link.addEventListener("click", () => onCodex(warning.codexRef));
        item.append(link);
      }
      root.append(item);
    }
  }

  return { root, update };
}
