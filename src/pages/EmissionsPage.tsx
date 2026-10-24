import React, { useState, useEffect } from 'react';
import {
  Leaf,
  Download,
  Info,
  Globe,
  Sliders,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { calculateEmissions } from '../services/api';

interface EmissionsPageProps {
  datasetId: string;
  emissionFactor: number;
  onUpdateEmissionFactor: (ef: number) => void;
}

export const EmissionsPage: React.FC<EmissionsPageProps> = ({
  datasetId,
  emissionFactor,
  onUpdateEmissionFactor,
}) => {
  const [localFactor, setLocalFactor] = useState(emissionFactor);
  const [selectedPreset, setSelectedPreset] = useState('epa_us');
  const [emissionsData, setEmissionsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const presets = [
    { id: 'epa_us', label: 'EPA eGRID US National Average', factor: 0.385, desc: 'Average operational generation mix across US grid interconnects' },
    { id: 'eu_avg', label: 'European Union Grid Average', factor: 0.255, desc: 'Higher proportion of renewables and nuclear generation' },
    { id: 'coal_heavy', label: 'Fossil / Coal-Heavy Sub-grid', factor: 0.720, desc: 'High thermal coal operational generation factor' },
    { id: 'hydro_clean', label: 'Hydro / Clean Renewable Region', factor: 0.045, desc: 'Low-carbon hydro/solar dominated grid mix' },
  ];

  useEffect(() => {
    loadEmissions();
  }, [datasetId, localFactor]);

  async function loadEmissions() {
    setLoading(true);
    try {
      const currentPreset = presets.find(p => Math.abs(p.factor - localFactor) < 0.001);
      const sourceName = currentPreset ? currentPreset.label : 'Custom Configured Emission Factor';
      const data = await calculateEmissions(datasetId, localFactor, sourceName);
      setEmissionsData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handlePresetChange(id: string) {
    const p = presets.find(item => item.id === id);
    if (p) {
      setSelectedPreset(id);
      setLocalFactor(p.factor);
      onUpdateEmissionFactor(p.factor);
    }
  }

  function exportEmissionsCSV() {
    if (!emissionsData) return;
    const headers = 'Date,Electricity_kWh,Estimated_CO2_kg,Emission_Factor\n';
    const rows = emissionsData.daily_trend
      .map(
        (d: any) =>
          `"${d.date}",${d.energy_kwh},${d.co2_kg},${localFactor}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carbon_emissions_${datasetId}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      {/* Scope Disclaimer */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-400">
        <Leaf className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-200">Carbon Emission Estimation Scope:</strong> Estimated emissions reflect operational grid generation intensity applied to measured kWh. They are marked as estimates and do not account for lifecycle embodied infrastructure carbon or localized real-time marginal dispatch unless explicitly configured.
        </div>
      </div>

      {/* Factor Configuration Panel */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400" />
          <span>Configurable Grid Carbon Intensity Factor</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          {presets.map(p => {
            const isSelected = Math.abs(p.factor - localFactor) < 0.001;
            return (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="font-semibold text-xs text-white">{p.label}</div>
                <div className="text-sm font-bold font-mono text-emerald-400 mt-1">{p.factor} kg/kWh</div>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">{p.desc}</p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-400">Custom Factor:</span>
            <input
              type="number"
              step="0.005"
              min="0.01"
              max="2.00"
              value={localFactor}
              onChange={e => {
                const val = parseFloat(e.target.value) || 0.385;
                setLocalFactor(val);
                onUpdateEmissionFactor(val);
              }}
              className="w-28 bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
            />
            <span className="text-slate-400 text-xs">kg CO₂/kWh</span>
          </div>

          <button
            onClick={exportEmissionsCSV}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export Emissions CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {emissionsData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400">Total Estimated CO₂ Footprint</span>
            <div className="text-xl font-bold text-white font-mono mt-1">
              {emissionsData.total_co2_kg.toLocaleString()} <span className="text-xs text-slate-400 font-normal">kg CO₂</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Over evaluated period</p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400">Average Daily CO₂ Emissions</span>
            <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
              {emissionsData.average_daily_co2_kg.toFixed(2)} <span className="text-xs text-slate-400 font-normal">kg/day</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Equivalent to ~{(emissionsData.average_daily_co2_kg * 4.2).toFixed(1)} km driven in petrol car</p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400">Formula & Factor Applied</span>
            <div className="text-sm font-semibold text-white mt-1 font-mono">
              kWh × {emissionsData.emission_factor_used} kg CO₂
            </div>
            <p className="text-[10px] text-emerald-400 mt-0.5 truncate">{emissionsData.factor_source}</p>
          </div>
        </div>
      )}

      {/* Dual Axis Chart: Electricity Consumption vs CO2 Emissions */}
      {emissionsData && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Daily Electricity Consumption & Carbon Footprint Trend</h3>
              <p className="text-xs text-slate-400">Daily kWh demand and corresponding operational CO₂ emissions</p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={emissionsData.daily_trend} margin={{ top: 15, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis yAxisId="left" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area yAxisId="left" type="monotone" dataKey="energy_kwh" fill="#10b981" fillOpacity={0.2} stroke="#10b981" name="Energy (kWh)" />
                <Line yAxisId="right" type="monotone" dataKey="co2_kg" stroke="#38bdf8" strokeWidth={2} dot={false} name="Est. CO₂ (kg)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
