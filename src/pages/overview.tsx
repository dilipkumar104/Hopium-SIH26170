import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLot } from '@/data/lot-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RiskBadge } from '@/components/shared/risk-badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { KPICard } from '@/components/shared/kpi-card';
import { formatDate } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import {
  Cpu, ScanSearch, AlertTriangle, UserCheck, CheckCircle2, XCircle,
  Eye, Clock, Activity, Bot, User, ArrowRight, TrendingUp,
  Shield, Zap,
} from 'lucide-react';

export default function Overview() {
  const { state, lotSummary } = useLot();
  const navigate = useNavigate();

  // Risk distribution chart data
  const riskData = useMemo(() => [
    { name: 'Low', count: lotSummary.lowRisk, fill: '#10b981' },
    { name: 'Medium', count: lotSummary.mediumRisk, fill: '#f59e0b' },
    { name: 'High', count: lotSummary.highRisk, fill: '#f97316' },
    { name: 'Critical', count: lotSummary.criticalRisk, fill: '#ef4444' },
  ], [lotSummary]);

  // Status distribution chart data
  const statusData = useMemo(() => [
    { name: 'Pass', value: lotSummary.passCount, color: '#10b981' },
    { name: 'Reject', value: lotSummary.rejectCount, color: '#ef4444' },
    { name: 'Monitor', value: lotSummary.monitorCount, color: '#f59e0b' },
    { name: 'Pending', value: lotSummary.pendingCount, color: '#94a3b8' },
  ].filter(d => d.value > 0), [lotSummary]);

  // Top flagged components
  const topFlagged = useMemo(() =>
    [...state.components]
      .sort((a, b) => b.risk.overallScore - a.risk.overallScore)
      .slice(0, 8),
    [state.components]
  );

  // Recent audit entries
  const recentAudit = useMemo(() =>
    [...state.auditTrail]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 8),
    [state.auditTrail]
  );

  // Lot health score (percentage of low-risk components)
  const lotHealth = useMemo(() => {
    return Math.round((lotSummary.lowRisk / lotSummary.totalComponents) * 100);
  }, [lotSummary]);

  const actorIcon = (actor: string) => {
    switch (actor) {
      case 'SYSTEM': return <Cpu className="w-3 h-3 text-gray-400" />;
      case 'AI': return <Bot className="w-3 h-3 text-blue-500" />;
      case 'SCIENTIST': return <User className="w-3 h-3 text-emerald-500" />;
      default: return <Activity className="w-3 h-3 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                Command Center
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Lot <span className="font-mono font-semibold text-gray-700">{lotSummary.lotId}</span> — {lotSummary.totalComponents.toLocaleString()} components under analysis
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Testing: {lotSummary.testingStatus}
          </Badge>
          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 font-semibold">
            <ScanSearch className="w-3 h-3 mr-1" />
            Analysis: {lotSummary.analysisStatus}
          </Badge>
          {lotSummary.isFinalized && (
            <Badge className="bg-primary text-white text-[10px] font-semibold shadow-sm">
              Finalized
            </Badge>
          )}
        </div>
      </div>

      {/* Lot Health Banner */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Lot Health</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold font-mono kpi-value">{lotHealth}%</span>
                <span className="text-sm text-gray-400">healthy</span>
              </div>
            </div>
            <div className="w-px h-12 bg-gray-700" />
            <div className="grid grid-cols-4 gap-6">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Low Risk</p>
                <p className="text-lg font-bold font-mono text-emerald-400">{lotSummary.lowRisk}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Medium</p>
                <p className="text-lg font-bold font-mono text-amber-400">{lotSummary.mediumRisk}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">High</p>
                <p className="text-lg font-bold font-mono text-orange-400">{lotSummary.highRisk}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Critical</p>
                <p className="text-lg font-bold font-mono text-red-400">{lotSummary.criticalRisk}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Manual Review</p>
              <p className="text-2xl font-bold font-mono text-blue-400">{lotSummary.manualReview}</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
        <KPICard
          title="Pass"
          value={lotSummary.passCount}
          icon={CheckCircle2}
          variant="success"
          onClick={() => navigate('/explorer?decision=PASS')}
        />
        <KPICard
          title="Reject"
          value={lotSummary.rejectCount}
          icon={XCircle}
          variant="danger"
          onClick={() => navigate('/explorer?decision=REJECT')}
        />
        <KPICard
          title="Monitor"
          value={lotSummary.monitorCount}
          icon={Eye}
          variant="warning"
          onClick={() => navigate('/explorer?decision=MONITOR')}
        />
        <KPICard
          title="Pending"
          value={lotSummary.pendingCount}
          icon={Clock}
          onClick={() => navigate('/explorer?decision=PENDING')}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-orange-500" />
                Risk Distribution
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-mono">
                {lotSummary.totalComponents} total
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={riskData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <RTooltip
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-xs">
                        <p className="font-bold text-gray-900">{d.name} Risk</p>
                        <p className="text-gray-600">{d.count} components</p>
                        <p className="text-gray-400 text-[10px]">{((d.count / lotSummary.totalComponents) * 100).toFixed(1)}% of lot</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {riskData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Decision Status */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-500" />
                Decision Status
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <ResponsiveContainer width="60%" height={240}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <RTooltip
                    content={({ payload }) => {
                      if (!payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-xs">
                          <p className="font-bold text-gray-900">{d.name}</p>
                          <p className="text-gray-600">{d.value} components</p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-[40%] space-y-2.5">
                {statusData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs font-medium text-gray-700">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold font-mono text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Flagged Components */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Top Flagged Components
              </CardTitle>
              <button
                onClick={() => navigate('/risk-analysis')}
                className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-0.5"
              >
                View All <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2.5 px-2 font-semibold text-gray-500">ID</th>
                    <th className="text-left py-2.5 px-2 font-semibold text-gray-500">Risk</th>
                    <th className="text-right py-2.5 px-2 font-semibold text-gray-500">Score</th>
                    <th className="text-left py-2.5 px-2 font-semibold text-gray-500">AI Rec.</th>
                  </tr>
                </thead>
                <tbody>
                  {topFlagged.map((c) => (
                    <tr
                      key={c.componentId}
                      className="border-b border-gray-50 hover:bg-blue-50/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/component/${c.componentId}`)}
                    >
                      <td className="py-2 px-2 font-mono font-bold text-blue-600 text-[11px]">
                        {c.componentId}
                      </td>
                      <td className="py-2 px-2">
                        <RiskBadge level={c.risk.level} size="sm" />
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[11px] font-semibold">
                        {c.risk.overallScore.toFixed(3)}
                      </td>
                      <td className="py-2 px-2">
                        <StatusBadge status={c.aiRecommendation} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-500" />
                Recent Activity
              </CardTitle>
              <button
                onClick={() => navigate('/audit')}
                className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-0.5"
              >
                View All <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentAudit.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 rounded px-1 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center mt-0.5 flex-shrink-0">
                    {actorIcon(entry.actor)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400 font-mono">
                        {formatDate(entry.timestamp)}
                      </span>
                      {entry.componentId !== 'LOT' && (
                        <span className="text-[10px] font-mono text-blue-600 font-bold">
                          {entry.componentId}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-700 truncate mt-0.5">{entry.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
