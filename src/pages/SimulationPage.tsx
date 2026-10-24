import React, { useState, useEffect } from 'react';
import {
  Sliders,
  DollarSign,
  Leaf,
  Save,
  CheckCircle,
  Info,
  HelpCircle,
  TrendingDown,
  Layers,
  ArrowRight,
  Download,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import {
  evaluateSimulation,
  saveScenario,
  fetchSavedScenarios,
  fetchAnalyticsSummary,
} from '../services/api';
import { ScenarioResult } from '../types';

interface SimulationPageProps {
  datasetId: string;
  tariff: number;
  emissionFactor: number;
  onUpdateTariff: (t: number) => void;
  onUpdateEmissionFactor: (ef: number) => void;
}

export const SimulationPage: React.FC<SimulationPageProps> = ({
  datasetId,
  tariff,
  emissionFactor,
  onUpdateTariff,
  onUpdateEmissionFactor,
}) => {
  const [reductionPct, setReductionPct] = useState(15);
  const [scenarioName, setScenarioName] = useState('Moderate 15% Conservation');
  const [localTariff, setLocalTariff] = useState(tariff);
  const [localEmissionFactor, setLocalEmissionFactor] = useState(emissionFactor);
  const [currentResult, setCurrentResult] = useState<ScenarioResult | null>(null);
  const [savedScenarios, setSavedScenarios] = useState<ScenarioResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    runEvaluation();
    loadSavedScenarios();
  }, [datasetId, reductionPct, localTariff, localEmissionFactor]);

  async function runEvaluation() {
    try {
      const res = await evaluateSimulation({
        dataset_id: datasetId,
        name: scenarioName,
        reduction_percentage: reductionPct,
        tariff: localTariff,
        emission_factor: localEmissionFactor,
      });
      setCurrentResult(res);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadSavedScenarios() {
    try {
      const res = await fetchSavedScenarios();
      setSavedScenarios(res.scenarios);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSaveScenario() {
    if (!currentResult) return;
    setLoading(true);
    try {
      await saveScenario(currentResult, datasetId);
      setSaveSuccess(true);
      await loadSavedScenarios();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Comparison Bar Chart data
  const comparisonData = currentResult
    ? [
        {
          name: 'Baseline Historical',
          kwh: currentResult.baseline_energy_kwh,
          cost: Number((currentResult.baseline_energy_kwh * currentResult.tariff_rate).toFixed(2)),
          co2: Number((currentResult.baseline_energy_kwh * currentResult.emission_factor).toFixed(2)),
        },
        {
          name: `Scenario (-${currentResult.reduction_percentage}%)`,
          kwh: currentResult.scenario_energy_kwh,
          cost: Number((currentResult.scenario_energy_kwh * currentResult.tariff_rate).toFixed(2)),
          co2: Number((currentResult.scenario_energy_kwh * currentResult.emission_factor).toFixed(2)),
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Scope Disclaimer */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-400">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-200">Simulation Engine Scope:</strong> Scenarios are hypothetical what-if mathematical models computed against the baseline period. They project potential outcomes under transparent equations; applying a reduction percentage does not claim verified real-world behavioral changes.
        </div>
      </div>

      {/* Control Configuration Panel */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span>Interactive Scenario Parameters</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 1. Reduction Percentage Slider */}
          <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-300 font-medium">Reduction Percentage</span>
              <span className="font-mono text-emerald-400 font-bold text-sm">{reductionPct}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="40"
              step="1"
              value={reductionPct}
              onChange={e => {
                const val = Number(e.target.value);
                setReductionPct(val);
                setScenarioName(`${val}% Electricity Reduction Scenario`);
              }}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>1% (Minimal)</span>
              <span>20% (Target)</span>
              <span>40% (Aggressive)</span>
            </div>
          </div>

          {/* 2. Electricity Tariff Rate ($/kWh) */}
          <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Electricity Tariff</span>
              <span className="font-mono text-emerald-400 font-bold">${localTariff.toFixed(2)}/kWh</span>
            </div>
            <p className="text-[10px] text-slate-400 mb-2">Regional average billing unit rate</p>
            <input
              type="number"
              step="0.01"
              min="0.05"
              max="1.00"
              value={localTariff}
              onChange={e => {
                const val = parseFloat(e.target.value) || 0.18;
                setLocalTariff(val);
                onUpdateTariff(val);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
            />
          </div>

          {/* 3. CO2 Emission Factor */}
          <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Grid Emission Factor</span>
              <span className="font-mono text-emerald-400 font-bold">{localEmissionFactor.toFixed(3)} kg/kWh</span>
            </div>
            <p className="text-[10px] text-slate-400 mb-2">EPA eGRID / Regional Grid Factor</p>
            <input
              type="number"
              step="0.005"
              min="0.05"
              max="1.50"
              value={localEmissionFactor}
              onChange={e => {
                const val = parseFloat(e.target.value) || 0.385;
                setLocalEmissionFactor(val);
                onUpdateEmissionFactor(val);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
            />
          </div>

          {/* 4. Scenario Label & Save Action */}
          <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-xs text-slate-300 font-medium">Scenario Name</span>
              <input
                type="text"
                value={scenarioName}
                onChange={e => setScenarioName(e.target.value)}
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <button
              onClick={handleSaveScenario}
              disabled={loading}
              className="mt-2 w-full py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Saved!
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" /> Save Scenario
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Calculated Results KPI Cards */}
      {currentResult && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400">Baseline Energy</span>
            <div className="text-lg font-bold text-slate-200 font-mono mt-1">
              {currentResult.baseline_energy_kwh.toLocaleString()} <span className="text-xs text-slate-400 font-normal">kWh</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Historical period total</p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400">Simulated Energy</span>
            <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
              {currentResult.scenario_energy_kwh.toLocaleString()} <span className="text-xs text-slate-400 font-normal">kWh</span>
            </div>
            <p className="text-[10px] text-emerald-400/80 mt-0.5">-{currentResult.reduction_percentage}% reduction</p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400">Projected Energy Savings</span>
            <div className="text-lg font-bold text-emerald-300 font-mono mt-1 flex items-center gap-1">
              <TrendingDown className="w-4 h-4 text-emerald-400" />
              {currentResult.energy_savings_kwh.toLocaleString()} <span className="text-xs text-slate-400 font-normal">kWh</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Baseline − Scenario</p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400">Estimated Cost Difference</span>
            <div className="text-lg font-bold text-white font-mono mt-1">
              ${currentResult.estimated_cost_diff.toLocaleString()}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">@ ${currentResult.tariff_rate.toFixed(2)}/kWh</p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400">Estimated CO₂ Difference</span>
            <div className="text-lg font-bold text-white font-mono mt-1">
              {currentResult.estimated_co2_diff.toLocaleString()} <span className="text-xs text-slate-400 font-normal">kg CO₂</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">@ {currentResult.emission_factor.toFixed(3)} kg/kWh</p>
          </div>
        </div>
      )}

      {/* Comparison Chart & Mathematical Formulas Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Comparison Bar Chart (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Baseline vs Scenario Consumption Comparison</h3>
              <p className="text-xs text-slate-400">Direct volume comparison over evaluated evaluation period</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="kwh" fill="#10b981" name="Energy (kWh)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" fill="#0284c7" name="Est. Cost ($)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Formulas & Assumptions Panel */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Documented Formulas</span>
            </h3>
            <p className="text-xs text-slate-400 mb-3">Transparent mathematical calculations applied:</p>

            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 bg-slate-950/70 rounded border border-slate-800 text-slate-300">
                <span className="text-emerald-400 block text-[10px] font-sans font-medium">Scenario Energy:</span>
                Scenario = Baseline × (1 − {reductionPct} / 100)
              </div>
              <div className="p-2.5 bg-slate-950/70 rounded border border-slate-800 text-slate-300">
                <span className="text-emerald-400 block text-[10px] font-sans font-medium">Energy Savings:</span>
                Savings = Baseline − Scenario
              </div>
              <div className="p-2.5 bg-slate-950/70 rounded border border-slate-800 text-slate-300">
                <span className="text-emerald-400 block text-[10px] font-sans font-medium">Estimated Cost Diff:</span>
                Cost Diff = Savings × ${localTariff.toFixed(2)}
              </div>
              <div className="p-2.5 bg-slate-950/70 rounded border border-slate-800 text-slate-300">
                <span className="text-emerald-400 block text-[10px] font-sans font-medium">Estimated CO₂ Diff:</span>
                CO₂ Diff = Savings × {localEmissionFactor.toFixed(3)} kg
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
            Note: Linear uniform reduction assumption across all hours.
          </div>
        </div>
      </div>

      {/* Saved Scenarios Comparison Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Scenario Comparison Dashboard</h3>
            <p className="text-xs text-slate-400">Side-by-side evaluation of saved what-if configurations</p>
          </div>
          <span className="text-xs text-emerald-400 font-mono">{savedScenarios.length} Scenarios Saved</span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Scenario Name</th>
                <th className="py-2.5 px-3">Cut %</th>
                <th className="py-2.5 px-3">Baseline (kWh)</th>
                <th className="py-2.5 px-3">Simulated (kWh)</th>
                <th className="py-2.5 px-3">Saved (kWh)</th>
                <th className="py-2.5 px-3">Cost Diff ($)</th>
                <th className="py-2.5 px-3">CO₂ Diff (kg)</th>
                <th className="py-2.5 px-3">Tariff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {savedScenarios.map((scen, idx) => (
                <tr key={scen.scenario_id || idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 px-3 font-semibold text-white font-sans">{scen.name}</td>
                  <td className="py-2 px-3 text-emerald-400 font-bold">{scen.reduction_percentage}%</td>
                  <td className="py-2 px-3 text-slate-400">{scen.baseline_energy_kwh.toFixed(1)}</td>
                  <td className="py-2 px-3 text-slate-200">{scen.scenario_energy_kwh.toFixed(1)}</td>
                  <td className="py-2 px-3 text-emerald-400 font-semibold">{scen.energy_savings_kwh.toFixed(1)}</td>
                  <td className="py-2 px-3 text-cyan-400">${scen.estimated_cost_diff.toFixed(2)}</td>
                  <td className="py-2 px-3 text-emerald-300">{scen.estimated_co2_diff.toFixed(2)}</td>
                  <td className="py-2 px-3 text-slate-400">${scen.tariff_rate.toFixed(2)}</td>
                </tr>
              ))}
              {savedScenarios.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-slate-500 font-sans">
                    No scenarios saved yet. Use the Save Scenario button above to store configurations.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
