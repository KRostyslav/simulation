/**
 * Точка входу лабораторної роботи.
 *
 * Принцип той самий, що і в сусідній симуляції монорепи: студент рухає
 * регулятор → змінюється поле стану → модель повертає новий знімок → усі
 * частини UI перемальовуються з нього. Ніхто, крім моделі, не рахує фізику,
 * і ніхто, крім знімка, не є джерелом чисел.
 *
 * Друге джерело істини тут — таблиця вимірювань. Вона теж входить у знімок,
 * бо обробка результатів рахується саме з неї, а не з теорії: у цьому й
 * полягає різниця між лабораторною роботою й демонстрацією.
 */

import "@edu/pixel-ui/pixel.css";
import "./style.css";

import { el, createSegmented } from "@edu/pixel-ui";
import { createStorage } from "@edu/explain";

import { MODE, MODE_OPTIONS, VIEW, VIEW_OPTIONS } from "./physics/constants.js";
import { snapshot, initialState } from "./physics/model.js";
import { operatingPoint } from "./physics/circuit.js";
import {
  emptyTable,
  addPoint,
  removePoint,
  clearSeries,
  seriesKey,
  parseSeriesKey,
} from "./physics/measurements.js";
import {
  createInstrument,
  measure,
  VOLTMETER,
  AMMETER,
} from "./physics/instrument.js";
import { mulberry32, seedFrom } from "./physics/random.js";
import { collectWarnings } from "./data/guards.js";

import { createScene } from "./render/scene.js";
import { createControls } from "./ui/controls.js";
import { createReadouts, createWarnings } from "./ui/readouts.js";
import { createTable } from "./ui/table.js";
import { createAnalysis } from "./ui/analysis.js";
import { createTasks } from "./ui/tasks.js";
import { createCommentary } from "./ui/commentary.js";
import { createCodex } from "./ui/codex.js";
import { createProtocol } from "./ui/protocol.js";
import { createLabels } from "./ui/labels.js";

/* ------------------------------ стан ------------------------------ */

const storage = createStorage("edu.diode-lab.v1");
const saved = storage.read({});

const state = { ...initialState(), ...(saved.state ?? {}) };
let table = saved.table ?? emptyTable();
let view = VIEW.circuit;
let logScale = false;
let showTheory = false;

/**
 * Екземпляри приладів. Seed зберігається разом із рештою стану, тому
 * систематична похибка «свого» амперметра лишається тією самою й після
 * перезавантаження — інакше вже записані точки перестали б узгоджуватись
 * із новими.
 */
const seed = saved.seed ?? Math.floor(Math.random() * 1e9);
const voltmeter = createInstrument(VOLTMETER, seed);
const ammeter = createInstrument(AMMETER, seed ^ 0x5f3759df);

let current = snapshot(state, table);
let previous = current;

/* ------------------------------ DOM ------------------------------ */

const scene = createScene({ parent: document.getElementById("scene") });
const labels = createLabels({ host: document.getElementById("labels") });

const codex = createCodex();
const openCodex = (id) => codex.show(id);

const protocol = createProtocol({
  done: saved.steps ?? [],
  onToggle: (steps) => save({ steps }),
  onGoTo: (step) => goToStep(step),
});

const controls = createControls({
  state,
  onChange: (key, value) => change(key, value),
});

const readouts = createReadouts({ onCodex: openCodex });
const warnings = createWarnings({ onCodex: openCodex });
const analysisPanel = createAnalysis({ onCodex: openCodex });
const commentary = createCommentary({ onCodex: openCodex });

const measurements = createTable({
  onRemove: (index) => {
    table = removePoint(table, current.seriesKey, index);
    render("record");
    save();
  },
  onClear: () => {
    table = clearSeries(table, current.seriesKey);
    render("record");
    save();
  },
  onSelectSeries: (key) => {
    const { deviceId, temperature } = parseSeriesKey(key);
    state.deviceId = deviceId;
    state.temperature = temperature;
    controls.sync(state);
    render("deviceId");
    save();
  },
});

const tasks = createTasks({
  done: saved.tasks ?? [],
  onCodex: openCodex,
  onAchieved: (done) => save({ tasks: done }),
  onGoTo: (mode) => change("mode", mode),
});

document.getElementById("controls").append(controls.root);
document.getElementById("readouts-host").append(readouts.root);
document.getElementById("warnings").append(warnings.root);
document.getElementById("table").append(measurements.root);
document.getElementById("analysis").append(analysisPanel.root);
document.getElementById("tasks").append(tasks.root);
document.getElementById("commentary").append(commentary.root);

/* --------------------------- перемикачі --------------------------- */

const modeSwitch = createSegmented({
  options: MODE_OPTIONS,
  value: state.mode,
  onChange: (value) => change("mode", value),
});
document.getElementById("mode-host").append(modeSwitch.root);

const viewSwitch = createSegmented({
  label: "Показати",
  options: VIEW_OPTIONS,
  value: view,
  onChange: (value) => {
    view = value;
    scene.setView(value);
    render();
  },
});

const logToggle = toggle("логарифмічна шкала струму", false, (on) => {
  logScale = on;
  scene.setOptions({ log: on });
  render();
});

const theoryToggle = toggle("показати теоретичну криву", false, (on) => {
  showTheory = on;
  scene.setOptions({ theory: on });
  render();
});

const viewHost = document.getElementById("view-host");
viewHost.append(viewSwitch.root, logToggle.root, theoryToggle.root);

