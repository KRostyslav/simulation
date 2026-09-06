/** Таблиця вимірювань: чиста робота з масивом точок. */

import test from "node:test";
import assert from "node:assert/strict";

import {
  emptyTable,
  seriesKey,
  parseSeriesKey,
  addPoint,
  removePoint,
  clearSeries,
  seriesOf,
  seriesList,
  totalPoints,
  MAX_POINTS,
} from "../src/physics/measurements.js";

const key = seriesKey({ deviceId: "si", temperature: 300 });
const point = (voltage, current) => ({ voltage, current, resolutionU: 1e-3 });

test("точки зберігаються впорядкованими за напругою", () => {
  let table = emptyTable();
  for (const v of [0.7, 0.3, 0.5]) table = addPoint(table, key, point(v, v * 1e-3));
  assert.deepEqual(
    seriesOf(table, key).map((p) => p.voltage),
    [0.3, 0.5, 0.7],
  );
});

test("повторне вимірювання тієї самої напруги замінює попереднє", () => {
  let table = addPoint(emptyTable(), key, point(0.6, 1e-3));
  table = addPoint(table, key, point(0.6, 2e-3));
  const list = seriesOf(table, key);
  assert.equal(list.length, 1, "двох різних струмів при одній напрузі бути не може");
  assert.equal(list[0].current, 2e-3, "лишається свіжіше вимірювання");
});

test("близькі, але різні напруги лишаються різними точками", () => {
  let table = addPoint(emptyTable(), key, point(0.6, 1e-3));
  table = addPoint(table, key, point(0.62, 1.5e-3));
  assert.equal(seriesOf(table, key).length, 2);
});

test("серії різних приладів і температур не змішуються", () => {
  const ge = seriesKey({ deviceId: "ge", temperature: 300 });
  const hot = seriesKey({ deviceId: "si", temperature: 350 });
  let table = addPoint(emptyTable(), key, point(0.6, 1e-3));
  table = addPoint(table, ge, point(0.3, 1e-3));
  table = addPoint(table, hot, point(0.55, 1e-3));
  assert.equal(seriesList(table).length, 3);
  assert.equal(totalPoints(table), 3);
  assert.deepEqual(parseSeriesKey(hot), { deviceId: "si", temperature: 350 });
});

test("вилучення й очищення працюють і не псують інших серій", () => {
  const ge = seriesKey({ deviceId: "ge", temperature: 300 });
  let table = addPoint(emptyTable(), key, point(0.6, 1e-3));
  table = addPoint(table, key, point(0.7, 2e-3));
  table = addPoint(table, ge, point(0.3, 1e-3));

  table = removePoint(table, key, 0);
  assert.equal(seriesOf(table, key).length, 1);
  assert.equal(seriesOf(table, ge).length, 1);

  table = clearSeries(table, key);
  assert.equal(seriesOf(table, key).length, 0);
  assert.equal(seriesOf(table, ge).length, 1);
});

test("вилучення неіснуючого індексу нічого не ламає", () => {
  const table = addPoint(emptyTable(), key, point(0.6, 1e-3));
  assert.equal(removePoint(table, key, 5), table);
  assert.equal(removePoint(table, "немає", 0), table);
});

test("серія не росте нескінченно", () => {
  let table = emptyTable();
  for (let i = 0; i < MAX_POINTS + 20; i += 1) {
    table = addPoint(table, key, point(0.3 + i * 0.005, 1e-6 * i));
  }
  assert.equal(seriesOf(table, key).length, MAX_POINTS);
});
