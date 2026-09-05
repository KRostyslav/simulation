/**
 * Підказки на межах моделі.
 *
 * Найнебезпечніший момент у навчальному застосунку — коли гравець виводить
 * регулятор туди, де наближення вже не працює, а програма мовчки показує
 * гарне число. Тут кожна така ситуація має голос: модель сама каже, де вона
 * закінчується, і чому саме там.
 */

import { sci, decimal } from "@edu/explain";

import { crossoverTemperature } from "../physics/intrinsic.js";
import { DOPANT } from "../physics/doping.js";
import { DEGENERATE_N, MODE } from "../physics/constants.js";

function crystalWarnings(snapshot) {
  const out = [];
  const { values, carrier, regime, state } = snapshot;
  const doped = values.doped;

  if (!carrier.equilibrium) {
    out.push({
      id: "nonEquilibrium",
      title: "Кристал не в рівновазі",
      text:
        `Світло безперервно народжує пари, тому n·p = ${sci(values.np, 1)} — це ` +
        `у ${sci(values.np / (values.ni * values.ni), 1)} разів більше за nᵢ². ` +
        "Закон діючих мас працює лише в темряві; зараз він не виконується, і це правильно.",
      tone: "warn",
      codexRef: "massAction",
    });
  }

  if (doped > 0 && regime === "власна") {
    out.push({
      id: "crossedOver",
      title: "Легування вже нічого не вирішує",
      text:
        `При ${values.temperature} К власна концентрація nᵢ = ${sci(values.ni, 1)} см⁻³ ` +
        `перевищила концентрацію домішки ${sci(doped, 1)} см⁻³. Теплових пар стало більше, ` +
        "ніж домішкових носіїв, і кристал знову поводиться як чистий — тип провідності зник. " +
        "Саме тому кремнієві прилади не працюють при високих температурах.",
      tone: "bad",
      codexRef: "temperature",
    });
  } else if (doped > 0 && regime === "домішкова" && state.dopant !== DOPANT.none) {
    const t = crossoverTemperature(doped);
    if (t && t > values.temperature) {
      out.push({
        id: "crossoverAhead",
        title: "До власної провідності",
        text:
          `Нагрійте до ${Math.round(t)} К (${Math.round(t - 273)} °C) — і теплових пар стане ` +
          "стільки ж, скільки домішкових носіїв. Легування перестане мати значення.",
        tone: "neutral",
        codexRef: "temperature",
      });
    }
  }

  if (regime === "інжекція") {
    out.push({
      id: "highInjection",
      title: "Високий рівень інжекції",
      text:
        `Світло дає Δn = ${sci(values.excess, 1)} см⁻³ — більше, ніж домішка ` +
        `(${sci(doped, 1)} см⁻³). Основні й неосновні носії зрівнялись, і поділ ` +
        "на n- та p-тип втратив сенс, поки світло увімкнене.",
      tone: "warn",
      codexRef: "photo",
    });
  }

  if (snapshot.degenerate) {
    out.push({
      id: "degenerate",
      title: "Межа моделі: виродження",
      text:
        `Вище ${sci(DEGENERATE_N, 0)} см⁻³ домішкові рівні зливаються в зону, кремній стає ` +
        "виродженим, і статистика Больцмана, на якій побудовані всі формули тут, " +
        "уже неточна. Числа лишаються правильними за порядком, але не за величиною.",
      tone: "warn",
      codexRef: "limits",
    });
  }

  if (values.temperature < 150 && doped > 0) {
    out.push({
      id: "freezeOut",
      title: "Межа моделі: виморожування",
      text:
        `При ${values.temperature} К частина донорів у реальному кремнії вже не встигає ` +
        "віддати електрон — носіїв стає менше, і опір при охолодженні починає рости. " +
        "Ця модель вважає домішку іонізованою повністю, тому такого зростання не покаже.",
      tone: "warn",
      codexRef: "limits",
    });
  }

  return out;
}

function junctionWarnings(snapshot) {
  const out = [];
  const { values } = snapshot;

  if (!values.valid) {
    out.push({
      id: "depletionInvalid",
      title: "Наближення збідненого шару вичерпалось",
      text:
        `Зміщення ${decimal(values.bias, 2)} В майже зрівнялося з бар'єром ` +
        `${decimal(values.vbi, 3)} В. Різниця стала порівнянною з тепловим розкидом kT, ` +
        "межі шару розмились, і формула для W тут уже не описує реальність. " +
        "Ширину показано за нижньою межею застосовності, а не як точне значення.",
      tone: "bad",
      codexRef: "limits",
    });
  }

  if (values.limitedBy === "послідовний опір") {
    out.push({
      id: "seriesLimited",
      title: "Струм обмежує не бар'єр, а опір",
      text:
        `На нейтральних областях падає ${decimal(values.current * values.rs, 3)} В із ` +
        `${decimal(values.bias, 2)} В прикладених. Експонента вже не керує струмом — ` +
        "на ВАХ це те місце, де крута крива переходить у майже пряму лінію.",
      tone: "warn",
      codexRef: "iv",
    });
  }

  if (values.bias < -5) {
    out.push({
      id: "noBreakdown",
      title: "Межа моделі: пробою немає",
      text:
        `Реальний перехід із таким легуванням пробився б приблизно при ` +
        "−60 В: поле в шарі розганяє носії настільки, що вони вибивають нові пари. " +
        "Ця модель лавинного пробою не відтворює й показуватиме сталий струм і далі.",
      tone: "neutral",
      codexRef: "limits",
    });
  }

  if (snapshot.degenerate) {
    out.push({
      id: "degenerate",
      title: "Межа моделі: виродження",
      text:
        `Легування понад ${sci(DEGENERATE_N, 0)} см⁻³ робить кремній виродженим — ` +
        "формула для V_bi через статистику Больцмана там завищує бар'єр.",
      tone: "warn",
      codexRef: "limits",
    });
  }

  return out;
}

export function collectWarnings(snapshot) {
  return snapshot.mode === MODE.junction ? junctionWarnings(snapshot) : crystalWarnings(snapshot);
}
