/**
 * Перенесення заряду: рухливість, провідність, опір, струм.
 *
 * Тут стає видно другу половину теми. Нагрівання діє на кристал двояко:
 * різко збільшує кількість носіїв (n_i ~ exp(−Eg/2kT)) і водночас зменшує
 * їхню рухливість (μ ~ T^−2,4), бо ґратка сильніше коливається й частіше
 * розсіює носії. У власному кремнії перший ефект на порядки сильніший —
 * тому опір усе одно падає. У сильно легованому, де кількість носіїв
 * майже не залежить від T, лишається тільки другий — і опір росте, як у металу.
 */

import { Q, SI, SAMPLE, T0 } from "./constants.js";
import { thermalVoltage } from "./intrinsic.js";

/**
 * Рухливість електронів [см²/(В·с)] за моделлю Кохі–Томаса, помножена на
 * температурний множник розсіяння на фононах.
 * `totalDoping` — сумарна концентрація домішок: розсіює будь-який заряджений
 * іон, і донор, і акцептор.
 */
export function electronMobility(totalDoping, temperature) {
  const { muNmin, muNmax, nRefN, alphaN, tExpN } = SI;
  const lattice = muNmin + (muNmax - muNmin) / (1 + (totalDoping / nRefN) ** alphaN);
  return lattice * (temperature / T0) ** tExpN;
}

/** Рухливість дірок. Утричі менша за електронну — дірка «переїжджає» */
/* по ланцюжку зв'язків, а не летить крізь кристал, тому вона повільніша. */
export function holeMobility(totalDoping, temperature) {
  const { muPmin, muPmax, nRefP, alphaP, tExpP } = SI;
  const lattice = muPmin + (muPmax - muPmin) / (1 + (totalDoping / nRefP) ** alphaP);
  return lattice * (temperature / T0) ** tExpP;
}

/** Коефіцієнт дифузії за співвідношенням Ейнштейна D = (kT/q)·μ [см²/с]. */
export function diffusionCoefficient(mobility, temperature) {
  return thermalVoltage(temperature) * mobility;
}

/**
 * Питома провідність σ = q(n·μₙ + p·μₚ) [См/см].
 * Внески електронів і дірок додаються — обидва типи носіїв переносять струм
 * в один бік (вони рухаються назустріч, але й заряди в них протилежні).
 */
export function conductivity({ n, p, muN, muP }) {
  return Q * (n * muN + p * muP);
}

/**
 * Дрейфова швидкість із насиченням [см/с].
 * У слабкому полі v = μE, але нескінченно розганятись носій не може:
 * при v ≈ 10⁷ см/с він починає віддавати енергію ґратці так само швидко,
 * як бере її від поля. Без цього обмеження модель при 5 В видала б
 * швидкість, більшу за фізично можливу.
 */
export function driftVelocity(mobility, field) {
  const low = mobility * field;
  return low / (1 + Math.abs(low) / SI.vSat);
}

/** Повний набір електричних характеристик зразка. */
export function sampleElectrics({ n, p, muN, muP, voltage }) {
  const sigma = conductivity({ n, p, muN, muP });
  const resistivity = 1 / sigma;
  const resistance = resistivity * SAMPLE.formFactor;
  const field = voltage / SAMPLE.lengthCm;
  const current = voltage / resistance;
  return {
    sigma,
    resistivity,
    resistance,
    field,
    current,
    currentDensity: current / SAMPLE.areaCm2,
  };
}
