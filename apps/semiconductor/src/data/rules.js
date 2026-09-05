/**
 * Правила живого коментаря: що сказати після кожної дії гравця.
 *
 * Правило не пише числа руками — воно бере їх із показників того самого
 * знімка, який щойно порахувала фізика. Тому коментар не може розійтися
 * з панеллю, а тест цілісності перевіряє, що всі згадані `readouts` і `codexRef`
 * справді існують.
 *
 * Перше правило, яке підійшло, і виграє — тому список іде від найконкретніших
 * ситуацій до загальних.
 */

import { sci, times, decimal, withPrefix, findChange } from "@edu/explain";

import { DOPANT } from "../physics/doping.js";
import { MODE } from "../physics/constants.js";

/** У скільки разів змінився показник; 1, якщо не змінився. */
function factor(ctx, id) {
  const change = findChange(ctx.changes, id);
  if (!change || !(change.from > 0) || !(change.to > 0)) return 1;
  return change.to / change.from;
}

function grew(ctx, id) {
  return factor(ctx, id) > 1;
}

export const RULES = [
  /* ------------------------------- домішка ------------------------------- */
  {
    id: "dopantAdded",
    codexRef: "extrinsic",
    readouts: ["n", "p", "sigma"],
    when: (ctx) => ctx.changedKey === "dopant" && ctx.next.state.dopant !== DOPANT.none,
    build: (ctx) => {
      const donor = ctx.next.state.dopant === DOPANT.donor;
      const { n, p } = ctx.next.values;
      return {
        headline: donor
          ? `Кристал став n-типом: провідність зросла ${times(factor(ctx, "sigma"))}`
          : `Кристал став p-типом: провідність зросла ${times(factor(ctx, "sigma"))}`,
        mechanism: donor
          ? "У фосфору п'ять валентних електронів, а зв'язків у ґратці лише чотири. " +
            "П'ятий утримується так слабко, що при кімнатній температурі відривається " +
            `майже в кожного атома домішки — звідси n = ${sci(n, 1)} см⁻³. ` +
            `Дірок при цьому стало МЕНШЕ (${sci(p, 1)} см⁻³): надлишок електронів їх «з'їв», ` +
            "щоб добуток n·p лишився рівним nᵢ²."
          : "Атому бору бракує одного електрона до четвертого зв'язку. Він забирає його " +
            "в сусіда, і на місці сусіда лишається дірка — вільний додатний носій. " +
            `Тому p = ${sci(p, 1)} см⁻³, а електронів стало менше (${sci(n, 1)} см⁻³).`,
      };
    },
  },
  {
    id: "dopantRemoved",
    codexRef: "intrinsic",
    readouts: ["n", "p", "sigma"],
    when: (ctx) => ctx.changedKey === "dopant" && ctx.next.state.dopant === DOPANT.none,
    build: (ctx) => ({
      headline: `Домішку прибрано — провідність упала ${times(1 / factor(ctx, "sigma"))}`,
      mechanism:
        "Лишились тільки теплові пари. Тепер електронів і дірок рівно порівну — " +
        `по ${sci(ctx.next.values.n, 1)} см⁻³, — бо кожен розрив зв'язку дає одразу обидва носії. ` +
        "Це і є власна провідність.",
    }),
  },
  {
    id: "dopingChanged",
    codexRef: "massAction",
    readouts: ["n", "p", "np", "sigma"],
    when: (ctx) => ctx.changedKey === "doping",
    build: (ctx) => {
      const up = ctx.next.state.doping > ctx.prev.state.doping;
      const majority = ctx.next.values.n > ctx.next.values.p ? "n" : "p";
      const minority = majority === "n" ? "p" : "n";
      return {
        headline: up
          ? `Легування сильніше: провідність ${grew(ctx, "sigma") ? "зросла" : "змінилась"} ${times(factor(ctx, "sigma"))}`
          : `Легування слабше: провідність упала ${times(1 / factor(ctx, "sigma"))}`,
        mechanism:
          `Основних носіїв стало ${sci(ctx.next.values[majority], 1)} см⁻³ — приблизно стільки ж, ` +
          "скільки атомів домішки: кожен віддає рівно один носій. " +
          `А неосновних — ${sci(ctx.next.values[minority], 1)} см⁻³: вони змінились ` +
          `${times(1 / factor(ctx, majority === "n" ? "p" : "n"))} у протилежний бік, ` +
          "бо добуток n·p не залежить від легування взагалі.",
      };
    },
  },

  /* ------------------------------ температура ----------------------------- */
  {
    id: "temperatureCrossover",
    codexRef: "temperature",
    readouts: ["ni", "n", "p", "sigma"],
    when: (ctx) =>
      ctx.changedKey === "temperature" &&
      ctx.next.mode === MODE.crystal &&
      ctx.next.regime === "власна" &&
      ctx.prev.regime !== "власна" &&
      ctx.next.values.doped > 0,
    build: (ctx) => ({
      headline: "Легування перестало мати значення — кристал знову власний",
      mechanism:
        `При ${ctx.next.values.temperature} К теплових пар (nᵢ = ${sci(ctx.next.values.ni, 1)} см⁻³) ` +
        `стало більше, ніж домішкових носіїв (${sci(ctx.next.values.doped, 1)} см⁻³). ` +
        "Тип провідності зник: електронів і дірок знову майже порівну. Саме через це " +
        "кремнієві прилади не працюють при високих температурах — транзистор просто " +
        "перестає бути транзистором.",
    }),
  },
  {
    id: "temperatureIntrinsic",
    codexRef: "temperature",
    readouts: ["ni", "sigma", "muN"],
    when: (ctx) =>
      ctx.changedKey === "temperature" &&
      ctx.next.mode === MODE.crystal &&
      ctx.next.regime !== "домішкова",
    build: (ctx) => {
      const up = ctx.next.state.temperature > ctx.prev.state.temperature;
      return {
        headline: up
          ? `Нагрівання: опір упав ${times(1 / factor(ctx, "resistance"))}`
          : `Охолодження: опір зріс ${times(factor(ctx, "resistance"))}`,
        mechanism:
          `Нагрівання діє двояко. Кількість пар змінилась ${times(factor(ctx, "ni"))} — ` +
          "бо nᵢ ~ exp(−E₉/2kT), і експонента дуже різка. Рухливість при цьому " +
          `змінилась лише ${times(factor(ctx, "muN"))} у протилежний бік: гаряча ґратка ` +
          "сильніше розсіює носії. Перший ефект на порядки сильніший — тому в напівпровідника " +
          "опір при нагріванні падає, а не росте, як у металу.",
      };
    },
  },
  {
    id: "temperatureExtrinsic",
    codexRef: "mobility",
    readouts: ["n", "muN", "resistance"],
    when: (ctx) => ctx.changedKey === "temperature" && ctx.next.mode === MODE.crystal,
    build: (ctx) => {
      const up = ctx.next.state.temperature > ctx.prev.state.temperature;
      return {
        headline: up
          ? `Нагрівання легованого кристала: опір ${grew(ctx, "resistance") ? "ЗРІС" : "упав"} ${times(Math.max(factor(ctx, "resistance"), 1 / factor(ctx, "resistance")))}`
          : `Охолодження легованого кристала: опір ${grew(ctx, "resistance") ? "зріс" : "упав"} ${times(Math.max(factor(ctx, "resistance"), 1 / factor(ctx, "resistance")))}`,
        mechanism:
          "Тут кристал поводиться як метал, і це не помилка. Носіїв дає домішка, а їхня " +
          `кількість від температури не залежить (n = ${sci(ctx.next.values.n, 1)} см⁻³ майже стала). ` +
          `Лишається тільки розсіяння: рухливість змінилась ${times(factor(ctx, "muN"))}. ` +
          "Власна провідність візьме гору лише тоді, коли nᵢ(T) дожене концентрацію домішки.",
      };
    },
  },

  /* -------------------------------- світло -------------------------------- */
  {
    id: "lightOn",
    codexRef: "photo",
    readouts: ["excess", "np", "sigma"],
    when: (ctx) => ctx.changedKey === "suns" && ctx.next.state.suns > 0,
    build: (ctx) => ({
      headline: `Світло додало носіїв: провідність зросла ${times(factor(ctx, "sigma"))}`,
      mechanism:
        `Фотони вибивають електрони із зв'язків так само, як це робить тепло, — ` +
        `народилось Δn = Δp = ${sci(ctx.next.values.excess, 1)} см⁻³ додаткових пар. ` +
        "Зверніть увагу на показник n·p: він перевищив nᵢ², і значок рівності згас. " +
        "Це не збій — закон діючих мас справедливий лише в рівновазі, а освітлений " +
        "кристал у ній не перебуває.",
    }),
  },
  {
    id: "lightOff",
    codexRef: "massAction",
    readouts: ["np", "sigma"],
    when: (ctx) => ctx.changedKey === "suns" && ctx.next.state.suns === 0,
    build: (ctx) => ({
      headline: `Темрява: провідність упала ${times(1 / factor(ctx, "sigma"))}`,
      mechanism:
        "Генерація припинилась, надлишкові пари за час τ рекомбінували, і кристал " +
        "повернувся в рівновагу. Добуток n·p знову точно дорівнює nᵢ².",
    }),
  },

  /* ------------------------------- напруга -------------------------------- */
  {
    id: "voltageChanged",
    codexRef: "drift",
    readouts: ["current", "resistance"],
    when: (ctx) => ctx.changedKey === "voltage",
    build: (ctx) => ({
      headline: `Струм ${withPrefix(ctx.next.values.current, "А")} — звичайний закон Ома`,
      mechanism:
        `Поле ${sci(ctx.next.values.field, 1)} В/см розганяє носії до ${sci(ctx.next.values.vDrift, 1)} см/с. ` +
        "Це дрейф — повільне систематичне зміщення поверх хаотичного теплового руху, " +
        "який на кілька порядків швидший. Опір від напруги не залежить: кількість носіїв " +
        "поле не змінює, лише зсуває їх.",
    }),
  },

  /* ------------------------------ p-n перехід ----------------------------- */
  {
    id: "forwardBias",
    codexRef: "bias",
    readouts: ["current", "width", "vbi"],
    when: (ctx) => ctx.changedKey === "bias" && ctx.next.state.bias > 0,
    build: (ctx) => ({
      headline: `Пряме зміщення ${decimal(ctx.next.state.bias, 2)} В: струм ${withPrefix(ctx.next.values.current, "А")}`,
      mechanism:
        `Зовнішня напруга віднімається від бар'єру ${decimal(ctx.next.values.vbi, 2)} В — ` +
        `лишилось ${decimal(ctx.next.values.veff, 3)} В. Збіднений шар звузився до ` +
        `${decimal(ctx.next.values.widthUm, 3)} мкм, і основні носії пішли крізь межу. ` +
        "Оскільки стримувала їх експонента, кожні 60 мВ додають десятикратне зростання струму. " +
        `Зараз струм обмежує ${ctx.next.values.limitedBy}.`,
    }),
  },
  {
    id: "reverseBias",
    codexRef: "bias",
    readouts: ["current", "width", "is"],
    when: (ctx) => ctx.changedKey === "bias" && ctx.next.state.bias < 0,
    build: (ctx) => ({
      headline: `Зворотне зміщення ${decimal(ctx.next.state.bias, 2)} В: струм майже нульовий`,
      mechanism:
        `Напруга додалась до бар'єру, шар розширився до ${decimal(ctx.next.values.widthUm, 3)} мкм — ` +
        "але не пропорційно напрузі, а як її корінь. Основним носіям це нічого не змінює: " +
        "вони бар'єр і так не долали. Лишився струм неосновних носіїв " +
        `${withPrefix(ctx.next.values.is, "А")}, і від напруги він не залежить — більше ` +
        "неосновних носіїв від неї не з'явиться. Тому вітка ВАХ горизонтальна.",
    }),
  },
  {
    id: "zeroBias",
    codexRef: "junction",
    readouts: ["vbi", "width", "field"],
    when: (ctx) => ctx.changedKey === "bias" && ctx.next.state.bias === 0,
    build: (ctx) => ({
      headline: "Рівновага: струм нуль, хоча носії рухаються весь час",
      mechanism:
        `Крізь межу йдуть два зустрічні потоки — дифузійний і дрейфовий, — і вони точно ` +
        `рівні. Бар'єр ${decimal(ctx.next.values.vbi, 3)} В виріс сам собою: ` +
        "електрони перейшли ліворуч, рекомбінували, і біля межі лишились нерухомі іони, " +
        `поле яких (${sci(ctx.next.values.fieldMax, 1)} В/см) і зупиняє решту.`,
    }),
  },
  {
    id: "junctionDoping",
    codexRef: "depletion",
    readouts: ["vbi", "width"],
    when: (ctx) => ctx.changedKey === "junctionNa" || ctx.changedKey === "junctionNd",
    build: (ctx) => {
      const { na, nd, xpUm, xnUm } = ctx.next.values;
      const wide = xpUm > xnUm ? "p" : "n";
      return {
        headline: `Бар'єр ${decimal(ctx.next.values.vbi, 3)} В, шар ${decimal(ctx.next.values.widthUm, 3)} мкм`,
        mechanism:
          `Сильніше легування піднімає бар'єр (V_bi = V_T·ln(N_a·N_d/nᵢ²)) і водночас звужує шар: ` +
          "той самий заряд набирається меншою товщиною. " +
          `Зараз шар несиметричний — у ${wide}-області він ` +
          `${decimal(Math.max(xpUm, xnUm) / Math.min(xpUm, xnUm), 1)} раза ширший, ` +
          `бо там легування слабше (${sci(wide === "p" ? na : nd, 1)} проти ` +
          `${sci(wide === "p" ? nd : na, 1)} см⁻³). Заряд по обидва боки має бути однаковим.`,
      };
    },
  },
  {
    id: "junctionTemperature",
    codexRef: "iv",
    readouts: ["is", "vbi", "current"],
    when: (ctx) => ctx.changedKey === "temperature" && ctx.next.mode === MODE.junction,
    build: (ctx) => ({
      headline: `Зворотний струм змінився ${times(factor(ctx, "is"))}`,
      mechanism:
        `Струм насичення пропорційний nᵢ², тому реагує на температуру вдвічі різкіше, ` +
        "ніж сама власна концентрація: приблизно подвоєння на кожні 10 К. " +
        `Заразом бар'єр змінився до ${decimal(ctx.next.values.vbi, 3)} В — ` +
        "нагрітий діод відкривається при меншій напрузі, приблизно на 2 мВ на градус.",
    }),
  },

  /* -------------------------------- режим --------------------------------- */
  {
    id: "modeSwitched",
    codexRef: "junction",
    readouts: [],
    when: (ctx) => ctx.changedKey === "mode",
    build: (ctx) => ({
      headline:
        ctx.next.mode === MODE.junction
          ? "Дві області стикнули — утворився p-n перехід"
          : "Повернулись до однорідного кристала",
      mechanism:
        ctx.next.mode === MODE.junction
          ? "Ліворуч p-область із дірками, праворуч n-область з електронами. Біля межі " +
            "вони вже рекомбінували, лишивши смугу з самих нерухомих іонів — збіднений шар. " +
            "Спробуйте зміщення в обидва боки й порівняйте струми."
          : "Знову один шматок кремнію з одним типом легування. Тут можна дивитись, " +
            "як на носіїв діють температура, домішка й світло.",
    }),
  },
];

