/**
 * Випрямляч — те, заради чого діод узагалі ставлять у схему.
 *
 * Уся вентильна дія випливає з ВАХ, яку студент щойно зняв власноруч: у один
 * бік діод проводить, у другий ні. Тому цей режим не вводить жодної нової
 * фізики — він лише показує ту саму характеристику в дії, і навіть «втрата»
 * випрямленої напруги дорівнює тим самим 0,7 В, які були виміряні на стенді.
 */

import { solveDiodeCurrent } from "@edu/diode";
import { deviceParameters } from "./devices.js";

/**
 * Осцилограма за задане число періодів.
 *
 * Активне навантаження рахується поточково: у кожен момент часу коло
 * «діод + R_н» — це той самий стенд, лише з миттєвою ЕРС замість постійної.
 * Розв'язок аналітичний за побудовою й повністю відтворюваний.
 *
 * Із конденсатором так уже не можна: напруга на ньому залежить від усієї
 * попередньої історії, і доводиться інтегрувати в часі
 *
 *     C·du_c/dt = I_діода(u_вх − u_c) − u_c/R_н
 *
 * явною схемою Ейлера. Кілька перших періодів іде на заряджання — їх
 * рахуємо, але не показуємо: на екрані має бути усталений режим, а не
 * перехідний процес увімкнення.
 */
export function rectifierWaveform({
  device,
  temperature,
  amplitude,
  frequency = 50,
  load,
  capacitance = 0,
  bridge = false,
  samples = 300,
}) {
  const params = deviceParameters(device, temperature, 0);
  const { is, igen, rs, vt, breakdown } = params;
  const period = 1 / frequency;

  // Скільки діодів послідовно стоїть на шляху струму: в мості завжди два.
  const arms = bridge ? 2 : 1;

  /**
   * Опір обмотки трансформатора. Без нього конденсатор заряджався б струмом,
   * обмеженим лише власним опором діода — тобто десятками ампер, чого в
   * реальному джерелі не буває. Саме цей опір і робить зарядний імпульс
   * скінченним.
   */
  const sourceResistance = 10;

  /**
   * Струм діода при заданій напрузі, прикладеній до всієї вітки.
   *
   * `series` — те, що ввімкнено послідовно з діодом, і воно РІЗНЕ у двох
   * схемах. Без конденсатора струм тече крізь навантаження, тому послідовним
   * є R_н. З конденсатором струм діода йде на заряджання ємності, а
   * навантаження висить на самому конденсаторі й у цьому колі не бере
   * участі — послідовним лишається тільки опір джерела.
   */
  const diodeCurrent = (drive, series) => {
    const { current } = solveDiodeCurrent({
      voltage: drive / arms,
      is,
      rs: rs + series / arms,
      vt,
      igen,
      breakdown,
    });
    return current;
  };

  const source = (t) => amplitude * Math.sin(2 * Math.PI * frequency * t);
  const input = (t) => (bridge ? Math.abs(source(t)) : source(t));

  const dt = period / samples;
  const t = [];
  const uIn = [];
  const uOut = [];
  const current = [];

  if (capacitance <= 0) {
    // Без згладжування: миттєве значення повністю визначає струм.
    for (let i = 0; i <= samples * 2; i += 1) {
      const time = i * dt;
      const drive = input(time);
      const iNow = Math.max(0, diodeCurrent(drive, load));
      t.push(time);
      uIn.push(source(time));
      current.push(iNow);
      uOut.push(iNow * load);
    }
  } else {
    /*
     * Крок інтегрування обмежений найшвидшим процесом у схемі — заряджанням
     * ємності крізь відкритий діод зі сталою часу (R_дж + R_s)·C. Явна схема
     * Ейлера з кроком, більшим за п'яту частину цієї сталої, розганяється
     * в коливання й дає напругу, більшу за амплітуду джерела. Тому кожен
     * відлік екрана ділимо на стільки підкроків, скільки потрібно.
     */
    const tau = (sourceResistance + rs) * capacitance;
    const subSteps = Math.min(400, Math.max(1, Math.ceil(dt / (0.2 * tau))));
    const h = dt / subSteps;

    let uc = 0;
    const step = (time) => {
      for (let k = 0; k < subSteps; k += 1) {
        const drive = input(time + k * h);
        const iNow = Math.max(0, diodeCurrent(drive - uc, sourceResistance));
        uc += ((iNow - uc / load) * h) / capacitance;
        if (uc < 0) uc = 0;
      }
      return Math.max(0, diodeCurrent(input(time) - uc, sourceResistance));
    };

    /*
     * Скільки періодів іде на розігрів: конденсатор заряджається за
     * кілька сталих часу розряду R_н·C, і поки він не зарядився, на екрані
     * був би перехідний процес увімкнення, а не усталений режим.
     */
    const warmupPeriods = Math.min(60, Math.max(4, Math.ceil((5 * load * capacitance) / period)));
    for (let i = 0; i < samples * warmupPeriods; i += 1) step(i * dt);

    for (let i = 0; i <= samples * 2; i += 1) {
      const time = i * dt;
      const iNow = step(time);
      t.push(time);
      uIn.push(source(time));
      current.push(iNow);
      uOut.push(uc);
    }
  }

  return { t, uIn, uOut, current, ...metrics({ uOut, uIn, load, bridge }) };
}

/**
 * Числа, які студент заносить у звіт.
 *
 * Коефіцієнт пульсацій рахуємо як розмах, віднесений до середнього, — це
 * найпростіше означення, і саме воно дає для однопівперіодного випрямляча
 * без ємності значення понад 100 %, тобто «згладжування немає зовсім».
 */
function metrics({ uOut, uIn, load }) {
  const n = uOut.length;
  let sum = 0;
  let sumSq = 0;
  let max = -Infinity;
  let min = Infinity;
  let conducting = 0;
  for (const u of uOut) {
    sum += u;
    sumSq += u * u;
    if (u > max) max = u;
    if (u < min) min = u;
    if (u > 1e-6) conducting += 1;
  }
  const uMean = sum / n;
  const uRms = Math.sqrt(sumSq / n);
  const amplitude = Math.max(...uIn.map(Math.abs));

  return {
    uMean,
    uRms,
    uMax: max,
    uMin: min,
    ripple: max - min,
    // Ділення на нуль дало б NaN — при замалій амплітуді діод просто не
    // відкривається, і чесна відповідь тут «пульсацій немає, бо немає струму».
    rippleFactor: uMean > 1e-9 ? (max - min) / uMean : 0,
    dropMean: amplitude - max,
    conductionFraction: conducting / n,
    load,
  };
}
