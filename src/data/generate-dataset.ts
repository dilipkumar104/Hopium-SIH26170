import {
  type Component,
  type ParameterData,
  type ParameterDefinition,
  type Measurement,
  type AnomalyMetrics,
  type PredictionMetrics,
  type PINNMetrics,
  type RiskScore,
  type ExplainabilityItem,
  type RiskLevel,
  type AIRecommendation,
  type LotParameterStats,
} from './types';
import {
  predictDegradationTrajectory,
  projectComponentLifetime,
  analyzeParameterCorrelation,
} from './pinn-physics-engine';

// ─── Seeded PRNG (deterministic) ────────────────────────────────────

class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 16807 + 0) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  gaussian(mean: number, std: number): number {
    // Box-Muller transform
    const u1 = this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * std;
  }
}

// ─── Parameter Definitions ──────────────────────────────────────────

export const PARAMETER_DEFINITIONS: ParameterDefinition[] = [
  {
    name: 'Leakage Current',
    unit: 'µA',
    safetyLimit: 50,
    nominalMean: 10,
    nominalStd: 2.5,
    naturalDriftPerHour: 0.005,
  },
  {
    name: 'Iddq',
    unit: 'mA',
    safetyLimit: 5.0,
    nominalMean: 1.2,
    nominalStd: 0.3,
    naturalDriftPerHour: 0.001,
  },
  {
    name: 'Propagation Delay',
    unit: 'ns',
    safetyLimit: 120,
    nominalMean: 45,
    nominalStd: 8,
    naturalDriftPerHour: 0.02,
  },
  {
    name: 'Threshold Voltage',
    unit: 'V',
    safetyLimit: 3.5,
    nominalMean: 1.8,
    nominalStd: 0.15,
    naturalDriftPerHour: 0.0003,
  },
  {
    name: 'Resistance',
    unit: 'mΩ',
    safetyLimit: 200,
    nominalMean: 85,
    nominalStd: 12,
    naturalDriftPerHour: 0.015,
  },
];

export const TIME_POINTS = [0, 24, 96, 168];

const LOT_ID = 'IGBT-2026-017';
const TEST_BATCH = 'BIN-ESS-2026-Q3-001';

// ─── Component Behavior Profiles ────────────────────────────────────

type BehaviorProfile = 'healthy' | 'moderate_drift' | 'high_drift' | 'critical' | 'static_pass_population_anomaly' | 'sudden_jump';

interface ComponentSeed {
  id: string;
  profile: BehaviorProfile;
  seed: number;
}

// ─── Showcase Components ────────────────────────────────────────────

const SHOWCASE_COMPONENTS: ComponentSeed[] = [
  { id: 'C201', profile: 'healthy', seed: 201 },
  { id: 'C518', profile: 'moderate_drift', seed: 518 },
  { id: 'C742', profile: 'high_drift', seed: 742 },
  { id: 'C883', profile: 'static_pass_population_anomaly', seed: 883 },
];

// ─── Generate measurements for a component ──────────────────────────

