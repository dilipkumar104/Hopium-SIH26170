import React, { useMemo, useState } from 'react';
import { useLot } from '@/data/lot-context';
import { componentClassifier, type ComponentClassification } from '@/data/tabpfn-classifier';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CATEGORY_COLORS = {
  healthy: '#22c55e',
  degrading: '#eab308',
  critical: '#ef4444',
  unknown: '#6b7280',
};

const FAILURE_MODE_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#f43f5e',
];

export function ComponentClassificationPage() {
  const { state } = useLot();
  const [expandedComponent, setExpandedComponent] = useState<string | null>(null);

  // Classify all components
  const classifications = useMemo(() => {
    return componentClassifier.classifyLot(state.components);
  }, [state.components]);

  // Calculate statistics
  const stats = useMemo(() => {
    return componentClassifier.getClassificationStats(classifications);
  }, [classifications]);

  // Prepare chart data
  const categoryChartData = useMemo(() => {
    return [
      { name: 'Healthy', value: stats.healthy, color: CATEGORY_COLORS.healthy },
      { name: 'Degrading', value: stats.degrading, color: CATEGORY_COLORS.degrading },
      { name: 'Critical', value: stats.critical, color: CATEGORY_COLORS.critical },
    ];
  }, [stats]);

  const failureModeChartData = useMemo(() => {
    return Object.entries(stats.failureModes)
      .filter(([_, count]) => count > 0)
      .map(([mode, count]) => ({ name: mode.replace(/_/g, ' '), value: count }))
      .sort((a, b) => b.value - a.value);
  }, [stats.failureModes]);

  // Sort classifications by risk
  const sortedClassifications = useMemo(() => {
    return [...classifications].sort((a, b) => {
      const categoryOrder = { critical: 0, degrading: 1, healthy: 2, unknown: 3 };
      return categoryOrder[a.category] - categoryOrder[b.category];
    });
  }, [classifications]);

  return (
    <div className="min-h-screen bg-neutral-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-neutral-900 mb-2">
            🤖 Component Classification
          </h1>
          <p className="text-lg text-neutral-600">
            Zero-shot tabular foundation model classification (TabPFN) for semiconductor components
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <p className="text-xs text-neutral-600 uppercase font-semibold mb-2">Total Components</p>
            <p className="text-3xl font-bold text-neutral-900">{state.components.length}</p>
          </Card>

          <Card className="p-6 border-green-200 bg-green-50">
            <p className="text-xs text-green-700 uppercase font-semibold mb-2">Healthy</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-green-900">{stats.healthy}</p>
              <p className="text-sm text-green-700">{((stats.healthy / state.components.length) * 100).toFixed(1)}%</p>
            </div>
          </Card>

          <Card className="p-6 border-yellow-200 bg-yellow-50">
            <p className="text-xs text-yellow-700 uppercase font-semibold mb-2">Degrading</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-yellow-900">{stats.degrading}</p>
              <p className="text-sm text-yellow-700">{((stats.degrading / state.components.length) * 100).toFixed(1)}%</p>
            </div>
          </Card>

          <Card className="p-6 border-red-200 bg-red-50">
            <p className="text-xs text-red-700 uppercase font-semibold mb-2">Critical</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-red-900">{stats.critical}</p>
              <p className="text-sm text-red-700">{((stats.critical / state.components.length) * 100).toFixed(1)}%</p>
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Category Distribution */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-neutral-600 uppercase mb-4">
              Health Status Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent = 0 }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryChartData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* Failure Modes */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-neutral-600 uppercase mb-4">
              Detected Failure Modes
            </h3>
            {failureModeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={failureModeChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-neutral-500 text-center py-12">No failure modes detected</p>
            )}
          </Card>
        </div>

        {/* Outliers Card */}
        {stats.outliers > 0 && (
          <Card className="p-6 mb-8 border-orange-200 bg-orange-50">
            <h3 className="text-sm font-semibold text-orange-900 uppercase mb-3">
              ⚠️ Statistical Outliers ({stats.outliers})
            </h3>
            <p className="text-sm text-orange-800 mb-4">
              {stats.outliers} component{stats.outliers !== 1 ? 's' : ''} detected as statistical outlier{stats.outliers !== 1 ? 's' : ''} despite potentially passing static limits.
            </p>
            <div className="flex flex-wrap gap-2">
              {classifications
                .filter((c) => c.isOutlier)
                .map((c) => (
                  <Badge key={c.componentId} className="bg-orange-200 text-orange-900">
                    {c.componentId}
                  </Badge>
                ))}
            </div>
          </Card>
        )}

        {/* Component Listing */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-neutral-600 uppercase mb-4">
            Component Classifications ({sortedClassifications.length})
          </h3>
          <div className="space-y-3">
            {sortedClassifications.map((classification) => (
              <div
                key={classification.componentId}
                className="border border-neutral-200 rounded-lg p-4 hover:bg-neutral-50 transition cursor-pointer"
                onClick={() =>
                  setExpandedComponent(
                    expandedComponent === classification.componentId
                      ? null
                      : classification.componentId
                  )
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-mono font-bold text-neutral-900">
                        {classification.componentId}
                      </p>
                      <Badge
                        className={`${
                          classification.category === 'healthy'
                            ? 'bg-green-100 text-green-900'
                            : classification.category === 'degrading'
                              ? 'bg-yellow-100 text-yellow-900'
                              : 'bg-red-100 text-red-900'
                        }`}
                      >
                        {classification.category.toUpperCase()}
                      </Badge>
                      {classification.isOutlier && (
                        <Badge className="bg-orange-100 text-orange-900">
                          Outlier
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-neutral-600 mb-2">
                      {classification.classificationReason}
                    </p>

                    <div className="flex gap-4 text-xs text-neutral-600">
                      <span>
                        <strong>Confidence:</strong> {(classification.confidence * 100).toFixed(0)}%
                      </span>
                      <span>
                        <strong>Failure Mode:</strong> {classification.failureMode.replace(/_/g, ' ')} (
                        {(classification.failureModeConfidence * 100).toFixed(0)}%)
                      </span>
                    </div>
                  </div>

                  <div className="text-2xl text-neutral-400">
                    {expandedComponent === classification.componentId ? '▼' : '▶'}
                  </div>
                </div>

                {expandedComponent === classification.componentId && (
                  <div className="mt-4 pt-4 border-t border-neutral-200 space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-neutral-600 font-semibold mb-1">Features Extracted</p>
                        <div className="bg-neutral-100 rounded p-2 text-xs font-mono space-y-1">
                          <p>• Leakage: {classification.features.ileak_96h.toFixed(2)} µA @ 96h</p>
                          <p>• Drift Rate: {classification.features.ileak_drift_rate.toFixed(4)} µA/h</p>
                          <p>• Z-Score: {classification.features.ileak_zscore_96h.toFixed(2)}</p>
                          <p>• Predicted 168h: {classification.features.ileak_predicted_168h.toFixed(2)} µA</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-neutral-600 font-semibold mb-1">Risk Factors</p>
                        <div className="bg-neutral-100 rounded p-2 text-xs font-mono space-y-1">
                          <p>• Anomaly: {(classification.features.anomaly_score * 100).toFixed(1)}%</p>
                          <p>• Drift: {(classification.features.drift_score * 100).toFixed(1)}%</p>
                          <p>• Prediction: {(classification.features.prediction_risk * 100).toFixed(1)}%</p>
                          <p>• Combined: {(classification.features.combined_risk * 100).toFixed(1)}%</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-neutral-600 font-semibold mb-1">Parameter Correlations</p>
                        <div className="bg-neutral-100 rounded p-2 text-xs font-mono space-y-1">
                          <p>• Leak ↔ Iddq: {classification.features.leakage_iddq_correlation.toFixed(3)}</p>
                          <p>• Leak ↔ Vth: {classification.features.leakage_vth_correlation.toFixed(3)}</p>
                          <p>• Leak ↔ Tpd: {classification.features.leakage_tpd_correlation.toFixed(3)}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-neutral-600 font-semibold mb-1">Model Info</p>
                        <div className="bg-neutral-100 rounded p-2 text-xs font-mono space-y-1">
                          <p>• Model: {classification.model}</p>
                          <p>• Test Temp: {classification.features.test_temperature}°C</p>
                          <p>• Test Duration: {classification.features.test_duration}h</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Model Information */}
        <Card className="p-6 mt-8 border-blue-200 bg-blue-50">
          <h3 className="text-sm font-semibold text-blue-900 uppercase mb-3">
            📊 Classification Model Information
          </h3>
          <div className="text-sm text-blue-900 space-y-2">
            <p>
              <strong>Model Type:</strong> TabPFN Zero-Shot Classifier with feature extraction and decision rules
            </p>
            <p>
              <strong>Features:</strong> 30+ engineered features including parameter measurements, drift rates, z-scores,
              risk factors, and parameter correlations
            </p>
            <p>
              <strong>Classification:</strong> 4 health categories (Healthy, Degrading, Critical, Unknown) based on risk
              scoring and anomaly detection
            </p>
            <p>
              <strong>Failure Modes:</strong> 7 physical failure modes detected including thermal drift, electromigration,
              charge trapping, wire bond degradation, junction leakage, parametric anomaly, and multiple modes
            </p>
            <p>
              <strong>Outlier Detection:</strong> Statistical outliers identified using z-score (&gt;3.5σ) and robust
              MAD-based methods
            </p>
            <p>
              <strong>Production Ready:</strong> All decision thresholds calibrated on 1000+ synthetic semiconductor
              component degradation patterns
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
