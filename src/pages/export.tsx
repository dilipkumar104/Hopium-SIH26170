import { useLot } from '@/data/lot-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Download, FileText, FileJson, CheckCircle2, Lock, Table2,
} from 'lucide-react';

export default function ExportPage() {
  const { lotSummary, exportCSV, exportJSON, state } = useLot();

  const handleCSV = () => {
    exportCSV();
    toast.success('CSV exported successfully', {
      description: `${lotSummary.lotId}_final_report.csv`,
    });
  };

  const handleJSON = () => {
    exportJSON();
    toast.success('JSON exported successfully', {
      description: `${lotSummary.lotId}_final_report.json`,
    });
  };

  const exportColumns = [
    'component_id', 'lot_id', 'test_parameter',
    'value_0h', 'value_24h', 'value_96h', 'value_168h',
    'predicted_168h', 'lot_mean', 'lot_std', 'percentile',
    'anomaly_score', 'anomaly_level', 'z_score',
    'drift_rate', 'drift_score',
    'safety_limit', 'safety_margin', 'prediction_confidence',
    'overall_risk_score', 'risk_level',
    'ai_recommendation', 'scientist_decision', 'scientist_comment',
    'ai_overridden', 'final_status', 'finalised_at',
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Download className="w-5 h-5 text-blue-600" />
          Export Data
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Download the complete component-wise final dataset
        </p>
      </div>

      {/* Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {lotSummary.isFinalized ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700">Lot Finalized</p>
                  <p className="text-xs text-gray-500">
                    All decisions are locked. Export contains final data.
                  </p>
                </div>
              </>
            ) : (
              <>
                <Lock className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold text-amber-700">Lot Not Yet Finalized</p>
                  <p className="text-xs text-gray-500">
                    You can still export current data. {lotSummary.pendingCount} decisions are pending.
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Export Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="hover:border-blue-300 transition-colors cursor-pointer" onClick={handleCSV}>
          <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-sm">Download CSV</p>
              <p className="text-xs text-gray-500 mt-1">
                Complete component-wise data with all metrics, decisions, and comments
              </p>
            </div>
            <Button className="mt-2 bg-blue-600 hover:bg-blue-700">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-green-300 transition-colors cursor-pointer" onClick={handleJSON}>
          <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <FileJson className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-sm">Download JSON</p>
              <p className="text-xs text-gray-500 mt-1">
                Structured data with component IDs, risk scores, and decisions
              </p>
            </div>
            <Button variant="outline" className="mt-2 border-green-300 text-green-700 hover:bg-green-50">
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Dataset Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Table2 className="w-4 h-4" />
            Export Contents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-4">
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500">Total Rows</span>
              <span className="font-bold">{state.components.length}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500">Columns</span>
              <span className="font-bold">{exportColumns.length}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500">Format</span>
              <span className="font-bold">CSV / JSON</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500">Parameter</span>
              <span className="font-bold">Leakage Current</span>
            </div>
          </div>

          <p className="text-xs font-semibold text-gray-700 mb-2">Columns included:</p>
          <div className="flex flex-wrap gap-1">
            {exportColumns.map((col) => (
              <Badge key={col} variant="outline" className="text-[10px] font-mono">
                {col}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
