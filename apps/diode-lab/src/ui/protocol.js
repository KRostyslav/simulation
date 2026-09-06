/**
 * Хід роботи в модальному вікні.
 *
 * Кожен крок — не абзац тексту, а кнопка: клік переводить застосунок у
 * потрібний режим і виставляє початковий стан регуляторів. Інакше студент
 * читав би інструкцію в одному місці, а шукав відповідну ручку в іншому.
 *
 * Галочки «виконано» ставить сам студент і вони зберігаються між сеансами:
 * лабораторну рідко роблять за один присід.
 */

import { el, createModal } from "@edu/pixel-ui";

import { PROTOCOL } from "../data/protocol.js";

export function createProtocol({ done, onGoTo, onToggle }) {
  const modal = createModal({ title: PROTOCOL.title, wide: true });
  const checked = new Set(done ?? []);

  const layout = el("div", "protocol");

  const goal = el("section", "protocol__section");
  goal.append(el("h3", "protocol__heading", "Мета роботи"));
  goal.append(el("p", "protocol__text", PROTOCOL.goal));

  const equipment = el("section", "protocol__section");
  equipment.append(el("h3", "protocol__heading", "Обладнання"));
  const equipmentList = el("ul", "protocol__list");
  for (const item of PROTOCOL.equipment) {
    equipmentList.append(el("li", "protocol__item", item));
  }
  equipment.append(equipmentList);
  equipment.append(el("h3", "protocol__heading", "Схема установки"));
  equipment.append(el("p", "protocol__text", PROTOCOL.scheme));

  const steps = el("section", "protocol__section");
  steps.append(el("h3", "protocol__heading", "Порядок виконання"));
  const stepList = el("ol", "protocol__steps");
  const items = new Map();

  for (const step of PROTOCOL.steps) {
    const li = el("li", "step");

    const mark = el("button", "step__mark");
    mark.type = "button";
    mark.setAttribute("aria-label", `Позначити виконаним: ${step.title}`);
    mark.addEventListener("click", () => {
      if (checked.has(step.id)) checked.delete(step.id);
      else checked.add(step.id);
      paint();
      onToggle?.([...checked]);
    });

    const title = el("button", "step__title", step.title);
    title.type = "button";
    title.title = "Перейти до цього кроку";
    title.addEventListener("click", () => {
      onGoTo?.(step);
      modal.hide();
    });

    const head = el("div", "step__head");
    head.append(mark, title);

    const body = el("div", "step__body");
    body.append(el("p", "step__what", step.what));
    if (step.record) {
      body.append(el("p", "step__record", `Занести у звіт: ${step.record}`));
    }
    if (step.note) body.append(el("p", "step__note", step.note));

    li.append(head, body);
    stepList.append(li);
    items.set(step.id, li);
  }
  steps.append(stepList);

  const report = el("section", "protocol__section");
  report.append(el("h3", "protocol__heading", "Зміст звіту"));
  const reportList = el("ul", "protocol__list");
  for (const item of PROTOCOL.report) reportList.append(el("li", "protocol__item", item));
  report.append(reportList);

  const questions = el("section", "protocol__section");
  questions.append(el("h3", "protocol__heading", "Контрольні запитання"));
  const questionList = el("ol", "protocol__list");
  for (const item of PROTOCOL.questions) {
    questionList.append(el("li", "protocol__item", item));
  }
  questions.append(questionList);

  layout.append(goal, equipment, steps, report, questions);
  modal.body.append(layout);

  function paint() {
    for (const [id, li] of items) li.dataset.done = checked.has(id) ? "1" : "";
    modal.heading.textContent = `${PROTOCOL.title} — виконано ${checked.size} з ${PROTOCOL.steps.length}`;
  }

  paint();
  return { show: modal.show, hide: modal.hide, paint };
}
