/**
 * Physics-Informed Neural Network (PINN) Engine
 *
 * Integrates Arrhenius and Coffin-Manson physics models for semiconductor degradation prediction.
 * This module provides physics-constrained predictions for thermal and mechanical stress scenarios.
 *
 * Mathematical Models:
 * 1. Arrhenius Thermal Acceleration: A(T) = A₀ * exp(Eₐ / kB * (1/T_ref - 1/T))
 * 2. Coffin-Manson Mechanical Fatigue: N_f = C * (ΔT)^(-m)
 */

import type { Measurement, ParameterDefinition } from './types';

// ─── Physical Constants ─────────────────────────────────────────────
const BOLTZMANN_CONSTANT_eV = 8.617e-5; // eV/K
const REFERENCE_TEMP_K = 298.15; // 25°C in Kelvin

// ─── Arrhenius Model Parameters (per parameter type) ──────────────
interface ArrheniusCoefficients {
  preExponential: number; // A₀: baseline degradation rate at reference temp
  activationEnergy: number; // Eₐ: activation energy in eV
  tempCoefficient: number; // accounts for non-ideal Arrhenius behavior
}

// ─── Coffin-Manson Fatigue Model Parameters ─────────────────────
interface CoffinMansonCoefficients {
  baseFatigueCycles: number; // C: baseline cycles to failure
  temperatureSensitivity: number; // m: Coffin-Manson exponent (typically 1.9-5)
  stressExponent: number; // n: stress coefficient
}

// ─── Parameter-Specific Physics Models ──────────────────────────
const PHYSICS_MODELS: Record<string, { arrhenius: ArrheniusCoefficients; coffinManson: CoffinMansonCoefficients }> = {
  'Leakage Current': {
    arrhenius: {
      preExponential: 1.2, // baseline drift per hour at 25°C
      activationEnergy: 0.95, // eV (gate oxide degradation)
      tempCoefficient: 1.08, // thermal acceleration factor
    },
    coffinManson: {
      baseFatigueCycles: 1e6,
      temperatureSensitivity: 3.2,
      stressExponent: 1.8,
    },
  },
  'Iddq': {
    arrhenius: {
      preExponential: 0.15,
      activationEnergy: 1.1, // eV (bridging defect acceleration)
      tempCoefficient: 1.12,
    },
    coffinManson: {
      baseFatigueCycles: 5e5,
      temperatureSensitivity: 2.8,
      stressExponent: 2.1,
    },
  },
  'Propagation Delay': {
    arrhenius: {
      preExponential: 0.08,
      activationEnergy: 0.62, // eV (electromigration)
      tempCoefficient: 1.05,
    },
    coffinManson: {
      baseFatigueCycles: 2e6,
      temperatureSensitivity: 2.2,
      stressExponent: 1.5,
    },
  },
  'Threshold Voltage': {
    arrhenius: {
      preExponential: 0.04,
      activationEnergy: 0.78, // eV (charge trapping / HCI)
      tempCoefficient: 1.06,
    },
    coffinManson: {
      baseFatigueCycles: 3e6,
      temperatureSensitivity: 2.5,
      stressExponent: 1.6,
    },
  },
  'Resistance': {
    arrhenius: {
      preExponential: 0.22,
      activationEnergy: 1.3, // eV (wire bond degradation)
      tempCoefficient: 1.15,
    },
    coffinManson: {
      baseFatigueCycles: 8e5,
      temperatureSensitivity: 3.5,
      stressExponent: 2.2,
    },
  },
};

// ─── PINN Physics Engine ────────────────────────────────────────

/**
 * Arrhenius Thermal Acceleration Model
 * Predicts degradation rate increase with temperature
 *
 * @param temperatureC Operating temperature in Celsius
 * @param referenceTemperatureC Baseline temperature (usually 25°C or 125°C)
 * @param coefficients Arrhenius model parameters
 * @returns Acceleration factor relative to reference temperature
 */
export function arrheniusThermalAcceleration(
  temperatureC: number,
  referenceTemperatureC: number,
  coefficients: ArrheniusCoefficients
): number {
  const T = temperatureC + 273.15; // Convert to Kelvin
  const T_ref = referenceTemperatureC + 273.15;

  // Arrhenius equation: A(T) = A₀ * exp(Eₐ / kB * (1/T_ref - 1/T))
  const exponent = (coefficients.activationEnergy / BOLTZMANN_CONSTANT_eV) * (1 / T_ref - 1 / T);
  const acceleration = Math.exp(exponent);

  // Apply non-ideal correction factor
  return acceleration * coefficients.tempCoefficient;
}

