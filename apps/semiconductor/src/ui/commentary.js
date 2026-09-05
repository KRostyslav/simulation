/**
 * Живий коментар — головна навчальна фіча застосунку.
 *
 * Розташований під канвою, по центру, а не в бічній колонці: саме він
 * відповідає на питання «що я щойно зробив і чому воно так подіяло».
 * Числа в ньому беруться з показників того самого знімка, тому розійтися
 * з панеллю коментар не може.
 *
 * aria-live="polite" — щоб зміну прочитав і скрінрідер, але не перебиваючи
 * гравця посеред перетягування повзунка.
 */

import { el } from "@edu/pixel-ui";
import { diffSnapshots } from "@edu/explain";

import { pickRule, describeState } from "../data/rules.js";

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
  link.addEventListener("click", () => currentRef && onCodex(currentRef));

  /**
   * @param prev       попередній знімок (може бути null на першому кадрі)
   * @param next       поточний знімок
   * @param changedKey яке поле стану змінив гравець
   */
  function update(prev, next, changedKey) {
    let comment;
    let ruleId = "intro";

    if (!prev || !changedKey) {
      // Перший кадр: описуємо те, що справді на екрані. Стан відновлюється
      // з localStorage, тому це може бути будь-що, а не чистий кремній.
      comment = describeState(next);
    } else {
      const changes = diffSnapshots(prev, next);
      const rule = pickRule({ prev, next, changedKey, changes });
      if (!rule) return;
      comment = rule.build({ prev, next, changedKey, changes });
      comment.codexRef = rule.codexRef;
      ruleId = rule.id;
    }

    headline.textContent = comment.headline;
    mechanism.textContent = comment.mechanism;
    currentRef = comment.codexRef;
    link.hidden = !currentRef;
    root.dataset.rule = ruleId;

    // Перезапуск підсвітки: без цього повторне спрацювання того самого
    // правила лишалося б непоміченим.
    root.classList.remove("comment--fresh");
    void root.offsetWidth;
    root.classList.add("comment--fresh");
  }

  return { root, update };
}
