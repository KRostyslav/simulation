/**
 * Перенесення заряду. Рухливість, дифузія й провідність — із @edu/diode;
 * тут лишається лише те, що прив'язане до геометрії саме цього зразка.
 */

import { conductivity, SAMPLE } from "@edu/diode";

export {
  electronMobility,
  holeMobility,
  diffusionCoefficient,
  conductivity,
  driftVelocity,
  diffusionLength,
} from "@edu/diode";

/** Повний набір електричних характеристик зразка-бруска. */
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
