/**
 * Фізика напівпровідникового діода — спільна для всіх симуляцій монорепи.
 *
 * Пакет не знає ні про DOM, ні про канву, ні про конкретну лабораторну роботу:
 * він лише відповідає на питання «який струм потече при такій напрузі й такій
 * температурі». Усе, що стосується того, як це показати, лишається в апці.
 */

export { Q, K_EV, EPS0, T0, SI, GE, MATERIALS, SAMPLE, clamp } from "./constants.js";
export {
  thermalVoltage,
  bandGap,
  intrinsicConcentration,
  crossoverTemperature,
} from "./intrinsic.js";
export {
  electronMobility,
  holeMobility,
  diffusionCoefficient,
  diffusionLength,
  conductivity,
  driftVelocity,
} from "./transport.js";
export { DOPANT, carrierLifetime, equilibriumCarriers, carriers } from "./doping.js";
export {
  CM_TO_UM,
  builtInVoltage,
  depletion,
  junctionCapacitance,
} from "./junction.js";
export { generationCurrent } from "./generation.js";
export {
  breakdownVoltage,
  breakdownTempCoefficient,
  breakdownAt,
} from "./breakdown.js";
export {
  saturationCurrent,
  seriesResistance,
  solveDiodeCurrent,
  diodePoint,
  ivCurve,
  voltageForCurrent,
} from "./diode.js";
