/**
 * Збірка знімка моделі: стан регуляторів → числа → показники з поясненнями.
 *
 * Це єдине місце, де фізика перетворюється на те, що бачить гравець.
 * Кожен показник створюється через `makeReadout`, тобто разом із причиною
 * і формулою — панель, живий коментар і довідник читають той самий об'єкт
 * і розійтися з розрахунком не можуть.
 */

import { makeReadout, sci, smart, decimal, withPrefix } from "@edu/explain";

import { SAMPLE, DEGENERATE_N, MODE } from "./constants.js";
import { intrinsicConcentration, thermalVoltage, bandGap } from "./intrinsic.js";
import { DOPANT, carriers, conductivityRegime, REGIME_TEXT } from "./doping.js";
import {
  electronMobility,
  holeMobility,
  conductivity,
  sampleElectrics,
  driftVelocity,
} from "./transport.js";
import { excessCarriers } from "./optical.js";
import { depletion, CM_TO_UM } from "./junction.js";
import { diodePoint } from "./diode.js";
import { collectWarnings } from "../data/guards.js";

export { MODE };

/** Стан за замовчуванням: чистий кремній при кімнатній температурі. */
export function initialState() {
  return {
    mode: MODE.crystal,
    temperature: 300,
    dopant: DOPANT.none,
    doping: 1e16,
    suns: 0,
    voltage: 1,
    junctionNa: 1e16,
    junctionNd: 1e16,
    bias: 0,
  };
}

const DOPANT_NAME = {
  [DOPANT.none]: "без домішки",
  [DOPANT.donor]: "фосфор (донор)",
  [DOPANT.acceptor]: "бор (акцептор)",
};

/* ------------------------------ режим кристала ------------------------------ */

