/**
 * Таблиця вимірювань — головний робочий інструмент студента.
 *
 * Числа в колонках моноширинні й вирівняні за розрядами (tabular-nums):
 * інакше цифри «стрибають» при оновленні, і колонку неможливо переглянути
 * очима згори вниз — а саме так її й читають, шукаючи випадкову точку.
 */

import { el } from "@edu/pixel-ui";
import { decimal, withPrefix } from "@edu/explain";

import { DEVICE_BY_ID } from "../physics/devices.js";
import { parseSeriesKey } from "../physics/measurements.js";

export function createTable({ onRemove, onClear, onSelectSeries }) {
  const root = el("section", "table");
  const head = el("div", "table__head");
  const title = el("h3", "panel__title", "Таблиця вимірювань");
  const counter = el("span", "table__counter", "");
  head.append(title, counter);

  const tabs = el("div", "table__tabs");
  const scroll = el("div", "table__scroll");
  const grid = el("div", "table__grid");
  scroll.append(grid);

  const empty = el(
    "p",
    "table__empty",
    "Точок ще немає. Виставте ЕРС і натисніть «Записати точку» — або пробіл.",
  );

  const clear = el("button", "btn btn--ghost table__clear", "Очистити серію");
  clear.type = "button";
  clear.addEventListener("click", () => onClear?.());

  root.append(head, tabs, empty, scroll, clear);

  function update(snapshot) {
    const points = snapshot.points;
    const used = new Set(snapshot.analysis.region.used);

    counter.textContent = points.length ? `${points.length} точок` : "";
    empty.hidden = points.length > 0;
    scroll.hidden = points.length === 0;
    clear.hidden = points.length === 0;

    renderTabs(snapshot);

    grid.textContent = "";
    if (points.length === 0) return;

    for (const text of ["№", "U, В", "I", ""]) {
      grid.append(el("span", "table__cell table__cell--head", text));
    }

    points.forEach((point, index) => {
      const row = [
        el("span", "table__cell table__cell--num", String(index + 1)),
        el("span", "table__cell table__cell--num", decimal(point.voltage, 3)),
        el("span", "table__cell table__cell--num", withPrefix(point.current, "А")),
      ];
      const remove = el("button", "table__drop", "✕");
      remove.type = "button";
      remove.title = "Вилучити точку";
      remove.setAttribute("aria-label", `Вилучити точку ${index + 1}`);
      remove.addEventListener("click", () => onRemove?.(index));

      const inFit = used.has(point);
      for (const cell of [...row, remove]) {
        cell.dataset.used = inFit ? "1" : "";
        if (!inFit) cell.title = "Не взято в апроксимацію";
        grid.append(cell);
      }
    });
  }

  /** Вкладки серій: одна серія — це один діод при одній температурі. */
  function renderTabs(snapshot) {
    const keys = Object.keys(snapshot.table).filter(
      (key) => snapshot.table[key].length > 0,
    );
    tabs.textContent = "";
    tabs.hidden = keys.length < 2;
    if (keys.length < 2) return;

    for (const key of keys) {
      const { deviceId, temperature } = parseSeriesKey(key);
      const device = DEVICE_BY_ID[deviceId];
      const button = el(
        "button",
        "table__tab",
        `${device?.short ?? deviceId} · ${temperature} К · ${snapshot.table[key].length}`,
      );
      button.type = "button";
      button.dataset.on = key === snapshot.seriesKey ? "1" : "";
      button.addEventListener("click", () => onSelectSeries?.(key));
      tabs.append(button);
    }
  }

  return { root, update };
}
