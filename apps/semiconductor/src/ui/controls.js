/**
 * Панель регуляторів. Кожен повзунок віддає ЦІЛУ позицію, а фізичне значення
 * бере з descriptor'а — див. коментар у data/controls.js про те, чому саме так.
 */

import { el, createSlider, createSegmented } from "@edu/pixel-ui";

import { CONTROLS, DOPANT_OPTIONS } from "../data/controls.js";
import { MODE } from "../physics/constants.js";
import { DOPANT } from "../physics/doping.js";

export function createControlPanel({ state, onChange }) {
  const root = el("div", "controls");
  const sliders = {};

  function addSlider(key, group) {
    const control = CONTROLS[key];
    const slider = createSlider({
      label: control.label,
      hint: control.hint,
      steps: control.steps,
      position: control.positionOf(state[key]),
      valueAt: control.valueAt,
      format: control.format,
      onInput: (_, value) => onChange(key, value),
    });
    sliders[key] = slider;
    group.append(slider.root);
    return slider;
  }

  /* --------------------------- спільна температура -------------------------- */

  const common = el("section", "controls__group");
  common.append(el("h3", "controls__title", "Умови"));
  addSlider("temperature", common);

  /* ------------------------------ режим кристала ---------------------------- */

  const crystal = el("section", "controls__group");
  crystal.append(el("h3", "controls__title", "Кристал"));

  const dopantSwitch = createSegmented({
    label: "Домішка",
    options: DOPANT_OPTIONS,
    value: state.dopant,
    onChange: (value) => {
      onChange("dopant", value);
      refresh();
    },
  });
  crystal.append(dopantSwitch.root);

  const dopingSlider = addSlider("doping", crystal);
  addSlider("suns", crystal);
  addSlider("voltage", crystal);

  /* ------------------------------ режим переходу ---------------------------- */

  const junction = el("section", "controls__group");
  junction.append(el("h3", "controls__title", "p-n перехід"));
  addSlider("junctionNa", junction);
  addSlider("junctionNd", junction);
  addSlider("bias", junction);

  root.append(common, crystal, junction);

  /** Приховуємо те, що в поточному режимі ні на що не впливає. */
  function refresh() {
    crystal.hidden = state.mode !== MODE.crystal;
    junction.hidden = state.mode !== MODE.junction;
    // Концентрація домішки без самої домішки нічого не означає.
    dopingSlider.root.hidden = state.dopant === DOPANT.none;
  }

  refresh();

  return {
    root,
    refresh,
    /** Повернути повзунки до значень стану — після завантаження чи скидання. */
    sync() {
      for (const [key, slider] of Object.entries(sliders)) {
        slider.set(CONTROLS[key].positionOf(state[key]));
      }
      dopantSwitch.select(state.dopant);
      refresh();
    },
  };
}
