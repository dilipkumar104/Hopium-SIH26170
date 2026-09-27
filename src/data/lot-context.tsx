import React, { createContext, useContext, useReducer, useMemo, useCallback, type ReactNode } from 'react';
import {
  type Component,
  type LotSummary,
  type AuditEntry,
  type ScientistDecision,
  type FinalStatus,
  type LotParameterStats,
} from './types';
import { generateDataset, computeLotStats, PARAMETER_DEFINITIONS } from './generate-dataset';
import { generateId } from '@/lib/utils';

// ─── State ──────────────────────────────────────────────────────────

interface LotState {
  components: Component[];
  auditTrail: AuditEntry[];
  isFinalized: boolean;
  finalizedAt?: Date;
  lotId: string;
}

// ─── Actions ────────────────────────────────────────────────────────

type LotAction =
  | { type: 'SET_DECISION'; componentId: string; decision: ScientistDecision; comment?: string }
  | { type: 'ADD_COMMENT'; componentId: string; comment: string }
  | { type: 'FINALIZE_LOT' }
  | { type: 'ADD_AUDIT'; entry: Omit<AuditEntry, 'id' | 'timestamp'> };

// ─── Reducer ────────────────────────────────────────────────────────

function lotReducer(state: LotState, action: LotAction): LotState {
  switch (action.type) {
    case 'SET_DECISION': {
      const now = new Date();
      const components = state.components.map((c) => {
        if (c.componentId !== action.componentId) return c;

        const aiOverridden =
          (c.aiRecommendation === 'PASS' && action.decision !== 'PASS') ||
          (c.aiRecommendation === 'REVIEW' && action.decision === 'PASS') ||
          (c.aiRecommendation === 'FAIL' && action.decision !== 'REJECT');

        const finalStatus: FinalStatus = action.decision === 'REJECT' ? 'REJECT' : action.decision;

        return {
          ...c,
          scientistDecision: action.decision,
          scientistComment: action.comment || c.scientistComment,
          aiOverridden,
          finalStatus,
        };
      });

      const auditEntry: AuditEntry = {
        id: generateId(),
        timestamp: now,
        componentId: action.componentId,
        action: 'Decision Changed',
        detail: `Scientist set decision to ${action.decision}${action.comment ? ` — "${action.comment}"` : ''}`,
        actor: 'SCIENTIST',
      };

      return {
        ...state,
        components,
        auditTrail: [...state.auditTrail, auditEntry],
      };
    }

    case 'ADD_COMMENT': {
      const now = new Date();
      const components = state.components.map((c) => {
        if (c.componentId !== action.componentId) return c;
        return { ...c, scientistComment: action.comment };
      });

      const auditEntry: AuditEntry = {
        id: generateId(),
        timestamp: now,
        componentId: action.componentId,
        action: 'Comment Added',
        detail: `Scientist comment: "${action.comment}"`,
        actor: 'SCIENTIST',
      };

      return {
        ...state,
        components,
        auditTrail: [...state.auditTrail, auditEntry],
      };
    }

    case 'FINALIZE_LOT': {
      const now = new Date();

      // Set all remaining PENDING to their AI recommendation
      const components = state.components.map((c) => {
        if (c.finalStatus !== 'PENDING') return c;
        const auto: FinalStatus = c.aiRecommendation === 'PASS' ? 'PASS' :
                                  c.aiRecommendation === 'FAIL' ? 'REJECT' : 'MONITOR';
        return {
          ...c,
          finalStatus: auto,
          scientistDecision: auto === 'REJECT' ? 'REJECT' as ScientistDecision :
                            auto === 'MONITOR' ? 'MONITOR' as ScientistDecision :
                            'PASS' as ScientistDecision,
        };
      });

      const auditEntry: AuditEntry = {
        id: generateId(),
        timestamp: now,
        componentId: 'LOT',
        action: 'Lot Finalized',
        detail: `Lot finalized. All decisions locked.`,
        actor: 'SCIENTIST',
      };

      return {
        ...state,
        components,
        isFinalized: true,
        finalizedAt: now,
        auditTrail: [...state.auditTrail, auditEntry],
      };
    }

    case 'ADD_AUDIT': {
      const entry: AuditEntry = {
        ...action.entry,
        id: generateId(),
        timestamp: new Date(),
      };
      return {
        ...state,
        auditTrail: [...state.auditTrail, entry],
      };
    }

    default:
      return state;
  }
}

// ─── Context Type ───────────────────────────────────────────────────

