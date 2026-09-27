import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLot } from '@/data/lot-context';
import type { RiskLevel, FinalStatus, AIRecommendation } from '@/data/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RiskBadge } from '@/components/shared/risk-badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { Search, SortDesc } from 'lucide-react';

type RiskFilter = 'ALL' | RiskLevel;
type DecisionFilter = 'ALL' | FinalStatus;
type AIRecFilter = 'ALL' | AIRecommendation;
type SortField = 'componentId' | 'riskScore' | 'anomalyScore' | 'driftScore' | 'predicted';

const RISK_FILTERS: { key: RiskFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'LOW', label: 'Low' },
  { key: 'MEDIUM', label: 'Medium' },
  { key: 'HIGH', label: 'High' },
  { key: 'CRITICAL', label: 'Critical' },
];

const DECISION_FILTERS: { key: DecisionFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PASS', label: 'Pass' },
  { key: 'REJECT', label: 'Reject' },
  { key: 'MONITOR', label: 'Monitor' },
  { key: 'PENDING', label: 'Pending' },
];

const AI_REC_FILTERS: { key: AIRecFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PASS', label: 'Pass' },
  { key: 'REVIEW', label: 'Review' },
  { key: 'FAIL', label: 'Fail' },
];

const PRIMARY_PARAM = 'Leakage Current';
const PAGE_SIZE = 50;

export default function ComponentExplorer() {
  const { state } = useLot();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialRisk = (searchParams.get('risk')?.toUpperCase() as RiskFilter) || 'ALL';
  const initialDecision = (searchParams.get('decision')?.toUpperCase() as DecisionFilter) || 'ALL';
  const initialAIRec = (searchParams.get('rec')?.toUpperCase() as AIRecFilter) || 'ALL';
  const initialSearch = searchParams.get('search') || '';

  const [searchId, setSearchId] = useState(initialSearch);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>(
    ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(initialRisk) ? initialRisk : 'ALL'
  );
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>(
    ['PASS', 'REJECT', 'MONITOR', 'PENDING'].includes(initialDecision) ? initialDecision : 'ALL'
  );
  const [aiRecFilter, setAiRecFilter] = useState<AIRecFilter>(
    ['PASS', 'REVIEW', 'FAIL'].includes(initialAIRec) ? initialAIRec : 'ALL'
  );
  const [sortField, setSortField] = useState<SortField>('riskScore');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let result = [...state.components];

    // Search
    if (searchId) {
      result = result.filter((c) =>
        c.componentId.toLowerCase().includes(searchId.toLowerCase())
      );
    }

    // Risk filter
    if (riskFilter !== 'ALL') {
      result = result.filter((c) => c.risk.level === riskFilter);
    }

    // Decision filter
    if (decisionFilter !== 'ALL') {
      result = result.filter((c) => c.finalStatus === decisionFilter);
    }

    // AI Rec filter
    if (aiRecFilter !== 'ALL') {
      result = result.filter((c) => c.aiRecommendation === aiRecFilter);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortField) {
        case 'componentId':
          return a.componentId.localeCompare(b.componentId);
        case 'riskScore':
          return b.risk.overallScore - a.risk.overallScore;
        case 'anomalyScore': {
          const aScore = a.anomalyMetrics[PRIMARY_PARAM]?.anomalyScore || 0;
          const bScore = b.anomalyMetrics[PRIMARY_PARAM]?.anomalyScore || 0;
          return bScore - aScore;
        }
        case 'driftScore': {
          const aDrift = a.predictionMetrics[PRIMARY_PARAM]?.driftScore || 0;
          const bDrift = b.predictionMetrics[PRIMARY_PARAM]?.driftScore || 0;
          return bDrift - aDrift;
        }
        case 'predicted': {
          const aPred = a.predictionMetrics[PRIMARY_PARAM]?.predictedValue || 0;
          const bPred = b.predictionMetrics[PRIMARY_PARAM]?.predictedValue || 0;
          return bPred - aPred;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [state.components, searchId, riskFilter, decisionFilter, sortField]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Search className="w-5 h-5 text-gray-600" />
          Component Explorer
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Search, filter, and inspect individual components
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Search Component ID..."
                value={searchId}
                onChange={(e) => { setSearchId(e.target.value); setPage(0); }}
                className="pl-8 h-8 text-xs"
              />
            </div>

            {/* Risk Filter */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 mr-1">Risk:</span>
              {RISK_FILTERS.map((f) => (
                <Button
                  key={f.key}
                  variant={riskFilter === f.key ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => { setRiskFilter(f.key); setPage(0); }}
                >
                  {f.label}
                </Button>
              ))}
            </div>

            {/* Decision Filter */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 mr-1">Decision:</span>
              {DECISION_FILTERS.map((f) => (
                <Button
                  key={f.key}
                  variant={decisionFilter === f.key ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => { setDecisionFilter(f.key); setPage(0); }}
                >
                  {f.label}
                </Button>
              ))}
            </div>

            {/* AI Recommendation Filter */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 mr-1">AI Rec:</span>
              {AI_REC_FILTERS.map((f) => (
                <Button
                  key={f.key}
                  variant={aiRecFilter === f.key ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => { setAiRecFilter(f.key); setPage(0); }}
                >
                  {f.label}
                </Button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1">
              <SortDesc className="w-3.5 h-3.5 text-gray-400" />
              <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                <SelectTrigger className="h-7 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="riskScore">Risk Score</SelectItem>
                  <SelectItem value="anomalyScore">Anomaly Score</SelectItem>
                  <SelectItem value="driftScore">Drift Score</SelectItem>
                  <SelectItem value="predicted">Predicted Value</SelectItem>
                  <SelectItem value="componentId">Component ID</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              Showing {filtered.length} of {state.components.length} components
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {paged.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No components match the current filters.</p>
            </div>
          ) : (
            <>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Component</th>
                      <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Risk Level</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-gray-600">Anomaly Score</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-gray-600">Predicted 168h</th>
                      <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Drift</th>
                      <th className="text-left py-2.5 px-3 font-semibold text-gray-600">AI Rec.</th>
                      <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((c) => {
                      const anomaly = c.anomalyMetrics[PRIMARY_PARAM];
                      const prediction = c.predictionMetrics[PRIMARY_PARAM];
                      const pd = c.parameterData.find((p) => p.parameter === PRIMARY_PARAM);

                      return (
                        <tr
                          key={c.componentId}
                          className="border-b border-gray-100 hover:bg-blue-50/50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/component/${c.componentId}`)}
                        >
                          <td className="py-2 px-3 font-mono font-bold text-blue-600">
                            {c.componentId}
                          </td>
                          <td className="py-2 px-3">
                            <RiskBadge level={c.risk.level} size="sm" />
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {anomaly ? anomaly.anomalyScore.toFixed(2) : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {prediction ? `${prediction.predictedValue.toFixed(1)} ${pd?.unit || ''}` : '—'}
                          </td>
                          <td className="py-2 px-3">
                            {prediction && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  prediction.driftLevel === 'CRITICAL' || prediction.driftLevel === 'HIGH'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : prediction.driftLevel === 'MEDIUM'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-gray-50 text-gray-600 border-gray-200'
                                }`}
                              >
                                {prediction.driftLevel}
                              </Badge>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <StatusBadge status={c.aiRecommendation} size="sm" />
                          </td>
                          <td className="py-2 px-3">
                            <StatusBadge status={c.finalStatus} size="sm" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pageCount > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