function generateMeasurements(
  rng: SeededRandom,
  param: ParameterDefinition,
  profile: BehaviorProfile
): { measurements: Measurement[]; predicted168h: number; confidence: number } {
  const baseValue = rng.gaussian(param.nominalMean, param.nominalStd * 0.3);

  let measurements: Measurement[];
  let predicted168h: number;
  let confidence: number;

  switch (profile) {
    case 'healthy': {
      measurements = TIME_POINTS.map((t) => ({
        timeHours: t,
        value: Math.max(0, baseValue + param.naturalDriftPerHour * t + rng.gaussian(0, param.nominalStd * 0.05)),
      }));
      const lastVal = measurements[measurements.length - 1].value;
      predicted168h = lastVal + rng.gaussian(0, param.nominalStd * 0.02);
      confidence = 0.92 + rng.next() * 0.07;
      break;
    }

    case 'moderate_drift': {
      const driftMultiplier = 3 + rng.next() * 4; // 3x-7x natural drift
      measurements = TIME_POINTS.map((t) => ({
        timeHours: t,
        value: Math.max(0, baseValue + param.naturalDriftPerHour * driftMultiplier * t + rng.gaussian(0, param.nominalStd * 0.08)),
      }));
      // Extrapolate with acceleration
      const slope = (measurements[2].value - measurements[1].value) / (TIME_POINTS[2] - TIME_POINTS[1]);
      predicted168h = measurements[2].value + slope * (168 - 96) * (1 + rng.next() * 0.3);
      confidence = 0.75 + rng.next() * 0.15;
      break;
    }

    case 'high_drift': {
      const driftMultiplier = 8 + rng.next() * 12; // 8x-20x natural drift
      const acceleration = 1 + rng.next() * 0.5; // accelerating trend
      measurements = TIME_POINTS.map((t) => ({
        timeHours: t,
        value: Math.max(0, baseValue + param.naturalDriftPerHour * driftMultiplier * t * (1 + acceleration * t / 500) + rng.gaussian(0, param.nominalStd * 0.05)),
      }));
      const slope = (measurements[2].value - measurements[1].value) / (TIME_POINTS[2] - TIME_POINTS[1]);
      predicted168h = measurements[2].value + slope * (168 - 96) * (1.3 + rng.next() * 0.4);
      confidence = 0.85 + rng.next() * 0.1;
      break;
    }

    case 'critical': {
      const driftMultiplier = 15 + rng.next() * 20;
      measurements = TIME_POINTS.map((t) => ({
        timeHours: t,
        value: Math.max(0, baseValue + param.naturalDriftPerHour * driftMultiplier * t * (1 + t / 200) + rng.gaussian(0, param.nominalStd * 0.03)),
      }));
      predicted168h = param.safetyLimit * (0.9 + rng.next() * 0.25); // Near or over limit
      confidence = 0.88 + rng.next() * 0.1;
      break;
    }

    case 'static_pass_population_anomaly': {
      // Values stay within static limits but are far from population center
      const offset = param.nominalStd * (2.5 + rng.next() * 1.5); // 2.5-4σ above mean
      measurements = TIME_POINTS.map((t) => ({
        timeHours: t,
        value: Math.max(0, baseValue + offset + param.naturalDriftPerHour * t * 0.5 + rng.gaussian(0, param.nominalStd * 0.03)),
      }));
      predicted168h = measurements[measurements.length - 1].value + param.naturalDriftPerHour * 20;
      confidence = 0.9 + rng.next() * 0.08;
      break;
    }

    case 'sudden_jump': {
      // Normal then sudden jump at 96h
      const jumpMagnitude = param.nominalStd * (3 + rng.next() * 3);
      measurements = TIME_POINTS.map((t, i) => ({
        timeHours: t,
        value: Math.max(0, baseValue + param.naturalDriftPerHour * t + (i >= 2 ? jumpMagnitude : 0) + rng.gaussian(0, param.nominalStd * 0.04)),
      }));
      predicted168h = measurements[2].value + jumpMagnitude * 0.3;
      confidence = 0.7 + rng.next() * 0.15;
      break;
    }
  }

  // Clamp predicted value
  predicted168h = Math.max(0, predicted168h);

  return { measurements, predicted168h, confidence };
}

// ─── Risk Level from score ──────────────────────────────────────────

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 0.86) return 'CRITICAL';
  if (score >= 0.61) return 'HIGH';
  if (score >= 0.31) return 'MEDIUM';
  return 'LOW';
}

// ─── Compute anomaly metrics ────────────────────────────────────────

function computeAnomalyMetrics(
  componentValue: number,
  lotValues: number[],
  lotMean: number,
  lotStd: number
): AnomalyMetrics {
  const zScore = lotStd > 0 ? (componentValue - lotMean) / lotStd : 0;

  // Robust z-score using median and MAD
  const sorted = [...lotValues].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mad = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b)[Math.floor(sorted.length / 2)] * 1.4826;
  const robustZScore = mad > 0 ? (componentValue - median) / mad : 0;

  // Percentile
  const belowCount = lotValues.filter((v) => v < componentValue).length;
  const percentile = (belowCount / lotValues.length) * 100;

  // Anomaly score (sigmoid-like mapping of absolute z-score)
  const absZ = Math.abs(zScore);
  const anomalyScore = Math.min(1, 1 - Math.exp(-absZ * absZ / 4));

  const deviationFromBaseline = componentValue - lotMean;

  const level = getRiskLevel(anomalyScore);

  return { anomalyScore, zScore, robustZScore, percentile, deviationFromBaseline, level };
}