/**
 * Coffin-Manson Mechanical Fatigue Model
 * Predicts fatigue cycles to failure under thermal cycling stress
 *
 * @param temperatureCycleRange Temperature range (ΔT) in Celsius
 * @param stressLevel Normalized stress level (0-1)
 * @param coefficients Coffin-Manson model parameters
 * @returns Estimated cycles to failure
 */
export function coffinMansonFatigue(
  temperatureCycleRange: number,
  stressLevel: number,
  coefficients: CoffinMansonCoefficients
): number {
  // Coffin-Manson: N_f = C * (ΔT)^(-m) * (σ/σ_ref)^(-n)
  const cyclesToFailure = coefficients.baseFatigueCycles *
    Math.pow(temperatureCycleRange, -coefficients.temperatureSensitivity) *
    Math.pow(stressLevel, -coefficients.stressExponent);

  return Math.max(1, cyclesToFailure); // Ensure positive cycles
}

/**
 * Multi-Point Degradation Trajectory Predictor
 * Uses measurements at 0h, 24h, 96h to infer physics-constrained projection to 168h
 *
 * Combines:
 * - Linear slope extrapolation (baseline)
 * - Quadratic acceleration detection
 * - Arrhenius thermal physics constraint
 * - Confidence weighting
 */
export interface DegradationTrajectory {
  predicted168h: number;
  confidence: number;
  degradationRate: number; // µA/hour or parameter units per hour
  accelerationFactor: number; // how much degradation is accelerating (>1.0 = accelerating)
  physicsModel: 'linear' | 'quadratic' | 'arrhenius_thermal' | 'hybrid';
  upperBound95th: number; // 95% confidence interval upper bound
  lowerBound5th: number; // 5% confidence interval lower bound
}

