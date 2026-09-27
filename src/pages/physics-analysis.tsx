import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLot } from '@/data/lot-context';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RiskBadge } from '@/components/shared/risk-badge';
import { LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import type { Measurement, ParameterData, Component, ExplainabilityItem } from '@/data/types';

export function PhysicsAnalysisPage() {
  const { componentId } = useParams<{ componentId: string }>();
  const { state } = useLot();
  const component = state.components.find((c: Component) => c.componentId === componentId);
  const [selectedParameter, setSelectedParameter] = useState(0);

  if (!component) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-neutral-500">Component not found</p>
      </div>
    );
  }

  const paramData = component.parameterData;
  if (paramData.length === 0) return null;

  const activeParam = paramData[selectedParameter];
  const activeAnomaly = component.anomalyMetrics[activeParam.parameter];
  const activePrediction = component.predictionMetrics[activeParam.parameter];
  const activePINN = component.pinnMetrics?.[activeParam.parameter];

  // Prepare trajectory chart data
  const trajectoryData = activeParam.measurements.map((m: Measurement) => ({
    time: m.timeHours,
    value: m.value,
  }));

  // Add prediction bound visualization
  if (activePINN) {
    trajectoryData.push({
      time: 168,
      value: activePrediction.predictedValue,
    });
  }

  // Prepare confidence interval chart
  const confidenceData = activeParam.measurements.map((m: Measurement) => ({
    time: m.timeHours,
    value: m.value,
    upper: m.value * 1.05,
    lower: m.value * 0.95,
  }));

  if (activePINN) {
    confidenceData.push({
      time: 168,
      value: activePrediction.predictedValue,
      upper: activePINN.upperBound95th,
      lower: activePINN.lowerBound5th,
    });
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-neutral-900 mb-2">
            Physics-Informed Analysis
          </h1>
          <p className="text-lg text-neutral-600">
            Component {component.componentId} • Arrhenius & Coffin-Manson Physics Models
          </p>
        </div>

        {/* Parameter Selector */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {paramData.map((param: ParameterData, idx: number) => (
            <button
              key={idx}
              onClick={() => setSelectedParameter(idx)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedParameter === idx
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-100'
              }`}
            >
              {param.parameter}
            </button>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left: Key Metrics */}
          <div className="lg:col-span-1 space-y-4">
            {/* Physics Model Card */}
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-neutral-600 uppercase mb-4">
                Physics Model
              </h3>
              {activePINN && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-neutral-500 uppercase">Model Type</p>
                    <p className="text-lg font-bold text-neutral-900 capitalize">
                      {activePINN.physicsModel}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 uppercase">Acceleration Factor</p>
                    <p className={`text-lg font-bold ${activePINN.accelerationFactor > 1.15 ? 'text-red-600' : activePINN.accelerationFactor > 1.05 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {activePINN.accelerationFactor.toFixed(2)}×
                    </p>
                  </div>
                </div>
              )}
            </Card>

            {/* Thermal Acceleration Card */}
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-neutral-600 uppercase mb-4">
                Thermal Acceleration
              </h3>
              {activePINN && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-neutral-500 uppercase">Arrhenius Factor</p>
                    <p className="text-lg font-bold text-neutral-900">
                      {activePINN.thermalAccelerationFactor.toFixed(2)}×
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Degradation speed at 125°C vs 25°C
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 uppercase">Est. Lifetime</p>
                    <p className="text-lg font-bold text-neutral-900">
                      {activePINN.estimatedLifetimeHours.toFixed(1)}h
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Until safety limit at operating conditions
                    </p>
                  </div>
                </div>
              )}
            </Card>

            {/* Failure Risk Card */}
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-neutral-600 uppercase mb-4">
                Failure Risk (168h)
              </h3>
              {activePINN && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-2xl font-bold text-neutral-900">
                      {activePINN.failureRiskPercent.toFixed(1)}%
                    </div>
                    <RiskBadge
                      level={
                        activePINN.failureRiskPercent > 50
                          ? 'CRITICAL'
                          : activePINN.failureRiskPercent > 20
                            ? 'HIGH'
                            : activePINN.failureRiskPercent > 5
                              ? 'MEDIUM'
                              : 'LOW'
                      }
                    />
                  </div>
                  <p className="text-xs text-neutral-500">
                    Probability of exceeding safety limit during 168h test
                  </p>
                </div>
              )}
            </Card>

            {/* Confidence Interval Card */}
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-neutral-600 uppercase mb-4">
                Prediction Bounds
              </h3>
              {activePINN && (
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-neutral-500 uppercase">95th Percentile</p>
                    <p className="text-lg font-bold text-red-600">
                      {activePINN.upperBound95th.toFixed(2)} {activeParam.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 uppercase">5th Percentile</p>
                    <p className="text-lg font-bold text-green-600">
                      {activePINN.lowerBound5th.toFixed(2)} {activeParam.unit}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-neutral-200">
                    <p className="text-xs text-neutral-500 uppercase">Safety Limit</p>
                    <p className="text-lg font-bold text-neutral-900">
                      {activeParam.safetyLimit.toFixed(2)} {activeParam.unit}
                    </p>
                  </div>
                </div>
              )}
            </Card>

            {/* Correlated Failure Modes */}
            {activePINN && activePINN.correlatedFailureModes.length > 0 && (
              <Card className="p-6 border-orange-200 bg-orange-50">
                <h3 className="text-sm font-semibold text-orange-900 uppercase mb-3">
                  ⚠ Coupled Failure Modes
                </h3>
                <ul className="space-y-2">
                  {activePINN.correlatedFailureModes.map((mode: string, idx: number) => (
                    <li key={idx} className="text-sm text-orange-800">
                      • {mode}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          {/* Right: Trajectory Charts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Trajectory with Confidence Interval */}
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-neutral-600 uppercase mb-4">
                Degradation Trajectory with Confidence Bounds
              </h3>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={confidenceData}>
                  <defs>
                    <linearGradient id="colorUpper" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorLower" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" label={{ value: 'Time (hours)', position: 'insideBottomRight', offset: -5 }} />
                  <YAxis label={{ value: `${activeParam.unit}`, angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}
                    formatter={(value) => `${Number(value).toFixed(2)} ${activeParam.unit}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="upper"
                    stroke="#ef4444"
                    fillOpacity={1}
                    fill="url(#colorUpper)"
                    name="95th Percentile"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                  <Area
                    type="monotone"
                    dataKey="lower"
                    stroke="#22c55e"
                    fillOpacity={1}
                    fill="url(#colorLower)"
                    name="5th Percentile"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={{ r: 5 }}
                    name="Measured / Predicted"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* Safety Margin Over Time */}
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-neutral-600 uppercase mb-4">
                Safety Margin Projection
              </h3>
              <div className="mb-4 p-4 bg-neutral-100 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-neutral-600 uppercase">Current Margin (96h)</p>
                    <p className="text-2xl font-bold text-neutral-900">
                      {(activeParam.safetyLimit - (activeParam.measurements.find((m: Measurement) => m.timeHours === 96)?.value || 0)).toFixed(2)} {activeParam.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-600 uppercase">Projected Margin (168h)</p>
                    <p className={`text-2xl font-bold ${activePrediction.safetyMargin > activeParam.safetyLimit * 0.2 ? 'text-green-600' : activePrediction.safetyMargin > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {activePrediction.safetyMargin.toFixed(2)} {activeParam.unit}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-neutral-600">
                  <strong>Degradation Rate:</strong> {activePrediction.driftRate.toFixed(4)} {activeParam.unit}/hour
                </p>
                <p className="text-neutral-600">
                  <strong>Trend:</strong> {activePrediction.trendDirection === 'accelerating' ? '📈 Accelerating' : activePrediction.trendDirection === 'increasing' ? '⬆ Increasing' : '➡ Stable'}
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* Detailed Physics Explanation */}
        <Card className="p-6 mb-8">
          <h3 className="text-sm font-semibold text-neutral-600 uppercase mb-4">
            🔬 Physics Model Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-semibold text-neutral-900 mb-2">Arrhenius Thermal Acceleration</h4>
              <p className="text-neutral-700 mb-2">
                This model predicts how temperature exponentially increases degradation rates according to the Arrhenius equation:
              </p>
              <code className="block bg-neutral-100 p-3 rounded text-xs text-neutral-800 mb-2">
                A(T) = A₀ × exp(Eₐ/kB × (1/T_ref - 1/T))
              </code>
              <p className="text-neutral-600 text-xs">
                For {activeParam.parameter}, the activation energy indicates {activeParam.parameter === 'Leakage Current' ? 'gate oxide degradation' : activeParam.parameter === 'Iddq' ? 'bridging defect acceleration' : activeParam.parameter === 'Propagation Delay' ? 'electromigration' : activeParam.parameter === 'Threshold Voltage' ? 'charge trapping / HCI' : 'wire bond degradation'}.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-neutral-900 mb-2">Coffin-Manson Fatigue Model</h4>
              <p className="text-neutral-700 mb-2">
                Mechanical stress and thermal cycling induce fatigue-based failures:
              </p>
              <code className="block bg-neutral-100 p-3 rounded text-xs text-neutral-800 mb-2">
                N_f = C × (ΔT)^(-m) × (σ/σ_ref)^(-n)
              </code>
              <p className="text-neutral-600 text-xs">
                The model predicts cycles to failure based on temperature cycling range and stress levels, enabling early detection of thermomechanical fatigue.
              </p>
            </div>
          </div>
        </Card>

        {/* Explainability Summary */}
        {component.explanations.length > 0 && (
          <Card className="p-6 border-blue-200 bg-blue-50">
            <h3 className="text-sm font-semibold text-blue-900 uppercase mb-4">
              📋 AI Explainability Summary
            </h3>
            <ul className="space-y-3">
              {component.explanations.map((item: ExplainabilityItem, idx: number) => (
                <li key={idx} className="text-sm text-blue-900">
                  <span className="font-semibold">{item.title}:</span> {item.description}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
