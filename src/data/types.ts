// ─── Risk & Status Enums ────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AIRecommendation = 'PASS' | 'REVIEW' | 'FAIL';

export type ScientistDecision = 'PASS' | 'REJECT' | 'MONITOR';

export type FinalStatus = 'PASS' | 'REJECT' | 'MONITOR' | 'PENDING';

// ─── Measurement & Test Data ────────────────────────────────────────

export interface Measurement {
  timeHours: number;
  value: number;
}

export interface ParameterData {
  parameter: string;
  unit: string;
  safetyLimit: number;
  measurements: Measurement[];
  /** Predicted value at final time point (168h) */
  predicted168h: number;
  predictionConfidence: number;
}

// ─── Anomaly Metrics ────────────────────────────────────────────────

export interface AnomalyMetrics {
  anomalyScore: number;       // 0–1
  zScore: number;
  robustZScore: number;
  percentile: number;         // 0–100
  deviationFromBaseline: number;
  level: RiskLevel;
}

// ─── Prediction / Drift Metrics ─────────────────────────────────────

export interface PredictionMetrics {
  predictedValue: number;
  confidence: number;         // 0–1
  driftRate: number;          // value per hour
  driftScore: number;         // 0–1
  safetyMargin: number;       // absolute distance to limit
  safetyMarginPct: number;    // percentage
  trendDirection: 'stable' | 'increasing' | 'decreasing' | 'accelerating';
  driftLevel: RiskLevel;
}

// ─── Physics-Informed Neural Network (PINN) Metrics ──────────────

export interface PINNMetrics {
  physicsModel: 'linear' | 'quadratic' | 'arrhenius_thermal' | 'hybrid';
  accelerationFactor: number; // >1.0 indicates accelerating degradation
  upperBound95th: number;     // 95% confidence interval upper bound
  lowerBound5th: number;      // 5% confidence interval lower bound
  thermalAccelerationFactor: number; // Arrhenius-based acceleration at operating temp
  estimatedLifetimeHours: number; // Until safety limit at operating conditions
  failureRiskPercent: number;  // 0-100% probability of failure during test
  correlatedFailureModes: string[]; // Coupled parameter degradation patterns
}

// ─── Risk Score ─────────────────────────────────────────────────────

export interface RiskScore {
  anomalyWeight: number;      // 0.40
  driftWeight: number;        // 0.35
  predictionWeight: number;   // 0.25
  anomalyContribution: number;
  driftContribution: number;
  predictionContribution: number;
  overallScore: number;       // 0–1
  level: RiskLevel;
}

// ─── Explainability ─────────────────────────────────────────────────

export interface ExplainabilityItem {
  category: 'population' | 'drift' | 'prediction' | 'combined';
  title: string;
  description: string;
  severity: RiskLevel;
}

// ─── Audit Trail ────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  timestamp: Date;
  componentId: string;
  action: string;
  detail: string;
  actor: 'SYSTEM' | 'AI' | 'SCIENTIST';
}

// ─── Component ──────────────────────────────────────────────────────

export interface Component {
  componentId: string;
  lotId: string;
  testBatch: string;
  testStart: Date;
  testEnd: Date;
  testCondition: string;

  /** Test data for each parameter */
  parameterData: ParameterData[];

  /** Anomaly metrics (computed for active parameter) */
  anomalyMetrics: Record<string, AnomalyMetrics>;

  /** Prediction/drift metrics (computed for active parameter) */
  predictionMetrics: Record<string, PredictionMetrics>;

  /** Physics-Informed Neural Network (PINN) predictions */
  pinnMetrics?: Record<string, PINNMetrics>;

  /** Overall risk score (aggregated across primary parameter) */
  risk: RiskScore;

  /** Explainability items */
  explanations: ExplainabilityItem[];

  /** AI recommendation */
  aiRecommendation: AIRecommendation;

  /** Scientist decision (undefined = pending) */
  scientistDecision?: ScientistDecision;

  /** Scientist comment */
  scientistComment?: string;

  /** Whether scientist overrode the AI */
  aiOverridden: boolean;

  /** Final status */
  finalStatus: FinalStatus;
}

// ─── Lot ────────────────────────────────────────────────────────────

export interface LotSummary {
  lotId: string;
  totalComponents: number;
  analyzed: number;
  lowRisk: number;
  mediumRisk: number;
  highRisk: number;
  criticalRisk: number;
  manualReview: number;
  passCount: number;
  rejectCount: number;
  monitorCount: number;
  pendingCount: number;
  testingStatus: 'In Progress' | 'Complete';
  analysisStatus: 'In Progress' | 'Complete';
  isFinalized: boolean;
  finalizedAt?: Date;
}

// ─── Parameter Definitions ──────────────────────────────────────────

export interface ParameterDefinition {
  name: string;
  unit: string;
  safetyLimit: number;
  nominalMean: number;
  nominalStd: number;
  /** Natural drift per hour for normal components */
  naturalDriftPerHour: number;
}

// ─── Lot Statistics (for population comparison) ─────────────────────

export interface LotParameterStats {
  parameter: string;
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  values: number[];
}
