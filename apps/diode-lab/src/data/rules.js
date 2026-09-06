/**
 * Живий коментар: одне речення про те, що щойно змінилося і чому.
 *
 * Правило вибирається за тим, який регулятор рухали останнім, — інакше
 * коментар щоразу писав би про найбільшу зміну, а гравець чекає пояснення
 * саме своєї дії.
 */

import { decimal, times, withPrefix } from "@edu/explain";

import { MODE } from "../physics/constants.js";

export const RULES = [
  {
    id: "emf-threshold",
    when: (key, snap, prev) =>
      key === "emf" && snap.op.current > 1e-6 && prev.op.current <= 1e-6,
    headline: () => "Діод відкрився",
    mechanism: (snap) =>
      `Зовнішня напруга нарешті помітно знизила потенціальний бар'єр, і струм зріс до ${withPrefix(snap.op.current, "А")}. ` +
      "Далі кожні 60 мВ збільшуватимуть його вдесятеро — саме тому ВАХ і називають експоненційною.",
    codexRef: "shockley",
  },
  {
    id: "emf-decade",
    when: (key, snap, prev) =>
      key === "emf" && prev.op.current > 1e-9 && snap.op.current / prev.op.current > 3,
    headline: (snap, prev) => `Струм зріс ${times(snap.op.current / prev.op.current)}`,
    mechanism: (snap, prev) =>
      `А напруга на діоді — лише на ${decimal((snap.op.diodeVoltage - prev.op.diodeVoltage) * 1000, 0)} мВ. ` +
      "Ось наочна різниця між діодом і резистором: у резистора струм і напруга ростуть однаково.",
    codexRef: "decade60",
  },
  {
    id: "emf-limited",
    when: (key, snap, prev) =>
      key === "emf" &&
      snap.op.regime === "обмежує резистор" &&
      prev.op.regime !== "обмежує резистор",
    headline: () => "Тепер струм задає резистор, а не діод",
    mechanism: (snap) =>
      `На резисторі падає вже ${decimal(snap.op.resistorVoltage, 2)} В із ${decimal(snap.emf, 2)} В джерела. ` +
      "Напруга на самому діоді майже перестала рости — далі вона змінюватиметься на десятки мілівольт, " +
      "хоч би скільки ви додавали ЕРС.",
    codexRef: "seriesResistance",
  },
  {
    id: "emf-breakdown",
    when: (key, snap, prev) => snap.op.regime === "пробій" && prev.op.regime !== "пробій",
    headline: () => "Настав зворотний пробій",
    mechanism: (snap) =>
      `Напруга на діоді зупинилась на ${decimal(Math.abs(snap.op.diodeVoltage), 2)} В і далі майже не росте, ` +
      "хоч би як збільшувалась ЕРС: усе зайве бере на себе резистор. Саме на цьому й побудована " +
      "стабілізація напруги.",
    codexRef: "zener",
  },
  {
    id: "temperature-shift",
    when: (key) => key === "temperature",
    headline: (snap, prev) =>
      snap.temperature > prev.temperature ? "Нагрівання зсунуло характеристику" : "Охолодження зсунуло характеристику",
    mechanism: (snap, prev) => {
      const dU = (snap.op.diodeVoltage - prev.op.diodeVoltage) * 1000;
      const dT = snap.temperature - prev.temperature;
      const rate = dT !== 0 ? dU / dT : 0;
      return (
        `При тій самій ЕРС напруга на діоді змінилась на ${decimal(dU, 1)} мВ, тобто ${decimal(rate, 1)} мВ на кельвін. ` +
        "Причина — струм насичення, який росте з температурою набагато швидше за тепловий потенціал."
      );
    },
    codexRef: "temperature",
  },
  {
    id: "device-change",
    when: (key) => key === "deviceId",
    headline: (snap) => `Установлено ${snap.device.label}`,
    mechanism: (snap) => snap.device.note,
    codexRef: "siVsGe",
  },
  {
    id: "resistance-change",
    when: (key) => key === "resistance",
    headline: (snap) => `Обмежувальний резистор ${snap.resistance} Ом`,
    mechanism: () =>
      "Резистор не змінює характеристики діода — він змінює те, які її ділянки вам доступні. " +
      "Більший опір розтягує придатний для обробки діапазон, менший дає більші струми.",
    codexRef: "measurement",
  },
  {
    id: "capacitance-change",
    when: (key, snap) => key === "capacitance" && snap.mode === MODE.rectifier,
    headline: (snap) =>
      snap.state.capacitance > 0 ? "Конденсатор згладжує пульсації" : "Конденсатор вимкнено",
    mechanism: (snap) =>
      snap.state.capacitance > 0
        ? `Коефіцієнт пульсацій ${decimal(snap.wave.rippleFactor * 100, 1)} %. Конденсатор віддає заряд, ` +
          "поки діод закритий, і напруга не встигає просісти до нуля."
        : "Без конденсатора напруга на навантаженні падає до нуля в кожній паузі — пульсації понад 100 %.",
    codexRef: "smoothing",
  },
  {
    id: "point-recorded",
    when: (key) => key === "record",
    headline: (snap) => `У таблиці ${snap.points.length} точок`,
    mechanism: (snap) => {
      const region = snap.analysis.region;
      if (!region.enough) {
        return "Для апроксимації потрібно щонайменше чотири придатні точки на прямій вітці.";
      }
      return (
        `В апроксимацію взято ${region.used.length}, охоплено ${decimal(region.decades, 1)} декади струму. ` +
        "Що ширший діапазон, то надійніший нахил, а з ним і коефіцієнт ідеальності."
      );
    },
    codexRef: "leastSquares",
  },
];

/** Перше правило, що спрацювало. Порядок у масиві — це і є пріоритет. */
export function pickRule(changedKey, snapshot, previous) {
  if (!changedKey || !previous) return null;
  for (const rule of RULES) {
    try {
      if (rule.when(changedKey, snapshot, previous)) return rule;
    } catch {
      // Правило, що спіткнулось об неповний знімок, не має права ламати кадр.
      continue;
    }
  }
  return null;
}
