/**
 * Кристалічна ґратка кремнію — пласка шкільна схема.
 *
 * Реальна ґратка тривимірна (тетраедри), але для теми це неважливо й лише
 * заважало б бачити головне: кожен атом ділиться чотирма електронами з
 * чотирма сусідами, і саме ці зв'язки рветься.
 *
 * Позиції домішкових атомів детерміновані (свій генератор із фіксованим
 * зерном). Якби вони обиралися випадково при кожному перемальовуванні,
 * картинка стрибала б від найменшого руху повзунка, і простежити, що
 * саме змінилось, було б неможливо.
 */

import { PALETTE, disc, ring, line, px, rect } from "@edu/pixel-ui";

import { DOPANT } from "../physics/doping.js";

const COLS = 9;
const ROWS = 5;

/** Детермінований перемішувач індексів вузлів — завжди той самий порядок. */
function shuffledNodes(count, seed = 20240905) {
  const nodes = Array.from({ length: count }, (_, i) => i);
  let state = seed;
  for (let i = count - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    const j = state % (i + 1);
    [nodes[i], nodes[j]] = [nodes[j], nodes[i]];
  }
  return nodes;
}

const NODE_ORDER = shuffledNodes(COLS * ROWS);

export function createLattice(bounds) {
  const stepX = bounds.w / (COLS + 1);
  const stepY = bounds.h / (ROWS + 1);

  const nodes = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      nodes.push({
        x: Math.round(bounds.x + stepX * (col + 1)),
        y: Math.round(bounds.y + stepY * (row + 1)),
        col,
        row,
      });
    }
  }

  /** Скільки домішкових атомів показати: логарифмічно, як і носії. */
  function dopantNodeCount(concentration) {
    if (!(concentration > 1e11)) return 0;
    return Math.max(0, Math.min(10, Math.round(1.6 * (Math.log10(concentration) - 12))));
  }

  function draw(ctx, { dopant, doping, broken = 0 }) {
    const dopantCount = dopant === DOPANT.none ? 0 : dopantNodeCount(doping);
    const dopantNodes = new Set(NODE_ORDER.slice(0, dopantCount));
    // Розірвані зв'язки беремо з кінця того самого порядку, щоб вони
    // не збігалися з домішковими вузлами.
    const brokenBonds = new Set(NODE_ORDER.slice(NODE_ORDER.length - broken));

    // Ковалентні зв'язки: подвійна лінія з двома електронами посередині.
    for (const node of nodes) {
      for (const [dc, dr] of [
        [1, 0],
        [0, 1],
      ]) {
        const next = nodes.find((n) => n.col === node.col + dc && n.row === node.row + dr);
        if (!next) continue;
        const index = nodes.indexOf(node);
        const isBroken = brokenBonds.has(index) && dc === 1;
        const color = isBroken ? PALETTE.bondBroken : PALETTE.bond;
        const off = dc === 1 ? 2 : 0;
        const offY = dc === 1 ? 0 : 2;
        line(ctx, node.x + offY, node.y + off, next.x + offY, next.y + off, color);
        line(ctx, node.x - offY, node.y - off, next.x - offY, next.y - off, color);

        if (!isBroken) {
          const mx = Math.round((node.x + next.x) / 2);
          const my = Math.round((node.y + next.y) / 2);
          px(ctx, mx + offY, my + off, PALETTE.bondElectron);
          px(ctx, mx - offY, my - off, PALETTE.bondElectron);
        }
      }
    }

    // Атоми: кремній сірий, домішка кольорова із знаком іона всередині.
    nodes.forEach((node, index) => {
      const isDopant = dopantNodes.has(index);
      if (!isDopant) {
        disc(ctx, node.x, node.y, 3, PALETTE.siShell);
        disc(ctx, node.x, node.y, 1, PALETTE.siCore);
        return;
      }

      const donor = dopant === DOPANT.donor;
      disc(ctx, node.x, node.y, 4, donor ? PALETTE.donor : PALETTE.acceptor);
      disc(ctx, node.x, node.y, 2, PALETTE.crystalDeep);
      // Знак нерухомого іона: донор віддав електрон і став «+»,
      // акцептор захопив електрон і став «−».
      rect(ctx, node.x - 1, node.y, 3, 1, donor ? PALETTE.donorIon : PALETTE.acceptorIon);
      if (donor) rect(ctx, node.x, node.y - 1, 1, 3, PALETTE.donorIon);
      ring(ctx, node.x, node.y, 4, donor ? PALETTE.donorIon : PALETTE.acceptorIon);
    });
  }

  return { draw, nodes, dopantNodeCount };
}

/** Скільки розірваних зв'язків намалювати — логарифмічно від n_i. */
export function brokenBondCount(ni) {
  if (!(ni > 1e9)) return 0;
  return Math.max(0, Math.min(8, Math.round((Math.log10(ni) - 9) * 1.2)));
}
