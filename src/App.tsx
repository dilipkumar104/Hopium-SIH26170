import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LotProvider } from '@/data/lot-context';
import { AppLayout } from '@/components/layout/app-layout';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import Overview from '@/pages/overview';
import ComponentExplorer from '@/pages/component-explorer';
import ComponentDetail from '@/pages/component-detail';
import RiskAnalysis from '@/pages/risk-analysis';
import FinalReview from '@/pages/final-review';
import ExportPage from '@/pages/export';
import AuditTrail from '@/pages/audit-trail';
import { PhysicsAnalysisPage } from '@/pages/physics-analysis';
import { LiveATEPage } from '@/pages/live-ate';
import { ComponentClassificationPage } from '@/pages/component-classification';

function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <LotProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Overview />} />
              <Route path="/explorer" element={<ComponentExplorer />} />
              <Route path="/component/:id" element={<ComponentDetail />} />
              <Route path="/physics/:componentId" element={<PhysicsAnalysisPage />} />
              <Route path="/classification" element={<ComponentClassificationPage />} />
              <Route path="/live-ate" element={<LiveATEPage />} />
              <Route path="/risk-analysis" element={<RiskAnalysis />} />
              <Route path="/final-review" element={<FinalReview />} />
              <Route path="/export" element={<ExportPage />} />
              <Route path="/audit" element={<AuditTrail />} />
            </Route>
          </Routes>
          <Toaster position="bottom-right" richColors />
        </LotProvider>
      </TooltipProvider>
    </BrowserRouter>
  );
}

export default App;
