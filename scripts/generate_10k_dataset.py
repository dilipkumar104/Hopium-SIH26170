#!/usr/bin/env python3
"""
SIH 26170 — Physics-Informed 10,000+ Component Dataset Generator
=================================================================

Generates realistic synthetic electronic component burn-in / ESS test data
using physics-based degradation models:

  1. Arrhenius Temperature Acceleration:
     AF_T = exp( Ea/kB * (1/T_use - 1/T_stress) )

  2. Power-Law Parametric Drift:
     V(t) = V_0 + alpha * t^beta + epsilon

  3. Population Anomaly Injection (MAD-based outliers)

Output:
  - data/lot_10k_components.json   (web platform feed, ~20-40 MB)
  - data/lot_10k_training.csv      (ML training flat table, ~30-50 MB)

Usage:
  python scripts/generate_10k_dataset.py
  python scripts/generate_10k_dataset.py --count 15000 --seed 42
  python scripts/generate_10k_dataset.py --ingest path/to/your_data.zip
"""

import argparse
import csv
import json
import math
import os
import random
import sys
import zipfile
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


# ─── Physical Constants ──────────────────────────────────────────────

BOLTZMANN_EV = 8.617333262e-5  # Boltzmann constant in eV/K
ACTIVATION_ENERGY = 0.7  # eV (typical for semiconductor failure mechanisms)
T_USE_KELVIN = 273.15 + 55  # 55°C typical operating temperature
T_STRESS_KELVIN = 273.15 + 125  # 125°C burn-in stress temperature

# Arrhenius Acceleration Factor
AF_ARRHENIUS = math.exp(
    (ACTIVATION_ENERGY / BOLTZMANN_EV) * (1.0 / T_USE_KELVIN - 1.0 / T_STRESS_KELVIN)
)

TIME_POINTS = [0, 24, 96, 168]  # Hours


# ─── Parameter Definitions (MIL-STD-883 aligned) ────────────────────

@dataclass
class ParameterDef:
    name: str
    unit: str
    safety_limit: float
    nominal_mean: float
    nominal_std: float
    natural_drift_per_hour: float


PARAMETERS = [
    ParameterDef("Leakage Current", "µA", 50.0, 10.0, 2.5, 0.005),
    ParameterDef("Iddq", "mA", 5.0, 1.2, 0.3, 0.001),
    ParameterDef("Propagation Delay", "ns", 120.0, 45.0, 8.0, 0.02),
    ParameterDef("Threshold Voltage", "V", 3.5, 1.8, 0.15, 0.0003),
    ParameterDef("Resistance", "mΩ", 200.0, 85.0, 12.0, 0.015),
]


# ─── Behavior Profiles ──────────────────────────────────────────────

PROFILE_DISTRIBUTION = {
    # profile_name: (fraction, description)
    "healthy":                     (0.9300, "Stable within nominal bounds"),
    "moderate_drift":              (0.0350, "Linear degradation approaching upper specs"),
    "high_drift":                  (0.0150, "Superlinear acceleration toward safety bounds"),
    "critical":                    (0.0080, "Thermal runaway / catastrophic shift"),
    "population_anomaly":          (0.0060, "Static-pass but >3.5σ MAD from population"),
    "sudden_jump":                 (0.0040, "Normal trajectory then abrupt shift at 96h"),
    "intermittent_noise":          (0.0015, "Random measurement spikes (contact issues)"),
    "early_infant_mortality":      (0.0005, "Rapid failure within first 24h"),
}


# ─── Seeded RNG ──────────────────────────────────────────────────────

class PhysicsRNG:
    """Deterministic pseudo-random number generator with Gaussian support."""

    def __init__(self, seed: int):
        self._rng = random.Random(seed)

    def uniform(self, lo: float = 0.0, hi: float = 1.0) -> float:
        return self._rng.uniform(lo, hi)

    def gauss(self, mu: float, sigma: float) -> float:
        return self._rng.gauss(mu, sigma)

    def choice(self, seq):
        return self._rng.choice(seq)

    def randint(self, a: int, b: int) -> int:
        return self._rng.randint(a, b)


# ─── Measurement & Component Data Classes ───────────────────────────

@dataclass
class Measurement:
    time_hours: int
    value: float


@dataclass
class ParameterRecord:
    parameter: str
    unit: str
    safety_limit: float
    measurements: list  # list of {"timeHours": int, "value": float}
    predicted_168h: float
    prediction_confidence: float


