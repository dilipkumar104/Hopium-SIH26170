import { NavLink, useLocation } from 'react-router-dom';
import { useLot } from '@/data/lot-context';
import {
  LayoutDashboard,
  Search,
  AlertTriangle,
  ClipboardCheck,
  Download,
  History,
  Activity,
  CheckCircle2,
  Lock,
  Cpu,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: 'Overview', icon: LayoutDashboard, description: 'Command Center' },
  { path: '/explorer', label: 'Component Explorer', icon: Search, description: 'Search & Filter' },
  { path: '/risk-analysis', label: 'Risk Analysis', icon: AlertTriangle, description: 'Population Analytics' },
  { path: '/final-review', label: 'Final Review', icon: ClipboardCheck, description: 'Lot Finalization' },
  { path: '/export', label: 'Export', icon: Download, description: 'Data Download' },
  { path: '/audit', label: 'Audit Trail', icon: History, description: 'Activity Log' },
];

export function Sidebar() {
  const { lotSummary } = useLot();
  const location = useLocation();

  return (
    <aside className="flex flex-col w-[272px] min-h-screen bg-white border-r border-gray-200/80">
      {/* Logo / Header */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm">
            <Zap className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <span className="text-[13px] font-bold tracking-tight text-gray-900">SIH 26170</span>
            <p className="text-[10px] font-medium text-gray-400 tracking-wider uppercase leading-tight">
              Screening Platform
            </p>
          </div>
        </div>
      </div>

      {/* Lot Info */}
      <div className="mx-3 mt-3 p-3 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/60 border border-gray-200/60">
        <div className="flex items-center gap-2 mb-2.5">
          <Cpu className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Active Lot</span>
        </div>
        <p className="text-sm font-bold text-gray-900 font-mono mb-2">{lotSummary.lotId}</p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">Testing</span>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
              <CheckCircle2 className="w-3 h-3" />
              {lotSummary.testingStatus}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500">Analysis</span>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
              <CheckCircle2 className="w-3 h-3" />
              {lotSummary.analysisStatus}
            </span>
          </div>
          {lotSummary.isFinalized && (
            <div className="flex items-center gap-1.5 mt-1 px-2 py-1 rounded-md bg-blue-50 border border-blue-100">
              <Lock className="w-3 h-3 text-blue-600" />
              <span className="text-[10px] font-bold text-blue-700">Finalized</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">Navigation</p>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-primary-foreground" : "text-gray-400")} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Quick Stats Footer */}
      <div className="mx-3 mb-3 p-3 rounded-xl bg-gray-50/80 border border-gray-200/50">
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Quick Stats</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
          <div className="flex justify-between">
            <span className="text-gray-500">Components</span>
            <span className="font-bold font-mono text-gray-800">{lotSummary.totalComponents.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">High Risk</span>
            <span className="font-bold font-mono text-orange-600">{lotSummary.highRisk + lotSummary.criticalRisk}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Pending</span>
            <span className="font-bold font-mono text-gray-600">{lotSummary.pendingCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Reviewed</span>
            <span className="font-bold font-mono text-emerald-600">
              {lotSummary.totalComponents - lotSummary.pendingCount}
            </span>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-amber-50/60">
        <div className="flex items-start gap-1.5">
          <Activity className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-[9px] text-amber-700/80 leading-tight font-medium">
            Decision Support System — AI outputs support engineering review and do not independently
            determine final component disposition.
          </p>
        </div>
      </div>
    </aside>
  );
}
