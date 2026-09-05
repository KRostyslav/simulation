/**
 * Фіксована палітра. Обмежений набір кольорів — головна ознака піксель-арту:
 * усе, що малюється, бере колір звідси, і сцена автоматично лишається цілісною.
 *
 * Кольори носіїв заряду навмисно контрастні між собою (холодний синій проти
 * теплого червоного): електрон і дірка — протилежні за знаком, і глядач має
 * розрізняти їх периферійним зором, не читаючи легенду щоразу.
 */
export const PALETTE = {
  // тло й кристал
  void: "#0e1218",
  crystal: "#141b24",
  crystalDeep: "#0b0f14",

  // атоми кремнію та ковалентні зв'язки
  siCore: "#5d7285",
  siShell: "#41566a",
  bond: "#2f4356",
  bondBroken: "#4a3128",
  bondElectron: "#7d93a8",

  // вільні носії заряду
  electron: "#4fc3f7",
  electronGlow: "#a6e4ff",
  hole: "#ff7043",
  holeGlow: "#ffb59a",

  // домішкові атоми та їхні нерухомі іони
  donor: "#8bc34a",
  donorIon: "#c5e1a5",
  acceptor: "#ba68c8",
  acceptorIon: "#e1bee7",

  // p-n перехід
  regionP: "#2a1a24",
  regionN: "#16242a",
  depletion: "#1f2b38",
  depletionEdge: "#3d5a72",
  fieldArrow: "#ffd54f",

  // графіки та службове
  axis: "#546e7a",
  grid: "#22303c",
  curve: "#ffd54f",
  curveAlt: "#ef5350",
  marker: "#ffffff",
  dim: "#37474f",

  // підсвітки подій
  flashGen: "#fff59d",
  flashRec: "#ff8a65",
};

/** Тепліше світіння кристала при нагріванні — суто візуальний натяк на T. */
export function crystalTint(temperatureK) {
  if (temperatureK >= 600) return "#241a1a";
  if (temperatureK >= 450) return "#1d1a1e";
  if (temperatureK <= 150) return "#101a24";
  return PALETTE.crystal;
}