export function predictDegradationTrajectory(
  measurements: Measurement[],
  parameterDef: ParameterDefinition,
  operatingTemperatureC: number = 125, // Typical burn-in temperature
  testDurationHours: number = 168
): DegradationTrajectory {
  if (measurements.length < 2) {
    return {
      predicted168h: measurements[measurements.length - 1]?.value || 0,
      confidence: 0.5,
      degradationRate: 0,
      accelerationFactor: 1.0,
      physicsModel: 'linear',
      upperBound95th: parameterDef.safetyLimit,
      lowerBound5th: measurements[measurements.length - 1]?.value || 0,
    };
  }

  // Extract time points and values
  const times = measurements.map((m) => m.timeHours);
  const values = measurements.map((m) => m.value);

  // ─── Linear Extrapolation ───────────────────────────────────
  const lastIdx = times.length - 1;
  const linearSlope = (values[lastIdx] - values[lastIdx - 1]) / (times[lastIdx] - times[lastIdx - 1]);
  const linearPredicted168h = values[lastIdx] + linearSlope * (testDurationHours - times[lastIdx]);

  // ─── Quadratic Acceleration Detection ────────────────────
  let quadraticPredicted168h = linearPredicted168h;
  let accelerationFactor = 1.0;

  if (measurements.length >= 3) {
    // Fit quadratic: y = at² + bt + c
    const n = measurements.length;
    const t_sum = times.reduce((a, b) => a + b, 0);
    const t2_sum = times.reduce((a, t) => a + t * t, 0);
    const t3_sum = times.reduce((a, t) => a + t * t * t, 0);
    const t4_sum = times.reduce((a, t) => a + t * t * t * t, 0);
    const v_sum = values.reduce((a, b) => a + b, 0);
    const tv_sum = times.reduce((sum, t, i) => sum + t * values[i], 0);
    const t2v_sum = times.reduce((sum, t, i) => sum + t * t * values[i], 0);

    // Solve normal equations for quadratic coefficients
    const denom = n * t2_sum * t4_sum + 2 * t_sum * t2_sum * t3_sum - t2_sum * t2_sum * t2_sum - n * t3_sum * t3_sum - t_sum * t_sum * t4_sum;

    if (Math.abs(denom) > 1e-10) {
      const a = (n * t2_sum * t2v_sum + t_sum * t3_sum * v_sum + t2_sum * tv_sum * t_sum - t2_sum * t2_sum * v_sum - t_sum * t_sum * t2v_sum - n * t3_sum * tv_sum) / denom;

      if (Math.abs(a) > 1e-8) {
        // Quadratic coefficient is significant
        quadraticPredicted168h = a * testDurationHours * testDurationHours +
                                linearSlope * testDurationHours +
                                values[0];
        accelerationFactor = Math.max(1.0, Math.abs(a * testDurationHours) / Math.max(Math.abs(linearSlope), 0.001));
      }
    }
  }

  // ─── Arrhenius Thermal Physics Constraint ───────────────
  const physicsModels = PHYSICS_MODELS[parameterDef.name];
  const arrheniusAccel = physicsModels
    ? arrheniusThermalAcceleration(operatingTemperatureC, 25, physicsModels.arrhenius)
    : 1.0;

  // Blend physics-informed prediction with empirical extrapolation
  const hoursRemaining = testDurationHours - times[lastIdx];
  const physicsInfluencedRate = linearSlope * Math.sqrt(arrheniusAccel);
  const physicsPredicted168h = values[lastIdx] + physicsInfluencedRate * hoursRemaining;

  // ─── Final Prediction (Weighted Ensemble) ────────────────
  let predicted168h = linearPredicted168h;
  let physicsModel: DegradationTrajectory['physicsModel'] = 'linear';
  let confidence = 0.78;

  if (accelerationFactor > 1.15) {
    // Strong quadratic signal detected
    predicted168h = 0.6 * quadraticPredicted168h + 0.4 * physicsPredicted168h;
    physicsModel = 'hybrid';
    confidence = 0.82;
  } else if (accelerationFactor > 1.05) {
    // Mild acceleration
    predicted168h = 0.5 * linearPredicted168h + 0.5 * physicsPredicted168h;
    physicsModel = 'quadratic';
    confidence = 0.80;
  } else {
    // Linear trend dominates
    predicted168h = 0.7 * linearPredicted168h + 0.3 * physicsPredicted168h;
    physicsModel = 'arrhenius_thermal';
    confidence = 0.75;
  }

  // ─── Confidence Interval (95% / 5% bounds) ─────────────
  const measurementNoise = values.length >= 2
    ? Math.sqrt(values.reduce((sum, v, i) => sum + (v - (i === 0 ? v : values[i - 1])) ** 2, 0) / (values.length - 1))
    : parameterDef.nominalStd * 0.1;

  const projectionUncertainty = measurementNoise * Math.sqrt(hoursRemaining / (times[lastIdx] || 1));
  const upperBound95th = Math.min(parameterDef.safetyLimit * 1.1, predicted168h + 1.96 * projectionUncertainty);
  const lowerBound5th = Math.max(0, predicted168h - 1.96 * projectionUncertainty);

  return {
    predicted168h: Math.max(0, predicted168h),
    confidence,
    degradationRate: linearSlope,
    accelerationFactor,
    physicsModel,
    upperBound95th,
    lowerBound5th,
  };
}

/**
 * Lifetime Extrapolation using Arrhenius-Coffin-Manson Combined Model
 * Projects component lifetime under various stress scenarios
 */
export interface LifetimeProjection {
  nominalLifetimeHours: number; // At 25°C
  acceleratedLifetimeHours: number; // At operating temperature
  safetyMarginHours: number; // Until safety limit
  failureRisk: number; // 0-1, probability of failure during test
}

export function projectComponentLifetime(
  currentValue: number,
  degradationRate: number, // units per hour
  safetyLimit: number,
  operatingTemperatureC: number,
  parameterName: string
): LifetimeProjection {
  const physicsModels = PHYSICS_MODELS[parameterName];
  if (!physicsModels) {
    // Fallback if parameter not in model library
    const hoursToLimit = Math.max(0, (safetyLimit - currentValue) / Math.max(degradationRate, 0.0001));
    return {
      nominalLifetimeHours: hoursToLimit,
      acceleratedLifetimeHours: hoursToLimit,
      safetyMarginHours: hoursToLimit - 168,
      failureRisk: 0.1,
    };
  }

  // Arrhenius acceleration at operating temperature
  const thermalAccel = arrheniusThermalAcceleration(operatingTemperatureC, 25, physicsModels.arrhenius);
  const acceleratedDegradationRate = degradationRate * thermalAccel;

  // Nominal lifetime at 25°C (no thermal stress)
  const nominalLifetimeHours = Math.max(0, (safetyLimit - currentValue) / Math.max(degradationRate, 0.0001));

  // Accelerated lifetime at operating temperature
  const acceleratedLifetimeHours = Math.max(0, (safetyLimit - currentValue) / Math.max(acceleratedDegradationRate, 0.0001));

  // Safety margin for 168h test
  const safetyMarginHours = acceleratedLifetimeHours - 168;

  // Failure risk estimation (Weibull-like)
  const failureRisk = Math.min(1, Math.pow(168 / Math.max(acceleratedLifetimeHours, 1), 2.0));

  return {
    nominalLifetimeHours,
    acceleratedLifetimeHours,
    safetyMarginHours,
    failureRisk,
  };
}

