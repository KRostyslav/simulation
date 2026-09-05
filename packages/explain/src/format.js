/**
 * Форматування чисел для української наукової нотації.
 *
 * У фізиці напівпровідників діапазон величин — від 10⁻¹⁵ А до 10¹⁹ см⁻³.
 * `toExponential` дав би «1.00e+16», що читається як код, а не як фізика.
 * Тому мантиса форматується з комою (українська норма), а степінь —
 * справжніми надрядковими символами.
 */

const SUPERSCRIPT = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
};

/** Ціле число надрядковими символами: -19 → "⁻¹⁹". */
export function superscript(n) {
  return String(n)
    .split("")
    .map((ch) => SUPERSCRIPT[ch] ?? ch)
    .join("");
}

/** Десяткове число з комою як роздільником. */
export function decimal(value, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(digits).replace(".", ",");
}

/** Наукова нотація: 1,0e16 → "1,00·10¹⁶". Нуль лишається нулем. */
export function sci(value, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  let exp = Math.floor(Math.log10(abs));
  let mantissa = abs / 10 ** exp;
  // Округлення мантиси може викинути її за межу декади (9,999 → 10,00).
  if (Number(mantissa.toFixed(digits)) >= 10) {
    mantissa /= 10;
    exp += 1;
  }
  return `${sign}${decimal(mantissa, digits)}·10${superscript(exp)}`;
}

/**
 * Читабельний вибір нотації: у «людському» діапазоні звичайне число,
 * поза ним — наукова нотація. 1248 краще читати як 1248, а не як 1,25·10³.
 */
export function smart(value, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs >= 0.01 && abs < 10000) {
    const d = abs >= 100 ? 0 : abs >= 10 ? 1 : digits;
    return decimal(value, d);
  }
  return sci(value, digits);
}

/**
 * Струм із автоматичним підбором приставки: 5e-15 А → "5,00 фА".
 * Без цього шкала струмів діода (від фемтоампер до міліампер) нечитабельна.
 */
const PREFIXES = [
  { min: 1, symbol: "" },
  { min: 1e-3, symbol: "м" },
  { min: 1e-6, symbol: "мк" },
  { min: 1e-9, symbol: "н" },
  { min: 1e-12, symbol: "п" },
  { min: 1e-15, symbol: "ф" },
];

export function withPrefix(value, unit, digits = 2) {
  if (!Number.isFinite(value)) return `— ${unit}`;
  if (value === 0) return `0 ${unit}`;
  const abs = Math.abs(value);
  if (abs >= 1000) return `${sci(value, digits)} ${unit}`;
  const found = PREFIXES.find((p) => abs >= p.min);
  if (!found) return `${sci(value, digits)} ${unit}`;
  return `${decimal(value / found.min, digits)} ${found.symbol}${unit}`;
}

/** Скільки разів: 700000 → "у 700 тис. разів". Для побутових формулювань. */
export function times(ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0) return "—";
  if (ratio < 10) return `у ${decimal(ratio, 1)} раза`;
  if (ratio < 1000) return `у ${Math.round(ratio)} разів`;
  if (ratio < 1e6) return `у ${Math.round(ratio / 1000)} тис. разів`;
  if (ratio < 1e9) return `у ${Math.round(ratio / 1e6)} млн разів`;
  return `у ${sci(ratio, 1)} разів`;
}

/** Скільки порядків розділяє два числа — основна міра «наскільки змінилось». */
export function decades(from, to) {
  if (!(from > 0) || !(to > 0)) return 0;
  return Math.log10(to) - Math.log10(from);
}