// ─── Compute PINN metrics ──────────────────────────────────────

function computePINNMetrics(
  measurements: Measurement[],
  paramDef: ParameterDefinition,
  driftScore: number,
  operatingTemperatureC: number = 125
): PINNMetrics {
  // Get physics-informed trajectory prediction
  const trajectory = predictDegradationTrajectory(
    measurements,
    paramDef,
    operatingTemperatureC,
    168
  );

  // Get lifetime projection
  const lastMeasurement = measurements[measurements.length - 1];
  const driftRate = measurements.length >= 2
    ? (lastMeasurement.value - measurements[0].value) / (lastMeasurement.timeHours - measurements[0].timeHours)
    : 0;

  const lifetime = projectComponentLifetime(
    lastMeasurement.value,
    driftRate,
    paramDef.safetyLimit,
    operatingTemperatureC,
    paramDef.name
  );

  return {
    physicsModel: trajectory.physicsModel,
    accelerationFactor: trajectory.accelerationFactor,
    upperBound95th: trajectory.upperBound95th,
    lowerBound5th: trajectory.lowerBound5th,
    thermalAccelerationFactor: lifetime.acceleratedLifetimeHours > 0
      ? lifetime.nominalLifetimeHours / lifetime.acceleratedLifetimeHours
      : 1.0,
    estimatedLifetimeHours: lifetime.acceleratedLifetimeHours,
    failureRiskPercent: lifetime.failureRisk * 100,
    correlatedFailureModes: [],
  };
}

// ─── Compute prediction metrics ─────────────────────────────────────

function computePredictionMetrics(
  measurements: Measurement[],
  predicted168h: number,
  predictionConfidence: number,
  safetyLimit: number
): PredictionMetrics {
  // Drift rate = average change per hour over last interval
  const lastTwo = measurements.slice(-2);
  const driftRate = lastTwo.length === 2
    ? (lastTwo[1].value - lastTwo[0].value) / (lastTwo[1].timeHours - lastTwo[0].timeHours)
    : 0;

  // Safety margin
  const safetyMargin = Math.max(0, safetyLimit - predicted168h);
  const safetyMarginPct = (safetyMargin / safetyLimit) * 100;

  // Drift score (0-1 based on how abnormal the drift is)
  const totalChange = measurements.length >= 2
    ? Math.abs(measurements[measurements.length - 1].value - measurements[0].value)
    : 0;
  const initialValue = measurements[0]?.value || 1;
  const changeRatio = totalChange / Math.max(initialValue, 0.001);
  const driftScore = Math.min(1, changeRatio * 2); // scale so 50%+ change = 1.0

  // Trend direction
  let trendDirection: PredictionMetrics['trendDirection'] = 'stable';
  if (measurements.length >= 3) {
    const earlySlope = (measurements[1].value - measurements[0].value) / Math.max(1, measurements[1].timeHours - measurements[0].timeHours);
    const lateSlope = (measurements[measurements.length - 1].value - measurements[measurements.length - 2].value)
      / Math.max(1, measurements[measurements.length - 1].timeHours - measurements[measurements.length - 2].timeHours);

    if (Math.abs(lateSlope) < Math.abs(earlySlope) * 0.5 && Math.abs(lateSlope) < 0.01) {
      trendDirection = 'stable';
    } else if (lateSlope > earlySlope * 1.5 && lateSlope > 0) {
      trendDirection = 'accelerating';
    } else if (lateSlope > 0) {
      trendDirection = 'increasing';
    } else {
      trendDirection = 'decreasing';
    }
  }

  const driftLevel = getRiskLevel(driftScore);

  return {
    predictedValue: predicted168h,
    confidence: predictionConfidence,
    driftRate,
    driftScore,
    safetyMargin,
    safetyMarginPct,
    trendDirection,
    driftLevel,
  };
}

// ─── Compute risk score ─────────────────────────────────────────────