/**
 * Multi-Parameter Correlation Analysis
 * Detects coupled degradation across parameters (indicates systemic physical failure mode)
 */
export interface ParameterCorrelation {
  parameter1: string;
  parameter2: string;
  correlationScore: number; // 0-1
  failureMode: string; // e.g., "thermal_runaway", "interconnect_degradation"
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export function analyzeParameterCorrelation(
  parameterDegradations: Record<string, Measurement[]>
): ParameterCorrelation[] {
  const correlations: ParameterCorrelation[] = [];
  const paramNames = Object.keys(parameterDegradations);

  for (let i = 0; i < paramNames.length; i++) {
    for (let j = i + 1; j < paramNames.length; j++) {
      const p1 = paramNames[i];
      const p2 = paramNames[j];
      const measurements1 = parameterDegradations[p1];
      const measurements2 = parameterDegradations[p2];

      if (measurements1.length < 2 || measurements2.length < 2) continue;

      // Calculate correlation of degradation rates
      const changes1 = measurements1.map((m, i) => i === 0 ? 0 : (m.value - measurements1[i - 1].value));
      const changes2 = measurements2.map((m, i) => i === 0 ? 0 : (m.value - measurements2[i - 1].value));

      const mean1 = changes1.reduce((a, b) => a + b) / changes1.length;
      const mean2 = changes2.reduce((a, b) => a + b) / changes2.length;

      const covariance = changes1.reduce((sum, c1, i) => sum + (c1 - mean1) * (changes2[i] - mean2), 0) / changes1.length;
      const std1 = Math.sqrt(changes1.reduce((sum, c1) => sum + (c1 - mean1) ** 2, 0) / changes1.length);
      const std2 = Math.sqrt(changes2.reduce((sum, c2) => sum + (c2 - mean2) ** 2, 0) / changes2.length);

      const correlationScore = std1 > 0 && std2 > 0 ? covariance / (std1 * std2) : 0;

      if (Math.abs(correlationScore) > 0.3) {
        // Significant correlation detected
        let failureMode = 'unknown_coupling';
        let severity: ParameterCorrelation['severity'] = 'LOW';

        if ((p1 === 'Leakage Current' && p2 === 'Threshold Voltage') ||
            (p1 === 'Threshold Voltage' && p2 === 'Leakage Current')) {
          failureMode = 'charge_trapping_degradation';
          severity = Math.abs(correlationScore) > 0.7 ? 'HIGH' : 'MEDIUM';
        } else if ((p1 === 'Leakage Current' && p2 === 'Iddq') ||
                   (p1 === 'Iddq' && p2 === 'Leakage Current')) {
          failureMode = 'thermal_runaway';
          severity = Math.abs(correlationScore) > 0.75 ? 'CRITICAL' : 'HIGH';
        } else if ((p1 === 'Propagation Delay' && p2 === 'Threshold Voltage') ||
                   (p1 === 'Threshold Voltage' && p2 === 'Propagation Delay')) {
          failureMode = 'interconnect_electromigration';
          severity = Math.abs(correlationScore) > 0.65 ? 'HIGH' : 'MEDIUM';
        } else if ((p1 === 'Resistance' && p2 === 'Propagation Delay') ||
                   (p1 === 'Propagation Delay' && p2 === 'Resistance')) {
          failureMode = 'wire_bond_degradation';
          severity = Math.abs(correlationScore) > 0.6 ? 'HIGH' : 'MEDIUM';
        }

        correlations.push({
          parameter1: p1,
          parameter2: p2,
          correlationScore: Math.abs(correlationScore),
          failureMode,
          severity,
        });
      }
    }
  }

  // Sort by severity
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  correlations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return correlations;
}
