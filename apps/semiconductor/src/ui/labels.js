/**
 * Підписи поверх канви.
 *
 * На канві текст навмисно не малюється: растровий шрифт 5×7 не дав би
 * коректної кирилиці, а скрінрідер не прочитав би нічого. Тому підписи —
 * звичайні DOM-елементи, спозиційовані у ВІДСОТКАХ від розміру канви.
 * Відсотки, а не пікселі, — щоб підписи лишились на місці при будь-якому
 * цілочисельному масштабі канви.
 */

import { el } from "@edu/pixel-ui";
import { sci, decimal, withPrefix } from "@edu/explain";

import { MODE } from "../physics/constants.js";
import { VIEW, WIDTH, HEIGHT } from "../render/scene.js";
import { conductivityPlotData, ivPlotData } from "../render/plot.js";

const pct = (value, total) => `${(value / total) * 100}%`;

export function createLabels() {
  const root = el("div", "labels");

  function place(x, y, text, className = "", align = "left") {
    const node = el("span", `label ${className}`, text);
    node.style.left = pct(x, WIDTH);
    node.style.top = pct(y, HEIGHT);
    if (align === "center") node.dataset.align = "center";
    if (align === "right") node.dataset.align = "right";
    root.append(node);
    return node;
  }

  function crystalLabels(snapshot) {
    const { n, p, ni } = snapshot.values;
    place(6, 4, snapshot.regime === "власна" ? "Власна провідність" : `Провідність: ${snapshot.regime}`, "label--tag");

    // Драбина концентрацій: степені десятки під віссю.
    for (let exp = 2; exp <= 20; exp += 4) {
      const x = 6 + ((exp - 2) / 18) * (WIDTH - 12);
      place(x, 186, `10${supers(exp)}`, "label--axis", "center");
    }
    const xFor = (value) =>
      6 + Math.max(0, Math.min(1, (Math.log10(value) - 2) / 18)) * (WIDTH - 12);

    place(xFor(n), 150, "n", "label--electron", "center");
    place(xFor(p), 150, "p", "label--hole", "center");
    if (snapshot.carrier.equilibrium) place(xFor(ni), 162, "nᵢ", "label--dim", "center");
  }

  function junctionLabels(snapshot) {
    const { widthUm, xpUm, xnUm, bias, current, vbi } = snapshot.values;
    place(10, 4, "p-область", "label--hole");
    place(WIDTH - 10, 4, "n-область", "label--electron", "right");
    place(WIDTH / 2, 4, `Збіднений шар ${decimal(widthUm, 3)} мкм`, "label--tag", "center");
    place(
      WIDTH / 2,
      136,
      `x_p = ${decimal(xpUm, 3)} мкм · x_n = ${decimal(xnUm, 3)} мкм`,
      "label--axis",
      "center",
    );
    place(
      WIDTH / 2,
      158,
      bias === 0
        ? `Бар'єр ${decimal(vbi, 3)} В`
        : `Бар'єр ${decimal(vbi - bias, 3)} В · струм ${withPrefix(current, "А")}`,
      "label--axis",
      "center",
    );
  }

  /**
   * Підписи осей беруть межі з тих самих даних кривої, що й рендер, —
   * інакше число під віссю могло б називати не той діапазон, у якому
   * насправді намальовано графік.
   */
  function plotLabels(snapshot, logScale) {
    // Межі графіка в логічних пікселях канви — див. PLOT_BOX у render/scene.js.
    const left = 26;
    const right = WIDTH - 12;
    const top = 10;
    const bottom = 172;

    if (snapshot.mode === MODE.junction) {
      const data = ivPlotData(snapshot, logScale);
      place(WIDTH / 2, 2, "Вольт-амперна характеристика діода", "label--tag", "center");
      place(WIDTH / 2, 182, "Напруга на діоді U, В", "label--axis", "center");

      place(left, 182, decimal(data.xMin, 2), "label--axis", "center");
      place(right, 182, `+${decimal(data.xMax, 2)}`, "label--axis", "center");

      if (logScale) {
        place(2, top - 8, "lg I, А", "label--axis");
        place(22, top, String(data.yMax), "label--axis", "right");
        place(22, bottom - 6, String(data.yMin), "label--axis", "right");
        // Усередині поля графіка, а не під віссю: там підпис наклався б
        // на засічки й на числа шкали.
        place(right - 4, top + 4, "нахил 60 мВ на декаду струму", "label--dim", "right");
      } else {
        place(2, top - 8, "I", "label--axis");
        place(22, top, withPrefix(data.yMax, "А"), "label--axis", "right");
        place(22, bottom - 6, "0", "label--axis", "right");
      }
      return;
    }

    const data = conductivityPlotData(snapshot);
    place(WIDTH / 2, 2, "Провідність від температури", "label--tag", "center");
    place(WIDTH / 2, 182, "1000/T, К⁻¹", "label--axis", "center");
    place(left, 182, `${data.tMax} К`, "label--axis", "center");
    place(right, 182, `${data.tMin} К`, "label--axis", "center");
    place(2, top - 8, "lg σ", "label--axis");
    place(22, top, String(data.yMax), "label--axis", "right");
    place(22, bottom - 6, String(data.yMin), "label--axis", "right");
    place(WIDTH - 8, 26, "мідь", "label--dim", "right");
  }

  function update(snapshot, view, logScale = false) {
    root.replaceChildren();
    if (view === VIEW.plot) plotLabels(snapshot, logScale);
    else if (snapshot.mode === MODE.junction) junctionLabels(snapshot);
    else crystalLabels(snapshot);
  }

  return { root, update };
}

const SUPERS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
function supers(n) {
  return String(n)
    .split("")
    .map((ch) => SUPERS[Number(ch)] ?? ch)
    .join("");
}

/** Легенда під канвою — постійна, бо без неї кольори нічого не означають. */
export function legendItems(mode) {
  if (mode === MODE.junction) {
    return [
      { color: "#4fc3f7", text: "електрон" },
      { color: "#ff7043", text: "дірка (порожній зв'язок)" },
      { color: "#c5e1a5", text: "іон донора ⊕" },
      { color: "#e1bee7", text: "іон акцептора ⊖" },
      { color: "#ffd54f", text: "внутрішнє поле" },
    ];
  }
  return [
    { color: "#4fc3f7", text: "електрон" },
    { color: "#ff7043", text: "дірка" },
    { color: "#8bc34a", text: "атом донора (P)" },
    { color: "#ba68c8", text: "атом акцептора (B)" },
    { color: "#fff59d", text: "народження пари" },
  ];
}

/** Пояснення логарифмічної шкали. Без нього кількість точок вводить в оману. */
export const SCALE_NOTE =
  "Шкала логарифмічна: кожні 3 точки на екрані — це вдесятеро більша концентрація. " +
  "Лінійно показати різницю в мільярд разів неможливо. На драбині внизу nᵢ завжди " +
  "стоїть рівно посередині між n і p — це і є закон діючих мас, побачений очима.";

/** Підпис для формату числа в наукових позначеннях — використовує довідник. */
export const formatConcentration = (value) => `${sci(value, 2)} см⁻³`;
