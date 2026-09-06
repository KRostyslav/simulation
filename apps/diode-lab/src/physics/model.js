/**
 * Знімок стану: єдине джерело чисел для всієї апки.
 *
 * Правило, спільне для монорепи: жоден модуль UI не рахує фізику сам. Панель,
 * графік, підписи над канвою й живий коментар беруть той самий об'єкт, який
 * повернула ця функція, — тому розійтися з розрахунком вони не можуть.
 *
 * Показники створюються через makeReadout, який не дасть створити число без
 * пояснення, чому воно таке. У лабораторній роботі це особливо важливо:
 * студент має здати не «I_s = 2·10⁻¹⁴», а «I_s = 2·10⁻¹⁴, бо це відрізок,
 * який відтяла на осі пряма, проведена по моїх точках».
 */

import { makeReadout } from "@edu/explain";
import { decimal, sci, smart, withPrefix } from "@edu/explain";
import { thermalVoltage } from "@edu/diode";

import { I_REF, MODE } from "./constants.js";
import { DEVICE_BY_ID } from "./devices.js";
import { operatingPoint, voltageAtCurrent } from "./circuit.js";
import { seriesKey, seriesOf } from "./measurements.js";
import { rectifierWaveform } from "./rectifier.js";
import {
  pickLinearRegion,
  fitShockley,
  decadeCheck,
  dynamicResistance,
  thresholdVoltage,
  thresholdByTangent,
  theoryMvPerDecade,
  compareSeries,
  breakdownFromPoints,
} from "./analysis.js";

export function initialState() {
  return {
    mode: MODE.stand,
    deviceId: "si",
    temperature: 300,
    emf: 0,
    resistance: 1000,
    // Випрямляч
    amplitude: 10,
    load: 1000,
    capacitance: 0,
    bridge: false,
  };
}

/**
 * Повний знімок. `table` — таблиця вимірювань студента; вона впливає на
 * знімок так само, як і положення регуляторів, бо обробка результатів
 * рахується саме з неї, а не з теорії.
 */
export function snapshot(state, table = {}) {
  const device = DEVICE_BY_ID[state.deviceId] ?? DEVICE_BY_ID.si;
  const temperature = state.temperature;
  const key = seriesKey({ deviceId: device.id, temperature });
  const points = seriesOf(table, key);

  const op = operatingPoint({
    device,
    temperature,
    emf: state.emf,
    resistance: state.resistance,
  });

  const analysis = analyse({ points, temperature, rs: op.rs, device });
  const wave =
    state.mode === MODE.rectifier
      ? rectifierWaveform({
          device,
          temperature,
          amplitude: state.amplitude,
          load: state.load,
          capacitance: state.capacitance,
          bridge: state.bridge,
        })
      : null;

  const snap = {
    mode: state.mode,
    device,
    temperature,
    emf: state.emf,
    resistance: state.resistance,
    seriesKey: key,
    points,
    op,
    analysis,
    wave,
    table,
    state,
  };

  snap.readouts = buildReadouts(snap);
  snap.warnings = [];
  return snap;
}

/** Уся обробка результатів в одному місці — і в тій самій послідовності, що в протоколі. */
export function analyse({ points, temperature, rs }) {
  const region = pickLinearRegion(points, { temperature, rs });
  const fit = region.enough ? fitShockley(region.used, { temperature }) : null;
  const forward = points.filter((p) => p.voltage > 0 && p.current > 0);

  // Динамічний опір беремо в точці, найближчій до опорного струму: саме
  // її й вимірюють у роботі, бо там прилад ще не перевантажений, а струм
  // уже впевнено читається.
  let rDyn = null;
  if (forward.length >= 3) {
    let best = 1;
    let distance = Infinity;
    for (let i = 1; i < forward.length - 1; i += 1) {
      const d = Math.abs(Math.log10(forward[i].current / I_REF));
      if (d < distance) {
        distance = d;
        best = i;
      }
    }
    rDyn = dynamicResistance(forward, best);
  }

  return {
    region,
    fit,
    decade: fit ? decadeCheck(fit, temperature) : null,
    rDyn,
    threshold: thresholdVoltage(points),
    tangent: thresholdByTangent(points),
    breakdown: breakdownFromPoints(points),
    theoryMv: theoryMvPerDecade(temperature, 1),
  };
}