@dataclass
class AnomalyMetrics:
    anomaly_score: float
    z_score: float
    robust_z_score: float
    percentile: float
    deviation_from_baseline: float
    level: str


@dataclass
class PredictionMetrics:
    predicted_value: float
    confidence: float
    drift_rate: float
    drift_score: float
    safety_margin: float
    safety_margin_pct: float
    trend_direction: str
    drift_level: str


@dataclass
class RiskScore:
    anomaly_weight: float = 0.40
    drift_weight: float = 0.35
    prediction_weight: float = 0.25
    anomaly_contribution: float = 0.0
    drift_contribution: float = 0.0
    prediction_contribution: float = 0.0
    overall_score: float = 0.0
    level: str = "LOW"


@dataclass
class ExplainabilityItem:
    category: str
    title: str
    description: str
    severity: str


@dataclass
class ComponentRecord:
    component_id: str
    lot_id: str
    test_batch: str
    test_start: str
    test_end: str
    test_condition: str
    profile: str
    parameter_data: list
    anomaly_metrics: dict
    prediction_metrics: dict
    risk: dict
    explanations: list
    ai_recommendation: str
    scientist_decision: Any = None
    scientist_comment: Any = None
    ai_overridden: bool = False
    final_status: str = "PENDING"


# ─── Physics-Informed Measurement Generator ──────────────────────────

def generate_measurements(
    rng: PhysicsRNG,
    param: ParameterDef,
    profile: str,
) -> tuple[list[dict], float, float]:
    """Generate time-series measurements using physics-informed degradation models.

    Returns:
        (measurements_list, predicted_168h, confidence)
    """
    base_value = max(0.01, rng.gauss(param.nominal_mean, param.nominal_std * 0.3))

    if profile == "healthy":
        # Power-law with β ≈ 1.0 (linear), tiny α
        alpha = param.natural_drift_per_hour * rng.uniform(0.5, 1.5)
        beta = rng.uniform(0.95, 1.05)
        measurements = []
        for t in TIME_POINTS:
            noise = rng.gauss(0, param.nominal_std * 0.04)
            val = base_value + alpha * (t ** beta) + noise
            measurements.append({"timeHours": t, "value": max(0, val)})
        last = measurements[-1]["value"]
        predicted = last + rng.gauss(0, param.nominal_std * 0.02)
        confidence = rng.uniform(0.92, 0.99)

    elif profile == "moderate_drift":
        # β ≈ 1.0-1.2, moderate α (3-7x natural)
        alpha = param.natural_drift_per_hour * rng.uniform(3, 7)
        beta = rng.uniform(1.0, 1.2)
        measurements = []
        for t in TIME_POINTS:
            noise = rng.gauss(0, param.nominal_std * 0.06)
            val = base_value + alpha * (max(1, t) ** beta) + noise
            measurements.append({"timeHours": t, "value": max(0, val)})
        # Extrapolate with slight acceleration
        slope = (measurements[2]["value"] - measurements[1]["value"]) / (96 - 24)
        predicted = measurements[2]["value"] + slope * (168 - 96) * rng.uniform(1.0, 1.3)
        confidence = rng.uniform(0.75, 0.90)

    elif profile == "high_drift":
        # β > 1.3 (superlinear acceleration), high α
        alpha = param.natural_drift_per_hour * rng.uniform(8, 20)
        beta = rng.uniform(1.3, 1.6)
        measurements = []
        for t in TIME_POINTS:
            noise = rng.gauss(0, param.nominal_std * 0.04)
            val = base_value + alpha * (max(1, t) ** beta) / (168 ** (beta - 1)) + noise
            measurements.append({"timeHours": t, "value": max(0, val)})
        slope = (measurements[2]["value"] - measurements[1]["value"]) / (96 - 24)
        predicted = measurements[2]["value"] + slope * (168 - 96) * rng.uniform(1.3, 1.7)
        confidence = rng.uniform(0.82, 0.93)

    elif profile == "critical":
        # Thermal runaway: exponential acceleration
        alpha = param.natural_drift_per_hour * rng.uniform(15, 35)
        beta = rng.uniform(1.6, 2.0)
        measurements = []
        for t in TIME_POINTS:
            noise = rng.gauss(0, param.nominal_std * 0.03)
            val = base_value + alpha * (max(1, t) ** beta) / (168 ** (beta - 1)) + noise
            measurements.append({"timeHours": t, "value": max(0, val)})
        predicted = param.safety_limit * rng.uniform(0.88, 1.25)
        confidence = rng.uniform(0.85, 0.95)

    elif profile == "population_anomaly":
        # Static-pass but far from population center (>3.5σ offset)
        offset = param.nominal_std * rng.uniform(2.5, 4.5)
        alpha = param.natural_drift_per_hour * rng.uniform(0.3, 0.8)
        measurements = []
        for t in TIME_POINTS:
            noise = rng.gauss(0, param.nominal_std * 0.03)
            val = base_value + offset + alpha * t + noise
            measurements.append({"timeHours": t, "value": max(0, val)})
        predicted = measurements[-1]["value"] + param.natural_drift_per_hour * rng.uniform(10, 30)
        confidence = rng.uniform(0.88, 0.95)

    elif profile == "sudden_jump":
        # Normal until 96h then abrupt shift
        jump = param.nominal_std * rng.uniform(3, 6)
        measurements = []
        for i, t in enumerate(TIME_POINTS):
            noise = rng.gauss(0, param.nominal_std * 0.04)
            jump_val = jump if i >= 2 else 0
            val = base_value + param.natural_drift_per_hour * t + jump_val + noise
            measurements.append({"timeHours": t, "value": max(0, val)})
        predicted = measurements[2]["value"] + jump * rng.uniform(0.2, 0.5)
        confidence = rng.uniform(0.65, 0.80)

    elif profile == "intermittent_noise":
        # Random spikes at unpredictable time points
        spike_idx = rng.randint(1, 3)
        measurements = []
        for i, t in enumerate(TIME_POINTS):
            noise = rng.gauss(0, param.nominal_std * 0.04)
            spike = param.nominal_std * rng.uniform(2, 5) if i == spike_idx else 0
            val = base_value + param.natural_drift_per_hour * t + noise + spike
            measurements.append({"timeHours": t, "value": max(0, val)})
        predicted = base_value + param.natural_drift_per_hour * 168 + rng.gauss(0, param.nominal_std * 0.1)
        confidence = rng.uniform(0.55, 0.75)

    elif profile == "early_infant_mortality":
        # Rapid failure within first 24h
        measurements = [{"timeHours": 0, "value": max(0, base_value)}]
        failure_val = param.safety_limit * rng.uniform(0.7, 1.1)
        measurements.append({"timeHours": 24, "value": failure_val})
        measurements.append({"timeHours": 96, "value": failure_val * rng.uniform(1.0, 1.2)})
        measurements.append({"timeHours": 168, "value": failure_val * rng.uniform(1.1, 1.4)})
        predicted = param.safety_limit * rng.uniform(1.0, 1.5)
        confidence = rng.uniform(0.90, 0.97)

    else:
        # Fallback: healthy
        measurements = [{"timeHours": t, "value": base_value + param.natural_drift_per_hour * t}
                        for t in TIME_POINTS]
        predicted = measurements[-1]["value"]
        confidence = 0.95

    return measurements, max(0, predicted), confidence


