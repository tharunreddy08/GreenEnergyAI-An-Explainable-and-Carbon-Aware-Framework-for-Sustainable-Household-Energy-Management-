import React from 'react';
import { Database, Zap, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { NavTab } from './Sidebar';

interface HeaderProps {
  currentTab: NavTab;
  datasetName: string;
  sourceType: string;
  tariff: number;
  emissionFactor: number;
  onRefresh: () => void;
  onSelectDatasetType: (type: 'uci' | 'synthetic') => void;
  onNavigate: (tab: NavTab) => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  datasetName,
  sourceType,
  tariff,
  emissionFactor,
  onRefresh,
  onSelectDatasetType,
  onNavigate,
  isRefreshing,
}) => {
  const titles: Record<NavTab, { title: string; subtitle: string }> = {
    overview: {
      title: 'Overview Dashboard',
      subtitle: 'Holistic household electricity demand, active forecasts, anomalies, and carbon impact.',
    },
    datasets: {
      title: 'Dataset Management & Ingestion',
      subtitle: 'Upload, validate, and inspect UCI benchmark records, synthetic demos, or custom CSVs.',
    },
    simulation: {
      title: 'What-If Electricity Simulation Engine',
      subtitle: 'Evaluate scenario reductions against historical baseline with transparent formulas.',
    },
    'digital-twin': {
      title: 'Household Energy Digital Twin',
      subtitle: 'Virtual household representation combining historical load, XGBoost forecast, and what-if overlays.',
    },
    forecasting: {
      title: 'AI Consumption Forecasting (XGBoost)',
      subtitle: 'Ensemble gradient boosted time-series regression with strict chronological validation.',
    },
    anomalies: {
      title: 'Uncertainty-Aware Energy Alerts & Anomalies',
      subtitle: 'Isolation Forest detection combined with forecast prediction intervals for calibrated alerts.',
    },
    explainability: {
      title: 'Explainable AI (SHAP & LIME)',
      subtitle: 'Global feature importance and local instance attributions explaining model decisions.',
    },
    emissions: {
      title: 'Electricity-Related CO₂ Emissions',
      subtitle: 'Configurable emission factor estimation and daily carbon footprint analytics.',
    },
    optimizer: {
      title: 'Multi-Objective Recommendation Optimizer',
      subtitle: 'Rank energy-saving actions dynamically across energy, cost, and carbon objectives.',
    },
    reports: {
      title: 'Consolidated Reports & Audit Export',
      subtitle: 'Export reproducible analysis summaries, JSON audits, and CSV records.',
    },
  };

  const currentInfo = titles[currentTab] || titles.overview;

  return (
    <header className="bg-slate-900/80 border-b border-slate-800 px-8 py-4 sticky top-0 z-20 backdrop-blur-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white tracking-tight">{currentInfo.title}</h2>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              {sourceType.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{currentInfo.subtitle}</p>
        </div>

        {/* Global Controls & Metrics */}
        <div className="flex items-center gap-3">
          {/* Quick Dataset Switcher buttons */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => onSelectDatasetType('uci')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                sourceType === 'uci'
                  ? 'bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Switch to official UCI Household Power Consumption dataset"
            >
              UCI Data
            </button>
            <button
              onClick={() => onSelectDatasetType('synthetic')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                sourceType === 'synthetic'
                  ? 'bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Generate synthetic demonstration dataset"
            >
              Synthetic Demo
            </button>
            <button
              onClick={() => onNavigate('datasets')}
              className="px-2.5 py-1 rounded text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
            >
              <Database className="w-3 h-3" />
              Upload
            </button>
          </div>

          {/* Quick Parameters indicator */}
          <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-slate-950/60 rounded-lg border border-slate-800/80 text-xs text-slate-300">
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Tariff:</span>
              <span className="font-mono text-emerald-400">${tariff.toFixed(2)}/kWh</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Factor:</span>
              <span className="font-mono text-emerald-400">{emissionFactor.toFixed(3)} kg/kWh</span>
            </div>
            <button
              onClick={() => onNavigate('simulation')}
              className="text-slate-400 hover:text-emerald-400 transition-colors ml-1"
              title="Configure parameters in Simulation page"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Refresh Data button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-all disabled:opacity-50"
            title="Reload dataset analytics"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
