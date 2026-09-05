/**
 * DOM-віджети поверх канви. Навмисно без фреймворку: кожен віджет — функція,
 * що повертає елемент і метод оновлення.
 */

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * Повзунок, що зберігає ЦІЛУ позицію, а фізичне значення обчислює з неї
 * через `valueAt(pos)`.
 *
 * Це принципово: логарифмічний регулятор концентрації від 10¹² до 10¹⁹
 * при зберіганні дробового значення накопичував би похибку float і ніколи
 * не «прилипав» би до круглих 10¹⁶. З цілою позицією 10¹⁶ — це рівно позиція 40.
 */
export function createSlider({
  label,
  hint = "",
  steps,
  position = 0,
  valueAt,
  format,
  onInput,
}) {
  const root = el("div", "ctl");
  const head = el("div", "ctl__head");
  const name = el("label", "ctl__label", label);
  const shown = el("span", "ctl__value");
  head.append(name, shown);

  const input = el("input", "ctl__slider");
  input.type = "range";
  input.min = "0";
  input.max = String(steps);
  input.step = "1";
  input.value = String(position);
  const id = `ctl-${label.replace(/\s+/g, "-").toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`;
  input.id = id;
  name.htmlFor = id;

  root.append(head, input);
  if (hint) {
    const note = el("p", "ctl__hint", hint);
    note.id = `${id}-hint`;
    input.setAttribute("aria-describedby", note.id);
    root.append(note);
  }

  function paint(pos) {
    const value = valueAt(pos);
    const text = format(value);
    shown.textContent = text;
    // Скрінрідер має читати «1,0·10¹⁶ см⁻³», а не «позиція 40».
    input.setAttribute("aria-valuetext", `${label}: ${text}`);
    return value;
  }

  input.addEventListener("input", () => {
    const pos = Number(input.value);
    onInput?.(pos, paint(pos));
  });

  paint(position);

  return {
    root,
    input,
    get position() {
      return Number(input.value);
    },
    set(pos) {
      input.value = String(pos);
      paint(pos);
    },
  };
}

/** Перемикач із кількох взаємовиключних варіантів (тип домішки, режим, вид). */
export function createSegmented({ label, options, value, onChange }) {
  const root = el("div", "seg");
  if (label) root.append(el("span", "seg__label", label));
  const group = el("div", "seg__group");
  group.setAttribute("role", "radiogroup");
  if (label) group.setAttribute("aria-label", label);

  const buttons = options.map((option) => {
    const btn = el("button", "seg__btn", option.label);
    btn.type = "button";
    btn.dataset.value = option.value;
    btn.setAttribute("role", "radio");
    if (option.hint) btn.title = option.hint;
    btn.addEventListener("click", () => {
      select(option.value);
      onChange?.(option.value);
    });
    group.append(btn);
    return btn;
  });

  function select(next) {
    for (const btn of buttons) {
      const on = btn.dataset.value === next;
      btn.dataset.on = on ? "1" : "";
      btn.setAttribute("aria-checked", on ? "true" : "false");
    }
  }

  select(value);
  root.append(group);
  return { root, select };
}

/**
 * Рядок показника з трьома рівнями розкриття.
 *
 * Рівень 1 — саме число. Рівень 2 — механізм словами. Рівень 3 — формула
 * символьно й з підставленими числами. Пояснення беруться з самого Readout,
 * тому розійтися з розрахунком не можуть.
 */
export function createReadoutRow({ readout, level = 1 }) {
  const root = el("div", "ro");
  const head = el("button", "ro__head");
  head.type = "button";
  const sym = el("span", "ro__symbol", readout.symbol);
  const lbl = el("span", "ro__label", readout.label);
  const val = el("span", "ro__value");
  head.append(sym, lbl, val);

  const body = el("div", "ro__body");
  const why = el("p", "ro__why");
  const formula = el("p", "ro__formula");
  const substituted = el("p", "ro__substituted");
  body.append(why, formula, substituted);

  root.append(head, body);
  head.addEventListener("click", () => {
    root.dataset.open = root.dataset.open === "1" ? "" : "1";
    head.setAttribute("aria-expanded", root.dataset.open === "1" ? "true" : "false");
  });
  head.setAttribute("aria-expanded", "false");

  function update(next, nextLevel = level) {
    val.textContent = `${next.display}${next.unit ? ` ${next.unit}` : ""}`;
    val.title = next.display;
    why.textContent = next.why;
    formula.textContent = next.formula ?? "";
    substituted.textContent = next.substituted ?? "";
    formula.hidden = !next.formula || nextLevel < 3;
    substituted.hidden = !next.substituted || nextLevel < 3;
    why.hidden = nextLevel < 2;
    // На рівні 1 розкривати нічого — ховаємо саму кнопку розкриття.
    root.dataset.collapsible = nextLevel >= 2 ? "1" : "";
    if (nextLevel < 2) root.dataset.open = "";
    if (next.tone) root.dataset.tone = next.tone;
  }

  update(readout, level);
  return { root, update };
}

/** Модальне вікно. Закривається по Esc і кліку на тло — інакше воно дратує. */
export function createModal({ title, wide = false }) {
  const overlay = el("div", "modal__overlay");
  const box = el("div", `modal ${wide ? "modal--wide" : ""}`);
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  const head = el("header", "modal__head");
  const heading = el("h2", "modal__title", title);
  const close = el("button", "modal__close", "✕");
  close.type = "button";
  close.setAttribute("aria-label", "Закрити");
  head.append(heading, close);
  const body = el("div", "modal__body");
  box.append(head, body);
  overlay.append(box);

  function hide() {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  }

  function onKey(event) {
    if (event.key === "Escape") hide();
  }

  close.addEventListener("click", hide);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) hide();
  });

  function show(parent = document.body) {
    parent.append(overlay);
    document.addEventListener("keydown", onKey);
    close.focus();
  }

  return { overlay, body, heading, show, hide };
}

/** Ненав'язливе повідомлення, що само зникає. Нічого не блокує. */
export function showToast({ title, text, parent = document.body, ms = 7000 }) {
  let host = parent.querySelector(".toasts");
  if (!host) {
    host = el("div", "toasts");
    host.setAttribute("aria-live", "polite");
    parent.append(host);
  }
  const node = el("div", "toast");
  node.append(el("strong", "toast__title", title));
  if (text) node.append(el("p", "toast__text", text));
  host.append(node);
  setTimeout(() => node.remove(), ms);
  return node;
}

/** Легенда до канви: колірна мітка + пояснення, що вона означає. */
export function createLegend(items) {
  const root = el("ul", "legend");
  for (const item of items) {
    const li = el("li", "legend__item");
    const dot = el("span", "legend__dot");
    dot.style.background = item.color;
    if (item.shape) dot.dataset.shape = item.shape;
    li.append(dot, el("span", "legend__text", item.text));
    root.append(li);
  }
  return root;
}