/** Перше правило, що підійшло. Порядок у списку — від конкретного до загального. */
export function pickRule(ctx) {
  return RULES.find((rule) => rule.when(ctx)) ?? null;
}

/**
 * Опис стану без попередньої дії — для першого кадру.
 *
 * Потрібен саме тому, що стан відновлюється з localStorage: якби тут стояв
 * фіксований текст про чистий кремній, гравець, повернувшись до легованого
 * кристала або до p-n переходу, читав би опис зовсім іншого досліду.
 */
export function describeState(snapshot) {
  if (snapshot.mode === MODE.junction) {
    const { vbi, widthUm, xpUm, xnUm, bias } = snapshot.values;
    const wide = xpUm > xnUm ? "p" : "n";
    return {
      headline:
        bias === 0
          ? `p-n перехід у рівновазі: бар'єр ${decimal(vbi, 3)} В`
          : bias > 0
            ? `p-n перехід під прямим зміщенням ${decimal(bias, 2)} В`
            : `p-n перехід під зворотним зміщенням ${decimal(bias, 2)} В`,
      mechanism:
        `Ліворуч p-область, праворуч n-область. Біля межі носії вже рекомбінували, ` +
        `лишивши смугу завширшки ${decimal(widthUm, 3)} мкм із самих нерухомих іонів — ` +
        `збіднений шар. Він несиметричний: у ${wide}-області ширший, бо там легування ` +
        "слабше, а заряд по обидва боки має бути однаковим. Спробуйте зміщення в обидва " +
        "боки й порівняйте струми.",
      codexRef: "junction",
    };
  }

  const { n, p, ni, doped, temperature, excess } = snapshot.values;

  // Порядок гілок — за тим, ЩО САМЕ дає носіїв зараз. Домішка в кристалі
  // ще не означає домішкової провідності: при 520 К теплові пари переганяють
  // легування 10¹³, і сказати «домішка дає стільки носіїв» було б неправдою.
  if (snapshot.regime === "інжекція") {
    return {
      headline: `Освітлений кремній при ${temperature} К`,
      mechanism:
        `Світло дає ${sci(excess, 1)} см⁻³ пар — більше, ніж домішка (${sci(doped, 1)} см⁻³). ` +
        "Основних і неосновних носіїв стало майже порівну, тип провідності розмито. " +
        "Зверніть увагу: добуток n·p перевищив nᵢ², бо закон діючих мас діє тільки " +
        "в рівновазі, а освітлений кристал у ній не перебуває.",
      codexRef: "photo",
    };
  }

  if (snapshot.regime === "власна") {
    return {
      headline:
        doped > 0
          ? `Легований кремній при ${temperature} К, але провідність уже власна`
          : `Чистий кремній при ${temperature} К`,
      mechanism:
        doped > 0
          ? `Теплових пар (nᵢ = ${sci(ni, 1)} см⁻³) стало більше, ніж домішкових носіїв ` +
            `(${sci(doped, 1)} см⁻³), тому легування вже нічого не вирішує: електронів ` +
            `${sci(n, 1)} см⁻³, дірок ${sci(p, 1)} см⁻³ — майже порівну. Саме через це ` +
            "кремнієві прилади мають верхню температурну межу. Охолодіть кристал, " +
            "і тип провідності повернеться."
          : "Кожен атом ділиться чотирма валентними електронами з чотирма сусідами, тому " +
            `вільних носіїв майже немає: ${sci(ni, 1)} см⁻³ на 5·10²² атомів у кубічному ` +
            "сантиметрі. Електронів і дірок рівно порівну — кожен розрив зв'язку дає " +
            "обидва носії одразу. Спробуйте нагріти кристал або додати домішку.",
      codexRef: doped > 0 ? "temperature" : "intrinsic",
    };
  }

  const type = n > p ? "n" : "p";
  return {
    headline: `Кремній ${type}-типу при ${temperature} К`,
    mechanism:
      `Домішка ${sci(doped, 1)} см⁻³ дає ${sci(Math.max(n, p), 1)} см⁻³ основних носіїв — ` +
      `${times(Math.max(n, p) / ni)} більше, ніж у чистого кремнію. Неосновних при цьому ` +
      `лишилось ${sci(Math.min(n, p), 1)} см⁻³: добуток n·p прив'язаний до nᵢ², і виграш ` +
      "в одних завжди означає рівно такий самий програш в інших." +
      // Світло увімкнене, але на такому легуванні майже нічого не змінює —
      // сказати це прямо корисніше, ніж змовчати: саме тому фоторезистори
      // роблять із високоомного матеріалу.
      (excess > 0
        ? ` Світло додає лише ${sci(excess, 1)} см⁻³ пар — на тлі домішки це майже ` +
          "непомітно. Послабте легування, і той самий промінь змінить опір на порядки."
        : ""),
    codexRef: "extrinsic",
  };
}
