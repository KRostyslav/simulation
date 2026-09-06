/**
 * Панель завдань. Перевіряються пасивно на кожному перерахунку й нічого
 * не блокують: завдання — привід зробити конкретний експеримент, а не
 * пропуск до наступного рівня.
 *
 * Теорія показується тільки після виконання — саме тоді студент найкраще
 * готовий її прочитати, бо щойно сам побачив ефект.
 */

import { el, showToast } from "@edu/pixel-ui";

import { TASKS } from "../data/tasks.js";

export function createTasks({ done, onCodex, onAchieved, onGoTo }) {
  const achieved = new Set(done ?? []);
  const root = el("section", "goals");

  const head = el("div", "goals__head");
  head.append(el("h3", "goals__title", "Завдання для дослідження"));
  const counter = el("span", "goals__counter");
  head.append(counter);

  const list = el("ul", "goals__list");
  const items = new Map();

  for (const task of TASKS) {
    const li = el("li", "goal");

    const button = el("button", "goal__head");
    button.type = "button";
    button.append(el("span", "goal__mark"));
    button.append(el("span", "goal__title", task.title));
    button.addEventListener("click", () => {
      li.dataset.open = li.dataset.open === "1" ? "" : "1";
      button.setAttribute("aria-expanded", li.dataset.open === "1" ? "true" : "false");
    });
    button.setAttribute("aria-expanded", "false");

    const body = el("div", "goal__body");
    body.append(el("p", "goal__task", task.task));

    const go = el("button", "goal__link", "Перейти до режиму →");
    go.type = "button";
    go.addEventListener("click", () => onGoTo?.(task.mode));

    const theory = el("p", "goal__theory", task.theory);
    const link = el("button", "goal__link", "Теорія →");
    link.type = "button";
    link.addEventListener("click", () => onCodex?.(task.codexRef));

    body.append(go, theory, link);
    li.append(button, body);
    list.append(li);
    items.set(task.id, { li, theory });
  }

  root.append(head, list);

  function paint() {
    counter.textContent = `${achieved.size} / ${TASKS.length}`;
    for (const [id, item] of items) {
      const on = achieved.has(id);
      item.li.dataset.done = on ? "1" : "";
      item.theory.hidden = !on;
    }
  }

  function update(snapshot) {
    let fresh = false;
    for (const task of TASKS) {
      if (achieved.has(task.id)) continue;
      let ok = false;
      try {
        ok = task.check({ snapshot });
      } catch {
        // Завдання, що спіткнулось об неповні дані, не має права ламати кадр.
        ok = false;
      }
      if (!ok) continue;
      achieved.add(task.id);
      fresh = true;
      items.get(task.id).li.dataset.open = "1";
      showToast({ title: `Виконано: ${task.title}`, text: task.theory });
    }
    if (fresh) {
      paint();
      onAchieved?.([...achieved]);
    }
  }

  paint();
  return {
    root,
    update,
    get achieved() {
      return [...achieved];
    },
  };
}
