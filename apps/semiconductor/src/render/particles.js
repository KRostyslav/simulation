/**
 * Частинкова система: вільні носії заряду на сцені.
 *
 * Три принципи, які роблять картинку чесною.
 *
 * 1. ЛОГАРИФМІЧНА ШКАЛА. Концентрації в цій темі різняться на десять порядків.
 *    Лінійно показати 10⁴ і 10¹⁶ разом фізично неможливо, тому кількість
 *    точок пропорційна ЛОГАРИФМУ концентрації: +4,5 точки = ×10.
 *
 * 2. ПАРНІСТЬ. Теплова й оптична генерація завжди народжує ПАРУ «електрон +
 *    дірка», рекомбінація завжди знищує пару. Домішка дає непарний носій —
 *    і разом із ним нерухомий іон, який малює ґратка. Тому на екрані завжди
 *    виконується (електрони − дірки) = (додатні іони − від'ємні іони):
 *    гравець буквально бачить електронейтральність кристала.
 *
 * 3. ФІЗИКА — ДЖЕРЕЛО ІСТИНИ. Система нічого не накопичує сама: щокадру вона
 *    підтягується до цілей, порахованих моделлю. Розійтися з числами в панелі
 *    вона не може.
 */

import { PALETTE, disc, ring, px } from "@edu/pixel-ui";

/**
 * Скільки точок показати для концентрації `value`.
 * `floor` — поріг, нижче якого носіїв на екрані немає взагалі: неосновних
 * носіїв у сильно легованому кристалі справді припадає менше одного на всю
 * видиму ділянку, і чесніше не показати жодного, ніж показати «хоча б одного».
 */
export function visibleCount(value, { perDecade = 4.5, floor = 1e8, max = 60 } = {}) {
  if (!(value > floor)) return 0;
  const count = Math.round(perDecade * (Math.log10(value) - Math.log10(floor)));
  return Math.max(0, Math.min(max, count));
}

