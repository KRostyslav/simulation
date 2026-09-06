/**
 * Довідник у модальному вікні.
 *
 * Статті згруповані за темами, а перехресні посилання `see` перетворені
 * на кнопки: тему рідко можна зрозуміти з одного абзацу, і перехід
 * «формула Шоклі → коефіцієнт ідеальності → генерація» тут за один клік.
 */

import { el, createModal } from "@edu/pixel-ui";

import { CODEX, CODEX_BY_ID, TOPICS } from "../data/codex.js";

export function createCodex() {
  const modal = createModal({ title: "Довідник", wide: true });

  const nav = el("nav", "codex__nav");
  const article = el("article", "codex__article");
  const layout = el("div", "codex__layout");
  layout.append(nav, article);
  modal.body.append(layout);

  const buttons = new Map();
  for (const topic of TOPICS) {
    nav.append(el("h4", "codex__topic", topic));
    const list = el("ul", "codex__list");
    for (const item of CODEX.filter((a) => a.topic === topic)) {
      const li = el("li");
      const btn = el("button", "codex__link", item.title);
      btn.type = "button";
      btn.addEventListener("click", () => open(item.id));
      buttons.set(item.id, btn);
      li.append(btn);
      list.append(li);
    }
    nav.append(list);
  }

  function open(id) {
    const item = CODEX_BY_ID[id] ?? CODEX[0];
    article.replaceChildren();
    article.append(el("h3", "codex__heading", item.title));
    for (const paragraph of item.body) article.append(el("p", "codex__para", paragraph));

    if (item.see?.length) {
      const also = el("div", "codex__also");
      also.append(el("span", "codex__alsoLabel", "Далі:"));
      for (const ref of item.see) {
        const target = CODEX_BY_ID[ref];
        if (!target) continue;
        const btn = el("button", "codex__link codex__link--inline", target.title);
        btn.type = "button";
        btn.addEventListener("click", () => open(ref));
        also.append(btn);
      }
      article.append(also);
    }

    for (const [key, btn] of buttons) btn.dataset.on = key === item.id ? "1" : "";
    article.scrollTop = 0;
    modal.heading.textContent = `Довідник — ${item.topic}`;
  }

  return {
    show(id = CODEX[0].id) {
      open(id);
      modal.show();
    },
    hide: modal.hide,
  };
}
