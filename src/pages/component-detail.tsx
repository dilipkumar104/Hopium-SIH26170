import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLot } from '@/data/lot-context';
import { PARAMETER_DEFINITIONS } from '@/data/generate-dataset';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RiskBadge } from '@/components/shared/risk-badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { DecisionDialog } from '@/components/shared/decision-dialog';
import { formatDate } from '@/lib/utils';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell,
} from 'recharts';
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus, Zap,
  Shield, Target, Brain, FileText, AlertTriangle,
  CheckCircle2, XCircle, Eye, Bot, User, Cpu,
  ChevronRight, BarChart3, Info, Clock,
} from 'lucide-react';

export default function ComponentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getComponent, getLotStats, state, addAudit } = useLot();

  const [selectedParameter, setSelectedParameter] = useState('Leakage Current');
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);

  const component = getComponent(id || '');

  // Log view to audit trail on first render
  useMemo(() => {
    if (component) {
      addAudit({
        componentId: component.componentId,
        action: 'Component Viewed',
        detail: `Scientist opened component details for ${component.componentId}`,
        actor: 'SCIENTIST',
      });
    }
    // eslint-disable-next-line
  }, [id]);

  const lotStats = getLotStats(selectedParameter);

  const paramDef = PARAMETER_DEFINITIONS.find((p) => p.name === selectedParameter);
  const paramData = component?.parameterData.find((p) => p.parameter === selectedParameter);
  const anomaly = component?.anomalyMetrics[selectedParameter];
  const prediction = component?.predictionMetrics[selectedParameter];

  // Time-series chart data
  const chartData = useMemo(() => {
    if (!paramData || !lotStats) return [];

    const m0 = paramData.measurements.find((m) => m.timeHours === 0)?.value ?? 0;
    const m24 = paramData.measurements.find((m) => m.timeHours === 24)?.value ?? 0;
    const m96 = paramData.measurements.find((m) => m.timeHours === 96)?.value ?? 0;

    return [
      {
        time: '0h', timeNum: 0, measured: m0, predicted: null,
        lotMean: lotStats.mean,
        normalHigh: lotStats.mean + 2 * lotStats.std,
        normalLow: Math.max(0, lotStats.mean - 2 * lotStats.std),
      },
      {
        time: '24h', timeNum: 24, measured: m24, predicted: null,
        lotMean: lotStats.mean,
        normalHigh: lotStats.mean + 2 * lotStats.std,
        normalLow: Math.max(0, lotStats.mean - 2 * lotStats.std),
      },
      {
        time: '96h', timeNum: 96, measured: m96, predicted: m96,
        lotMean: lotStats.mean,
        normalHigh: lotStats.mean + 2 * lotStats.std,
        normalLow: Math.max(0, lotStats.mean - 2 * lotStats.std),
      },
      {
        time: '168h', timeNum: 168, measured: null,
        predicted: prediction ? prediction.predictedValue : null,
        lotMean: lotStats.mean,
        normalHigh: lotStats.mean + 2 * lotStats.std,
        normalLow: Math.max(0, lotStats.mean - 2 * lotStats.std),
        isPrediction: true,
      },
    ];
  }, [paramData, lotStats, prediction]);

  // Population histogram data
  const histogramData = useMemo(() => {
    if (!lotStats || !component) return [];
    const values = lotStats.values;
    const min = lotStats.min;
    const max = lotStats.max;
    const binCount = 15;
    const binWidth = (max - min) / binCount;

    const bins = Array.from({ length: binCount }, (_, i) => ({
      range: `${(min + i * binWidth).toFixed(1)}`,
      rangeStart: min + i * binWidth,
      rangeEnd: min + (i + 1) * binWidth,
      count: 0,
      isComponent: false,
    }));

    const componentValue = paramData?.measurements.find((m) => m.timeHours === 96)?.value || 0;

    for (const v of values) {
      const idx = Math.min(binCount - 1, Math.floor((v - min) / binWidth));
      if (idx >= 0 && idx < binCount) {
        bins[idx].count++;
      }
    }

    const compBinIdx = Math.min(binCount - 1, Math.floor((componentValue - min) / binWidth));
    if (compBinIdx >= 0 && compBinIdx < binCount) {
      bins[compBinIdx].isComponent = true;
    }

    return bins;
  }, [lotStats, component, paramData]);

  // Component audit entries
  const componentAudit = useMemo(() => {
    if (!component) return [];
    return state.auditTrail
      .filter((e) => e.componentId === component.componentId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 15);
  }, [state.auditTrail, component]);

  // Trend icon
  const trendIcon = (dir: string) => {
    switch (dir) {
      case 'accelerating': return <Zap className="w-3.5 h-3.5 text-red-500" />;
      case 'increasing': return <TrendingUp className="w-3.5 h-3.5 text-orange-500" />;
      case 'decreasing': return <TrendingDown className="w-3.5 h-3.5 text-blue-500" />;
      default: return <Minus className="w-3.5 h-3.5 text-green-500" />;
    }
  };

  if (!component) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-gray-300" />
        </div>
        <h2 className="text-lg font-semibold text-gray-700">Component Not Found</h2>
        <p className="text-sm text-gray-500 mt-1">Component "{id}" does not exist in this lot.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/explorer')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Explorer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back Button */}
      <Button variant="ghost" size="sm" className="text-xs text-gray-500" onClick={() => navigate('/explorer')}>
        <ArrowLeft className="w-3.5 h-3.5 mr-1" />
        Back to Explorer
      </Button>

      {/* Component Header */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 font-mono tracking-tight">{component.componentId}</h1>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                  <span>Lot: <span className="font-mono font-semibold text-gray-700">{component.lotId}</span></span>
                  <span className="text-gray-300">|</span>
                  <span>{component.testCondition}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
              <Clock className="w-3 h-3" />
              <span>Test: {formatDate(component.testStart)} → {formatDate(component.testEnd)}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center px-4 py-2 rounded-lg bg-gray-50 border border-gray-100">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Overall Risk</p>
              <RiskBadge level={component.risk.level} size="lg" showIcon />
            </div>
            <div className="text-center px-4 py-2 rounded-lg bg-gray-50 border border-gray-100">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold mb-1">AI Recommendation</p>
              <StatusBadge status={component.aiRecommendation} size="md" />
            </div>
            {component.scientistDecision && (
              <div className="text-center px-4 py-2 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-[9px] text-blue-600 uppercase tracking-wider font-semibold mb-1">Scientist Decision</p>
                <StatusBadge status={component.finalStatus} size="md" />
              </div>
            )}
          </div>
        </div>

        {/* Override notice */}
        {component.aiOverridden && (
          <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs text-purple-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong>AI Override:</strong> AI recommended {component.aiRecommendation}, Scientist decided {component.scientistDecision}
              {component.scientistComment && ` — "${component.scientistComment}"`}
            </span>
          </div>
        )}
      </div>

      {/* Parameter Selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-gray-600">Parameter:</span>
        <Select value={selectedParameter} onValueChange={(v) => { if (v) setSelectedParameter(v); }}>
          <SelectTrigger className="w-56 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PARAMETER_DEFINITIONS.map((p) => (
              <SelectItem key={p.name} value={p.name}>
                {p.name} ({p.unit})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="analysis" className="w-full">
        <TabsList className="bg-gray-100/80 p-1 rounded-lg">
          <TabsTrigger value="analysis" className="text-xs font-semibold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
            Trajectory Analysis
          </TabsTrigger>
          <TabsTrigger value="metrics" className="text-xs font-semibold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Shield className="w-3.5 h-3.5 mr-1.5" />
            Risk Metrics
          </TabsTrigger>
          <TabsTrigger value="decision" className="text-xs font-semibold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Brain className="w-3.5 h-3.5 mr-1.5" />
            Decision & Explainability
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs font-semibold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Trajectory Analysis */}
        <TabsContent value="analysis" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Time-Series Chart */}
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  {selectedParameter} vs Test Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      label={{ value: paramDef?.unit || '', angle: -90, position: 'insideLeft', fontSize: 10 }}
                    />
                    <RTooltip
                      content={({ payload, label }) => {
                        if (!payload?.length) return null;
                        const d = payload[0]?.payload;
                        if (!d) return null;
                        const isPred = d.isPrediction || (d.predicted !== null && d.measured === null);
                        return (
                          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 shadow-lg text-xs space-y-0.5">
                            <p className="font-bold text-gray-900">Time: {label}{isPred ? ' (Predicted)' : ''}</p>
                            {d.measured !== null && !isNaN(d.measured) && (
                              <>
                                <p className="text-gray-600">Measured: <span className="font-mono font-semibold">{d.measured?.toFixed(2)} {paramDef?.unit}</span></p>
                                <p className="text-gray-500">Lot Mean: <span className="font-mono">{d.lotMean?.toFixed(2)} {paramDef?.unit}</span></p>
                                <p className="text-gray-500">Deviation: <span className="font-mono font-semibold">{(d.measured - d.lotMean) > 0 ? '+' : ''}{(d.measured - d.lotMean)?.toFixed(2)} {paramDef?.unit}</span></p>
                              </>
                            )}
                            {isPred && d.predicted !== null && (
                              <>
                                <p className="text-orange-600 font-semibold">Predicted: <span className="font-mono">{d.predicted?.toFixed(2)} {paramDef?.unit}</span></p>
                                <p className="text-gray-500">Confidence: <span className="font-mono">{prediction ? `${(prediction.confidence * 100).toFixed(0)}%` : '—'}</span></p>
                              </>
                            )}
                          </div>
                        );
                      }}
                    />

                    <Area dataKey="normalHigh" stroke="none" fill="#dcfce7" fillOpacity={0.4} />
                    <Area dataKey="normalLow" stroke="none" fill="#ffffff" fillOpacity={1} />

                    <Line dataKey="lotMean" stroke="#22c55e" strokeDasharray="4 4" dot={false} strokeWidth={1} name="Lot Average" />
                    <Line dataKey="measured" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: '#fff' }} name="Measured" connectNulls={false} />
                    <Line dataKey="predicted" stroke="#f97316" strokeDasharray="5 5" strokeWidth={2} dot={{ fill: '#f97316', r: 5, stroke: '#ea580c', strokeWidth: 2 }} name="Predicted" />

                    {paramDef && (
                      <ReferenceLine
                        y={paramDef.safetyLimit}
                        stroke="#ef4444"
                        strokeDasharray="6 3"
                        strokeWidth={1.5}
                        label={{ value: `Safety Limit (${paramDef.safetyLimit} ${paramDef.unit})`, position: 'right', fontSize: 9, fill: '#ef4444' }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>

                {/* Prediction annotation */}
                {prediction && (
                  <div className="mt-3 flex items-center gap-4 text-xs bg-orange-50/80 border border-orange-200/60 rounded-lg px-4 py-2.5">
                    <div>
                      <span className="text-orange-600 font-semibold">Predicted 168h:</span>{' '}
                      <span className="font-mono font-bold text-gray-900">{prediction.predictedValue.toFixed(1)} {paramDef?.unit}</span>
                    </div>
                    <div className="w-px h-4 bg-orange-200" />
                    <div>
                      <span className="text-gray-500">Confidence:</span>{' '}
                      <span className="font-mono font-semibold">{(prediction.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-px h-4 bg-orange-200" />
                    <div>
                      <span className="text-gray-500">Safety Margin:</span>{' '}
                      <span className={`font-mono font-bold ${prediction.safetyMarginPct < 10 ? 'text-red-600' : prediction.safetyMarginPct < 20 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {prediction.safetyMargin.toFixed(1)} {paramDef?.unit} ({prediction.safetyMarginPct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Prediction & Drift Panel */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-orange-500" />
                    Trajectory Prediction
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Predicted 168h</span>
                    <span className="text-xl font-bold font-mono">
                      {prediction?.predictedValue.toFixed(1)} <span className="text-sm text-gray-400">{paramDef?.unit}</span>
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-gray-500">Safety Limit</span>
                      <span className="font-mono">{paramDef?.safetyLimit} {paramDef?.unit}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-gray-500">Safety Margin</span>
                      <span className={`font-mono font-bold ${
                        prediction && prediction.safetyMarginPct < 10 ? 'text-red-600' :
                        prediction && prediction.safetyMarginPct < 20 ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {prediction?.safetyMargin.toFixed(1)} {paramDef?.unit} ({prediction?.safetyMarginPct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-gray-500">Drift Rate</span>
                      <span className="font-mono">{prediction?.driftRate.toFixed(4)} /h</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-gray-500">Drift Score</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono">{prediction?.driftScore.toFixed(3)}</span>
                        {prediction && <RiskBadge level={prediction.driftLevel} size="sm" />}
                      </div>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-gray-500">Trend</span>
                      <div className="flex items-center gap-1">
                        {prediction && trendIcon(prediction.trendDirection)}
                        <span className="capitalize">{prediction?.trendDirection}</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Confidence</span>
                      <span className="font-mono font-semibold">{prediction && (prediction.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Decision */}
              <Card className="border-2 border-primary/20">
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-gray-500 mb-1">AI Recommendation</p>
                      <StatusBadge status={component.aiRecommendation} size="md" />
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Scientist Decision</p>
                      {component.scientistDecision ? (
                        <StatusBadge status={component.finalStatus} size="md" />
                      ) : (
                        <Badge variant="outline" className="text-gray-500">Pending</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => setDecisionDialogOpen(true)}
                    disabled={state.isFinalized}
                  >
                    {state.isFinalized ? 'Decisions Locked' : 'Set Decision'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Population Comparison */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-500" />
                Population Comparison (96h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={histogramData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="range" tick={{ fontSize: 8 }} interval={2} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RTooltip
                    content={({ payload }) => {
                      if (!payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-xs">
                          <p>Range: {d.rangeStart?.toFixed(1)}–{d.rangeEnd?.toFixed(1)} {paramDef?.unit}</p>
                          <p className="font-bold">{d.count} components</p>
                          {d.isComponent && <p className="text-red-600 font-bold">← {component.componentId} is here</p>}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {histogramData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.isComponent ? '#ef4444' : '#93c5fd'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3 text-xs">
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-gray-500 text-[10px]">Lot Mean</p>
                  <p className="font-mono font-bold">{lotStats.mean.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-gray-500 text-[10px]">Median</p>
                  <p className="font-mono font-bold">{lotStats.median.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-gray-500 text-[10px]">Std Dev</p>
                  <p className="font-mono font-bold">{lotStats.std.toFixed(2)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2.5 text-center border border-blue-100">
                  <p className="text-blue-600 text-[10px] font-semibold">Component</p>
                  <p className="font-mono font-bold text-blue-700">
                    {paramData?.measurements.find((m) => m.timeHours === 96)?.value.toFixed(2) || '—'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-gray-500 text-[10px]">Percentile</p>
                  <p className="font-mono font-bold">{anomaly?.percentile.toFixed(1)}%</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-gray-500 text-[10px]">Z-Score</p>
                  <p className="font-mono font-bold">{anomaly?.zScore.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Risk Metrics */}
        <TabsContent value="metrics" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Module A: Anomaly Detection */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-500" />
                  Population Anomaly Detection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Anomaly Score</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold font-mono">{anomaly?.anomalyScore.toFixed(2)}</span>
                    {anomaly && <RiskBadge level={anomaly.level} size="sm" />}
                  </div>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between border-b border-gray-100 pb-1">
                    <span className="text-gray-500">Z-Score</span>
                    <span className="font-mono font-semibold">{anomaly?.zScore.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-1">
                    <span className="text-gray-500">Robust Z-Score</span>
                    <span className="font-mono">{anomaly?.robustZScore.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-1">
                    <span className="text-gray-500">Percentile</span>
                    <span className="font-mono font-semibold">{anomaly?.percentile.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Deviation from Baseline</span>
                    <span className="font-mono">
                      {anomaly && anomaly.deviationFromBaseline > 0 ? '+' : ''}
                      {anomaly?.deviationFromBaseline.toFixed(3)} {paramDef?.unit}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Module B: Drift & Prediction */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  Trajectory Prediction
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Predicted 168h</span>
                  <span className="text-2xl font-bold font-mono">
                    {prediction?.predictedValue.toFixed(1)} <span className="text-sm text-gray-400">{paramDef?.unit}</span>
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between border-b border-gray-100 pb-1">
                    <span className="text-gray-500">Safety Limit</span>
                    <span className="font-mono">{paramDef?.safetyLimit} {paramDef?.unit}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-1">
                    <span className="text-gray-500">Safety Margin</span>
                    <span className={`font-mono font-bold ${
                      prediction && prediction.safetyMarginPct < 10 ? 'text-red-600' :
                      prediction && prediction.safetyMarginPct < 20 ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {prediction?.safetyMargin.toFixed(1)} {paramDef?.unit} ({prediction?.safetyMarginPct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-1">
                    <span className="text-gray-500">Drift Score</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono">{prediction?.driftScore.toFixed(3)}</span>
                      {prediction && <RiskBadge level={prediction.driftLevel} size="sm" />}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Trend</span>
                    <div className="flex items-center gap-1">
                      {prediction && trendIcon(prediction.trendDirection)}
                      <span className="capitalize font-semibold">{prediction?.trendDirection}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Risk Engine */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-500" />
                  Combined Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Overall Risk</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold font-mono">{component.risk.overallScore.toFixed(2)}</span>
                    <RiskBadge level={component.risk.level} size="md" showIcon />
                  </div>
                </div>

                {/* Contribution bar */}
                <div className="space-y-1.5">
                  <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                    <div
                      className="bg-blue-500 transition-all"
                      style={{ width: `${(component.risk.anomalyContribution / Math.max(component.risk.overallScore, 0.001)) * 100}%` }}
                    />
                    <div
                      className="bg-orange-500 transition-all"
                      style={{ width: `${(component.risk.driftContribution / Math.max(component.risk.overallScore, 0.001)) * 100}%` }}
                    />
                    <div
                      className="bg-red-500 transition-all"
                      style={{ width: `${(component.risk.predictionContribution / Math.max(component.risk.overallScore, 0.001)) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Anomaly 40%
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      Drift 35%
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      Prediction 25%
                    </span>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between border-b border-gray-100 pb-1">
                    <span className="text-gray-500">Anomaly × 40%</span>
                    <span className="font-mono font-semibold">{component.risk.anomalyContribution.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-1">
                    <span className="text-gray-500">Drift × 35%</span>
                    <span className="font-mono font-semibold">{component.risk.driftContribution.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Prediction × 25%</span>
                    <span className="font-mono font-semibold">{component.risk.predictionContribution.toFixed(3)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 3: Decision & Explainability */}
        <TabsContent value="decision" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Explainability */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  Why This Component Is Flagged
                </CardTitle>
              </CardHeader>
              <CardContent>
                {component.explanations.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-700">No Risk Factors Identified</p>
                    <p className="text-xs text-gray-500 mt-1">This component appears healthy with no anomalous behavior detected.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {component.explanations.map((exp, idx) => (
                      <div key={idx} className="flex gap-3 text-xs bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="font-bold text-amber-700 text-[10px]">{idx + 1}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{exp.title}</p>
                          <p className="text-gray-500 mt-0.5 leading-relaxed">{exp.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Decision Panel */}
            <Card className="border-2 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Engineering Decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <p className="text-gray-500 mb-1.5 font-semibold text-[10px] uppercase tracking-wider">AI Recommendation</p>
                    <StatusBadge status={component.aiRecommendation} size="md" />
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <p className="text-gray-500 mb-1.5 font-semibold text-[10px] uppercase tracking-wider">Scientist Decision</p>
                    {component.scientistDecision ? (
                      <StatusBadge status={component.finalStatus} size="md" />
                    ) : (
                      <Badge variant="outline" className="text-gray-500">Pending</Badge>
                    )}
                  </div>
                </div>

                {component.scientistComment && (
                  <div className="bg-blue-50 rounded-lg px-3 py-2.5 text-xs text-gray-700 border border-blue-100">
                    <p className="text-[10px] text-blue-500 uppercase tracking-wider mb-1 font-semibold">Comment</p>
                    {component.scientistComment}
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => setDecisionDialogOpen(true)}
                  disabled={state.isFinalized}
                >
                  {state.isFinalized ? 'Lot Finalized — Decisions Locked' : 'Set Decision'}
                </Button>

                <div className="bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2 text-[10px] text-amber-700 flex items-start gap-1.5">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>AI outputs support engineering review and do not independently determine final component disposition.</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 4: History */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                Component History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {componentAudit.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No audit entries for this component.</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {componentAudit.map((entry, idx) => (
                    <div key={entry.id} className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
                      <div className="flex flex-col items-center pt-0.5">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                          {entry.actor === 'AI' ? <Bot className="w-3.5 h-3.5 text-blue-500" /> :
                           entry.actor === 'SCIENTIST' ? <User className="w-3.5 h-3.5 text-emerald-500" /> :
                           <Cpu className="w-3.5 h-3.5 text-gray-400" />}
                        </div>
                        {idx < componentAudit.length - 1 && (
                          <div className="w-px h-full bg-gray-200 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] text-gray-400 font-mono">
                            {formatDate(entry.timestamp)}
                          </span>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">{entry.actor}</Badge>
                        </div>
                        <p className="text-xs font-semibold text-gray-800">{entry.action}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{entry.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Decision Dialog */}
      <DecisionDialog
        component={component}
        open={decisionDialogOpen}
        onOpenChange={setDecisionDialogOpen}
      />
    </div>
  );
}