function computeRiskScore(
  anomalyScore: number,
  driftScore: number,
  predicted168h: number,
  safetyLimit: number
): RiskScore {
  const anomalyWeight = 0.40;
  const driftWeight = 0.35;
  const predictionWeight = 0.25;

  // Prediction-to-limit risk
  const predictionRisk = Math.min(1, Math.max(0, predicted168h / safetyLimit));

  const anomalyContribution = anomalyScore * anomalyWeight;
  const driftContribution = driftScore * driftWeight;
  const predictionContribution = predictionRisk * predictionWeight;

  const overallScore = Math.min(1, anomalyContribution + driftContribution + predictionContribution);

  return {
    anomalyWeight,
    driftWeight,
    predictionWeight,
    anomalyContribution,
    driftContribution,
    predictionContribution,
    overallScore,
    level: getRiskLevel(overallScore),
  };
}

// ─── Generate explanations ──────────────────────────────────────────

function generateExplanations(
  anomaly: AnomalyMetrics,
  prediction: PredictionMetrics,
  risk: RiskScore,
  paramName: string
): ExplainabilityItem[] {
  const items: ExplainabilityItem[] = [];

  // Population anomaly
  if (anomaly.anomalyScore > 0.3) {
    const sigmaStr = Math.abs(anomaly.zScore).toFixed(1);
    items.push({
      category: 'population',
      title: 'Population Anomaly',
      description: `${paramName} is ${sigmaStr}σ ${anomaly.zScore > 0 ? 'above' : 'below'} the lot baseline. Component is in the ${anomaly.percentile.toFixed(1)} percentile.`,
      severity: anomaly.level,
    });
  }

  // Drift
  if (prediction.driftScore > 0.3) {
    const driftPct = (prediction.driftRate > 0 ? '+' : '') + (prediction.driftRate * 100).toFixed(1);
    const trendLabel = prediction.trendDirection === 'accelerating'
      ? 'with accelerating trend'
      : prediction.trendDirection === 'increasing'
        ? 'showing steady increase'
        : '';
    items.push({
      category: 'drift',
      title: 'Abnormal Drift',
      description: `${paramName} shows drift rate of ${driftPct} per hour ${trendLabel}. Drift score: ${prediction.driftScore.toFixed(2)}.`,
      severity: prediction.driftLevel,
    });
  }

  // Prediction
  if (prediction.safetyMarginPct < 30) {
    items.push({
      category: 'prediction',
      title: 'Future Prediction Concern',
      description: `Predicted 168h value (${prediction.predictedValue.toFixed(1)}) is within ${prediction.safetyMarginPct.toFixed(1)}% of the safety boundary. Safety margin: ${prediction.safetyMargin.toFixed(1)}.`,
      severity: prediction.safetyMarginPct < 10 ? 'CRITICAL' : prediction.safetyMarginPct < 20 ? 'HIGH' : 'MEDIUM',
    });
  }

  // Combined
  if (items.length >= 2) {
    items.push({
      category: 'combined',
      title: 'Combined Evidence',
      description: `Multiple independent indicators suggest elevated risk. ${items.length - 1} risk factors identified.`,
      severity: risk.level,
    });
  }

  return items;
}

// ─── Determine AI Recommendation ────────────────────────────────────

function getAIRecommendation(risk: RiskScore): AIRecommendation {
  if (risk.overallScore >= 0.61) return 'REVIEW';
  if (risk.overallScore >= 0.31) return 'REVIEW';
  return 'PASS';
}

// ─── Compute Lot Statistics ─────────────────────────────────────────

export function computeLotStats(
  components: Component[],
  parameterName: string,
  timePoint: number = 96 // Use 96h as reference
): LotParameterStats {
  const values: number[] = [];

  for (const comp of components) {
    const pd = comp.parameterData.find((p) => p.parameter === parameterName);
    if (!pd) continue;
    const m = pd.measurements.find((m) => m.timeHours === timePoint);
    if (m) values.push(m.value);
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const median = sorted[Math.floor(n / 2)];
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];

  return {
    parameter: parameterName,
    mean,
    median,
    std,
    min: sorted[0],
    max: sorted[n - 1],
    q1,
    q3,
    values: sorted,
  };
}

// ─── Main Dataset Generator ─────────────────────────────────────────