interface LotContextType {
  state: LotState;
  lotSummary: LotSummary;
  getComponent: (id: string) => Component | undefined;
  getLotStats: (parameterName: string) => LotParameterStats;
  setDecision: (componentId: string, decision: ScientistDecision, comment?: string) => void;
  addComment: (componentId: string, comment: string) => void;
  finalizeLot: () => void;
  addAudit: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void;
  exportCSV: () => void;
  exportJSON: () => void;
}

const LotContext = createContext<LotContextType | null>(null);

// ─── CSV Export ─────────────────────────────────────────────────────

function generateCSV(components: Component[], finalizedAt?: Date): string {
  const primaryParam = PARAMETER_DEFINITIONS[0];

  const headers = [
    'component_id',
    'lot_id',
    'test_parameter',
    'value_0h',
    'value_24h',
    'value_96h',
    'value_168h',
    'predicted_168h',
    'lot_mean',
    'lot_std',
    'percentile',
    'anomaly_score',
    'anomaly_level',
    'z_score',
    'drift_rate',
    'drift_score',
    'safety_limit',
    'safety_margin',
    'prediction_confidence',
    'overall_risk_score',
    'risk_level',
    'ai_recommendation',
    'scientist_decision',
    'scientist_comment',
    'ai_overridden',
    'final_status',
    'finalised_at',
  ];

  const primaryStats = computeLotStats(components, primaryParam.name);

  const rows = components.map((c) => {
    const pd = c.parameterData.find((p) => p.parameter === primaryParam.name);
    const anomaly = c.anomalyMetrics[primaryParam.name];
    const prediction = c.predictionMetrics[primaryParam.name];

    const getValue = (timeH: number) => pd?.measurements.find((m) => m.timeHours === timeH)?.value?.toFixed(3) || '';

    return [
      c.componentId,
      c.lotId,
      primaryParam.name,
      getValue(0),
      getValue(24),
      getValue(96),
      getValue(168),
      prediction?.predictedValue?.toFixed(3) || '',
      primaryStats.mean.toFixed(3),
      primaryStats.std.toFixed(3),
      anomaly?.percentile?.toFixed(1) || '',
      anomaly?.anomalyScore?.toFixed(4) || '',
      anomaly?.level || '',
      anomaly?.zScore?.toFixed(3) || '',
      prediction?.driftRate?.toFixed(6) || '',
      prediction?.driftScore?.toFixed(4) || '',
      pd?.safetyLimit?.toString() || '',
      prediction?.safetyMargin?.toFixed(3) || '',
      prediction?.confidence?.toFixed(3) || '',
      c.risk.overallScore.toFixed(4),
      c.risk.level,
      c.aiRecommendation,
      c.scientistDecision || '',
      `"${(c.scientistComment || '').replace(/"/g, '""')}"`,
      c.aiOverridden ? 'TRUE' : 'FALSE',
      c.finalStatus,
      finalizedAt ? finalizedAt.toISOString() : '',
    ];
  });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Provider ───────────────────────────────────────────────────────

export function LotProvider({ children }: { children: ReactNode }) {
  // Generate dataset once
  const initialComponents = useMemo(() => generateDataset(), []);

  // Build initial audit trail
  const initialAudit = useMemo<AuditEntry[]>(() => {
    const now = new Date();
    const entries: AuditEntry[] = [
      {
        id: generateId(),
        timestamp: new Date(now.getTime() - 3600000),
        componentId: 'LOT',
        action: 'Test Data Imported',
        detail: `Imported ${initialComponents.length} component test records for lot IGBT-2026-017`,
        actor: 'SYSTEM',
      },
      {
        id: generateId(),
        timestamp: new Date(now.getTime() - 3500000),
        componentId: 'LOT',
        action: 'AI Analysis Started',
        detail: 'Population anomaly detection, drift analysis, and prediction initiated',
        actor: 'AI',
      },
      {
        id: generateId(),
        timestamp: new Date(now.getTime() - 3400000),
        componentId: 'LOT',
        action: 'AI Analysis Complete',
        detail: `Analysis complete. ${initialComponents.filter((c) => c.risk.level === 'HIGH' || c.risk.level === 'CRITICAL').length} high/critical risk components identified.`,
        actor: 'AI',
      },
    ];

    // Add AI flagging for high-risk components
    const highRisk = initialComponents
      .filter((c) => c.risk.level === 'HIGH' || c.risk.level === 'CRITICAL')
      .slice(0, 15);

    highRisk.forEach((c, i) => {
      entries.push({
        id: generateId(),
        timestamp: new Date(now.getTime() - 3300000 + i * 10000),
        componentId: c.componentId,
        action: 'AI Flagged',
        detail: `Marked as ${c.risk.level} risk (score: ${c.risk.overallScore.toFixed(2)}). Recommendation: ${c.aiRecommendation}`,
        actor: 'AI',
      });
    });

    return entries;
  }, [initialComponents]);

  const [state, dispatch] = useReducer(lotReducer, {
    components: initialComponents,
    auditTrail: initialAudit,
    isFinalized: false,
    lotId: 'IGBT-2026-017',
  });

  const lotSummary = useMemo<LotSummary>(() => {
    const cs = state.components;
    return {
      lotId: state.lotId,
      totalComponents: cs.length,
      analyzed: cs.length,
      lowRisk: cs.filter((c) => c.risk.level === 'LOW').length,
      mediumRisk: cs.filter((c) => c.risk.level === 'MEDIUM').length,
      highRisk: cs.filter((c) => c.risk.level === 'HIGH').length,
      criticalRisk: cs.filter((c) => c.risk.level === 'CRITICAL').length,
      manualReview: cs.filter((c) => c.aiRecommendation === 'REVIEW').length,
      passCount: cs.filter((c) => c.finalStatus === 'PASS').length,
      rejectCount: cs.filter((c) => c.finalStatus === 'REJECT').length,
      monitorCount: cs.filter((c) => c.finalStatus === 'MONITOR').length,
      pendingCount: cs.filter((c) => c.finalStatus === 'PENDING').length,
      testingStatus: 'Complete',
      analysisStatus: 'Complete',
      isFinalized: state.isFinalized,
      finalizedAt: state.finalizedAt,
    };
  }, [state.components, state.isFinalized, state.finalizedAt, state.lotId]);

  // Lot stats cache
  const lotStatsCache = useMemo(() => {
    const cache = new Map<string, LotParameterStats>();
    for (const param of PARAMETER_DEFINITIONS) {
      cache.set(param.name, computeLotStats(state.components, param.name));
    }
    return cache;
  }, [state.components]);

  const getComponent = useCallback(
    (id: string) => state.components.find((c) => c.componentId === id),
    [state.components]
  );

  const getLotStats = useCallback(
    (parameterName: string) => lotStatsCache.get(parameterName)!,
    [lotStatsCache]
  );

  const setDecision = useCallback(
    (componentId: string, decision: ScientistDecision, comment?: string) => {
      if (state.isFinalized) return;
      dispatch({ type: 'SET_DECISION', componentId, decision, comment });
    },
    [state.isFinalized]
  );

  const addComment = useCallback(
    (componentId: string, comment: string) => {
      if (state.isFinalized) return;
      dispatch({ type: 'ADD_COMMENT', componentId, comment });
    },
    [state.isFinalized]
  );

  const finalizeLot = useCallback(() => {
    dispatch({ type: 'FINALIZE_LOT' });
  }, []);

  const addAudit = useCallback(
    (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => {
      dispatch({ type: 'ADD_AUDIT', entry });
    },
    []
  );

  const exportCSV = useCallback(() => {
    const csv = generateCSV(state.components, state.finalizedAt);
    downloadFile(csv, `${state.lotId}_final_report.csv`, 'text/csv');
  }, [state.components, state.finalizedAt, state.lotId]);

  const exportJSON = useCallback(() => {
    const data = state.components.map((c) => ({
      componentId: c.componentId,
      lotId: c.lotId,
      riskScore: c.risk.overallScore,
      riskLevel: c.risk.level,
      aiRecommendation: c.aiRecommendation,
      scientistDecision: c.scientistDecision,
      scientistComment: c.scientistComment,
      aiOverridden: c.aiOverridden,
      finalStatus: c.finalStatus,
    }));
    downloadFile(JSON.stringify(data, null, 2), `${state.lotId}_final_report.json`, 'application/json');
  }, [state.components, state.lotId]);

  const value = useMemo<LotContextType>(
    () => ({
      state,
      lotSummary,
      getComponent,
      getLotStats,
      setDecision,
      addComment,
      finalizeLot,
      addAudit,
      exportCSV,
      exportJSON,
    }),
    [state, lotSummary, getComponent, getLotStats, setDecision, addComment, finalizeLot, addAudit, exportCSV, exportJSON]
  );

  return <LotContext.Provider value={value}>{children}</LotContext.Provider>;
}

export function useLot(): LotContextType {
  const ctx = useContext(LotContext);
  if (!ctx) throw new Error('useLot must be used within LotProvider');
  return ctx;
}
