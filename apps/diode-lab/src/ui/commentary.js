/**
 * Живий коментар під сценою: що щойно змінилося і чому.
 *
 * Стоїть під канвою, а не в бічній колонці, бо відповідає на питання
 * «що я щойно зробив». Числа беруться з того самого знімка, який намалював
 * графік, тому розійтися з ним коментар не може.
 *
 * aria-live="polite" — щоб зміну прочитав скрінрідер, але не перебиваючи
 * студента посеред перетягування повзунка.
 */

import { el } from "@edu/pixel-ui";

import { pickRule } from "../data/rules.js";

const INTRO = {
  headline: "Стенд зібрано",
  mechanism:
    "Підвищуйте ЕРС і записуйте точки. Біля порогу рухайте регулятор повільно: там кожні " +
    "60 мілівольт змінюють струм у десять разів, і саме ця ділянка потрібна для обробки.",
  codexRef: "pnJunction",
};

export function createCommentary({ onCodex }) {
  const root = el("section", "comment");
  root.setAttribute("aria-live", "polite");

  const headline = el("h2", "comment__headline");
  const mechanism = el("p", "comment__mechanism");
  const link = el("button", "comment__link", "Теорія →");
  link.type = "button";
  link.hidden = true;
  root.append(headline, mechanism, link);

  let currentRef = null;
  let lastId = null;
  link.addEventListener("click", () => currentRef && onCodex?.(currentRef));

  function paint(id, text, ref) {
    headline.textContent = text.headline;
    mechanism.textContent = text.mechanism;
    currentRef = ref ?? null;
    link.hidden = !currentRef;

    // Спалах лише тоді, коли коментар справді змінився: миготіння на кожному
    // русі повзунка дратувало б і нічого не додавало.
    if (id !== lastId) {
      root.classList.remove("comment--fresh");
      // Перезапуск анімації: без читання offsetWidth браузер склеїть
      // зняття й повернення класу в один кадр, і анімація не програється.
      void root.offsetWidth;
      root.classList.add("comment--fresh");
      lastId = id;
    }
  }

  function update(previous, next, changedKey) {
    const rule = pickRule(changedKey, next, previous);
    if (!rule) {
      if (!lastId) paint("intro", INTRO, INTRO.codexRef);
      return;
    }
    paint(
      rule.id,
      {
        headline: rule.headline(next, previous),
        mechanism: rule.mechanism(next, previous),
      },
      rule.codexRef,
    );
  }

  paint("intro", INTRO, INTRO.codexRef);
  return { root, update };
}
