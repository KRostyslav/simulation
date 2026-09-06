/**
 * Підписи поверх канви.
 *
 * На канві 320×192 текст не малюється взагалі: там просто немає роздільності
 * для читабельного шрифту, а розтягнутий системний зруйнував би піксельний
 * вигляд. Тому підписи — звичайні DOM-елементи, спозиційовані у ВІДСОТКАХ
 * від розміру канви: канва масштабується цілими кратностями, і у відсотках
 * підпис лишається над своїм місцем за будь-якого масштабу.
 *
 * Межі осей беруться з того самого об'єкта даних, який намалював криву, —
 * інакше підпис міг би назвати діапазон, якого на екрані немає.
 */

import { el } from "@edu/pixel-ui";
import { decimal, withPrefix, superscript } from "@edu/explain";

import { WIDTH, HEIGHT } from "../render/scene.js";
import { NODES } from "../render/circuit.js";
import { MODE, VIEW } from "../physics/constants.js";

const pct = (value, total) => `${(value / total) * 100}%`;

export function createLabels({ host }) {
  const root = host;

  function place(x, y, text, className = "", align = "left") {
    const node = el("span", `label ${className}`, text);
    node.style.left = pct(x, WIDTH);
    node.style.top = pct(y, HEIGHT);
    node.dataset.align = align;
    root.append(node);
    return node;
  }

  function update(snapshot, view, data) {
    root.textContent = "";

    if (snapshot.mode === MODE.rectifier) {
      scopeLabels(snapshot);
      return;
    }
    if (view === VIEW.circuit) {
      circuitLabels(snapshot);
      return;
    }
    if (snapshot.mode === MODE.breakdown) {
      reverseLabels(snapshot, data);
      return;
    }
    plotLabels(snapshot, data);
  }

  /* ------------------------------ схема ------------------------------ */

  function circuitLabels(snapshot) {
    const { op } = snapshot;
    place(NODES.source.x + 14, NODES.source.y - 16, `E = ${decimal(snapshot.emf, 2)} В`);
    place(NODES.source.x - 16, NODES.source.y - 22, "+", "label--tag");
    place(NODES.source.x - 16, NODES.source.y + 10, "−", "label--tag");

    place(
      NODES.resistor.x + NODES.resistor.w / 2,
      NODES.resistor.y - 26,
      `R = ${snapshot.resistance >= 1000 ? `${decimal(snapshot.resistance / 1000, 1)} кОм` : `${snapshot.resistance} Ом`}`,
      "",
      "center",
    );
    place(
      NODES.resistor.x + NODES.resistor.w / 2,
      NODES.resistor.y + 14,
      `${decimal(op.resistorVoltage, 2)} В`,
      "label--dim",
      "center",
    );

    place(NODES.ammeter.x, NODES.ammeter.y - 4, "A", "label--tag", "center");
    place(
      NODES.ammeter.x,
      NODES.ammeter.y - 26,
      withPrefix(op.current, "А"),
      "label--electron",
      "center",
    );

    place(NODES.voltmeter.x, NODES.voltmeter.y - 4, "V", "label--tag", "center");
    place(
      NODES.voltmeter.x,
      NODES.voltmeter.y + 14,
      `${decimal(op.diodeVoltage, 3)} В`,
      "label--hole",
      "center",
    );

    place(NODES.diode.x - 22, NODES.diode.y - 26, snapshot.device.short, "label--tag", "right");
    place(NODES.diode.x - 22, NODES.diode.y + 4, `${Math.round(snapshot.temperature)} К`, "label--dim", "right");
    place(6, HEIGHT - 12, `Режим: ${op.regime}`, "label--dim");
  }

  /* ------------------------------ графік ------------------------------ */

  function plotLabels(snapshot, data) {
    if (!data) return;
    const box = { x: 30, y: 8, w: WIDTH - 42, h: HEIGHT - 30 };

    place(box.x + box.w / 2, HEIGHT - 12, "U на діоді, В", "label--axis", "center");
    place(box.x - 4, 2, data.logScale ? "lg I" : "I", "label--axis", "right");

    // Кінці осей: підписуємо саме ті межі, у яких намальована крива.
    place(box.x - 4, box.y - 2, axisTop(data), "label--axis", "right");
    place(box.x - 4, box.y + box.h - 10, axisBottom(data), "label--axis", "right");
    place(box.x, box.y + box.h + 2, decimal(data.xMin ?? 0, 2), "label--axis", "center");
    place(
      box.x + box.w,
      box.y + box.h + 2,
      decimal(data.xMax ?? 1, 2),
      "label--axis",
      "right",
    );

    if (data.points?.length) {
      place(box.x + 4, box.y + 2, `${data.points.length} точок`, "label--dim");
    }
    if (data.fit && data.logScale) {
      place(
        box.x + box.w - 4,
        box.y + 2,
        `n = ${decimal(data.fit.ideality, 2)}`,
        "label--electron",
        "right",
      );
    }
  }

  function axisTop(data) {
    if (data.logScale) return `10${superscript(Math.round(data.yMax))}`;
    return withPrefix(data.yMax, "А");
  }

  function axisBottom(data) {
    if (data.logScale) return `10${superscript(Math.round(data.yMin))}`;
    return "0";
  }

  /* --------------------------- зворотна вітка --------------------------- */

  function reverseLabels(snapshot, data) {
    if (!data) return;
    const box = { x: 30, y: 8, w: WIDTH - 42, h: HEIGHT - 30 };
    place(box.x + box.w / 2, HEIGHT - 12, "U на діоді, В", "label--axis", "center");
    place(box.x - 4, box.y - 2, withPrefix(data.forwardMax, "А"), "label--axis", "right");
    place(
      box.x - 4,
      box.y + box.h - 10,
      `−${withPrefix(data.reverseMax, "А")}`,
      "label--axis",
      "right",
    );
    place(box.x + 2, box.y + box.h + 2, `−${decimal(data.depth, 0)} В`, "label--axis");
    place(box.x + box.w, box.y + box.h + 2, "+1 В", "label--axis", "right");
    place(
      box.x + 6,
      box.y + Math.round(box.h * 0.35) - 12,
      `U_проб = ${decimal(data.vbr, 2)} В`,
      "label--hole",
    );
    place(box.x + box.w - 4, box.y + 2, "прямий струм", "label--dim", "right");
    place(box.x + box.w - 4, box.y + box.h - 12, "зворотний струм", "label--dim", "right");
  }

  /* ---------------------------- осцилограма ---------------------------- */

  function scopeLabels(snapshot) {
    const wave = snapshot.wave;
    if (!wave) return;
    const box = { x: 30, y: 8, w: WIDTH - 42, h: HEIGHT - 30 };

    place(box.x + 4, box.y + 2, "u вх", "label--electron");
    place(box.x + 34, box.y + 2, "u вих", "label--hole");
    place(
      box.x + box.w - 4,
      box.y + 2,
      `U ср = ${decimal(wave.uMean, 2)} В`,
      "label--dim",
      "right",
    );
    place(
      box.x + box.w - 4,
      box.y + 14,
      `k п = ${decimal(wave.rippleFactor * 100, 0)} %`,
      "label--dim",
      "right",
    );
    place(box.x, box.y + box.h + 2, "0", "label--axis", "center");
    place(box.x + box.w / 2, box.y + box.h + 2, "T", "label--axis", "center");
    place(box.x + box.w, box.y + box.h + 2, "2T", "label--axis", "right");
    place(box.x + box.w / 2, HEIGHT - 12, "час", "label--axis", "center");
  }

  return { root, update };
}
