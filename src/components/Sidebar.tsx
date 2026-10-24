import React from 'react';
import {
  LayoutDashboard,
  Database,
  Sliders,
  Cpu,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Leaf,
  Target,
  FileText,
  ShieldCheck,
} from 'lucide-react';

export type NavTab =
  | 'overview'
  | 'datasets'
  | 'simulation'
  | 'digital-twin'
  | 'forecasting'
  | 'anomalies'
  | 'explainability'
  | 'emissions'
  | 'optimizer'
  | 'reports';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  datasetName?: string;
  rowCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  datasetName,
  rowCount,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode; tag?: string }[] = [
    { id: 'overview', label: 'Overview Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'datasets', label: 'Dataset Management', icon: <Database className="w-4 h-4" /> },
    { id: 'simulation', label: 'Energy Simulation & What-If', icon: <Sliders className="w-4 h-4" /> },
    { id: 'digital-twin', label: 'Household Digital Twin', icon: <Cpu className="w-4 h-4" />, tag: 'Innovation 1' },
    { id: 'forecasting', label: 'AI Forecasting (XGBoost)', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'anomalies', label: 'Uncertainty Alerts & Anomalies', icon: <AlertTriangle className="w-4 h-4" />, tag: 'Innovation 2' },
    { id: 'explainability', label: 'Explainable AI (SHAP / LIME)', icon: <Lightbulb className="w-4 h-4" /> },
    { id: 'emissions', label: 'Carbon Emission Analysis', icon: <Leaf className="w-4 h-4" /> },
    { id: 'optimizer', label: 'Multi-Objective Optimizer', icon: <Target className="w-4 h-4" />, tag: 'Innovation 3' },
    { id: 'reports', label: 'Reports & Export Audit', icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-72 bg-slate-900/95 border-r border-slate-800 flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none">
      <div className="flex flex-col h-full overflow-hidden">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-base shadow-sm">
              ⚡
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white flex items-center gap-1.5">
                GreenEnergyAI
              </h1>
              <p className="text-xs text-slate-400">Intelligent Household Decision Engine</p>
            </div>
          </div>
        </div>

        {/* Active Dataset Mini Card */}
        <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-950/40">
          <div className="text-[11px] font-medium text-slate-400 mb-1 flex items-center justify-between">
            <span>Active Dataset</span>
            <span className="text-[10px] text-emerald-400 font-mono">{rowCount ? `${rowCount} rows` : 'Ready'}</span>
          </div>
          <div className="text-xs text-slate-200 font-medium truncate" title={datasetName || 'UCI Household Benchmark'}>
            {datasetName || 'UCI Household Benchmark'}
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map(item => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={isActive ? 'text-emerald-400' : 'text-slate-400'}>{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </div>
                {item.tag && (
                  <span className="text-[9px] font-mono tracking-wider text-emerald-400/80 px-1.5 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20 shrink-0 ml-1">
                    {item.tag}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer info & Scope notice */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[11px] text-slate-400">Software-Only Engine</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 leading-tight">
            Historical data analytics & simulation. Hardware IoT sensors (PZEM-004T / ESP32) reserved for future enhancements.
          </p>
        </div>
      </div>
    </aside>
  );
};