function toggle(text, value, onChange) {
  const root = el("label", "toggle");
  const input = el("input");
  input.type = "checkbox";
  input.checked = value;
  input.addEventListener("change", () => onChange(input.checked));
  root.append(input, el("span", "", text));
  return { root, input };
}

/* -------------------------- запис точки --------------------------- */

const recordButton = el("button", "btn btn--primary actions__record", "Записати точку");
recordButton.type = "button";
recordButton.addEventListener("click", recordPoint);

const recordHint = el(
  "span",
  "actions__hint",
  "або натисніть пробіл — точка запишеться з поточними показами приладів",
);
const actionsHost = document.getElementById("actions");
actionsHost.append(recordButton, recordHint);

/**
 * Записати поточну робочу точку так, як її бачать прилади.
 *
 * Seed вимірювання виводиться з самої точки, а не з лічильника: тоді
 * повторний запис тієї самої напруги дає той самий показ, і студент бачить,
 * що прилад стабільний, а не «щоразу інший».
 */
function recordPoint() {
  const op = operatingPoint({
    device: current.device,
    temperature: state.temperature,
    emf: state.emf,
    resistance: state.resistance,
  });

  const rng = mulberry32(seedFrom(state.emf, state.temperature, state.resistance));
  const u = measure(voltmeter, op.diodeVoltage, rng);
  const i = measure(ammeter, op.current, rng);

  if (u.overload || i.overload) {
    warnings.update([
      {
        id: "overload",
        tone: "bad",
        title: "Прилад перевантажено",
        text: "Значення поза межами шкали — точку не записано. Зменште ЕРС або візьміть більший резистор.",
        codexRef: "measurement",
      },
    ]);
    return;
  }

  table = addPoint(table, current.seriesKey, {
    voltage: u.display,
    current: i.display,
    counts: i.counts,
    resolutionU: u.resolution,
    resolutionI: i.resolution,
  });
  render("record");
  save();
}

document.addEventListener("keydown", (event) => {
  if (event.code !== "Space") return;
  // Пробіл на кнопці чи повзунку має лишатись пробілом, а не дублювати запис.
  const tag = event.target?.tagName;
  if (tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA") return;
  if (state.mode === MODE.rectifier) return;
  event.preventDefault();
  recordPoint();
});

/* ------------------------------ кнопки ------------------------------ */

document.getElementById("codex-btn").addEventListener("click", () => codex.show());
document.getElementById("protocol-btn").addEventListener("click", () => protocol.show());
document.getElementById("reset-btn").addEventListener("click", () => {
  Object.assign(state, initialState());
  table = emptyTable();
  controls.sync(state);
  modeSwitch.select(state.mode);
  render();
  save();
});

/* ------------------------------ цикл ------------------------------ */

function change(key, value) {
  if (state[key] === value) return;
  state[key] = value;
  if (key === "mode") {
    // У випрямлячі немає ані ВАХ, ані таблиці — повертаємо вигляд до схеми,
    // інакше студент побачив би порожнє поле графіка.
    view = value === MODE.rectifier ? VIEW.circuit : view;
    viewSwitch.select(view);
    scene.setView(view);
    controls.refresh(state);
    modeSwitch.select(value);
  }
  render(key);
  save();
}

function render(changedKey = null) {
  previous = current;
  current = snapshot(state, table);
  current.warnings = collectWarnings(current);

  scene.setSnapshot(current);
  const data = scene.renderOnce(0);
  labels.update(current, view, data);

  readouts.update(current);
  warnings.update(current.warnings);
  measurements.update(current);
  analysisPanel.update(current);
  tasks.update(current);
  commentary.update(previous, current, changedKey);

  /*
   * У режимі випрямляча немає ані ВАХ, ані таблиці: там знімають осцилограму,
   * а не точки. Тому ховаємо все, що стосується запису й обробки, — інакше
   * кнопка «Записати точку» дописувала б точки в серію, якої студент зараз
   * не бачить.
   */
  const plotMode = current.mode !== MODE.rectifier;
  logToggle.root.hidden = !(plotMode && view !== VIEW.circuit);
  theoryToggle.root.hidden = !plotMode;
  viewSwitch.root.hidden = !plotMode;
  actionsHost.hidden = !plotMode;
  measurements.root.hidden = !plotMode;
  analysisPanel.root.hidden = !plotMode;
}

function goToStep(step) {
  Object.assign(state, step.preset ?? {});
  state.mode = step.mode;
  if (step.view) {
    view = step.view;
    viewSwitch.select(view);
    scene.setView(view);
  }
  controls.sync(state);
  controls.refresh(state);
  modeSwitch.select(state.mode);
  render("mode");
  save();
}

function save(extra = {}) {
  storage.write({
    state,
    table,
    seed,
    tasks: tasks.achieved,
    ...(saved.steps ? { steps: saved.steps } : {}),
    ...extra,
  });
}

/* ------------------------------ старт ------------------------------ */

// Шар підписів повторює розмір канви: канва масштабується цілими
// кратностями залежно від ширини вікна, і без цього підписи роз'їхались би.
new ResizeObserver(() => {
  labels.root.style.width = scene.canvas.style.width;
  labels.root.style.height = scene.canvas.style.height;
}).observe(scene.canvas);

scene.setSnapshot(current);
scene.setView(view);
scene.setOptions({ log: logScale, theory: showTheory });
scene.start();

controls.sync(state);
controls.refresh(state);
render();
