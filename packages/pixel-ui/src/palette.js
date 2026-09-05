/**
 * Фіксована палітра. Обмежений набір кольорів — головна ознака піксель-арту:
 * усе, що малюється, бере колір звідси, і сцена автоматично лишається цілісною.
 *
 * Тема світла, «паперова» — сцена має читатися як рисунок у підручнику, а не
 * як осцилограф. Наслідок для решти кольорів: носії заряду й домішки мусять
 * бути ТЕМНІШИМИ за тло, а не світитися на ньому. Тому сині та червоні тут
 * насичені й глибокі — світлі пастельні відтінки на паперовому тлі просто
 * зникли б, а це єдине, за чим гравець стежить очима.
 */
export const PALETTE = {
  // тло й кристал
  void: "#e5ded0",
  crystal: "#f2ede1",
  crystalDeep: "#e0d8c6",

  // атоми кремнію та ковалентні зв'язки
  siCore: "#4a4437",
  siShell: "#7b7261",
  bond: "#a89c84",
  bondBroken: "#d09a72",
  bondElectron: "#585044",

  // вільні носії заряду
  electron: "#12539e",
  electronGlow: "#5a93cf",
  hole: "#c8401a",
  holeGlow: "#f08050",

  // домішкові атоми та їхні нерухомі іони
  donor: "#4f9a3a",
  donorIon: "#1c5e1c",
  acceptor: "#8d4bb0",
  acceptorIon: "#54176e",

  // p-n перехід
  regionP: "#f6e4dc",
  regionN: "#dfeaf4",
  depletion: "#ece5d3",
  depletionEdge: "#968c76",
  fieldArrow: "#b0741a",

  // графіки та службове
  axis: "#6f6757",
  grid: "#cdc3ad",
  curve: "#b8430c",
  curveAlt: "#12539e",
  marker: "#2b2721",
  dim: "#a79c86",

  // підсвітки подій
  flashGen: "#d59413",
  flashRec: "#c8401a",
};

/** Ледь помітний зсув тону кристала за температурою — теплий/холодний натяк. */
export function crystalTint(temperatureK) {
  if (temperatureK >= 600) return "#f7e5d5";
  if (temperatureK >= 450) return "#f5eadb";
  if (temperatureK <= 150) return "#e6edf4";
  return PALETTE.crystal;
}