export function generateDataset(): Component[] {
  const TOTAL = 1000;
  const components: Component[] = [];
  const rng = new SeededRandom(42);

  // Determine profiles for non-showcase components
  const profileDistribution: { profile: BehaviorProfile; count: number }[] = [
    { profile: 'healthy', count: 930 },
    { profile: 'moderate_drift', count: 28 },
    { profile: 'high_drift', count: 15 },
    { profile: 'critical', count: 7 },
    { profile: 'sudden_jump', count: 10 },
    { profile: 'static_pass_population_anomaly', count: 6 },
  ];

  // Build component seeds
  const allSeeds: ComponentSeed[] = [...SHOWCASE_COMPONENTS];
  const usedIds = new Set(SHOWCASE_COMPONENTS.map((c) => c.id));

  let profileIdx = 0;
  let profileRemaining = profileDistribution[0].count;

  for (let i = 0; i < TOTAL - SHOWCASE_COMPONENTS.length; i++) {
    let id: string;
    do {
      const num = Math.floor(rng.next() * 9999) + 1;
      id = `C${String(num).padStart(3, '0')}`;
    } while (usedIds.has(id));
    usedIds.add(id);

    allSeeds.push({
      id,
      profile: profileDistribution[profileIdx].profile,
      seed: Math.floor(rng.next() * 100000),
    });

    profileRemaining--;
    if (profileRemaining <= 0 && profileIdx < profileDistribution.length - 1) {
      profileIdx++;
      profileRemaining = profileDistribution[profileIdx].count;
    }
  }

  // Sort by ID for consistent ordering
  allSeeds.sort((a, b) => a.id.localeCompare(b.id));

  // Generate base test data first (needed for lot statistics)
  const rawData: {
    seed: ComponentSeed;
    paramData: {
      param: ParameterDefinition;
      measurements: Measurement[];
      predicted168h: number;
      confidence: number;
    }[];
  }[] = [];

  for (const seed of allSeeds) {
    const compRng = new SeededRandom(seed.seed);
    const paramData = PARAMETER_DEFINITIONS.map((param) => {
      const { measurements, predicted168h, confidence } = generateMeasurements(compRng, param, seed.profile);
      return { param, measurements, predicted168h, confidence };
    });

    // Calibrate showcase components to exactly match the problem statement demo storyline
    if (seed.id === 'C742') {
      const lc = paramData.find((p) => p.param.name === 'Leakage Current');
      if (lc) {
        lc.measurements = [
          { timeHours: 0, value: 10.2 },
          { timeHours: 24, value: 11.8 },
          { timeHours: 96, value: 14.1 },
          { timeHours: 168, value: 46.8 },
        ];
        lc.predicted168h = 47.3;
        lc.confidence = 0.91;
      }
    } else if (seed.id === 'C518') {
      const lc = paramData.find((p) => p.param.name === 'Leakage Current');
      if (lc) {
        lc.measurements = [
          { timeHours: 0, value: 10.1 },
          { timeHours: 24, value: 11.5 },
          { timeHours: 96, value: 13.2 },
          { timeHours: 168, value: 40.2 },
        ];
        lc.predicted168h = 41.2;
        lc.confidence = 0.88;
      }
    } else if (seed.id === 'C201') {
      const lc = paramData.find((p) => p.param.name === 'Leakage Current');
      if (lc) {
        lc.measurements = [
          { timeHours: 0, value: 10.0 },
          { timeHours: 24, value: 10.2 },
          { timeHours: 96, value: 10.5 },
          { timeHours: 168, value: 11.2 },
        ];
        lc.predicted168h = 14.8;
        lc.confidence = 0.96;
      }
    } else if (seed.id === 'C883') {
      const lc = paramData.find((p) => p.param.name === 'Leakage Current');
      if (lc) {
        lc.measurements = [
          { timeHours: 0, value: 18.2 },
          { timeHours: 24, value: 18.4 },
          { timeHours: 96, value: 18.8 },
          { timeHours: 168, value: 19.3 },
        ];
        lc.predicted168h = 21.0;
        lc.confidence = 0.94;
      }
    }

    rawData.push({ seed, paramData });
  }

  // Compute lot statistics for each parameter at 96h
  const lotStatsMap = new Map<string, { mean: number; std: number; values: number[] }>();

  for (const paramDef of PARAMETER_DEFINITIONS) {
    const values: number[] = [];
    for (const rd of rawData) {
      const pd = rd.paramData.find((p) => p.param.name === paramDef.name);
      if (pd) {
        const m96 = pd.measurements.find((m) => m.timeHours === 96);
        if (m96) values.push(m96.value);
      }
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
    lotStatsMap.set(paramDef.name, { mean, std, values });
  }

  // Now build full components with metrics
  const testStart = new Date('2026-09-01T08:00:00');
  const testEnd = new Date('2026-09-08T08:00:00');

  for (const rd of rawData) {
    const parameterData: ParameterData[] = rd.paramData.map((pd) => ({
      parameter: pd.param.name,
      unit: pd.param.unit,
      safetyLimit: pd.param.safetyLimit,
      measurements: pd.measurements,
      predicted168h: pd.predicted168h,
      predictionConfidence: pd.confidence,
    }));

    // Use primary parameter (Leakage Current) for overall risk
    const primaryParam = rd.paramData[0];
    const primaryStats = lotStatsMap.get(primaryParam.param.name)!;
    const m96Value = primaryParam.measurements.find((m) => m.timeHours === 96)?.value || primaryParam.measurements[primaryParam.measurements.length - 1].value;

    // Compute metrics for ALL parameters
    const anomalyMetrics: Record<string, AnomalyMetrics> = {};
    const predictionMetricsMap: Record<string, PredictionMetrics> = {};

    for (const pd of rd.paramData) {
      const stats = lotStatsMap.get(pd.param.name)!;
      const val96 = pd.measurements.find((m) => m.timeHours === 96)?.value || pd.measurements[pd.measurements.length - 1].value;
      anomalyMetrics[pd.param.name] = computeAnomalyMetrics(val96, stats.values, stats.mean, stats.std);
      predictionMetricsMap[pd.param.name] = computePredictionMetrics(
        pd.measurements,
        pd.predicted168h,
        pd.confidence,
        pd.param.safetyLimit
      );
    }

    // Overall risk from primary parameter
    const primaryAnomaly = anomalyMetrics[primaryParam.param.name];
    const primaryPrediction = predictionMetricsMap[primaryParam.param.name];

    const risk = computeRiskScore(
      primaryAnomaly.anomalyScore,
      primaryPrediction.driftScore,
      primaryParam.predicted168h,
      primaryParam.param.safetyLimit
    );

    const explanations = generateExplanations(
      primaryAnomaly,
      primaryPrediction,
      risk,
      primaryParam.param.name
    );

    const aiRecommendation = getAIRecommendation(risk);

    // ─── Compute PINN metrics for all parameters ────────────────────
    const pinnMetricsMap: Record<string, PINNMetrics> = {};
    for (const pd of rd.paramData) {
      pinnMetricsMap[pd.param.name] = computePINNMetrics(
        pd.measurements,
        pd.param,
        predictionMetricsMap[pd.param.name].driftScore,
        125 // Operating temperature (burn-in)
      );
    }

    // ─── Analyze parameter correlations for coupled failure modes ───
    const parameterDegradations: Record<string, Measurement[]> = {};
    for (const pd of rd.paramData) {
      parameterDegradations[pd.param.name] = pd.measurements;
    }
    const correlations = analyzeParameterCorrelation(parameterDegradations);

    // Add correlated failure modes to primary parameter PINN metrics
    if (pinnMetricsMap[primaryParam.param.name]) {
      pinnMetricsMap[primaryParam.param.name].correlatedFailureModes = correlations
        .filter((c) => c.severity !== 'LOW')
        .map((c) => `${c.failureMode} (${c.parameter1} + ${c.parameter2})`);
    }

    const component: Component = {
      componentId: rd.seed.id,
      lotId: LOT_ID,
      testBatch: TEST_BATCH,
      testStart,
      testEnd,
      testCondition: 'Burn-In @ 125°C, 168h, Vce=80%Vmax',
      parameterData,
      anomalyMetrics,
      predictionMetrics: predictionMetricsMap,
      pinnMetrics: pinnMetricsMap,
      risk,
      explanations,
      aiRecommendation,
      scientistDecision: undefined,
      scientistComment: undefined,
      aiOverridden: false,
      finalStatus: 'PENDING',
    };

    components.push(component);
  }

  return components;
}
