/**
 * Порівняння двох знімків моделі.
 *
 * Ранжуємо зміни за модулем логарифма відношення, а не за різницею.
 * Причина фізична: у напівпровіднику концентрація може змінитись у 10⁶ разів,
 * і абсолютна різниця завжди «перемагала» б у найбільшої величини. Учня ж
 * цікавить саме «у скільки разів», тому декади — правильна міра.
 */

import { decades } from "./format.js";

export function diffSnapshots(prev, next) {
  if (!prev || !next) return [];
  const changes = [];

  for (const [id, readout] of Object.entries(next.readouts)) {
    const before = prev.readouts[id];
    if (!before) continue;
    const from = before.value;
    const to = readout.value;
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    if (from === to) continue;

    const magnitude =
      from > 0 && to > 0 ? Math.abs(decades(from, to)) : Math.abs(to - from) > 0 ? 0.3 : 0;

    changes.push({
      id,
      label: readout.label,
      from,
      to,
      ratio: from !== 0 ? to / from : Infinity,
      decades: from > 0 && to > 0 ? decades(from, to) : 0,
      direction: to > from ? 1 : -1,
      magnitude,
    });
  }

  changes.sort((a, b) => b.magnitude - a.magnitude);
  return changes;
}

/** Швидкий пошук зміни конкретного показника у списку. */
export function findChange(changes, id) {
  return changes.find((change) => change.id === id) ?? null;
}
