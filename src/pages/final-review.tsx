import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLot } from '@/data/lot-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { RiskBadge } from '@/components/shared/risk-badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { toast } from 'sonner';
import {
  ClipboardCheck, AlertTriangle, CheckCircle2, XCircle, Eye, Clock,
  Lock, Search, ArrowRight,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RTooltip } from 'recharts';

type FilterStatus = 'ALL' | 'PASS' | 'REJECT' | 'MONITOR' | 'PENDING';

export default function FinalReview() {
  const { state, lotSummary, finalizeLot } = useLot();
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [searchId, setSearchId] = useState('');
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const filtered = useMemo(() => {
    let result = [...state.components];

    if (searchId) {
      result = result.filter((c) =>
        c.componentId.toLowerCase().includes(searchId.toLowerCase())
      );
    }

    if (filterStatus !== 'ALL') {
      result = result.filter((c) => c.finalStatus === filterStatus);
    }

    return result;
  }, [state.components, filterStatus, searchId]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const statusColors = [
    { name: 'PASS', value: lotSummary.passCount, color: '#10b981' },
    { name: 'REJECT', value: lotSummary.rejectCount, color: '#ef4444' },
    { name: 'MONITOR', value: lotSummary.monitorCount, color: '#f59e0b' },
    { name: 'PENDING', value: lotSummary.pendingCount, color: '#9ca3af' },
  ].filter((d) => d.value > 0);

  const handleFinalize = () => {
    finalizeLot();
    setShowFinalizeDialog(false);
    toast.success('Lot finalized successfully. All decisions are now locked.');
  };

  const filterButtons: { key: FilterStatus; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'ALL', label: 'All', icon: null, count: state.components.length },
    { key: 'PASS', label: 'Pass', icon: <CheckCircle2 className="w-3 h-3" />, count: lotSummary.passCount },
    { key: 'REJECT', label: 'Reject', icon: <XCircle className="w-3 h-3" />, count: lotSummary.rejectCount },
    { key: 'MONITOR', label: 'Monitor', icon: <Eye className="w-3 h-3" />, count: lotSummary.monitorCount },
    { key: 'PENDING', label: 'Pending', icon: <Clock className="w-3 h-3" />, count: lotSummary.pendingCount },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
            Final Review
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review all component decisions before finalizing the lot
          </p>
        </div>
        {lotSummary.isFinalized ? (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 px-3 py-1.5">
            <Lock className="w-3.5 h-3.5 mr-1.5" />
            Lot Finalized
          </Badge>
        ) : (
          <Button
            onClick={() => setShowFinalizeDialog(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Lock className="w-4 h-4 mr-2" />
            Finalize Lot
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-2">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{lotSummary.totalComponents.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Total Components</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-700">{lotSummary.passCount}</p>
            <p className="text-xs text-emerald-600">Pass</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-700">{lotSummary.rejectCount}</p>
            <p className="text-xs text-red-600">Reject</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{lotSummary.monitorCount}</p>
            <p className="text-xs text-amber-600">Monitor</p>
          </CardContent>
        </Card>
        <Card className="border-gray-300 bg-gray-50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-700">{lotSummary.pendingCount}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Decision Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Decision Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusColors}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusColors.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <RTooltip
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border rounded px-3 py-2 shadow text-xs">
                        <p className="font-bold">{d.name}</p>
                        <p>{d.value} components</p>
                      </div>
                    );
                  }}
                />
                <Legend
                  formatter={(value) => <span className="text-xs">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Override Summary */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">AI Override Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(() => {
                const overridden = state.components.filter((c) => c.aiOverridden);
                if (overridden.length === 0) {
                  return (
                    <p className="text-sm text-gray-500 py-4 text-center">
                      No AI recommendations have been overridden yet.
                    </p>
                  );
                }
                return (
                  <>
                    <p className="text-xs text-gray-600">
                      {overridden.length} component(s) have scientist decisions that differ from AI recommendations.
                    </p>
                    <div className="overflow-auto max-h-[180px]">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gray-50">
                          <tr className="border-b">
                            <th className="text-left py-1.5 px-2 font-semibold">Component</th>
                            <th className="text-left py-1.5 px-2 font-semibold">AI</th>
                            <th className="text-left py-1.5 px-2 font-semibold"></th>
                            <th className="text-left py-1.5 px-2 font-semibold">Scientist</th>
                            <th className="text-left py-1.5 px-2 font-semibold">Comment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overridden.slice(0, 20).map((c) => (
                            <tr
                              key={c.componentId}
                              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                              onClick={() => navigate(`/component/${c.componentId}`)}
                            >
                              <td className="py-1 px-2 font-mono font-bold text-blue-600">{c.componentId}</td>
                              <td className="py-1 px-2"><StatusBadge status={c.aiRecommendation} size="sm" /></td>
                              <td className="py-1 px-1"><ArrowRight className="w-3 h-3 text-gray-400" /></td>
                              <td className="py-1 px-2"><StatusBadge status={c.finalStatus} size="sm" /></td>
                              <td className="py-1 px-2 text-gray-500 truncate max-w-[200px]">{c.scientistComment || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-sm font-semibold">All Components</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  placeholder="Search ID..."
                  value={searchId}
                  onChange={(e) => { setSearchId(e.target.value); setPage(0); }}
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <div className="flex gap-1">
                {filterButtons.map((fb) => (
                  <Button
                    key={fb.key}
                    variant={filterStatus === fb.key ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => { setFilterStatus(fb.key); setPage(0); }}
                  >
                    {fb.icon}
                    {fb.label}
                    <span className="ml-1 text-[10px] opacity-70">({fb.count})</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Component</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Risk</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">AI Rec.</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Final Decision</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Override</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Comment</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((c) => (
                  <tr
                    key={c.componentId}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/component/${c.componentId}`)}
                  >
                    <td className="py-1.5 px-3 font-mono font-bold text-blue-600">{c.componentId}</td>
                    <td className="py-1.5 px-3"><RiskBadge level={c.risk.level} size="sm" /></td>
                    <td className="py-1.5 px-3"><StatusBadge status={c.aiRecommendation} size="sm" /></td>
                    <td className="py-1.5 px-3"><StatusBadge status={c.finalStatus} size="sm" /></td>
                    <td className="py-1.5 px-3">
                      {c.aiOverridden ? (
                        <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                          Overridden
                        </Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-gray-500 truncate max-w-[200px]">
                      {c.scientistComment || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Finalize Dialog */}
      <Dialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Finalize Lot?
            </DialogTitle>
            <DialogDescription>
              This action will lock all decisions for lot {lotSummary.lotId}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800">
              <p className="font-semibold mb-1">After finalization:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>All decisions will be locked and cannot be changed</li>
                <li>Pending components will be auto-resolved based on AI recommendation</li>
                <li>Final dataset will be available for export</li>
                <li>Audit information will be preserved</li>
              </ul>
            </div>

            {lotSummary.pendingCount > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs text-gray-700">
                <p>
                  <span className="font-bold text-orange-600">{lotSummary.pendingCount}</span> component(s) still have
                  pending decisions. These will be auto-resolved based on AI recommendations.
                </p>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-emerald-50 p-2 rounded">
                <p className="font-bold text-emerald-700">{lotSummary.passCount}</p>
                <p className="text-emerald-600">Pass</p>
              </div>
              <div className="bg-red-50 p-2 rounded">
                <p className="font-bold text-red-700">{lotSummary.rejectCount}</p>
                <p className="text-red-600">Reject</p>
              </div>
              <div className="bg-amber-50 p-2 rounded">
                <p className="font-bold text-amber-700">{lotSummary.monitorCount}</p>
                <p className="text-amber-600">Monitor</p>
              </div>
              <div className="bg-gray-50 p-2 rounded border">
                <p className="font-bold text-gray-700">{lotSummary.pendingCount}</p>
                <p className="text-gray-600">Pending</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinalizeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleFinalize} className="bg-blue-600 hover:bg-blue-700">
              <Lock className="w-4 h-4 mr-2" />
              Finalize Lot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