# ─── Risk Level Categorizer ─────────────────────────────────────────

def get_risk_level(score: float) -> str:
    if score >= 0.86:
        return "CRITICAL"
    if score >= 0.61:
        return "HIGH"
    if score >= 0.31:
        return "MEDIUM"
    return "LOW"


# ─── Anomaly Metrics ────────────────────────────────────────────────

def compute_anomaly_metrics(
    value: float, lot_values: list[float], lot_mean: float, lot_std: float
) -> dict:
    z_score = (value - lot_mean) / lot_std if lot_std > 0 else 0.0

    sorted_vals = sorted(lot_values)
    n = len(sorted_vals)
    median = sorted_vals[n // 2]
    abs_devs = sorted([abs(v - median) for v in sorted_vals])
    mad = abs_devs[n // 2] * 1.4826
    robust_z = (value - median) / mad if mad > 0 else 0.0

    below = sum(1 for v in lot_values if v < value)
    percentile = (below / n) * 100

    abs_z = abs(z_score)
    anomaly_score = min(1.0, 1.0 - math.exp(-abs_z * abs_z / 4.0))

    deviation = value - lot_mean
    level = get_risk_level(anomaly_score)

    return {
        "anomalyScore": round(anomaly_score, 4),
        "zScore": round(z_score, 4),
        "robustZScore": round(robust_z, 4),
        "percentile": round(percentile, 2),
        "deviationFromBaseline": round(deviation, 4),
        "level": level,
    }


# ─── Prediction Metrics ─────────────────────────────────────────────

def compute_prediction_metrics(
    measurements: list[dict], predicted: float, confidence: float, safety_limit: float
) -> dict:
    if len(measurements) >= 2:
        last = measurements[-1]
        prev = measurements[-2]
        dt = last["timeHours"] - prev["timeHours"]
        drift_rate = (last["value"] - prev["value"]) / dt if dt > 0 else 0.0
    else:
        drift_rate = 0.0

    safety_margin = max(0, safety_limit - predicted)
    safety_margin_pct = (safety_margin / safety_limit) * 100 if safety_limit > 0 else 0

    total_change = abs(measurements[-1]["value"] - measurements[0]["value"]) if len(measurements) >= 2 else 0
    initial = max(measurements[0]["value"], 0.001)
    drift_score = min(1.0, (total_change / initial) * 2)

    # Trend direction
    trend = "stable"
    if len(measurements) >= 3:
        dt1 = max(1, measurements[1]["timeHours"] - measurements[0]["timeHours"])
        dt2 = max(1, measurements[-1]["timeHours"] - measurements[-2]["timeHours"])
        early_slope = (measurements[1]["value"] - measurements[0]["value"]) / dt1
        late_slope = (measurements[-1]["value"] - measurements[-2]["value"]) / dt2
        if abs(late_slope) < abs(early_slope) * 0.5 and abs(late_slope) < 0.01:
            trend = "stable"
        elif late_slope > early_slope * 1.5 and late_slope > 0:
            trend = "accelerating"
        elif late_slope > 0:
            trend = "increasing"
        else:
            trend = "decreasing"

    drift_level = get_risk_level(drift_score)

    return {
        "predictedValue": round(predicted, 4),
        "confidence": round(confidence, 4),
        "driftRate": round(drift_rate, 6),
        "driftScore": round(drift_score, 4),
        "safetyMargin": round(safety_margin, 4),
        "safetyMarginPct": round(safety_margin_pct, 2),
        "trendDirection": trend,
        "driftLevel": drift_level,
    }


# ─── Risk Score ──────────────────────────────────────────────────────

def compute_risk_score(anomaly_score: float, drift_score: float, predicted: float, safety_limit: float) -> dict:
    aw, dw, pw = 0.40, 0.35, 0.25
    pred_risk = min(1.0, max(0.0, predicted / safety_limit))

    ac = anomaly_score * aw
    dc = drift_score * dw
    pc = pred_risk * pw
    overall = min(1.0, ac + dc + pc)

    return {
        "anomalyWeight": aw,
        "driftWeight": dw,
        "predictionWeight": pw,
        "anomalyContribution": round(ac, 4),
        "driftContribution": round(dc, 4),
        "predictionContribution": round(pc, 4),
        "overallScore": round(overall, 4),
        "level": get_risk_level(overall),
    }


# ─── Explainability ─────────────────────────────────────────────────

def generate_explanations(anomaly: dict, prediction: dict, risk: dict, param_name: str) -> list[dict]:
    items = []

    if anomaly["anomalyScore"] > 0.3:
        sigma = abs(anomaly["zScore"])
        direction = "above" if anomaly["zScore"] > 0 else "below"
        items.append({
            "category": "population",
            "title": "Population Anomaly",
            "description": f"{param_name} is {sigma:.1f}σ {direction} the lot baseline. "
                           f"Component is in the {anomaly['percentile']:.1f} percentile.",
            "severity": anomaly["level"],
        })

    if prediction["driftScore"] > 0.3:
        dr = prediction["driftRate"]
        sign = "+" if dr > 0 else ""
        trend_label = ""
        if prediction["trendDirection"] == "accelerating":
            trend_label = " with accelerating trend"
        elif prediction["trendDirection"] == "increasing":
            trend_label = " showing steady increase"
        items.append({
            "category": "drift",
            "title": "Abnormal Drift",
            "description": f"{param_name} shows drift rate of {sign}{dr * 100:.1f} per hour{trend_label}. "
                           f"Drift score: {prediction['driftScore']:.2f}.",
            "severity": prediction["driftLevel"],
        })

    if prediction["safetyMarginPct"] < 30:
        sev = "CRITICAL" if prediction["safetyMarginPct"] < 10 else (
              "HIGH" if prediction["safetyMarginPct"] < 20 else "MEDIUM")
        items.append({
            "category": "prediction",
            "title": "Future Prediction Concern",
            "description": f"Predicted 168h value ({prediction['predictedValue']:.1f}) is within "
                           f"{prediction['safetyMarginPct']:.1f}% of the safety boundary. "
                           f"Safety margin: {prediction['safetyMargin']:.1f}.",
            "severity": sev,
        })

    if len(items) >= 2:
        items.append({
            "category": "combined",
            "title": "Combined Evidence",
            "description": f"Multiple independent indicators suggest elevated risk. "
                           f"{len(items)} risk factors identified.",
            "severity": risk["level"],
        })

    return items


# ─── AI Recommendation ──────────────────────────────────────────────

def get_ai_recommendation(risk: dict) -> str:
    score = risk["overallScore"]
    if score >= 0.61:
        return "FAIL"
    if score >= 0.31:
        return "REVIEW"
    return "PASS"


# ─── Showcase Component Calibration ─────────────────────────────────

SHOWCASE_OVERRIDES = {
    "C0201": {
        "Leakage Current": {
            "measurements": [
                {"timeHours": 0, "value": 10.0},
                {"timeHours": 24, "value": 10.2},
                {"timeHours": 96, "value": 10.5},
                {"timeHours": 168, "value": 11.2},
            ],
            "predicted": 14.8,
            "confidence": 0.96,
        }
    },
    "C0518": {
        "Leakage Current": {
            "measurements": [
                {"timeHours": 0, "value": 10.1},
                {"timeHours": 24, "value": 11.5},
                {"timeHours": 96, "value": 13.2},
                {"timeHours": 168, "value": 40.2},
            ],
            "predicted": 41.2,
            "confidence": 0.88,
        }
    },
    "C0742": {
        "Leakage Current": {
            "measurements": [
                {"timeHours": 0, "value": 10.2},
                {"timeHours": 24, "value": 11.8},
                {"timeHours": 96, "value": 14.1},
                {"timeHours": 168, "value": 46.8},
            ],
            "predicted": 47.3,
            "confidence": 0.91,
        }
    },
    "C0883": {
        "Leakage Current": {
            "measurements": [
                {"timeHours": 0, "value": 18.2},
                {"timeHours": 24, "value": 18.4},
                {"timeHours": 96, "value": 18.8},
                {"timeHours": 168, "value": 19.3},
            ],
            "predicted": 21.0,
            "confidence": 0.94,
        }
    },
}


# ─── Main Generator ─────────────────────────────────────────────────

def generate_dataset(count: int = 10000, seed: int = 42) -> list[dict]:
    """Generate `count` components with physics-informed degradation."""

    rng = PhysicsRNG(seed)

    # ── Assign profiles ──────────────────────────────────────────────
    profiles: list[str] = []
    for name, (fraction, _desc) in PROFILE_DISTRIBUTION.items():
        n = max(1, round(count * fraction))
        profiles.extend([name] * n)

    # Pad or trim to exact count
    while len(profiles) < count:
        profiles.append("healthy")
    profiles = profiles[:count]
    rng._rng.shuffle(profiles)

    # ── Generate IDs ─────────────────────────────────────────────────
    # Ensure showcase IDs exist
    showcase_ids = {"C0201", "C0518", "C0742", "C0883"}
    showcase_profiles = {
        "C0201": "healthy",
        "C0518": "moderate_drift",
        "C0742": "high_drift",
        "C0883": "population_anomaly",
    }

    all_ids = sorted(showcase_ids)
    used = set(showcase_ids)
    for _ in range(count - len(showcase_ids)):
        while True:
            num = rng.randint(1, 99999)
            cid = f"C{num:04d}"
            if cid not in used:
                used.add(cid)
                all_ids.append(cid)
                break

    all_ids.sort()

    # Map IDs to profiles
    id_profile_map = {}
    profile_iter = iter(profiles)
    for cid in all_ids:
        if cid in showcase_profiles:
            id_profile_map[cid] = showcase_profiles[cid]
        else:
            id_profile_map[cid] = next(profile_iter, "healthy")

    # ── Phase 1: Generate raw measurements ───────────────────────────
    LOT_ID = "IGBT-2026-017"
    TEST_BATCH = "BIN-ESS-2026-Q3-001"
    test_start = "2026-09-01T08:00:00"
    test_end = "2026-09-08T08:00:00"
    test_condition = "Burn-In @ 125°C, 168h, Vce=80%Vmax"

    raw_data = []  # list of (cid, profile, param_data_list)

    for cid in all_ids:
        profile = id_profile_map[cid]
        comp_rng = PhysicsRNG(hash(cid) % (2**31))
        param_data_list = []

        for param in PARAMETERS:
            measurements, predicted, confidence = generate_measurements(comp_rng, param, profile)

            # Apply showcase overrides
            if cid in SHOWCASE_OVERRIDES and param.name in SHOWCASE_OVERRIDES[cid]:
                override = SHOWCASE_OVERRIDES[cid][param.name]
                measurements = override["measurements"]
                predicted = override["predicted"]
                confidence = override["confidence"]

            param_data_list.append({
                "param": param,
                "measurements": measurements,
                "predicted": predicted,
                "confidence": confidence,
            })

        raw_data.append((cid, profile, param_data_list))

    # ── Phase 2: Compute lot statistics at 96h ───────────────────────
    lot_stats = {}  # param_name -> {mean, std, values}
    for param in PARAMETERS:
        values = []
        for _cid, _profile, param_data_list in raw_data:
            pd = next((p for p in param_data_list if p["param"].name == param.name), None)
            if pd:
                m96 = next((m for m in pd["measurements"] if m["timeHours"] == 96), None)
                if m96:
                    values.append(m96["value"])
        if values:
            mean = sum(values) / len(values)
            std = math.sqrt(sum((v - mean) ** 2 for v in values) / len(values))
            lot_stats[param.name] = {"mean": mean, "std": std, "values": values}
        else:
            lot_stats[param.name] = {"mean": 0, "std": 1, "values": []}

    # ── Phase 3: Build full component records with metrics ───────────
    components = []

    for cid, profile, param_data_list in raw_data:
        parameter_data = []
        anomaly_metrics_all = {}
        prediction_metrics_all = {}

        for pd in param_data_list:
            p = pd["param"]
            parameter_data.append({
                "parameter": p.name,
                "unit": p.unit,
                "safetyLimit": p.safety_limit,
                "measurements": pd["measurements"],
                "predicted168h": round(pd["predicted"], 4),
                "predictionConfidence": round(pd["confidence"], 4),
            })

            stats = lot_stats.get(p.name, {"mean": 0, "std": 1, "values": []})
            m96 = next((m for m in pd["measurements"] if m["timeHours"] == 96), pd["measurements"][-1])
            val96 = m96["value"]

            anomaly_metrics_all[p.name] = compute_anomaly_metrics(
                val96, stats["values"], stats["mean"], stats["std"]
            )
            prediction_metrics_all[p.name] = compute_prediction_metrics(
                pd["measurements"], pd["predicted"], pd["confidence"], p.safety_limit
            )

        # Primary parameter for overall risk
        primary = param_data_list[0]
        pp = primary["param"]
        primary_anomaly = anomaly_metrics_all[pp.name]
        primary_prediction = prediction_metrics_all[pp.name]

        risk = compute_risk_score(
            primary_anomaly["anomalyScore"],
            primary_prediction["driftScore"],
            primary["predicted"],
            pp.safety_limit,
        )

        explanations = generate_explanations(
            primary_anomaly, primary_prediction, risk, pp.name
        )

        ai_rec = get_ai_recommendation(risk)

        comp = {
            "componentId": cid,
            "lotId": LOT_ID,
            "testBatch": TEST_BATCH,
            "testStart": test_start,
            "testEnd": test_end,
            "testCondition": test_condition,
            "profile": profile,
            "parameterData": parameter_data,
            "anomalyMetrics": anomaly_metrics_all,
            "predictionMetrics": prediction_metrics_all,
            "risk": risk,
            "explanations": explanations,
            "aiRecommendation": ai_rec,
            "scientistDecision": None,
            "scientistComment": None,
            "aiOverridden": False,
            "finalStatus": "PENDING",
        }

        components.append(comp)

    return components


# ─── CSV Export (Flat ML-Training Table) ─────────────────────────────

def export_training_csv(components: list[dict], output_path: str):
    """Export a flat CSV suitable for TabPFN / LightGBM training."""

    fieldnames = [
        "component_id", "lot_id", "profile",
        # Primary parameter (Leakage Current) measurements
        "lc_0h", "lc_24h", "lc_96h", "lc_168h",
        "lc_predicted_168h", "lc_confidence",
        # Iddq measurements
        "iddq_0h", "iddq_24h", "iddq_96h", "iddq_168h",
        # Propagation Delay
        "pd_0h", "pd_24h", "pd_96h", "pd_168h",
        # Threshold Voltage
        "vth_0h", "vth_24h", "vth_96h", "vth_168h",
        # Resistance
        "res_0h", "res_24h", "res_96h", "res_168h",
        # Anomaly metrics (primary)
        "anomaly_score", "z_score", "robust_z_score", "percentile",
        # Prediction metrics (primary)
        "drift_rate", "drift_score", "safety_margin_pct", "trend_direction",
        # Risk
        "risk_score", "risk_level",
        # Labels
        "ai_recommendation",
        # Ground truth label for ML (derived from profile)
        "ground_truth_label",
    ]

    PARAM_SHORT = {
        "Leakage Current": "lc",
        "Iddq": "iddq",
        "Propagation Delay": "pd",
        "Threshold Voltage": "vth",
        "Resistance": "res",
    }

    LABEL_MAP = {
        "healthy": "PASS",
        "moderate_drift": "REVIEW",
        "high_drift": "FAIL",
        "critical": "FAIL",
        "population_anomaly": "REVIEW",
        "sudden_jump": "REVIEW",
        "intermittent_noise": "REVIEW",
        "early_infant_mortality": "FAIL",
    }

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for comp in components:
            row = {
                "component_id": comp["componentId"],
                "lot_id": comp["lotId"],
                "profile": comp["profile"],
            }

            # Parameter measurements
            for pd_item in comp["parameterData"]:
                prefix = PARAM_SHORT.get(pd_item["parameter"], "unk")
                for m in pd_item["measurements"]:
                    key = f"{prefix}_{m['timeHours']}h"
                    if key in fieldnames:
                        row[key] = round(m["value"], 4)
                if prefix == "lc":
                    row["lc_predicted_168h"] = pd_item["predicted168h"]
                    row["lc_confidence"] = pd_item["predictionConfidence"]

            # Primary anomaly
            primary_anomaly = comp["anomalyMetrics"].get("Leakage Current", {})
            row["anomaly_score"] = primary_anomaly.get("anomalyScore", 0)
            row["z_score"] = primary_anomaly.get("zScore", 0)
            row["robust_z_score"] = primary_anomaly.get("robustZScore", 0)
            row["percentile"] = primary_anomaly.get("percentile", 0)

            # Primary prediction
            primary_pred = comp["predictionMetrics"].get("Leakage Current", {})
            row["drift_rate"] = primary_pred.get("driftRate", 0)
            row["drift_score"] = primary_pred.get("driftScore", 0)
            row["safety_margin_pct"] = primary_pred.get("safetyMarginPct", 0)
            row["trend_direction"] = primary_pred.get("trendDirection", "stable")

            # Risk
            row["risk_score"] = comp["risk"]["overallScore"]
            row["risk_level"] = comp["risk"]["level"]
            row["ai_recommendation"] = comp["aiRecommendation"]
            row["ground_truth_label"] = LABEL_MAP.get(comp["profile"], "PASS")

            writer.writerow(row)

    print(f"  ✓ Training CSV exported: {output_path}")


# ─── ZIP Ingestion Stub ─────────────────────────────────────────────

def ingest_zip(zip_path: str) -> list[dict]:
    """Inspect and extract data from a user-provided ZIP file.

    This function streams the ZIP to avoid loading the entire 7.8GB into memory.
    """
    zip_path = Path(zip_path)
    if not zip_path.exists():
        print(f"  ✗ ZIP file not found: {zip_path}")
        return []

    print(f"\n  Inspecting ZIP: {zip_path}")
    print(f"  File size: {zip_path.stat().st_size / (1024**3):.2f} GB")

    with zipfile.ZipFile(zip_path, "r") as zf:
        entries = zf.namelist()
        print(f"  Total entries: {len(entries)}")

        # Categorize files
        csv_files = [e for e in entries if e.lower().endswith(".csv")]
        json_files = [e for e in entries if e.lower().endswith(".json")]
        other_files = [e for e in entries if not e.lower().endswith((".csv", ".json"))]

        print(f"  CSV files:  {len(csv_files)}")
        print(f"  JSON files: {len(json_files)}")
        print(f"  Other:      {len(other_files)}")

        # Show first 20 entries
        print("\n  First 20 entries:")
        for entry in entries[:20]:
            info = zf.getinfo(entry)
            size_mb = info.file_size / (1024 * 1024)
            print(f"    {entry} ({size_mb:.2f} MB)")

        if len(entries) > 20:
            print(f"    ... and {len(entries) - 20} more files")

    print("\n  ⓘ  ZIP inspection complete. Run with --process-zip to extract and convert data.")
    return []


# ─── CLI Entry Point ────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="SIH 26170 — Physics-Informed 10,000+ Component Dataset Generator"
    )
    parser.add_argument("--count", type=int, default=10000, help="Number of components to generate (default: 10000)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility (default: 42)")
    parser.add_argument("--ingest", type=str, default=None, help="Path to a ZIP file to inspect/ingest")
    parser.add_argument("--output-dir", type=str, default=None, help="Output directory (default: data/)")

    args = parser.parse_args()

    # Resolve output directory
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent
    output_dir = Path(args.output_dir) if args.output_dir else project_root / "data"
    output_dir.mkdir(parents=True, exist_ok=True)

    # ── ZIP Ingestion ────────────────────────────────────────────────
    if args.ingest:
        ingest_zip(args.ingest)
        return

    # ── Dataset Generation ───────────────────────────────────────────
    print(f"\n{'═' * 60}")
    print(f"  SIH 26170 — Physics-Informed Dataset Generator")
    print(f"{'═' * 60}")
    print(f"  Components:       {args.count:,}")
    print(f"  Seed:             {args.seed}")
    print(f"  Arrhenius AF:     {AF_ARRHENIUS:.2f}x")
    print(f"  T_stress:         {T_STRESS_KELVIN - 273.15:.0f}°C ({T_STRESS_KELVIN:.2f} K)")
    print(f"  T_use:            {T_USE_KELVIN - 273.15:.0f}°C ({T_USE_KELVIN:.2f} K)")
    print(f"  Activation Energy: {ACTIVATION_ENERGY} eV")
    print(f"  Output:           {output_dir}")
    print(f"{'─' * 60}")

    print("\n  Generating components...")
    components = generate_dataset(count=args.count, seed=args.seed)

    # ── Statistics ───────────────────────────────────────────────────
    profile_counts: dict[str, int] = {}
    risk_counts: dict[str, int] = {}
    rec_counts: dict[str, int] = {}

    for c in components:
        p = c["profile"]
        profile_counts[p] = profile_counts.get(p, 0) + 1
        r = c["risk"]["level"]
        risk_counts[r] = risk_counts.get(r, 0) + 1
        a = c["aiRecommendation"]
        rec_counts[a] = rec_counts.get(a, 0) + 1

    print(f"\n  ✓ Generated {len(components):,} components")
    print(f"\n  Profile Distribution:")
    for name, count in sorted(profile_counts.items(), key=lambda x: -x[1]):
        pct = count / len(components) * 100
        print(f"    {name:30s}  {count:6,}  ({pct:5.1f}%)")

    print(f"\n  Risk Distribution:")
    for level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
        count = risk_counts.get(level, 0)
        pct = count / len(components) * 100
        print(f"    {level:10s}  {count:6,}  ({pct:5.1f}%)")

    print(f"\n  AI Recommendation Distribution:")
    for rec in ["PASS", "REVIEW", "FAIL"]:
        count = rec_counts.get(rec, 0)
        pct = count / len(components) * 100
        print(f"    {rec:10s}  {count:6,}  ({pct:5.1f}%)")

    # ── Export JSON ──────────────────────────────────────────────────
    json_path = output_dir / "lot_10k_components.json"
    print(f"\n  Exporting JSON...")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(components, f, indent=None, ensure_ascii=False)  # compact JSON
    json_size = json_path.stat().st_size / (1024 * 1024)
    print(f"  ✓ JSON exported: {json_path} ({json_size:.1f} MB)")

    # ── Export Training CSV ──────────────────────────────────────────
    csv_path = output_dir / "lot_10k_training.csv"
    print(f"\n  Exporting training CSV...")
    export_training_csv(components, str(csv_path))
    csv_size = csv_path.stat().st_size / (1024 * 1024)
    print(f"  ✓ CSV size: {csv_size:.1f} MB")

    print(f"\n{'═' * 60}")
    print(f"  ✓ COMPLETE — Dataset ready for TabPFN / ML training")
    print(f"{'═' * 60}\n")


if __name__ == "__main__":
    main()
