/**
 * Цілі. Перевіряються пасивно на кожному перерахунку моделі й нічого
 * не блокують: пісочниця лишається пісочницею, а ціль — лише приводом
 * зробити конкретний експеримент.
 *
 * Виконання показуємо тостом і розкриваємо теорію — саме в цей момент
 * гравець найкраще готовий її прочитати, бо щойно сам побачив ефект.
 */

import { el, showToast } from "@edu/pixel-ui";

import { GOALS, GOALS_BY_ID, achievedGoals } from "../data/goals.js";

export function createGoalPanel({ done, onCodex, onAchieved }) {
  const achieved = new Set(done ?? []);
  const root = el("section", "goals");
  const head = el("div", "goals__head");
  const title = el("h3", "goals__title", "Завдання");
  const counter = el("span", "goals__counter");
  head.append(title, counter);

  const list = el("ul", "goals__list");
  const items = new Map();

  for (const goal of GOALS) {
    const li = el("li", "goal");
    const button = el("button", "goal__head");
    button.type = "button";
    button.append(el("span", "goal__mark"));
    button.append(el("span", "goal__title", goal.title));
    const body = el("div", "goal__body");
    body.append(el("p", "goal__task", goal.task));
    const theory = el("p", "goal__theory", goal.theory);
    const link = el("button", "goal__link", "Теорія →");
    link.type = "button";
    link.addEventListener("click", () => onCodex(goal.codexRef));
    body.append(theory, link);

    button.addEventListener("click", () => {
      li.dataset.open = li.dataset.open === "1" ? "" : "1";
      button.setAttribute("aria-expanded", li.dataset.open === "1" ? "true" : "false");
    });
    button.setAttribute("aria-expanded", "false");

    li.append(button, body);
    list.append(li);
    items.set(goal.id, { li, theory });
  }

  root.append(head, list);

  function paint() {
    counter.textContent = `${achieved.size} / ${GOALS.length}`;
    for (const [id, item] of items) {
      const on = achieved.has(id);
      item.li.dataset.done = on ? "1" : "";
      // Теорія — нагорода за виконання, тому до нього її не показуємо.
      item.theory.hidden = !on;
    }
  }

  function update(snapshot) {
    let fresh = false;
    for (const id of achievedGoals(snapshot)) {
      if (achieved.has(id)) continue;
      achieved.add(id);
      fresh = true;
      const goal = GOALS_BY_ID[id];
      items.get(id).li.dataset.open = "1";
      showToast({ title: `Виконано: ${goal.title}`, text: goal.theory });
    }
    if (fresh) {
      paint();
      onAchieved?.([...achieved]);
    }
  }

  paint();
  return { root, update, get achieved() {
    return [...achieved];
  } };
}
