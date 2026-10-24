import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Info,
  Calendar,
  Layers,
  Sparkles,
  BarChart2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { trainForecastModel, predictForecast } from '../services/api';
import { ForecastPoint, ForecastMetrics } from '../types';

interface ForecastingPageProps {
  datasetId: string;
}

export const ForecastingPage: React.FC<ForecastingPageProps> = ({ datasetId }) => {
  const [horizon, setHorizon] = useState(24);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [metrics, setMetrics] = useState<ForecastMetrics | null>(null);
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [recentActuals, setRecentActuals] = useState<ForecastPoint[]>([]);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [trainStatus, setTrainStatus] = useState<string | null>(null);

  useEffect(() => {
    loadForecast();
  }, [datasetId, horizon]);

  async function loadForecast() {
    setLoading(true);
    try {
      const res = await predictForecast(datasetId, horizon);
      setForecast(res.forecast);
      setRecentActuals(res.recent_actuals);
      setMetrics(res.metrics);
      setAssumptions(res.assumptions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRetrain() {
    setTraining(true);
    setTrainStatus(null);
    try {
      const trainRes = await trainForecastModel(datasetId);
      setMetrics(trainRes.metrics);
      setTrainStatus(`XGBoost model successfully retrained on chronological split (MAE: ${trainRes.metrics.mae} kWh).`);
      await loadForecast();
    } catch (err: any) {
      setTrainStatus(`Training error: ${err.message}`);
    } finally {
      setTraining(false);
    }
  }

  // Combined visualization data: last actuals followed by future forecast
  const combinedData = [
    ...recentActuals.map(a => ({
      time: new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actual: a.actual,
      predicted: null,
      lower: null,
      upper: null,
    })),
    ...forecast.map(f => ({
      time: new Date(f.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actual: null,
      predicted: f.predicted,
      lower: f.lower_bound,
      upper: f.upper_bound,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Overview & Train Controls */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>XGBoost Gradient Boosted Tree Forecaster</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Predicts future electricity consumption using lag features (lag 1, 2, 24), 6h/24h rolling averages, hour of day, and day of week.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400 pl-1">Horizon:</span>
            <button
              onClick={() => setHorizon(24)}
              className={`px-2.5 py-1 rounded ${horizon === 24 ? 'bg-emerald-500/20 text-emerald-300 font-medium' : 'text-slate-400'}`}
            >
              24h
            </button>
            <button
              onClick={() => setHorizon(48)}
              className={`px-2.5 py-1 rounded ${horizon === 48 ? 'bg-emerald-500/20 text-emerald-300 font-medium' : 'text-slate-400'}`}
            >
              48h
            </button>
            <button
              onClick={() => setHorizon(72)}
              className={`px-2.5 py-1 rounded ${horizon === 72 ? 'bg-emerald-500/20 text-emerald-300 font-medium' : 'text-slate-400'}`}
            >
              72h
            </button>
          </div>

          <button
            onClick={handleRetrain}
            disabled={training}
            className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${training ? 'animate-spin' : ''}`} />
            {training ? 'Training...' : 'Retrain Ensemble'}
          </button>
        </div>
      </div>

      {trainStatus && (
        <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{trainStatus}</span>
        </div>
      )}

      {/* Held-Out Evaluation Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl">
            <span className="text-[11px] text-slate-400">Mean Absolute Error (MAE)</span>
            <div className="text-lg font-bold text-emerald-400 font-mono mt-1">{metrics.mae} <span className="text-xs text-slate-400 font-normal">kWh</span></div>
            <p className="text-[10px] text-slate-400 mt-0.5">Average absolute step error</p>
          </div>

          <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl">
            <span className="text-[11px] text-slate-400">Root Mean Squared Error</span>
            <div className="text-lg font-bold text-teal-400 font-mono mt-1">{metrics.rmse} <span className="text-xs text-slate-400 font-normal">kWh</span></div>
            <p className="text-[10px] text-slate-400 mt-0.5">Penalizes large peak spikes</p>
          </div>

          <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl">
            <span className="text-[11px] text-slate-400">Variance Explained (R²)</span>
            <div className="text-lg font-bold text-white font-mono mt-1">{(metrics.r2 * 100).toFixed(1)}%</div>
            <p className="text-[10px] text-slate-400 mt-0.5">On held-out test data</p>
          </div>

          <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl">
            <span className="text-[11px] text-slate-400">Train Observations</span>
            <div className="text-lg font-bold text-slate-300 font-mono mt-1">{metrics.train_rows}</div>
            <p className="text-[10px] text-slate-400 mt-0.5">70% chronological split</p>
          </div>

          <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl">
            <span className="text-[11px] text-slate-400">Validation / Test</span>
            <div className="text-lg font-bold text-slate-300 font-mono mt-1">{metrics.val_rows} / {metrics.test_rows}</div>
            <p className="text-[10px] text-slate-400 mt-0.5">15% val / 15% test</p>
          </div>

          <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-xl">
            <span className="text-[11px] text-slate-400">Uncertainty σ</span>
            <div className="text-lg font-bold text-amber-400 font-mono mt-1">±{(metrics.uncertainty_std * 1.96).toFixed(2)} <span className="text-xs text-slate-400 font-normal">kWh</span></div>
            <p className="text-[10px] text-slate-400 mt-0.5">95% prediction interval</p>
          </div>
        </div>
      )}

      {/* Main Interactive Forecast Chart */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Historical Actuals vs {horizon}-Hour Forecast</h3>
            <p className="text-xs text-slate-400">
              Solid line: Observed actuals & projected forecast. Dashed lines: 95% uncertainty interval.
            </p>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={combinedData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Line type="monotone" dataKey="actual" stroke="#94a3b8" strokeWidth={2} dot={{ r: 2 }} name="Actual (kWh)" connectNulls={false} />
              <Line type="monotone" dataKey="upper" stroke="#047857" strokeDasharray="3 3" dot={false} name="95% Upper Bound" />
              <Line type="monotone" dataKey="predicted" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} name="XGBoost Forecast (kWh)" />
              <Line type="monotone" dataKey="lower" stroke="#047857" strokeDasharray="3 3" dot={false} name="95% Lower Bound" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Methodology & Documented Assumptions */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 text-xs text-slate-300 space-y-2">
        <span className="font-semibold text-white flex items-center gap-1.5 mb-1">
          <Info className="w-3.5 h-3.5 text-emerald-400" />
          Model Methodology & Leakage Prevention:
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-400">
          <div>
            <p className="mb-1.5">
              • <strong className="text-slate-300">Chronological Splitting:</strong> The dataset is partitioned chronologically (70% train, 15% validation, 15% test). No future observations are ever leaked into feature creation.
            </p>
            <p>
              • <strong className="text-slate-300">Multi-Step Autoregression:</strong> As forecast steps proceed into the future, previous model predictions are fed dynamically into lag and rolling features.
            </p>
          </div>
          <div>
            <p className="mb-1.5">
              • <strong className="text-slate-300">Uncertainty Bounds:</strong> Computed from residual variance of held-out validation predictions and expanded monotonically with forecast horizon.
            </p>
            <p>
              • <strong className="text-slate-300">Scope Notice:</strong> Output is a statistical expectation subject to household schedule variance; not a guarantee of electricity draw.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
