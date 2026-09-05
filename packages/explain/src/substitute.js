/**
 * Підстановка чисел у символьну формулу.
 *
 * Формула пишеться з плейсхолдерами: "σ = q(n·{muN} + p·{muP})".
 * Значення підставляються з `terms`. Якщо плейсхолдер не має значення —
 * кидаємо помилку: мовчазне «{muN}» у навчальному тексті гірше за падіння,
 * бо учень побачить сміття й повірить йому.
 */

const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;

/** Імена всіх плейсхолдерів у шаблоні. */
export function placeholders(template) {
  const found = new Set();
  for (const match of String(template).matchAll(PLACEHOLDER)) found.add(match[1]);
  return [...found];
}

export function substitute(template, terms = {}) {
  const missing = placeholders(template).filter((name) => !(name in terms));
  if (missing.length > 0) {
    throw new Error(`У формулі "${template}" немає значень для: ${missing.join(", ")}`);
  }
  return String(template).replace(PLACEHOLDER, (_, name) => String(terms[name]));
}
