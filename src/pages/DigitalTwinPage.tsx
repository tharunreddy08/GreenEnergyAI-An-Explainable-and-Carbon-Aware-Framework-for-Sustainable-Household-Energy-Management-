import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Zap,
  Activity,
  Layers,
  Info,
  Clock,
  ShieldAlert,
  ChevronRight,
  TrendingDown,
  PieChart as PieIcon,
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
  BarChart,
  Bar,
} from 'recharts';
import { fetchDigitalTwin } from '../services/api';
import { DigitalTwinState } from '../types';

interface DigitalTwinPageProps {
  datasetId: string;
}

export const DigitalTwinPage: React.FC<DigitalTwinPageProps> = ({ datasetId }) => {
  const [twin, setTwin] = useState<DigitalTwinState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTwin();
  }, [datasetId]);

  async function loadTwin() {
    setLoading(true);
    try {
      const data = await fetchDigitalTwin(datasetId);
      setTwin(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm">Synthesizing Household Energy Digital Twin...</p>
      </div>
    );
  }

  if (!twin) return null;

  return (
    <div className="space-y-6">
      {/* Digital Twin Scope & Software Nature Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-400">
        <Cpu className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-200">Household Digital Twin (Innovation Module 1):</strong> This module maintains a unified virtual representation of household demand dynamics by consolidating historical data, XGBoost machine learning forecasts, and what-if simulation overlays into one synchronized virtual load profile. Hardware IoT devices (ESP32 / PZEM-004T) are reserved for future work.
        </div>
      </div>

      {/* Household Virtual Profile Metadata Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400">Household ID</span>
          <div className="text-base font-bold text-white font-mono mt-1">{twin.household_id}</div>
          <p className="text-[10px] text-emerald-400 mt-0.5">Profile: {twin.virtual_profile.efficiency_rating}</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400">Continuous Base Load</span>
          <div className="text-base font-bold text-slate-200 font-mono mt-1">
            {twin.virtual_profile.base_load_kw} <span className="text-xs text-slate-400 font-normal">kW</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Refrigeration & standby floor</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400">Peak Active Power</span>
          <div className="text-base font-bold text-amber-400 font-mono mt-1">
            {twin.virtual_profile.peak_load_kw} <span className="text-xs text-slate-400 font-normal">kW</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Historical maximum surge</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400">Average Daily Demand</span>
          <div className="text-base font-bold text-emerald-400 font-mono mt-1">
            {twin.virtual_profile.daily_average_kwh} <span className="text-xs text-slate-400 font-normal">kWh/day</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Normalized 24h consumption</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400">Peak Demand Window</span>
          <div className="text-sm font-semibold text-white mt-1">{twin.virtual_profile.most_active_hours}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Load factor: {twin.virtual_profile.load_factor}</p>
        </div>
      </div>

      {/* Unified Digital Twin Chart: Historical vs Forecast vs Simulated */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>Synchronized 24-Hour Load Trajectory</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                Unified Twin State
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Comparing historical baseline hourly mean vs XGBoost demand forecast vs hypothetical 10% reduction
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-slate-400 inline-block" /> Historical Avg
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" /> XGBoost Forecast
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-teal-300 stroke-dasharray inline-block" /> Simulated -10%
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={twin.load_curve_24h} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="hour" stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={h => `${h}:00`} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                labelFormatter={h => `Hour ${h}:00`}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Line type="monotone" dataKey="forecast_upper" stroke="#065f46" strokeDasharray="3 3" dot={false} name="Forecast 95% Upper" />
              <Line type="monotone" dataKey="historical_avg" stroke="#94a3b8" strokeWidth={2} dot={{ r: 2 }} name="Historical Avg (kWh)" />
              <Line type="monotone" dataKey="forecast_expected" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} name="XGBoost Expected (kWh)" />
              <Line type="monotone" dataKey="simulated_10pct_cut" stroke="#2dd4bf" strokeDasharray="4 4" strokeWidth={2} dot={false} name="Simulated 10% Cut (kWh)" />
              <Line type="monotone" dataKey="forecast_lower" stroke="#065f46" strokeDasharray="3 3" dot={false} name="Forecast 95% Lower" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Synthetic Appliance Category Breakdown (Statistical Disaggregation) */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-400" />
              <span>Statistical Demand Disaggregation</span>
            </h3>
            <p className="text-xs text-slate-400">
              Estimated category allocation derived from diurnal amplitude and sub-metering signatures
            </p>
          </div>
          <span className="text-[11px] text-amber-400/90 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            Statistical Estimate (No Circuit Sensors)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {twin.synthetic_disaggregation.map((cat, idx) => (
            <div key={idx} className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-white truncate" title={cat.category}>
                    {cat.category}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">{cat.estimated_share_pct}%</span>
                </div>
                <div className="text-sm font-bold text-slate-200 font-mono">
                  {cat.estimated_daily_kwh} <span className="text-xs text-slate-400 font-normal">kWh/day</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${cat.estimated_share_pct}%` }} />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                {cat.confidence_note}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
