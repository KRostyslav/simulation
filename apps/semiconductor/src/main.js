/**
 * Точка входу: збирає модель, сцену й UI в один цикл.
 *
 * Логіка одна й дуже проста: гравець рухає регулятор → змінюється поле стану →
 * модель повертає новий знімок → усі частини UI перемальовуються з нього.
 * Ніхто, крім моделі, не рахує фізику, і ніхто, крім знімка, не є джерелом
 * чисел — тому панель, коментар і картинка не можуть розійтися між собою.
 */

import "@edu/pixel-ui/pixel.css";
import "./style.css";

import { el, createSegmented, createLegend } from "@edu/pixel-ui";
import { createStorage } from "@edu/explain";

import { snapshot, initialState } from "./physics/model.js";
import { MODE } from "./physics/constants.js";
import { LEVEL_OPTIONS } from "./data/controls.js";
import { createScene, VIEW } from "./render/scene.js";
import { createControlPanel } from "./ui/controls.js";
import { createReadoutPanel, createWarningPanel } from "./ui/readouts.js";
import { createCommentary } from "./ui/commentary.js";
import { createCodex } from "./ui/codex.js";
import { createGoalPanel } from "./ui/goals.js";
import { createLabels, legendItems, SCALE_NOTE } from "./ui/labels.js";

const storage = createStorage("edu.semiconductor.v1");
const saved = storage.read({});

const state = { ...initialState(), ...(saved.state ?? {}) };
let level = saved.level ?? 2;
let view = VIEW.scene;
let logIv = false;
let previous = null;
let current = snapshot(state);

/* --------------------------------- сцена --------------------------------- */

const sceneHost = document.getElementById("scene");
const scene = createScene({ parent: sceneHost });
const labels = createLabels();
sceneHost.querySelector("#labels").remove();
sceneHost.append(labels.root);

// Підписи мусять точно накривати канву, а її розмір задає цілочисельний
// масштаб — тому копіюємо його щоразу, коли канва змінює розмір.
new ResizeObserver(() => {
  labels.root.style.width = scene.canvas.style.width;
  labels.root.style.height = scene.canvas.style.height;
}).observe(scene.canvas);

/* ------------------------------- елементи UI ------------------------------ */

const codex = createCodex();
const onCodex = (id) => codex.show(id);

const controls = createControlPanel({ state, onChange: change });
const readouts = createReadoutPanel({ onCodex });
const warnings = createWarningPanel({ onCodex });
const commentary = createCommentary({ onCodex });
const goals = createGoalPanel({
  done: saved.goals,
  onCodex,
  onAchieved: () => save(),
});

document.getElementById("controls").append(controls.root);
document.getElementById("readouts").append(readouts.root);
document.getElementById("warnings").append(warnings.root);
document.getElementById("commentary").replaceWith(commentary.root);
document.getElementById("goals").append(goals.root);

const modeSwitch = createSegmented({
  options: [
    { value: MODE.crystal, label: "Кристал", hint: "Однорідний зразок кремнію" },
    { value: MODE.junction, label: "p-n перехід", hint: "Дві області, стиснуті разом" },
  ],
  value: state.mode,
  onChange: (value) => change("mode", value),
});
document.getElementById("mode-host").append(modeSwitch.root);

const levelSwitch = createSegmented({
  options: LEVEL_OPTIONS,
  value: String(level),
  onChange: (value) => {
    level = Number(value);
    readouts.update(current, level);
    save();
  },
});
document.getElementById("level-host").append(levelSwitch.root);

const viewSwitch = createSegmented({
  options: [
    { value: VIEW.scene, label: "Кристал", hint: "Що відбувається всередині" },
    { value: VIEW.plot, label: "Графік", hint: "Залежність у координатах" },
  ],
  value: view,
  onChange: (value) => {
    view = value;
    scene.setView(view);
    refreshViewTools();
    labels.update(current, view, logIv);
  },
});
const viewHost = document.getElementById("view-host");
viewHost.append(viewSwitch.root);

// Тумблер логарифмічної шкали ВАХ — тільки там, де він щось означає.
const logToggle = el("label", "toggle");
const logInput = el("input");
logInput.type = "checkbox";
logInput.addEventListener("change", () => {
  logIv = logInput.checked;
  scene.setLogIv(logIv);
  labels.update(current, view, logIv);
});
logToggle.append(logInput, el("span", "toggle__text", "логарифмічна шкала струму"));
viewHost.append(logToggle);

function refreshViewTools() {
  logToggle.hidden = !(view === VIEW.plot && state.mode === MODE.junction);
}

const legendHost = document.getElementById("legend");
document.getElementById("scale-note").textContent = SCALE_NOTE;

/* ------------------------------- оновлення -------------------------------- */

function change(key, value) {
  if (state[key] === value) return;
  state[key] = value;
  render(key);
  if (key === "mode" || key === "dopant") controls.refresh();
  if (key === "mode") refreshViewTools();
  save();
}

function render(changedKey = null) {
  previous = current;
  current = snapshot(state);

  scene.setSnapshot(current);
  labels.update(current, view, logIv);
  readouts.update(current, level);
  warnings.update(current);
  commentary.update(previous, current, changedKey);
  goals.update(current);

  // Легенда залежить тільки від режиму, тому перебудовуємо її лише при зміні.
  if (legendHost.dataset.mode !== current.mode) {
    legendHost.dataset.mode = current.mode;
    legendHost.replaceChildren(...createLegend(legendItems(current.mode)).children);
  }
}

function save() {
  storage.write({ state, level, goals: goals.achieved });
}

/* --------------------------------- запуск --------------------------------- */

document.getElementById("codex-btn").addEventListener("click", () => codex.show());
document.getElementById("reset-btn").addEventListener("click", () => {
  Object.assign(state, initialState());
  controls.sync();
  modeSwitch.select(state.mode);
  refreshViewTools();
  render("mode");
  save();
});

scene.setSnapshot(current);
scene.setView(view);
scene.start();
controls.sync();
refreshViewTools();
render();
