/**
 * Панель регуляторів. Набір змінюється залежно від режиму: у випрямлячі
 * немає ЕРС і резистора, зате є амплітуда, навантаження та ємність.
 */

import { el, createSlider, createSegmented } from "@edu/pixel-ui";

import { CONTROLS, DEVICE_OPTIONS, SCHEME_OPTIONS, controlsFor } from "../data/controls.js";
import { MODE } from "../physics/constants.js";

export function createControls({ state, onChange }) {
  const root = el("div", "controls");

  const device = createSegmented({
    label: "Досліджуваний прилад",
    options: DEVICE_OPTIONS,
    value: state.deviceId,
    onChange: (value) => onChange("deviceId", value),
  });

  const scheme = createSegmented({
    label: "Схема випрямляча",
    options: SCHEME_OPTIONS,
    value: state.bridge ? "bridge" : "half",
    onChange: (value) => onChange("bridge", value === "bridge"),
  });

  const sliders = new Map();
  for (const control of Object.values(CONTROLS)) {
    const slider = createSlider({
      label: control.label,
      hint: control.hint,
      steps: control.steps,
      position: control.positionOf(state[control.id]),
      valueAt: control.valueAt,
      format: control.format,
      onInput: (_position, value) => onChange(control.id, value),
    });
    sliders.set(control.id, slider);
  }

  root.append(device.root, scheme.root, ...[...sliders.values()].map((s) => s.root));

  /** Показати саме ті регулятори, що мають сенс у цьому режимі. */
  function refresh(next) {
    const visible = new Set(controlsFor(next.mode).map((c) => c.id));
    for (const [id, slider] of sliders) slider.root.hidden = !visible.has(id);
    scheme.root.hidden = next.mode !== MODE.rectifier;
    device.select(next.deviceId);
  }

  /** Підтягнути позиції повзунків під стан — після скидання чи переходу за протоколом. */
  function sync(next) {
    for (const [id, slider] of sliders) {
      slider.set(CONTROLS[id].positionOf(next[id]));
    }
    device.select(next.deviceId);
    scheme.select(next.bridge ? "bridge" : "half");
  }

  return { root, refresh, sync };
}