/** Порівняння двох серій — для завдань «Si проти Ge» і «−2 мВ/К». */
export function compare(table, a, b) {
  const pa = seriesOf(table, seriesKey(a));
  const pb = seriesOf(table, seriesKey(b));
  if (pa.length < 3 || pb.length < 3) return null;
  return compareSeries(
    { points: pa, temperature: a.temperature },
    { points: pb, temperature: b.temperature },
  );
}

function buildReadouts(snap) {
  const { op, temperature, analysis, resistance, emf, device, wave } = snap;
  const vt = thermalVoltage(temperature);
  const out = {};

  const add = (readout) => {
    out[readout.id] = readout;
  };

  add(
    makeReadout({
      id: "current",
      symbol: "I",
      label: "Струм через діод",
      value: op.current,
      display: withPrefix(op.current, "А"),
      why:
        op.current === 0
          ? "Джерело вимкнене — струму немає, і саме ця точка є початком координат ВАХ."
          : `Струм задає ${op.regime === "обмежує резистор" ? "обмежувальний резистор: діод уже відкритий, і далі росте лише спад на R" : op.regime}.`,
      formula: "I = I_s·(exp(U/V_T) − 1)",
      substitution: "I = {is}·(exp({u}/{vt}) − 1) = {i}",
      terms: {
        is: withPrefix(op.is, "А"),
        u: `${decimal(op.junctionVoltage, 3)} В`,
        vt: `${decimal(vt, 4)} В`,
        i: withPrefix(op.current, "А"),
      },
      codexRef: "shockley",
      tone: op.regime === "пробій" ? "warn" : "neutral",
    }),
  );

  add(
    makeReadout({
      id: "diodeVoltage",
      symbol: "U_д",
      label: "Напруга на діоді",
      value: op.diodeVoltage,
      display: `${decimal(op.diodeVoltage, 3)} В`,
      why: "Показ вольтметра, під'єднаного просто до діода. Решта ЕРС падає на обмежувальному резисторі.",
      formula: "E = U_д + I·R",
      substitution: "{e} = {ud} + {i}·{r} = {sum}",
      terms: {
        e: `${decimal(emf, 3)} В`,
        ud: `${decimal(op.diodeVoltage, 3)} В`,
        i: withPrefix(op.current, "А"),
        r: `${smart(resistance)} Ом`,
        sum: `${decimal(op.diodeVoltage + op.current * resistance, 3)} В`,
      },
      codexRef: "measurement",
    }),
  );

  add(
    makeReadout({
      id: "resistorVoltage",
      symbol: "U_R",
      label: "Спад на резисторі",
      value: op.resistorVoltage,
      display: `${decimal(op.resistorVoltage, 3)} В`,
      why: "Те, що не дісталося діоду. Саме цей спад і не дає струму зрости лавиноподібно.",
      codexRef: "measurement",
    }),
  );

  add(
    makeReadout({
      id: "power",
      symbol: "P",
      label: "Потужність на діоді",
      value: op.power,
      display: withPrefix(op.power, "Вт"),
      why: "Уся вона перетворюється на тепло в кристалі. Понад сотню міліват реальний корпус уже помітно нагріває.",
      formula: "P = U_д·I",
      substitution: "P = {u}·{i} = {p}",
      terms: {
        u: `${decimal(op.diodeVoltage, 3)} В`,
        i: withPrefix(op.current, "А"),
        p: withPrefix(op.power, "Вт"),
      },
      codexRef: "heating",
      tone: op.power > 0.1 ? "warn" : "neutral",
    }),
  );

  add(
    makeReadout({
      id: "isTheory",
      symbol: "I_s",
      label: "Струм насичення (теорія)",
      value: op.is,
      display: withPrefix(op.is, "А"),
      why: "Розрахований із параметрів переходу — те, з чим студент порівнює власний результат обробки.",
      formula: "I_s = q·A·n_i²·(D_p/(L_p·N_d) + D_n/(L_n·N_a))",
      substitution: "n_i = {ni} см⁻³ → I_s = {is}",
      terms: { ni: sci(op.ni, 2), is: withPrefix(op.is, "А") },
      codexRef: "saturationCurrent",
    }),
  );

  const fit = analysis.fit;
  add(
    makeReadout({
      id: "ideality",
      symbol: "n",
      label: "Коефіцієнт ідеальності",
      value: fit ? fit.ideality : NaN,
      display: fit ? decimal(fit.ideality, 3) : "—",
      why: fit
        ? "Отриманий із нахилу прямої, проведеної методом найменших квадратів по ваших точках у координатах lg I(U). Одиниця означає чисту дифузію, двійка — рекомбінацію в переході."
        : "Запишіть щонайменше чотири точки на прямій вітці — по одній точці нахил не визначити.",
      formula: fit ? "n = 1/(b·V_T·ln10)" : null,
      substitution: fit ? "n = 1/({b}·{vt}·2,303) = {n}" : null,
      terms: fit
        ? {
            b: `${decimal(fit.b, 2)} дек/В`,
            vt: `${decimal(fit.vt, 4)} В`,
            n: decimal(fit.ideality, 3),
          }
        : null,
      codexRef: "ideality",
      tone: fit && (fit.ideality < 0.9 || fit.ideality > 2.2) ? "warn" : "neutral",
    }),
  );

  add(
    makeReadout({
      id: "isMeasured",
      symbol: "I_s*",
      label: "Струм насичення (з досліду)",
      value: fit ? fit.is : NaN,
      display: fit ? withPrefix(fit.is, "А") : "—",
      why: fit
        ? "Відрізок, який ваша пряма відтинає на осі струмів при U = 0. Збіг із теорією лише за порядком величини — це нормальний результат: систематична похибка приладу зсуває всю пряму паралельно."
        : "Потрібна апроксимація прямої вітки.",
      formula: fit ? "I_s = 10^a" : null,
      substitution: fit ? "I_s = 10^{a} = {is}" : null,
      terms: fit ? { a: decimal(fit.a, 2), is: withPrefix(fit.is, "А") } : null,
      codexRef: "measurement",
    }),
  );

  const decade = analysis.decade;
  add(
    makeReadout({
      id: "mvPerDecade",
      symbol: "ΔU",
      label: "Напруга на декаду струму",
      value: decade ? decade.measured : NaN,
      display: decade ? `${decimal(decade.measured, 1)} мВ` : "—",
      why: decade
        ? `Скільки треба додати напруги, щоб струм зріс у десять разів. Теорія при ${Math.round(temperature)} К дає ${decimal(decade.theory, 1)} мВ — те саме «правило 60 мілівольт».`
        : "Рахується з нахилу прямої на ділянці lg I(U).",
      formula: decade ? "ΔU = n·V_T·ln10" : null,
      substitution: decade ? "ΔU = {n}·{vt}·2,303 = {du}" : null,
      terms:
        decade && fit
          ? {
              n: decimal(fit.ideality, 3),
              vt: `${decimal(fit.vt, 4)} В`,
              du: `${decimal(decade.measured, 1)} мВ`,
            }
          : null,
      codexRef: "decade60",
      tone: decade && decade.verdict !== "збігається" ? "warn" : "good",
    }),
  );

  const rDyn = analysis.rDyn;
  add(
    makeReadout({
      id: "rDynamic",
      symbol: "r_дин",
      label: "Динамічний опір",
      value: rDyn ? rDyn.r : NaN,
      display: rDyn ? `${smart(rDyn.r)} Ом` : "—",
      why: rDyn
        ? "Опір діода для малого приросту струму. Він у сотні разів менший за статичний U/I — і саме тому діод не можна описувати законом Ома."
        : "Потрібні щонайменше три сусідні точки прямої вітки.",
      formula: rDyn ? "r_дин = ΔU/ΔI ≈ n·V_T/I" : null,
      substitution: rDyn ? "r = {du}/{di} = {r}" : null,
      terms: rDyn
        ? {
            du: `${decimal(rDyn.du * 1000, 1)} мВ`,
            di: withPrefix(rDyn.di, "А"),
            r: `${smart(rDyn.r)} Ом`,
          }
        : null,
      codexRef: "dynamicResistance",
    }),
  );

  const threshold = analysis.threshold;
  add(
    makeReadout({
      id: "threshold",
      symbol: "U_пор",
      label: `Порогова напруга (при ${withPrefix(I_REF, "А")})`,
      value: threshold?.voltage ?? NaN,
      display: threshold?.voltage != null ? `${decimal(threshold.voltage, 3)} В` : "—",
      why: threshold?.voltage
        ? "Напруга, за якої струм досягає опорного значення 1 мА. Це не константа матеріалу, а домовленість: за іншого опорного струму поріг буде іншим."
        : "Запишіть точки по обидва боки від струму 1 мА.",
      codexRef: "threshold",
    }),
  );

  add(
    makeReadout({
      id: "thresholdTheory",
      symbol: "U₀",
      label: "Поріг за теорією",
      value: voltageAtCurrent({ device, temperature, resistance, target: I_REF }),
      display: `${decimal(voltageAtCurrent({ device, temperature, resistance, target: I_REF }), 3)} В`,
      why: `Розрахунок для ${device.material.name.toLowerCase()}ю при ${Math.round(temperature)} К — те, з чим порівнюють виміряне значення.`,
      codexRef: "siVsGe",
    }),
  );

  add(
    makeReadout({
      id: "r2",
      symbol: "r²",
      label: "Якість апроксимації",
      value: fit ? fit.r2 : NaN,
      display: fit ? decimal(fit.r2, 5) : "—",
      why: fit
        ? "Наскільки щільно точки лягли на пряму. Помітне падіння означає, що в апроксимацію потрапили точки з зони послідовного опору або з зони, де прилад уже не читає струм."
        : "З'явиться після апроксимації.",
      codexRef: "leastSquares",
      tone: fit && fit.r2 < 0.99 ? "warn" : "good",
    }),
  );

  add(
    makeReadout({
      id: "vbr",
      symbol: "U_проб",
      label: "Напруга пробою (теорія)",
      value: op.breakdown.vbr,
      display: `${decimal(op.breakdown.vbr, 2)} В`,
      why: `Пробій ${op.breakdown.kind}. Він визначається легуванням: що сильніше леговано, то вужчий збіднений шар і то раніше настає пробій.`,
      formula: "U_проб ≈ 60·(E_g/1,1)^1,5·(N/10¹⁶)^−0,75",
      substitution: "N = {n} см⁻³ → U_проб = {v}",
      terms: {
        n: sci(Math.min(device.na, device.nd), 1),
        v: `${decimal(op.breakdown.vbr, 2)} В`,
      },
      codexRef: "breakdown",
    }),
  );

  if (wave) {
    add(
      makeReadout({
        id: "uMean",
        symbol: "U_ср",
        label: "Середня напруга на виході",
        value: wave.uMean,
        display: `${decimal(wave.uMean, 2)} В`,
        why: "Те, що покаже вольтметр постійного струму. Для ідеального однопівперіодного випрямляча без згладжування це U_m/π; діод забирає своє падіння, тому виходить менше.",
        codexRef: "rectifier",
      }),
    );
    add(
      makeReadout({
        id: "rippleFactor",
        symbol: "k_п",
        label: "Коефіцієнт пульсацій",
        value: wave.rippleFactor,
        display: `${decimal(wave.rippleFactor * 100, 1)} %`,
        why: "Розмах пульсацій, віднесений до середньої напруги. Конденсатор утримує заряд між імпульсами й тим зменшує розмах.",
        formula: "k_п = (U_max − U_min)/U_ср",
        substitution: "k = ({max} − {min})/{mean} = {k}",
        terms: {
          max: `${decimal(wave.uMax, 2)} В`,
          min: `${decimal(wave.uMin, 2)} В`,
          mean: `${decimal(wave.uMean, 2)} В`,
          k: `${decimal(wave.rippleFactor * 100, 1)} %`,
        },
        codexRef: "smoothing",
        tone: wave.rippleFactor < 0.05 ? "good" : "neutral",
      }),
    );
    add(
      makeReadout({
        id: "dropMean",
        symbol: "ΔU",
        label: "Втрата на діоді",
        value: wave.dropMean,
        display: `${decimal(wave.dropMean, 2)} В`,
        why: "Різниця між амплітудою входу й максимумом виходу. Це та сама пряма напруга, яку ви виміряли на стенді, — випрямляч не додає до неї нічого нового.",
        codexRef: "rectifier",
      }),
    );
  }

  return out;
}