const RELAX_SECONDS = 0.7; // за скільки система доходить до нової цілі
const MAX_PARTICLES = 200;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function createParticles({ bounds, seed = 1 }) {
  const electrons = [];
  const holes = [];
  const flashes = [];
  let pairs = 0;
  let extra = 0;
  let extraKind = null;
  let noise = seed;

  /** Детермінований дріб — щоб позиції не «стрибали» при кожному перемальовуванні. */
  function nextNoise() {
    noise = (noise * 1664525 + 1013904223) % 4294967296;
    return noise / 4294967296;
  }

  function spawn(kind, origin) {
    const particle = {
      kind,
      origin,
      x: rand(bounds.x + 2, bounds.x + bounds.w - 2),
      y: rand(bounds.y + 2, bounds.y + bounds.h - 2),
      vx: rand(-1, 1),
      vy: rand(-1, 1),
    };
    (kind === "e" ? electrons : holes).push(particle);
    return particle;
  }

  function flash(x, y, kind) {
    flashes.push({ x, y, kind, life: 0.35 });
  }

  /** Народження пари: підсвічуємо місце розриву зв'язку. */
  function generatePair() {
    if (electrons.length + holes.length + 2 > MAX_PARTICLES) return;
    const e = spawn("e", "pair");
    const h = spawn("h", "pair");
    h.x = e.x + rand(-3, 3);
    h.y = e.y + rand(-3, 3);
    flash(e.x, e.y, "gen");
    pairs += 1;
  }

  /** Рекомбінація: електрон знаходить дірку, обидва зникають. */
  function recombinePair() {
    const e = electrons.findIndex((p) => p.origin === "pair");
    const h = holes.findIndex((p) => p.origin === "pair");
    if (e < 0 || h < 0) return;
    flash(electrons[e].x, electrons[e].y, "rec");
    electrons.splice(e, 1);
    holes.splice(h, 1);
    pairs -= 1;
  }

  function addExtra(kind) {
    if (electrons.length + holes.length + 1 > MAX_PARTICLES) return;
    spawn(kind, "dopant");
    extra += 1;
  }

  function removeExtra(kind) {
    const list = kind === "e" ? electrons : holes;
    const index = list.findIndex((p) => p.origin === "dopant");
    if (index < 0) return;
    list.splice(index, 1);
    extra -= 1;
  }

  function dropAll(origin) {
    for (const list of [electrons, holes]) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        if (list[i].origin === origin) list.splice(i, 1);
      }
    }
  }

  /**
   * @param dt      секунди з попереднього кадру
   * @param targets { pairs, extra, extraKind }
   * @param motion  { thermal, driftE, driftH } — швидкості в пікселях за секунду
   */
  function update(dt, targets, motion) {
    // Зміна типу основних носіїв (n → p) означає, що старі непарні носії
    // більше не існують: їх дала інша домішка, якої вже немає.
    if (targets.extraKind !== extraKind) {
      dropAll("dopant");
      extra = 0;
      extraKind = targets.extraKind;
    }

    const step = Math.max(1, Math.ceil((dt / RELAX_SECONDS) * 60));

    for (let i = 0; i < step && pairs < targets.pairs; i += 1) generatePair();
    for (let i = 0; i < step && pairs > targets.pairs; i += 1) recombinePair();
    if (extraKind) {
      for (let i = 0; i < step && extra < targets.extra; i += 1) addExtra(extraKind);
      for (let i = 0; i < step && extra > targets.extra; i += 1) removeExtra(extraKind);
    }

    const thermal = motion.thermal;
    for (const list of [electrons, holes]) {
      const drift = list === electrons ? motion.driftE : motion.driftH;
      for (const p of list) {
        // Хаотичний тепловий рух: напрямок безперервно збивається.
        p.vx += (nextNoise() - 0.5) * thermal * dt * 8;
        p.vy += (nextNoise() - 0.5) * thermal * dt * 8;
        const speed = Math.hypot(p.vx, p.vy) || 1;
        p.vx = (p.vx / speed) * thermal;
        p.vy = (p.vy / speed) * thermal;

        p.x += (p.vx + drift) * dt;
        p.y += p.vy * dt;

        // Відбиття від країв ділянки — носій не залишає кристал.
        if (p.x < bounds.x + 1) {
          p.x = bounds.x + 1;
          p.vx = Math.abs(p.vx);
        }
        if (p.x > bounds.x + bounds.w - 2) {
          p.x = bounds.x + bounds.w - 2;
          p.vx = -Math.abs(p.vx);
        }
        if (p.y < bounds.y + 1) {
          p.y = bounds.y + 1;
          p.vy = Math.abs(p.vy);
        }
        if (p.y > bounds.y + bounds.h - 2) {
          p.y = bounds.y + bounds.h - 2;
          p.vy = -Math.abs(p.vy);
        }
      }
    }

    for (let i = flashes.length - 1; i >= 0; i -= 1) {
      flashes[i].life -= dt;
      if (flashes[i].life <= 0) flashes.splice(i, 1);
    }
  }

  function draw(ctx) {
    for (const f of flashes) {
      const r = f.life > 0.2 ? 4 : 3;
      ring(ctx, f.x, f.y, r, f.kind === "gen" ? PALETTE.flashGen : PALETTE.flashRec);
    }
    // Дірка — кільце: порожній зв'язок, а не частинка. Електрон — залитий диск.
    for (const p of holes) {
      ring(ctx, p.x, p.y, 2, PALETTE.hole);
      px(ctx, p.x, p.y, PALETTE.holeGlow);
    }
    for (const p of electrons) {
      disc(ctx, p.x, p.y, 2, PALETTE.electron);
      px(ctx, p.x - 1, p.y - 1, PALETTE.electronGlow);
    }
  }

  return {
    update,
    draw,
    get counts() {
      return { electrons: electrons.length, holes: holes.length, pairs, extra };
    },
    reset() {
      electrons.length = 0;
      holes.length = 0;
      flashes.length = 0;
      pairs = 0;
      extra = 0;
      extraKind = null;
    },
  };
}

/**
 * Цілі частинкової системи зі знімка моделі.
 * Парні носії — це min(n, p): стільки пар справді існує. Решта — непарні
 * носії від домішки, у яких на сцені є нерухомий іон-партнер.
 */
export function particleTargets(snapshot) {
  const { n, p } = snapshot.values;
  const pairsConcentration = Math.min(n, p);
  const extraConcentration = Math.abs(n - p);
  return {
    pairs: visibleCount(pairsConcentration, { perDecade: 3, max: 40 }),
    extra: visibleCount(extraConcentration, { perDecade: 3, max: 40 }),
    extraKind: extraConcentration <= 0 ? null : n > p ? "e" : "h",
  };
}

/** Швидкості для анімації: тепловий рух ∝ √T, дрейф ∝ μE. */
export function motionFromSnapshot(snapshot, { reduced = false }) {
  if (reduced) return { thermal: 0, driftE: 0, driftH: 0 };
  const { temperature, muN, muP, field } = snapshot.values;
  const thermal = 12 * Math.sqrt(temperature / 300);
  // Дрейф навмисно НЕ в масштабі: реальний дрейф на три порядки повільніший
  // за тепловий рух і був би непомітним. Зберігаємо головне — відношення
  // μₙ/μₚ і напрямок: електрони до «+», дірки до «−».
  const scale = Math.min(1, Math.abs(field) / 50);
  return {
    thermal,
    driftE: scale * 10 * (muN / 1360),
    driftH: -scale * 10 * (muP / 1360),
  };
}
