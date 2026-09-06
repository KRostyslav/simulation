/**
 * Панель обробки результатів: великі числа, які студент переписує у звіт,
 * поруч із тим, що каже теорія.
 *
 * Порівняння «виміряно / теорія» стоїть у кожній картці навмисно. Мета
 * роботи — не отримати «правильне» число, а побачити, наскільки й чому
 * виміряне від нього відрізняється.
 */

import { el } from "@edu/pixel-ui";
import { decimal, withPrefix } from "@edu/explain";

export function createAnalysis({ onCodex }) {
  const root = el("section", "analysis");
  root.append(el("h3", "panel__title", "Результати обробки"));

  const body = el("div", "analysis__cards");
  const hint = el(
    "p",
    "analysis__hint",
    "Запишіть щонайменше чотири точки прямої вітки — і тут з'являться n, I_s, r_дин і U_пор.",
  );
  root.append(hint, body);

  function card({ label, value, expected, verdict, codexRef, note }) {
    const box = el("div", "result");
    if (verdict) box.dataset.verdict = verdict;
    box.append(el("span", "result__label", label));
    box.append(el("strong", "result__value", value));
    if (expected) box.append(el("span", "result__expected", expected));
    if (note) box.append(el("p", "result__note", note));
    if (codexRef) {
      const link = el("button", "result__link", "Теорія →");
      link.type = "button";
      link.addEventListener("click", () => onCodex?.(codexRef));
      box.append(link);
    }
    return box;
  }

  function update(snapshot) {
    const { fit, decade, rDyn, threshold, tangent, region } = snapshot.analysis;
    body.textContent = "";
    hint.hidden = Boolean(fit);
    if (!fit) return;

    body.append(
      card({
        label: "Коефіцієнт ідеальності n",
        value: decimal(fit.ideality, 3),
        expected: `± ${decimal(fit.sigmaIdeality, 3)} · очікується 1…2`,
        verdict: fit.ideality > 0.9 && fit.ideality < 2.1 ? "ok" : "warn",
        codexRef: "ideality",
      }),
    );

    body.append(
      card({
        label: "Струм насичення I_s",
        value: withPrefix(fit.is, "А"),
        expected: `теорія ${withPrefix(snapshot.op.is, "А")}`,
        note:
          "Розбіжність у рази — очікуваний результат: систематична похибка приладу зсуває пряму паралельно.",
        codexRef: "measurement",
      }),
    );

    if (decade) {
      body.append(
        card({
          label: "Напруга на декаду струму",
          value: `${decimal(decade.measured, 1)} мВ`,
          expected: `теорія ${decimal(decade.theory, 1)} мВ · різниця ${decimal(decade.deviation, 0)} %`,
          verdict: decade.verdict === "збігається" ? "ok" : "warn",
          codexRef: "decade60",
        }),
      );
    }

    if (rDyn) {
      const statik = rDyn.at.voltage / rDyn.at.current;
      body.append(
        card({
          label: "Динамічний опір r_дин",
          value: `${decimal(rDyn.r, 1)} Ом`,
          expected: `при I = ${withPrefix(rDyn.at.current, "А")} · статичний U/I = ${decimal(statik, 0)} Ом`,
          codexRef: "dynamicResistance",
        }),
      );
    }

    if (threshold?.voltage != null) {
      body.append(
        card({
          label: "Порогова напруга U_пор",
          value: `${decimal(threshold.voltage, 3)} В`,
          expected: tangent
            ? `за струмом 1 мА · методом дотичної ${decimal(tangent.voltage, 3)} В`
            : "за опорним струмом 1 мА",
          codexRef: "threshold",
        }),
      );
    }

    body.append(
      card({
        label: "Якість апроксимації r²",
        value: decimal(fit.r2, 5),
        expected: `${region.used.length} точок · ${decimal(region.decades, 1)} декади струму`,
        verdict: fit.r2 > 0.99 ? "ok" : "warn",
        codexRef: "leastSquares",
      }),
    );
  }

  return { root, update };
}
