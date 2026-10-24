import React, { useEffect, useState } from 'react';
import {
  Zap,
  TrendingUp,
  AlertTriangle,
  Leaf,
  Shield,
  Clock,
  ArrowUpRight,
  Info,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import {
  fetchAnalyticsSummary,
  fetchConsumptionSeries,
  predictForecast,
  calculateEmissions,
  calculateSustainability,
  fetchUncertaintyAlerts,
} from '../services/api';
import {
  AnalyticsSummary,
  ConsumptionPoint,
  ForecastPoint,
  SustainabilityScoreResult,
  UncertaintyAlert,
} from '../types';
import { NavTab } from '../components/Sidebar';

interface OverviewPageProps {
  datasetId: string;
  tariff: number;
  emissionFactor: number;
  onNavigate: (tab: NavTab) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  datasetId,
  tariff,
  emissionFactor,
  onNavigate,
}) => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [series, setSeries] = useState<ConsumptionPoint[]>([]);
  const [hourlyProfile, setHourlyProfile] = useState<{ hour: number; avg_kwh: number }[]>([]);
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [sustainability, setSustainability] = useState<SustainabilityScoreResult | null>(null);
  const [alerts, setAlerts] = useState<UncertaintyAlert[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [datasetId, tariff, emissionFactor]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, consRes, fcRes, sustRes, alertRes] = await Promise.all([
        fetchAnalyticsSummary(datasetId),
        fetchConsumptionSeries(datasetId, 168),
        predictForecast(datasetId, 24),
        calculateSustainability(datasetId, emissionFactor),
        fetchUncertaintyAlerts(datasetId),
      ]);

      setSummary(sumRes);
      setSeries(consRes.series);
      setHourlyProfile(consRes.hourly_profile);
      setForecast(fcRes.forecast);
      setSustainability(sustRes);
      setAlerts(alertRes.alerts);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm">Calculating household energy telemetry and forecasts...</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-8 bg-red-950/20 border border-red-800/40 rounded-xl text-red-200">
        <h3 className="font-semibold text-base mb-1">Error Loading Energy Analytics</h3>
        <p className="text-xs text-red-300 mb-4">{error || 'Unknown error'}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-red-800/40 hover:bg-red-800/60 rounded text-xs text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  // Calculate 24h forecasted total
  const next24hForecastKwh = forecast.reduce((sum, f) => sum + f.predicted, 0);
  const totalCo2 = summary.total_energy_kwh * emissionFactor;

  // Chart data preparing: last 48 hours for clean visualization
  const recentHistory = series.slice(-48).map(pt => ({
    time: new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    actual_kwh: pt.energy_kwh,
    power_kw: pt.global_active_power,
  }));

  const forecastChartData = forecast.map(f => ({
    time: new Date(f.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    predicted: f.predicted,
    lower: f.lower_bound,
    upper: f.upper_bound,
  }));

  return (
    <div className="space-y-6">
      {/* Scope and Transparency Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2.5">
          <Info className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong className="text-slate-200">Software Analytics Mode:</strong> Values computed from active historical records ({summary.days_covered} days covered). No connected physical meters claimed.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigate('simulation')}
            className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 hover:underline"
          >
            Run What-If Simulation <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Total Energy */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Consumption</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {summary.total_energy_kwh.toLocaleString()} <span className="text-xs text-slate-400 font-normal">kWh</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Over {summary.days_covered} days ({summary.total_observations} readings)
          </p>
        </div>

        {/* Card 2: Daily Average */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Daily Average</span>
            <Clock className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {summary.average_daily_kwh.toFixed(1)} <span className="text-xs text-slate-400 font-normal">kWh/day</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Est. ${(summary.average_daily_kwh * tariff).toFixed(2)}/day @ ${tariff.toFixed(2)}/kWh
          </p>
        </div>

        {/* Card 3: 24h Demand Forecast */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Next 24h Forecast</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono">
            {next24hForecastKwh.toFixed(1)} <span className="text-xs text-slate-400 font-normal">kWh</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            XGBoost recursive multi-step model
          </p>
        </div>

        {/* Card 4: Anomalies */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Detected Anomalies</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 font-mono">
            {summary.detected_anomalies_count}{' '}
            <span className="text-xs text-slate-400 font-normal">
              ({((summary.detected_anomalies_count / Math.max(1, summary.total_observations)) * 100).toFixed(1)}%)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Isolation Forest statistical outliers
          </p>
        </div>

        {/* Card 5: Carbon Emissions */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Estimated CO₂</span>
            <Leaf className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {totalCo2.toFixed(1)} <span className="text-xs text-slate-400 font-normal">kg</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Factor: {emissionFactor.toFixed(3)} kg/kWh
          </p>
        </div>

        {/* Card 6: Sustainability Score */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Sustainability</span>
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono flex items-center gap-1.5">
            <span>{sustainability?.score ?? 74}</span>
            <span className="text-xs text-emerald-400 font-sans font-medium">/100</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Rating: <span className="text-emerald-300 font-medium">{sustainability?.rating ?? 'Good'}</span>
          </p>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Historical Consumption Chart (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Historical Energy Trajectory</h3>
              <p className="text-xs text-slate-400">Recent 48 observations (Active Power in kW and Energy in kWh)</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Energy (kWh)
              </span>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={recentHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorKwh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Area type="monotone" dataKey="actual_kwh" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorKwh)" name="Energy (kWh)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 24-Hour Diurnal Pattern Bar Chart */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">24h Diurnal Load Curve</h3>
              <p className="text-xs text-slate-400">Hourly average consumption (0-23h)</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyProfile} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={h => `${h}h`} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(val: any) => [`${val} kWh`, 'Avg Load']}
                />
                <Bar dataKey="avg_kwh" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Forecast & Alerts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next 24h XGBoost Forecast Chart */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <span>XGBoost Demand Forecast (Next 24h)</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  95% Interval
                </span>
              </h3>
              <p className="text-xs text-slate-400">Recursive multi-step forecast with empirical prediction bounds</p>
            </div>
            <button
              onClick={() => onNavigate('forecasting')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-0.5"
            >
              Details <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                />
                <Line type="monotone" dataKey="upper" stroke="#047857" strokeDasharray="3 3" dot={false} name="Upper 95% Bound" />
                <Line type="monotone" dataKey="predicted" stroke="#10b981" strokeWidth={2.5} dot={{ r: 2 }} name="Predicted (kWh)" />
                <Line type="monotone" dataKey="lower" stroke="#047857" strokeDasharray="3 3" dot={false} name="Lower 95% Bound" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Uncertainty-Aware Alerts (Innovation 2 Highlight) */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Uncertainty-Aware Energy Alerts</span>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    Innovation 2
                  </span>
                </h3>
                <p className="text-xs text-slate-400">Contextualized anomalies evaluated against forecast prediction intervals</p>
              </div>
              <button
                onClick={() => onNavigate('anomalies')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-0.5"
              >
                All Alerts <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5 mt-2">
              {alerts.slice(0, 3).map((alert, idx) => (
                <div
                  key={alert.id || idx}
                  className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{alert.severity_label}</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {alert.plain_language_explanation}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5 pt-1 border-t border-slate-800/50">
                    <span>Observed: <strong className="text-slate-200">{alert.observed_kwh} kWh</strong></span>
                    <span>Score: <strong className="text-amber-400">{alert.anomaly_score}</strong></span>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-500">
                  No unusual consumption alerts active for the current threshold.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Alerts combine iForest scores + XGBoost uncertainty spans</span>
            <button
              onClick={() => onNavigate('digital-twin')}
              className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
            >
              Digital Twin View <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
