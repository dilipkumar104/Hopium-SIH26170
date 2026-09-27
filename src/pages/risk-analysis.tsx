import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLot } from '@/data/lot-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RiskBadge } from '@/components/shared/risk-badge';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend,
} from 'recharts';
import { AlertTriangle, TrendingUp, Search } from 'lucide-react';

export default function RiskAnalysis() {
  const { state } = useLot();
  const navigate = useNavigate();
  const [searchId, setSearchId] = useState('');

  const primaryParam = 'Leakage Current';

  // Scatter data: anomaly vs risk
  const scatterData = useMemo(() => {
    return state.components.map((c) => ({
      id: c.componentId,
      anomalyScore: c.anomalyMetrics[primaryParam]?.anomalyScore || 0,
      driftScore: c.predictionMetrics[primaryParam]?.driftScore || 0,
      riskScore: c.risk.overallScore,
      level: c.risk.level,
    }));
  }, [state.components]);

  // Risk ranking (top 50 highest risk)
  const ranking = useMemo(() => {
    let filtered = [...state.components].sort((a, b) => b.risk.overallScore - a.risk.overallScore);
    if (searchId) {
      filtered = filtered.filter((c) =>
        c.componentId.toLowerCase().includes(searchId.toLowerCase())
      );
    }
    return filtered.slice(0, 50);
  }, [state.components, searchId]);

  // Risk distribution histogram
  const histogramData = useMemo(() => {
    const bins = Array.from({ length: 20 }, (_, i) => ({
      range: `${(i * 5).toString()}–${((i + 1) * 5).toString()}%`,
      rangeStart: i * 0.05,
      rangeEnd: (i + 1) * 0.05,
      count: 0,
    }));
    for (const c of state.components) {
      const idx = Math.min(19, Math.floor(c.risk.overallScore * 20));
      bins[idx].count++;
    }
    return bins;
  }, [state.components]);

  const getScatterColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return '#ef4444';
      case 'HIGH': return '#f97316';
      case 'MEDIUM': return '#f59e0b';
      default: return '#10b981';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Risk Analysis
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Population-level risk visualization and component ranking
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          Parameter: {primaryParam}
        </Badge>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Anomaly vs Risk Scatter */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Anomaly Score vs Overall Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="anomalyScore"
                  type="number"
                  domain={[0, 1]}
                  name="Anomaly Score"
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Anomaly Score', position: 'bottom', fontSize: 11 }}
                />
                <YAxis
                  dataKey="riskScore"
                  type="number"
                  domain={[0, 1]}
                  name="Risk Score"
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Risk Score', angle: -90, position: 'insideLeft', fontSize: 11 }}
                />
                <RTooltip
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border border-gray-200 rounded px-3 py-2 shadow text-xs">
                        <p className="font-bold">{d.id}</p>
                        <p>Anomaly: {d.anomalyScore.toFixed(3)}</p>
                        <p>Risk: {d.riskScore.toFixed(3)}</p>
                        <p>Level: {d.level}</p>
                      </div>
                    );
                  }}
                />
                <Scatter data={scatterData} cursor="pointer" onClick={(d: any) => navigate(`/component/${d?.id || d?.payload?.id}`)}>
                  {scatterData.map((entry, idx) => (
                    <Cell key={idx} fill={getScatterColor(entry.level)} fillOpacity={0.6} r={3} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Drift vs Risk Scatter */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Drift Score vs Overall Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="driftScore"
                  type="number"
                  domain={[0, 1]}
                  name="Drift Score"
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Drift Score', position: 'bottom', fontSize: 11 }}
                />
                <YAxis
                  dataKey="riskScore"
                  type="number"
                  domain={[0, 1]}
                  name="Risk Score"
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Risk Score', angle: -90, position: 'insideLeft', fontSize: 11 }}
                />
                <RTooltip
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border border-gray-200 rounded px-3 py-2 shadow text-xs">
                        <p className="font-bold">{d.id}</p>
                        <p>Drift: {d.driftScore.toFixed(3)}</p>
                        <p>Risk: {d.riskScore.toFixed(3)}</p>
                        <p>Level: {d.level}</p>
                      </div>
                    );
                  }}
                />
                <Scatter data={scatterData} cursor="pointer" onClick={(d: any) => navigate(`/component/${d?.id || d?.payload?.id}`)}>
                  {scatterData.map((entry, idx) => (
                    <Cell key={idx} fill={getScatterColor(entry.level)} fillOpacity={0.6} r={3} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Risk Distribution Histogram */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Risk Score Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={histogramData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="range" tick={{ fontSize: 8 }} interval={1} />
              <YAxis tick={{ fontSize: 10 }} />
              <RTooltip
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border border-gray-200 rounded px-3 py-2 shadow text-xs">
                      <p>Range: {d.range}</p>
                      <p className="font-bold">{d.count} components</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count">
                {histogramData.map((entry, idx) => {
                  const midpoint = (entry.rangeStart + entry.rangeEnd) / 2;
                  let color = '#10b981';
                  if (midpoint >= 0.86) color = '#ef4444';
                  else if (midpoint >= 0.61) color = '#f97316';
                  else if (midpoint >= 0.31) color = '#f59e0b';
                  return <Cell key={idx} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Component Ranking Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Component Risk Ranking (Top 50)</CardTitle>
          <div className="mt-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Filter by Component ID..."
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Rank</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Component</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Risk</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-600">Risk Score</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-600">Anomaly</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-600">Drift</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">AI Rec.</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Decision</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((c, idx) => (
                  <tr
                    key={c.componentId}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/component/${c.componentId}`)}
                  >
                    <td className="py-1.5 px-3 text-gray-400 font-mono">{idx + 1}</td>
                    <td className="py-1.5 px-3 font-mono font-bold text-blue-600">{c.componentId}</td>
                    <td className="py-1.5 px-3"><RiskBadge level={c.risk.level} size="sm" /></td>
                    <td className="py-1.5 px-3 text-right font-mono">{c.risk.overallScore.toFixed(3)}</td>
                    <td className="py-1.5 px-3 text-right font-mono">
                      {(c.anomalyMetrics[primaryParam]?.anomalyScore || 0).toFixed(3)}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono">
                      {(c.predictionMetrics[primaryParam]?.driftScore || 0).toFixed(3)}
                    </td>
                    <td className="py-1.5 px-3"><StatusBadge status={c.aiRecommendation} size="sm" /></td>
                    <td className="py-1.5 px-3"><StatusBadge status={c.finalStatus} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
