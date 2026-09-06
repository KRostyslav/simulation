/**
 * Таблиця вимірювань — те, що студент накопичує сам.
 *
 * Модуль навмисно чистий: жодного DOM, лише операції над масивом точок.
 * Тому таблицю можна прогнати тестом, зберегти в localStorage і відновити,
 * не боячись, що при відновленні щось перерахується інакше.
 *
 * Точки лежать окремими СЕРІЯМИ. Серія — це «один діод при одній
 * температурі»: змішувати в одній апроксимації кремній із германієм або
 * 300 К із 350 К не можна, бо це різні характеристики, а не розкид.
 */

const MAX_POINTS = 60;

/** Ключ серії. Температуру округлюємо до градуса — точніше регулятор і не дає. */
export function seriesKey({ deviceId, temperature }) {
  return `${deviceId}@${Math.round(temperature)}`;
}

export function parseSeriesKey(key) {
  const [deviceId, temperature] = key.split("@");
  return { deviceId, temperature: Number(temperature) };
}

export function emptyTable() {
  return {};
}

export function seriesOf(table, key) {
  return table[key] ?? [];
}

/**
 * Додати виміряну точку.
 *
 * Дубльовану напругу ЗАМІНЮЄМО, а не додаємо другою: два різні струми при
 * одній напрузі — це не дві точки характеристики, а суперечність, і
 * апроксимація на ній перекосилася б. Збіг напруг у межах дискретності
 * приладу означає, що студент повторив вимірювання, — правильна реакція
 * на повтор — узяти свіжіше значення.
 */
export function addPoint(table, key, point) {
  const list = seriesOf(table, key);
  const tolerance = (point.resolutionU ?? 1e-9) / 2;
  const rest = list.filter((p) => Math.abs(p.voltage - point.voltage) > tolerance);
  const next = [...rest, point]
    .sort((a, b) => a.voltage - b.voltage)
    .slice(-MAX_POINTS);
  return { ...table, [key]: next };
}

export function removePoint(table, key, index) {
  const list = seriesOf(table, key);
  if (index < 0 || index >= list.length) return table;
  return { ...table, [key]: list.filter((_, i) => i !== index) };
}

export function clearSeries(table, key) {
  const next = { ...table };
  delete next[key];
  return next;
}

/** Скільки всього точок записано — для лічильника в панелі. */
export function totalPoints(table) {
  return Object.values(table).reduce((sum, list) => sum + list.length, 0);
}

/** Усі серії, впорядковані так, як їх записували. */
export function seriesList(table) {
  return Object.entries(table)
    .filter(([, list]) => list.length > 0)
    .map(([key, list]) => ({ key, ...parseSeriesKey(key), points: list }));
}

export { MAX_POINTS };