function crystalSnapshot(state) {
  const { temperature, dopant, doping, suns, voltage } = state;
  const doped = dopant === DOPANT.none ? 0 : doping;

  const { excess, tau } = excessCarriers({ suns, doping: doped });
  const carrier = carriers({ temperature, dopant, doping: doped, excess });
  const { n, p, ni, net } = carrier;

  const muN = electronMobility(doped, temperature);
  const muP = holeMobility(doped, temperature);
  const sigma = conductivity({ n, p, muN, muP });
  const electrics = sampleElectrics({ n, p, muN, muP, voltage });
  const regime = conductivityRegime(carrier);
  const vDrift = driftVelocity(muN, electrics.field);

  const values = {
    temperature,
    ni,
    n,
    p,
    np: n * p,
    net,
    excess,
    tau,
    muN,
    muP,
    sigma,
    resistivity: electrics.resistivity,
    resistance: electrics.resistance,
    current: electrics.current,
    field: electrics.field,
    vDrift,
    eg: bandGap(temperature),
    vt: thermalVoltage(temperature),
    doped,
    regime,
    dopant,
  };

  const readouts = {};

  readouts.ni = makeReadout({
    id: "ni",
    label: "Власна концентрація",
    symbol: "nᵢ",
    value: ni,
    unit: "см⁻³",
    display: sci(ni),
    why:
      "Скільки пар «електрон + дірка» за секунду встигає народити тепловий рух ґратки. " +
      `При ${temperature} К заборонена зона ${decimal(values.eg, 3)} еВ, а теплова енергія kT — ` +
      `лише ${decimal(values.vt * 1000, 1)} меВ. Розрив зв'язку — рідкісна подія, ` +
      "але експонента робить її дуже чутливою до температури: +100 К дають зростання на порядки.",
    formula: "nᵢ(T) ~ T³ᐟ²·exp(−E₉ / 2kT)",
    substitution: "nᵢ({T} К) = {ni} см⁻³   (E₉ = {eg} еВ, kT = {kt} меВ)",
    terms: {
      T: temperature,
      ni: sci(ni),
      eg: decimal(values.eg, 3),
      kt: decimal(values.vt * 1000, 1),
    },
    codexRef: "intrinsic",
  });

  readouts.n = makeReadout({
    id: "n",
    label: "Електрони",
    symbol: "n",
    value: n,
    unit: "см⁻³",
    display: sci(n),
    why:
      dopant === DOPANT.donor
        ? "Кожен атом фосфору має п'ять валентних електронів, а зв'язків у ґратці лише чотири. " +
          "П'ятий електрон нікуди приткнути — він відривається майже задарма й стає вільним. " +
          "Тому електронів приблизно стільки ж, скільки атомів домішки."
        : dopant === DOPANT.acceptor
          ? "У p-типі електрони — неосновні носії. Їх залишилось лише стільки, скільки " +
            "дозволяє закон діючих мас: nᵢ²/p. Кожен зайвий електрон швидко знаходить дірку."
          : "У чистому кристалі електрони народжуються тільки парами з дірками, " +
            "тому їх рівно стільки ж, скільки дірок.",
    formula: dopant === DOPANT.donor ? "n ≈ N_d" : "n = nᵢ² / p",
    substitution: "n = {n} см⁻³,   nᵢ = {ni} см⁻³   →   n/nᵢ = {ratio}",
    terms: { n: sci(n), ni: sci(ni), ratio: sci(n / ni, 1) },
    codexRef: dopant === DOPANT.none ? "intrinsic" : "extrinsic",
    tone: dopant === DOPANT.donor ? "good" : "neutral",
  });

  readouts.p = makeReadout({
    id: "p",
    label: "Дірки",
    symbol: "p",
    value: p,
    unit: "см⁻³",
    display: sci(p),
    why:
      dopant === DOPANT.acceptor
        ? "Атому бору бракує одного електрона до четвертого зв'язку. Він забирає електрон " +
          "у сусіда — і на місці сусіда лишається порожнє місце, дірка. Вона поводиться " +
          "як вільний додатний заряд, бо на її місце перестрибує наступний електрон."
        : dopant === DOPANT.donor
          ? "У n-типі дірки — неосновні носії. Вільних електронів так багато, що дірка " +
            "майже одразу знаходить, ким заповнитись: p = nᵢ²/n."
          : "Дірка — це порожній ковалентний зв'язок. У чистому кристалі кожен розірваний " +
            "зв'язок дає одночасно електрон і дірку, тому їх порівну.",
    formula: dopant === DOPANT.acceptor ? "p ≈ N_a" : "p = nᵢ² / n",
    substitution: "p = {p} см⁻³,   nᵢ = {ni} см⁻³   →   p/nᵢ = {ratio}",
    terms: { p: sci(p), ni: sci(ni), ratio: sci(p / ni, 1) },
    codexRef: dopant === DOPANT.none ? "intrinsic" : "extrinsic",
    tone: dopant === DOPANT.acceptor ? "good" : "neutral",
  });

  readouts.np = makeReadout({
    id: "np",
    label: carrier.equilibrium ? "Закон діючих мас" : "Закон діючих мас порушено",
    symbol: "n·p",
    value: n * p,
    unit: "см⁻⁶",
    display: sci(n * p),
    why: carrier.equilibrium
      ? "У рівновазі добуток концентрацій не залежить від легування взагалі: скільки " +
        "додасться основних носіїв, у стільки ж разів поменшає неосновних. Це не збіг, " +
        "а рівність темпів генерації й рекомбінації."
      : "Освітлення вивело кристал із рівноваги: пари народжуються швидше, ніж рекомбінують, " +
        "і добуток n·p перевищив nᵢ². Закон діючих мас справедливий ЛИШЕ в рівновазі — " +
        "у темряві. Вимкніть світло, і рівність відновиться.",
    formula: "n·p = nᵢ²   (тільки в рівновазі)",
    substitution: "n·p = {np},   nᵢ² = {ni2}   →   відношення {ratio}",
    terms: { np: sci(n * p), ni2: sci(ni * ni), ratio: sci((n * p) / (ni * ni), 2) },
    codexRef: "massAction",
    tone: carrier.equilibrium ? "good" : "warn",
  });

  readouts.muN = makeReadout({
    id: "muN",
    label: "Рухливість електронів",
    symbol: "μₙ",
    value: muN,
    unit: "см²/(В·с)",
    display: smart(muN),
    why:
      "Наскільки швидко носій розганяється в полі, поки не зіткнеться. Заважають два " +
      "механізми: теплові коливання ґратки (сильніші при нагріванні) і заряджені іони " +
      "домішки (їх тим більше, чим сильніше легування). Тому μ падає і від нагрівання, " +
      "і від легування.",
    formula: "μₙ(N, T) = μ(N)·(T/300)⁻²'⁴",
    substitution: "μₙ = {mu} см²/(В·с) при N = {n} см⁻³, T = {T} К",
    terms: { mu: smart(muN), n: sci(doped), T: temperature },
    codexRef: "mobility",
  });

  readouts.muP = makeReadout({
    id: "muP",
    label: "Рухливість дірок",
    symbol: "μₚ",
    value: muP,
    unit: "см²/(В·с)",
    display: smart(muP),
    why:
      "Утричі менша за електронну — і це не дрібниця, а суть того, чим дірка відрізняється " +
      "від електрона. Електрон летить крізь кристал вільно, а дірка «переїжджає» тільки " +
      `тим, що в неї перестрибує сусідній зв'язаний електрон. Звідси μₙ/μₚ = ${decimal(muN / muP, 1)}.`,
    formula: "μₚ(N, T) = μ(N)·(T/300)⁻²'²",
    substitution: "μₚ = {mu} см²/(В·с);   μₙ/μₚ = {ratio}",
    terms: { mu: smart(muP), ratio: decimal(muN / muP, 2) },
    codexRef: "mobility",
  });

  readouts.sigma = makeReadout({
    id: "sigma",
    label: "Питома провідність",
    symbol: "σ",
    value: sigma,
    unit: "См/см",
    display: sci(sigma),
    why:
      "Добуток кількості носіїв на їхню рухливість. Обидва типи носіїв додають внесок: " +
      "електрони й дірки рухаються назустріч, але й заряди в них протилежні, тому струм " +
      "виходить в один бік.",
    formula: "σ = q·(n·μₙ + p·μₚ)",
    substitution: "σ = 1,60·10⁻¹⁹ · ({n}·{muN} + {p}·{muP}) = {sigma} См/см",
    terms: {
      n: sci(n, 1),
      muN: smart(muN),
      p: sci(p, 1),
      muP: smart(muP),
      sigma: sci(sigma),
    },
    codexRef: "conductivity",
  });

  readouts.resistivity = makeReadout({
    id: "resistivity",
    label: "Питомий опір",
    symbol: "ρ",
    value: electrics.resistivity,
    unit: "Ом·см",
    display: sci(electrics.resistivity),
    why:
      "Те саме число навпаки. Для порівняння: у чистого кремнію ρ ≈ 3·10⁵ Ом·см, " +
      "у міді — 1,7·10⁻⁶ Ом·см. Легування зсуває кремній із першого значення в бік " +
      "другого на шість порядків, не змінюючи в ньому жодного атома, крім одного на мільйон.",
    formula: "ρ = 1/σ",
    substitution: "ρ = 1 / {sigma} = {rho} Ом·см",
    terms: { sigma: sci(sigma), rho: sci(electrics.resistivity) },
    codexRef: "conductivity",
  });

  readouts.resistance = makeReadout({
    id: "resistance",
    label: "Опір зразка",
    symbol: "R",
    value: electrics.resistance,
    unit: "Ом",
    display: sci(electrics.resistance),
    why:
      `Зразок — брусок ${SAMPLE.lengthCm * 10} × 1 × 1 мм, тому L/A = 100 см⁻¹ ` +
      "і опір в омах дорівнює просто ста питомим опорам. Круглий множник обрано " +
      "навмисно, щоб перевірку можна було зробити подумки.",
    formula: "R = ρ·L/A",
    substitution: "R = {rho} · 100 = {r} Ом",
    terms: { rho: sci(electrics.resistivity), r: sci(electrics.resistance) },
    codexRef: "conductivity",
  });

  readouts.current = makeReadout({
    id: "current",
    label: "Струм через зразок",
    symbol: "I",
    value: electrics.current,
    unit: "",
    display: withPrefix(electrics.current, "А"),
    why:
      `Звичайний закон Ома: I = U/R. Поле в кристалі ${sci(electrics.field, 1)} В/см ` +
      `розганяє електрони до ${sci(vDrift, 1)} см/с. Це дрейф — повільне зміщення ` +
      "поверх хаотичного теплового руху, який на кілька порядків швидший.",
    formula: "I = U/R,   v_др = μ·E",
    substitution: "I = {u} В / {r} Ом = {i}",
    terms: { u: decimal(voltage, 2), r: sci(electrics.resistance), i: withPrefix(electrics.current, "А") },
    codexRef: "drift",
  });

  if (suns > 0) {
    readouts.excess = makeReadout({
      id: "excess",
      label: "Носії від світла",
      symbol: "Δn",
      value: excess,
      unit: "см⁻³",
      display: sci(excess),
      why:
        "Фотон з енергією понад 1,12 еВ (тобто будь-яке видиме світло) вибиває електрон " +
        "із ковалентного зв'язку — так само, як це робить тепло, але без нагрівання. " +
        `Носій живе ${sci(tau, 1)} с, тому їх встигає накопичитись Δn = G·τ. ` +
        "Саме на цьому працює фоторезистор.",
      formula: "Δn = Δp = G·τ",
      substitution: "Δn = {g} · {tau} = {excess} см⁻³",
      terms: { g: sci(suns * 2.5e20, 1), tau: sci(tau, 1), excess: sci(excess) },
      codexRef: "photo",
      tone: "warn",
    });
  }

  return {
    mode: MODE.crystal,
    state,
    values,
    carrier,
    electrics,
    regime,
    regimeText: REGIME_TEXT[regime],
    dopantName: DOPANT_NAME[dopant],
    readouts,
    order: [
      "ni",
      "n",
      "p",
      "np",
      ...(suns > 0 ? ["excess"] : []),
      "muN",
      "muP",
      "sigma",
      "resistivity",
      "resistance",
      "current",
    ],
    degenerate: doped > DEGENERATE_N,
  };
}

