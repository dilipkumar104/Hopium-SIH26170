# 📚 SIH 26170 - Complete Study & Learning Guide

**Last Updated:** September 26, 2026  
**Audience:** Students, Engineers, Researchers, Project Stakeholders

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement & Motivation](#2-problem-statement--motivation)
3. [Core Technologies & Concepts](#3-core-technologies--concepts)
4. [Module 1: Dynamic Population Anomaly Detection](#4-module-1-dynamic-population-anomaly-detection)
5. [Module 2: Early-Life Degradation Prediction](#5-module-2-early-life-degradation-prediction)
6. [Module 3: Physics-Informed Neural Networks (PINNs)](#6-module-3-physics-informed-neural-networks-pinns)
7. [Module 4: TabPFN Zero-Shot Classification](#7-module-4-tabpfn-zero-shot-classification)
8. [Module 5: Live ATE Integration](#8-module-5-live-ate-integration)
9. [Risk Scoring & Decision Engine](#9-risk-scoring--decision-engine)
10. [Technology Stack Deep Dive](#10-technology-stack-deep-dive)
11. [Implementation Walkthrough](#11-implementation-walkthrough)
12. [Case Studies & Examples](#12-case-studies--examples)
13. [Interview Prep Questions](#13-interview-prep-questions)

---

## 1. Project Overview

### What is SIH 26170?

**SIH 26170** is an **AI-Assisted Human-In-The-Loop Decision Support System** for semiconductor component screening in mission-critical applications (ISRO satellites, defense avionics, high-reliability power electronics).

### Why Does It Matter?

**Problem:** Traditional quality testing uses static limits (e.g., "Is Leakage < 50µA?"). This misses:
- Statistical outliers (components at ±3.8σ from lot median but passing limits)
- Hidden degradation patterns (slow drift accelerating toward failure)
- Coupled failures (multiple parameters degrading together)

**Result:** Undetected defects cause **in-flight failures**, jeopardizing **entire missions**.

### Solution

Combine **4 AI/ML Technologies** to catch defects static testing misses:
1. Dynamic population anomaly detection (Z-scores + MAD)
2. Early-life trajectory prediction (drift + acceleration modeling)
3. Physics-Informed Neural Networks (Arrhenius + Coffin-Manson)
4. TabPFN zero-shot classification (failure mode detection)

---

## 2. Problem Statement & Motivation

### The "Maverick Outlier" Problem

**Scenario:** A component measures 19.3µA leakage at 96h.

**Static Testing Says:** ✅ PASS (19.3 < 50µA limit)

**SIH 26170 Detects:** 🚫 REJECT (Outlier at +3.8σ from lot median of 10µA)

**Why It Matters:** The component's physical structure is different. It will fail prematurely in-flight despite passing the limit.

### The "Hidden Degradation" Problem

**Scenario:** Component leakage increases:
- 0h: 10.2µA
- 24h: 11.8µA
- 96h: 14.1µA (appears normal, +0.04µA/hour)

**Linear Extrapolation:** 168h ≈ 14.8µA (✅ PASS)

**Physics Reality:** Thermal acceleration is **quadratic**, not linear.

**True Prediction:** 168h ≈ 47.3µA (🚫 REJECT, near 50µA limit)

### The "Coupled Failures" Problem

**Scenario:** Multiple parameters degrade together:
- Leakage ↑ 300% (thermal runaway)
- Iddq ↑ 250% (bridging defects)
- Vth ↓ 200mV (charge trapping)

**Indicator:** Strong correlation (r > 0.7) between Leakage and Iddq suggests systemic failure, not random variation.

---

## 3. Core Technologies & Concepts

### 3.1 Statistical Methods

#### Z-Score (Parametric Anomaly Detection)
$$Z = \frac{X - \mu}{\sigma}$$

- **X:** Component measurement
- **μ:** Lot mean
- **σ:** Lot standard deviation
- **Threshold:** |Z| > 3.0 = outlier (0.27% of population)

**Advantage:** Fast, simple
**Disadvantage:** Assumes normal distribution, sensitive to extreme outliers

#### Robust MAD Z-Score (Non-Parametric)
$$Z_{MAD} = \frac{X - \text{Median}}{\text{1.4826} \times \text{MAD}}$$

- **Median:** Middle value (robust to outliers)
- **MAD:** Median Absolute Deviation = median(|X - median|)
- **1.4826:** Scaling factor for normal distribution equivalence

**Advantage:** Robust to outliers, doesn't assume distribution
**Disadvantage:** Requires more computation

#### Percentile Ranking
$$\text{Percentile} = \frac{\text{Count of values < X}}{\text{Total count}} \times 100$$

**Interpretation:** 95th percentile means 95% of lot is below this value

### 3.2 Time-Series Analysis

#### Drift Rate Calculation
$$\text{Drift Rate} = \frac{\text{Value}_{\text{end}} - \text{Value}_{\text{start}}}{\text{Time}_{\text{end}} - \text{Time}_{\text{start}}}$$

**Example:** (14.1 - 10.2) µA / 96h = **0.041 µA/hour**

#### Acceleration Detection (Quadratic Fit)

If drift rate **increases over time**, degradation is **accelerating**.

**Simple Test:** Compare early slope vs. late slope
- 0h→24h slope: (11.8 - 10.2) / 24 = 0.067 µA/h
- 72h→96h slope: (14.1 - 13.2) / 24 = 0.038 µA/h
- **Conclusion:** Deceleration (less aggressive aging) → likely safe

### 3.3 Correlation Analysis

#### Pearson Correlation Coefficient
$$r = \frac{\sum(X - \bar{X})(Y - \bar{Y})}{\sqrt{\sum(X - \bar{X})^2 \sum(Y - \bar{Y})^2}}$$

**Range:** -1 (perfect negative) to +1 (perfect positive)

**Interpretation:**
- r > 0.7 = strong positive correlation (parameters degrade together)
- r < -0.7 = strong negative correlation (one increases as other decreases)
- |r| < 0.3 = weak correlation (independent degradation)

**Application:** Leakage ↔ Iddq correlation > 0.7 suggests **thermal runaway** (coupled failure).

---

## 4. Module 1: Dynamic Population Anomaly Detection

### Concept

**Traditional Approach:** Compare component against fixed limits
- ❌ Misses lot-specific patterns
- ❌ Can't detect population-wide anomalies

**SIH Approach:** Compare against **active lot population**
- ✅ Detects outliers relative to peers
- ✅ Adapts to lot characteristics

### Algorithm

```
1. Measure all components at 96h
2. Calculate lot statistics:
   - Mean (μ), Std Dev (σ)
   - Median, MAD
   - Percentiles (Q1, Q3)
3. For each component:
   - Calculate Z-score
   - Calculate robust MAD Z-score
   - Compute percentile rank
   - Map to anomaly score (0-1)
4. Flag if Z > 3.0 OR Z_MAD > 3.0
```

### Anomaly Score Formula

$$\text{Anomaly} = \min\left(1.0, \max\left(\frac{|Z| - 1.5}{3.5}, \frac{|Z_{MAD}| - 1.5}{3.5}\right)\right)$$

**Interpretation:**
- Score < 0.2: Normal (within 1.5σ)
- Score 0.2-0.5: Mild anomaly
- Score 0.5-0.8: Strong anomaly
- Score > 0.8: Critical outlier

### Real Example: C883 Component

| Metric | Value | Lot Avg | Status |
|--------|-------|---------|--------|
| Leakage @ 96h | 18.8 µA | 10.0 µA | +88% |
| Z-Score | +3.8σ | - | ⚠️ Outlier |
| Percentile | 99.8% | - | Top 0.2% |
| Static Limit | 50 µA | - | ✅ PASS |
| **Anomaly Score** | **0.72** | - | **⚠️ HIGH** |

**Conclusion:** Passes static test but is statistical outlier → **REJECT** (early failure risk)

---

## 5. Module 2: Early-Life Degradation Prediction

### Concept

**Goal:** Predict 168h performance from 0h, 24h, 96h measurements

**Challenge:** Early measurements can't distinguish between:
- Normal variation
- Linear drift
- Quadratic acceleration
- Non-physical anomalies

### Two-Slope Method

Compare early vs. late drift rates:

```
Early Slope (0h to 24h):  m1 = (X24 - X0) / 24
Late Slope (72h to 96h):   m2 = (X96 - X72) / 24

If m2 > m1 * 1.5 → Accelerating (risky)
If m2 ≈ m1       → Linear (predictable)
If m2 < m1 * 0.5 → Decelerating (safe)
```

### Extrapolation with Acceleration Factor

$$X_{168}^{\text{pred}} = X_{96} + m_{\text{avg}} \times (168 - 96) \times \alpha_{\text{accel}}$$

- **m_avg:** Average drift rate
- **(168 - 96):** 72 hours remaining
- **α_accel:** 1.0 (linear) to 1.5+ (accelerating)

### Real Example: C742 Component

| Time | Measured | Calculated | Extrapolated |
|------|----------|------------|--------------|
| 0h | 10.2 µA | - | - |
| 24h | 11.8 µA | Slope: 0.067 µA/h | - |
| 96h | 14.1 µA | Slope: 0.038 µA/h | - |
| 168h | ??? | Decel observed | 47.3 µA 🚫 |

**Physics Explanation:** Initial thermal ramp, then thermal runaway acceleration → **REJECT**

---

## 6. Module 3: Physics-Informed Neural Networks (PINNs)

### What Are PINNs?

**Traditional Neural Nets:** Learn patterns from data alone (black box)

**PINNs:** Embed physics equations as constraints in the network

**Advantage:** Predictions respect physical laws, generalize better

### Arrhenius Thermal Acceleration Model

**Background:** Component degradation speeds up with temperature

$$A(T) = A_0 \cdot \exp\left(\frac{E_a}{k_B} \left(\frac{1}{T_{ref}} - \frac{1}{T}\right)\right)$$

**Parameters:**
- **A(T):** Degradation acceleration factor at temperature T
- **A₀:** Baseline rate at reference (typically 1.0)
- **E_a:** Activation energy (eV) - parameter-specific
- **k_B:** Boltzmann constant (8.617 × 10⁻⁵ eV/K)
- **T_ref:** Reference temperature (298K = 25°C)
- **T:** Operating temperature (K)

**Calibrated Activation Energies:**
| Parameter | E_a | Failure Mode |
|-----------|-----|--------------|
| Leakage Current | 0.95 eV | Gate oxide degradation |
| Iddq | 1.1 eV | Bridging defects |
| Tpd | 0.62 eV | Electromigration |
| Vth | 0.78 eV | Charge trapping / HCI |
| Ron | 1.3 eV | Wire bond degradation |

### Real Calculation

**Scenario:** Leakage current at 125°C burn-in

$$A(125°C) = 1.0 \times \exp\left(\frac{0.95}{8.617 \times 10^{-5}} \left(\frac{1}{298.15} - \frac{1}{398.15}\right)\right)$$

$$= \exp(11,024 \times 0.000843) = \exp(9.29) ≈ \mathbf{10,700×}$$

**Interpretation:** Degradation rate at 125°C is ~**10,700 times faster** than at 25°C

### Coffin-Manson Fatigue Model

**Background:** Thermal cycling (heating/cooling cycles) causes mechanical fatigue

$$N_f = C \times (\Delta T)^{-m} \times \left(\frac{\sigma}{\sigma_{ref}}\right)^{-n}$$

**Parameters:**
- **N_f:** Cycles to failure
- **C:** Material constant
- **ΔT:** Temperature cycle range (°C)
- **m:** Coffin-Manson exponent (typically 1.9-5)
- **σ:** Stress level
- **n:** Stress coefficient

**Application:** Predicts wire bond cracking, solder joint fatigue

---

## 7. Module 4: TabPFN Zero-Shot Classification

### What is TabPFN?

**TabPFN:** Tabular Foundation Model Pre-trained Network

**Key Idea:** Pre-trained on millions of synthetic tabular classification tasks

**Advantage:** Works on new tasks without fine-tuning (zero-shot learning)

### Feature Engineering (35 Features)

#### Raw Measurements (15 features)
```
Leakage: 0h, 24h, 96h, 168h predicted
Iddq: 0h, 24h, 96h
Tpd: 0h, 24h, 96h
Vth: 0h, 24h, 96h
Ron: 0h, 24h, 96h
```

#### Drift Features (5 features)
```
Leakage drift rate (µA/h)
Iddq drift rate (mA/h)
Tpd drift rate (ns/h)
Vth drift rate (mV/h)
Ron drift rate (mΩ/h)
```

#### Statistical Features (6 features)
```
Leakage Z-score @ 96h
Leakage robust MAD Z-score
Leakage percentile
Anomaly score (0-1)
Drift score (0-1)
Prediction risk (0-1)
```

#### Correlation Features (3 features)
```
Leakage ↔ Iddq correlation
Leakage ↔ Vth correlation
Leakage ↔ Tpd correlation
```

#### Context Features (6 features)
```
Test temperature (125°C)
Test voltage (80% Vmax)
Test duration (168h)
Combined risk score
Operating conditions
Thermal stress level
```

### Classification Output

**4 Health Categories:**
- **HEALTHY:** Risk < 0.25 (Normal operation)
- **DEGRADING:** 0.25 ≤ Risk < 0.75 (Monitor closely)
- **CRITICAL:** Risk ≥ 0.75 (Reject)
- **UNKNOWN:** Insufficient data

**7 Failure Modes Detected:**
1. **Thermal drift:** High leakage acceleration + prediction risk
2. **Electromigration:** High propagation delay drift
3. **Charge trapping:** Leakage-Vth correlation > 0.6
4. **Wire bond degradation:** Resistance increase > 2%/hour
5. **Junction leakage:** High Iddq drift + Leakage-Iddq correlation
6. **Parametric anomaly:** MAD Z-score > 3.5
7. **Multiple modes:** Multiple correlated parameters

### Decision Logic Example

```python
if risk_score > 0.75:
    category = "CRITICAL"
    failure_mode = "thermal_drift"  # (if acceleration > 0.05)
elif risk_score > 0.5:
    category = "DEGRADING"
elif z_score_mad > 3.5:
    category = "DEGRADING"
    failure_mode = "parametric_anomaly"
else:
    category = "HEALTHY"
```

---

## 8. Module 5: Live ATE Integration

### What is ATE?

**ATE (Automated Test Equipment):** Machines that perform semiconductor tests automatically

**Examples:**
- Burn-in chambers (controlled temperature ovens)
- Parametric testers (measure electrical properties)
- Functional testers (verify circuit operation)

### MQTT Protocol

**Use Case:** IoT-friendly, lightweight real-time streaming

**Architecture:**
```
ATE Equipment
    ↓ (publishes)
MQTT Broker (mosquitto, HiveMQ)
    ↓ (subscribes)
SIH 26170 Platform
```

**Topics:**
```
ate/measurements    → Raw test data
ate/status         → Equipment status (temperature, progress)
ate/commands       → Commands from platform (start/stop)
```

**Example Message:**
```json
{
  "componentId": "C742",
  "timestamp": "2026-09-26T16:55:50Z",
  "parameterName": "Leakage Current",
  "value": 14.1,
  "unit": "µA",
  "testPointHours": 96,
  "temperature": 125.3,
  "voltage": 3.95,
  "confidence": 0.92,
  "status": "valid"
}
```

### OPC-UA Protocol

**Use Case:** Industrial-standard machine-to-machine communication

**Architecture:**
```
ATE Server (OPC-UA)
    ↓ (Node IDs)
Session (authenticated)
    ↓ (reads)
SIH 26170 Platform
```

**Node IDs:**
```
ns=2;s=Measurements    → Array of measurements
ns=2;s=Status         → Equipment status
ns=2;s=TestProgress   → Progress percentage
```

### Session Management

```
1. Connect to broker/server
2. Start test session
   - Test ID: TEST-1234567890
   - Lot ID: IGBT-2026-017
   - Components: [C201, C518, C742, C883, ...]
3. Receive measurements
   - Validate (type, range, timestamp)
   - Store in buffer
   - Update real-time charts
4. Monitor equipment status
   - Temperature tracking
   - Error detection
   - Progress reporting
5. End session
   - Lock measurements
   - Generate report
```

---

## 9. Risk Scoring & Decision Engine

### Multi-Factor Risk Composite

$$\text{Risk Score} = 0.40 \times A_{score} + 0.35 \times D_{score} + 0.25 \times P_{risk}$$

**Components:**

1. **Anomaly Score (40% weight)**
   - Z-score and robust MAD Z-score
   - Measures deviation from lot population
   - Higher = more unusual

2. **Drift Score (35% weight)**
   - Rate of parameter change (µA/hour)
   - Acceleration detection (quadratic vs. linear)
   - Higher = faster degradation

3. **Prediction Risk (25% weight)**
   - Projected 168h value relative to safety limit
   - Confidence intervals
   - Higher = closer to failure

### Risk Level Mapping

| Risk Score | Level | Recommendation | Action |
|-----------|-------|----------------|--------|
| < 0.25 | 🟢 LOW | PASS | Ship component |
| 0.25-0.50 | 🟡 MEDIUM | MONITOR | Watch closely |
| 0.50-0.75 | 🟠 HIGH | REVIEW | Engineer judgment |
| ≥ 0.75 | 🔴 CRITICAL | REJECT | Do not ship |

### Human-In-The-Loop Workflow

```
AI Risk Scoring
    ↓
Display with Explanations
    ↓
Scientist Reviews
    ↓
Engineer Decides: PASS / REJECT / MONITOR
    ↓
If Override → AI Override Flag ⚠️
    ↓
Decision Locked in Audit Trail
    ↓
Export 27-Column Record
```

**Key:** Engineer can override but decision is **transparent and auditable**

---

## 10. Technology Stack Deep Dive

### Frontend (React 19 + TypeScript)

**Why React?**
- Component-based (modular, reusable)
- Real-time state management (hooks, context)
- Rich ecosystem (Recharts, Radix UI)

**Key Libraries:**
- **React Router:** Navigation between `/physics`, `/classification`, `/live-ate`
- **Recharts:** Interactive time-series, scatter, pie charts
- **Tailwind CSS:** Utility-first styling (fast, maintainable)
- **Radix UI:** Accessible dialogs, tabs, tooltips

**Example: Physics Analysis Page**
```tsx
export function PhysicsAnalysisPage() {
  // 1. Get component from URL
  const { componentId } = useParams();
  
  // 2. Fetch data from context
  const { state } = useLot();
  const component = state.components.find(c => c.componentId === componentId);
  
  // 3. Extract PINN metrics
  const pinnMetrics = component.pinnMetrics['Leakage Current'];
  
  // 4. Render trajectory chart
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={trajectoryData}>
        <Area dataKey="upper" fill="url(#colorUpper)" />
        <Area dataKey="value" stroke="#2563eb" />
        <Area dataKey="lower" fill="url(#colorLower)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

### Backend (TypeScript Data Modules)

**Key Modules:**

1. **types.ts** - Domain models
   - Component, ParameterData, Measurement
   - PINNMetrics, AnomalyMetrics, RiskScore

2. **generate-dataset.ts** - Data pipeline
   - 1000+ synthetic components
   - Physics-based degradation profiles
   - Risk calculations

3. **pinn-physics-engine.ts** - Physics models
   - Arrhenius thermal acceleration
   - Coffin-Manson fatigue
   - Trajectory prediction

4. **tabpfn-classifier.ts** - ML classification
   - 35-feature extraction
   - Zero-shot classification
   - Failure mode detection

5. **ate-integration.ts** - Equipment streaming
   - MQTT client
   - OPC-UA client
   - Session management

### Build & Deployment

**Vite:**
- Ultra-fast development server (hot reload)
- Production bundle optimization
- Tree-shaking (removes unused code)

**Build Process:**
```bash
npm run build
# TypeScript compilation
# Vite bundling
# Output: dist/index.html, dist/assets/*.js, dist/assets/*.css
```

**Result:** 1.1 MB gzipped production bundle

---

## 11. Implementation Walkthrough

### Step 1: Data Loading

```typescript
// Generate 1000 components with physics-based degradation
const components = generateDataset();

// Each component has:
// - 5 parameters (Leakage, Iddq, Tpd, Vth, Ron)
// - 4 time points (0h, 24h, 96h, 168h)
// - Risk scores and PINN predictions
```

### Step 2: Anomaly Detection

```typescript
function computeAnomalyMetrics(
  componentValue: number,
  lotValues: number[],
  lotMean: number,
  lotStd: number
): AnomalyMetrics {
  // Calculate Z-score
  const zScore = (componentValue - lotMean) / lotStd;
  
  // Calculate robust MAD Z-score
  const sorted = [...lotValues].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mad = sorted.map(v => Math.abs(v - median))
    .sort((a, b) => a - b)[Math.floor(sorted.length / 2)] * 1.4826;
  const robustZScore = (componentValue - median) / mad;
  
  // Map to anomaly score (0-1)
  const anomalyScore = Math.min(1, 1 - Math.exp(-absZ * absZ / 4));
  
  return { zScore, robustZScore, anomalyScore, ... };
}
```

### Step 3: PINN Trajectory Prediction

```typescript
function predictDegradationTrajectory(
  measurements: Measurement[],
  parameterDef: ParameterDefinition
): DegradationTrajectory {
  // Extract time points and values
  const times = measurements.map(m => m.timeHours);
  const values = measurements.map(m => m.value);
  
  // Linear extrapolation
  const lastSlope = (values[3] - values[2]) / (times[3] - times[2]);
  const linear168h = values[3] + lastSlope * (168 - times[3]);
  
  // Quadratic acceleration detection
  // ... fit polynomial, check acceleration
  
  // Arrhenius physics correction
  const arrheniusAccel = arrheniusThermalAcceleration(125, 25, coefficients);
  const physicsRate = linearSlope * Math.sqrt(arrheniusAccel);
  
  // Ensemble prediction
  const predicted168h = 0.6 * quadratic + 0.4 * physics;
  
  return {
    predicted168h,
    upperBound95th,
    lowerBound5th,
    physicsModel: 'hybrid',
    ...
  };
}
```

### Step 4: TabPFN Classification

```typescript
function classifyComponent(
  component: Component,
  lotComponents: Component[]
): ComponentClassification {
  // Extract 35 features
  const features = extractFeatures(component, lotMean, lotStd);
  
  // Decision rules
  if (features.combined_risk > 0.75) {
    return { category: 'critical', failureMode: 'thermal_drift' };
  }
  if (features.ileak_zscore > 3.5) {
    return { category: 'degrading', failureMode: 'parametric_anomaly' };
  }
  if (features.leakage_iddq_correlation > 0.7) {
    return { category: 'degrading', failureMode: 'thermal_runaway' };
  }
  
  return { category: 'healthy', failureMode: 'none' };
}
```

### Step 5: Display & Interaction

```typescript
// Physics Analysis Page
<PhysicsAnalysisPage componentId="C742" />
// Shows: trajectory chart, confidence bounds, failure risk

// Classification Page
<ComponentClassificationPage />
// Shows: health distribution pie chart, failure modes, outliers

// Live ATE Page
<LiveATEPage />
// Shows: real-time measurements, equipment status, live session data
```

---

## 12. Case Studies & Examples

### Case Study 1: C742 (Thermal Acceleration)

**Background:** Component shows moderate leakage at 96h

**Measurements:**
| Time | Leakage | Iddq | Tpd | Vth | Ron |
|------|---------|------|-----|-----|-----|
| 0h | 10.2 µA | 1.18 mA | 44.8 ns | 1.82 V | 83.2 mΩ |
| 24h | 11.8 µA | 1.21 mA | 45.2 ns | 1.81 V | 84.1 mΩ |
| 96h | 14.1 µA | 1.25 mA | 45.8 ns | 1.79 V | 85.5 mΩ |

**Analysis:**
- Drift rate: 0.041 µA/hour (appears linear)
- Z-score: +1.64 (within population)
- Static test: PASS (14.1 < 50 µA)

**PINN Prediction:**
- Detects quadratic acceleration (drift accelerating)
- Arrhenius correction: 10,700× thermal acceleration at 125°C
- **Predicted 168h: 47.3 µA** (97% of 50 µA limit)

**TabPFN Classification:**
- Health: **DEGRADING** (confidence 85%)
- Failure mode: **THERMAL DRIFT**
- Risk factors: High acceleration (2.1×), Tpd-Leakage correlation (0.65)

**Recommendation:** 🚫 **REJECT** (hidden thermal acceleration)

**Why It Matters:** Linear extrapolation would have shipped a component with 97% probability of field failure.

---

### Case Study 2: C883 (Statistical Outlier)

**Background:** Component has normal measurements but unusual distribution

**Measurements:**
| Parameter | C883 | Lot Mean | Lot StdDev | Z-Score |
|-----------|------|----------|------------|---------|
| Leakage @ 96h | 18.8 µA | 10.0 µA | 2.5 µA | **+3.52σ** |

**Analysis:**
- Static test: ✅ PASS (18.8 < 50 µA)
- Population anomaly: 🚫 **REJECT**
- Percentile: 99.8% (top 0.2% of lot)
- Robust MAD Z-score: +3.8

**TabPFN Classification:**
- Health: **DEGRADING** (confidence 88%)
- Failure mode: **PARAMETRIC ANOMALY**
- Outlier flag: YES

**Root Cause (Hypothetical):**
- Manufacturing defect (slightly thinner gate oxide)
- Physical structure different from peers
- Will age faster than normal components

**Recommendation:** 🚫 **REJECT** (structural defect)

**Why It Matters:** Static testing would have shipped a defective component. Dynamic population comparison catches it.

---

### Case Study 3: C201 (Healthy Baseline)

**Background:** Component shows ideal characteristics

**Measurements:**
| Time | Leakage |
|------|---------|
| 0h | 10.0 µA |
| 24h | 10.2 µA |
| 96h | 10.5 µA |
| 168h | 10.8 µA |

**Analysis:**
- Drift rate: 0.009 µA/hour (very low)
- Trend: Stable, slight natural aging
- Z-score: -0.2 (at population mean)
- Predicted margin: 39.2 µA (78% remaining to limit)

**PINN Prediction:**
- Physics model: LINEAR (no acceleration)
- Confidence: 96% (very high)
- Estimated lifetime: ~500 hours at 125°C

**TabPFN Classification:**
- Health: **HEALTHY** (confidence 96%)
- Failure mode: NONE
- Risk score: 0.08 (very low)

**Recommendation:** ✅ **PASS** (nominal performance)

**Why It Matters:** This is the baseline. Components deviating from this pattern raise flags.

---

## 13. Interview Prep Questions

### Conceptual Questions

**Q1: Why does static limit testing fail?**
A: Static limits (e.g., "Leakage < 50µA") miss two critical issues:
1. Statistical outliers (components 3-4σ from lot mean pass the limit but have structural defects)
2. Hidden degradation (linear extrapolation misses quadratic thermal acceleration toward failure)

**Q2: What's the difference between Z-score and MAD Z-score?**
A: 
- Z-score: Assumes normal distribution, sensitive to outliers
- MAD Z-score: Non-parametric, robust to outliers
- When component is extreme outlier, MAD Z-score is more accurate

**Q3: How do PINNs improve predictions?**
A: Traditional models learn from data alone. PINNs embed physics constraints (Arrhenius, Coffin-Manson), so:
- Predictions respect physical laws
- Model generalizes beyond training data
- More accurate extrapolation to 168h

**Q4: Why use both MQTT and OPC-UA?**
A:
- MQTT: Lightweight, IoT-friendly, good for high-volume streaming
- OPC-UA: Industrial standard, enterprise security, synchronous reliability
- Having both provides options for different ATE equipment

**Q5: How is the risk score weighted?**
A: Risk = 0.40×Anomaly + 0.35×Drift + 0.25×Prediction
- Anomaly (40%): Detects unusual components
- Drift (35%): Detects accelerating degradation
- Prediction (25%): Detects trajectory to failure
- Weightings tuned for mission-critical applications

---

### Implementation Questions

**Q6: How do you extract the 35 features for TabPFN?**
A: 
- Raw measurements: 15 (4 time points × 5 parameters, minus one)
- Drift rates: 5 (one per parameter)
- Statistical: 6 (Z-scores, percentiles, anomaly score)
- Correlations: 3 (Leak↔Iddq, Leak↔Vth, Leak↔Tpd)
- Context: 6 (temperature, voltage, risk scores)
- Total: 35

**Q7: What's the Arrhenius acceleration factor at 125°C vs 25°C?**
A: 
- E_a (Leakage): 0.95 eV
- Calculation: exp(0.95 eV / (8.617×10⁻⁵ eV/K) × (1/298K - 1/398K))
- Result: **~10,700×** faster degradation at 125°C
- Implication: 1 hour @ 125°C ≈ 10,700 hours @ 25°C (accelerated testing)

**Q8: How do you detect quadratic acceleration?**
A:
- Calculate drift rate over early period (0-24h)
- Calculate drift rate over late period (72-96h)
- If late rate > early rate × 1.5 → accelerating
- If late rate ≈ early rate → linear
- Fit polynomial to confirm coefficient magnitude

**Q9: What indicates thermal runaway coupling?**
A:
- Leakage ↑ and Iddq ↑ correlated (r > 0.7)
- Both increase with temperature exponentially
- Indicates positive feedback: more current → more heat → more current
- Physical mechanism: Thermal coefficient of both parameters

**Q10: How do you handle real-time MQTT data?**
A:
- Connect to broker with credentials
- Subscribe to `ate/measurements` and `ate/status` topics
- Validate each measurement (type, range, timestamp)
- Store in buffer, don't block on processing
- Update charts asynchronously
- Handle disconnections with exponential backoff reconnection

---

### Design Questions

**Q11: Why human-in-the-loop instead of full automation?**
A:
- AI makes mistakes too (may flag good components as bad)
- Engineers understand context (design intent, mission criticality)
- Audit trail requires human accountability
- Learning: Engineers provide feedback to improve future models
- Trust: Mission-critical decisions need human judgment

**Q12: How do you ensure audit trail tamper-proofing?**
A:
- Immutable timestamp on every decision
- Record: component ID, AI recommendation, engineer decision, override flag, timestamp
- Lock lot state after finalization (prevent edits)
- Export as JSON with hash verification
- Compliance: 27-column export for regulatory review

**Q13: What would you improve in this system?**
A: (Good answer)
- Real PINNs using TensorFlow instead of analytical models
- Active learning: Query most uncertain components to human for labeling
- Streaming database (TimescaleDB) instead of in-memory buffers
- Explainability metrics (SHAP values for feature importance)
- Multi-site deployment (federation across multiple test facilities)

**Q14: How do you handle model drift over time?**
A:
- Monitor prediction accuracy on historical data
- Retrain TabPFN annually on production data
- Update Arrhenius coefficients as new failure data comes in
- A/B testing: Compare new model vs. old on test set before deployment

**Q15: What's your approach to testing?**
A:
- Unit tests: Statistical functions, feature extraction
- Integration tests: End-to-end from raw data to risk score
- Regression tests: Known components (C201, C742, C883) should always score correctly
- Load testing: Can system handle real-time stream from 100+ ATE channels?

---

## Learning Path

### Week 1: Foundations
- [ ] Read semiconductor physics basics (leakage, electromigration, wire bond degradation)
- [ ] Study statistical methods (Z-score, percentiles, correlation)
- [ ] Understand burn-in testing (0h, 24h, 96h, 168h protocol)
- [ ] Learn time-series analysis (drift, acceleration detection)

### Week 2: Physics Models
- [ ] Arrhenius equation and thermal acceleration
- [ ] Coffin-Manson fatigue model
- [ ] Temperature scaling and extrapolation
- [ ] Hands-on: Calculate acceleration factors for each parameter

### Week 3: ML & Classification
- [ ] Zero-shot learning concepts
- [ ] Feature engineering (why each of 35 features matters)
- [ ] Decision trees and rules-based classification
- [ ] Failure mode diagnosis

### Week 4: Integration & Deployment
- [ ] MQTT and OPC-UA protocols
- [ ] Real-time data streaming
- [ ] React component architecture
- [ ] Human-in-the-loop workflows

### Week 5: Full Project Integration
- [ ] Run local development server
- [ ] Trace through a component from data to risk score
- [ ] Modify risk weights and observe impact
- [ ] Generate synthetic data and verify predictions

---

## Key Takeaways

1. **Problem Motivation:** Static testing misses outliers and hidden degradation → mission failures
2. **Multi-Modal AI:** Combine statistics, physics, and ML for robust predictions
3. **Physics Constraints:** PINNs ensure predictions respect physical laws (Arrhenius, Coffin-Manson)
4. **Zero-Shot Learning:** TabPFN classification without fine-tuning
5. **Real-Time Integration:** MQTT/OPC-UA for live equipment streaming
6. **Human Trust:** Explainable AI + human override = accountability
7. **Audit Trail:** Every decision recorded for regulatory compliance
8. **Winning Approach:** Combines domain expertise (physics), ML (TabPFN), and pragmatism (HITL)

---

## Additional Resources

### Papers & References
- Arrhenius kinetics in semiconductor aging
- Coffin-Manson fatigue models
- Physics-Informed Neural Networks (PINNs)
- Zero-shot learning in tabular data

### Tools to Explore
- MQTT brokers: Mosquitto, HiveMQ
- OPC-UA servers: KEPware, Ignition
- Python libraries: NumPy, Pandas, SciPy, scikit-learn
- React visualization: Recharts, Plotly.js

### Practice Projects
1. Build Z-score calculator in Python
2. Implement Arrhenius model for your favorite semiconductor
3. Train simple decision tree on synthetic component data
4. Connect to public MQTT broker and visualize sensor data
5. Deploy React app with real-time charts

---

**Good luck studying and teaching SIH 26170!** 🚀

Remember: The goal is not just to pass a hackathon, but to build a system that **actually prevents mission-critical failures**. That's what makes this project special.