/* ------------------------------ режим переходу ------------------------------ */

function junctionSnapshot(state) {
  const { temperature, junctionNa: na, junctionNd: nd, bias } = state;

  const dep = depletion({ na, nd, temperature, bias });
  const diode = diodePoint({ na, nd, temperature, voltage: bias });
  const ni = intrinsicConcentration(temperature);

  const values = {
    temperature,
    na,
    nd,
    bias,
    ni,
    vbi: dep.vbi,
    veff: dep.veff,
    width: dep.width,
    widthUm: dep.widthUm,
    xnUm: dep.xnUm,
    xpUm: dep.xpUm,
    fieldMax: dep.fieldMax,
    current: diode.current,
    junctionVoltage: diode.junctionVoltage,
    is: diode.is,
    rs: diode.rs,
    limitedBy: diode.limitedBy,
    valid: dep.valid,
  };

  const readouts = {};

  readouts.vbi = makeReadout({
    id: "vbi",
    label: "Контактна різниця потенціалів",
    symbol: "V_bi",
    value: dep.vbi,
    unit: "В",
    display: `${decimal(dep.vbi, 3)}`,
    why:
      "Висота бар'єру, що сам собою виріс на межі. Електрони з n-області перейшли " +
      "в p-область і рекомбінували; біля межі лишились нерухомі іони — від'ємні акцептори " +
      "зліва, додатні донори справа. Їхнє поле й тримає решту носіїв. Саме тому " +
      "кремнієвий діод відкривається приблизно на 0,7 В: меншою напругою бар'єр не зняти.",
    formula: "V_bi = V_T·ln(N_a·N_d / nᵢ²)",
    substitution: "V_bi = {vt} · ln({na}·{nd} / {ni}²) = {vbi} В",
    terms: {
      vt: decimal(thermalVoltage(temperature), 4),
      na: sci(na, 1),
      nd: sci(nd, 1),
      ni: sci(ni, 1),
      vbi: decimal(dep.vbi, 3),
    },
    codexRef: "junction",
  });

  readouts.width = makeReadout({
    id: "width",
    label: "Ширина збідненого шару",
    symbol: "W",
    value: dep.widthUm,
    unit: "мкм",
    display: decimal(dep.widthUm, 3),
    why:
      bias > 0
        ? "Пряме зміщення знижує бар'єр, і шар звужується: полю більше не треба " +
          "стримувати такий великий потік, тому достатньо меншого заряду іонів."
        : bias < 0
          ? "Зворотне зміщення додається до власного бар'єру, і шар розширюється — " +
            "але не пропорційно напрузі, а як її корінь: щоб подвоїти ширину, " +
            "напругу треба збільшити вчетверо."
          : "Без зовнішньої напруги шар має рівно таку ширину, щоб заряд іонів створив " +
            "поле, яке точно врівноважує дифузію.",
    formula: "W = √( 2ε·(V_bi − U)/q · (1/N_a + 1/N_d) )",
    substitution: "W = {w} мкм при U = {u} В   (x_p = {xp} мкм, x_n = {xn} мкм)",
    terms: {
      w: decimal(dep.widthUm, 3),
      u: decimal(bias, 2),
      xp: decimal(dep.xpUm, 3),
      xn: decimal(dep.xnUm, 3),
    },
    codexRef: "depletion",
    tone: dep.valid ? "neutral" : "warn",
  });

  readouts.field = makeReadout({
    id: "field",
    label: "Максимальне поле в шарі",
    symbol: "E_max",
    value: dep.fieldMax,
    unit: "В/см",
    display: sci(dep.fieldMax),
    why:
      "Поле зосереджене саме в збідненому шарі — за його межами кристал нейтральний, " +
      "і поля там майже немає. Тому вся напруга падає на тонкій смужці завтовшки " +
      "менше мікрометра, і напруженість виходить величезною.",
    formula: "E_max = 2·(V_bi − U)/W",
    substitution: "E_max = 2 · {v} / {w} см = {e} В/см",
    terms: { v: decimal(dep.veff, 3), w: sci(dep.width, 2), e: sci(dep.fieldMax) },
    codexRef: "depletion",
  });

  readouts.is = makeReadout({
    id: "is",
    label: "Струм насичення",
    symbol: "I_s",
    value: diode.is,
    unit: "",
    display: withPrefix(diode.is, "А"),
    why:
      "Уся зворотна вітка ВАХ в одному числі. Його дають неосновні носії — ті нечисленні " +
      "дірки в n-області й електрони в p-області, яким бар'єр не заважає, а допомагає. " +
      "Оскільки I_s ∝ nᵢ², він подвоюється приблизно на кожні 10 К нагрівання.",
    formula: "I_s = q·A·nᵢ²·(D_p/(L_p·N_d) + D_n/(L_n·N_a))",
    substitution: "I_s = {is}   (nᵢ = {ni} см⁻³)",
    terms: { is: withPrefix(diode.is, "А"), ni: sci(ni, 1) },
    codexRef: "iv",
  });

  readouts.current = makeReadout({
    id: "current",
    label: "Струм через діод",
    symbol: "I",
    value: diode.current,
    unit: "",
    display: withPrefix(diode.current, "А"),
    why:
      bias > 0
        ? `Пряме зміщення знижує бар'єр, і потік основних носіїв через межу росте ` +
          `експоненційно: кожні 60 мВ дають десятикратне зростання. Зараз струм обмежує ` +
          `${diode.limitedBy}.`
        : bias < 0
          ? "Зворотне зміщення лише піднімає бар'єр, який основні носії й так не долали. " +
            "Лишається крихітний струм неосновних носіїв, і йому байдуже, наскільки " +
            "сильна напруга: більше їх від цього не стане. Тому вітка горизонтальна."
          : "Без зовнішньої напруги дифузійний і дрейфовий потоки точно рівні й гасять " +
            "один одного. Струм дорівнює нулю, хоча носії крізь межу рухаються весь час.",
    formula: "I = I_s·(exp(U_перех / V_T) − 1)",
    substitution: "I = {is} · (exp({vj} / {vt}) − 1) = {i}",
    terms: {
      is: withPrefix(diode.is, "А"),
      vj: decimal(diode.junctionVoltage, 3),
      vt: decimal(diode.vt, 4),
      i: withPrefix(diode.current, "А"),
    },
    codexRef: "iv",
    tone: bias > 0 ? "good" : "neutral",
  });

  readouts.rs = makeReadout({
    id: "rs",
    label: "Опір нейтральних областей",
    symbol: "R_s",
    value: diode.rs,
    unit: "Ом",
    display: smart(diode.rs),
    why:
      "Поза збідненим шаром діод — це просто два шматки легованого кремнію зі звичайним " +
      "опором. При великому прямому струмі саме він, а не бар'єр, починає обмежувати струм, " +
      "і крута експонента на ВАХ переходить у звичайну пряму.",
    formula: "R_s = (ρₙ + ρₚ)·(L/2)/A",
    substitution: "R_s = {rs} Ом;   на ньому зараз падає {drop} В",
    terms: { rs: smart(diode.rs), drop: decimal(diode.current * diode.rs, 3) },
    codexRef: "iv",
  });

  return {
    mode: MODE.junction,
    state,
    values,
    depletion: dep,
    diode,
    readouts,
    order: ["vbi", "width", "field", "is", "current", "rs"],
    degenerate: Math.max(na, nd) > DEGENERATE_N,
  };
}

/* --------------------------------- фасад --------------------------------- */

export function snapshot(state) {
  const base = state.mode === MODE.junction ? junctionSnapshot(state) : crystalSnapshot(state);
  return { ...base, warnings: collectWarnings(base) };
}

/** Скільки мікрометрів у сантиметрі — для підписів рендера. */
export { CM_TO_UM };
