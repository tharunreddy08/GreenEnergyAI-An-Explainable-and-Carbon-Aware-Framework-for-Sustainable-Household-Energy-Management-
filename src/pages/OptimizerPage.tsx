import React, { useState, useEffect } from 'react';
import {
  Target,
  Award,
  Zap,
  DollarSign,
  Leaf,
  Sliders,
  CheckCircle2,
  Info,
  TrendingUp,
  Shield,
  Layers,
} from 'lucide-react';
import {
  rankOptimizerRecommendations,
  calculateSustainability,
} from '../services/api';
import { RankedRecommendation, SustainabilityScoreResult } from '../types';

interface OptimizerPageProps {
  datasetId: string;
  tariff: number;
  emissionFactor: number;
}

export const OptimizerPage: React.FC<OptimizerPageProps> = ({
  datasetId,
  tariff,
  emissionFactor,
}) => {
  const [weightKwh, setWeightKwh] = useState(35);
  const [weightCost, setWeightCost] = useState(35);
  const [weightCo2, setWeightCo2] = useState(30);
  const [targetSavingsPct, setTargetSavingsPct] = useState(12);

  const [recommendations, setRecommendations] = useState<RankedRecommendation[]>([]);
  const [sustainability, setSustainability] = useState<SustainabilityScoreResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runOptimizer();
  }, [datasetId, weightKwh, weightCost, weightCo2, targetSavingsPct, tariff, emissionFactor]);

  async function runOptimizer() {
    setLoading(true);
    try {
      const [optRes, sustRes] = await Promise.all([
        rankOptimizerRecommendations({
          dataset_id: datasetId,
          weight_kwh: weightKwh / 100,
          weight_cost: weightCost / 100,
          weight_co2: weightCo2 / 100,
          tariff,
          emission_factor: emissionFactor,
          target_savings_pct: targetSavingsPct,
        }),
        calculateSustainability(datasetId, emissionFactor, targetSavingsPct),
      ]);
      setRecommendations(optRes.ranked_recommendations);
      setSustainability(sustRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Scope Disclaimer */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-400">
        <Target className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-200">Multi-Objective Recommendation Optimizer (Innovation Module 3):</strong> Ranks candidate household interventions by balancing three distinct, user-weighted criteria: electricity volume (kWh), billing expenditure ($), and grid carbon intensity (CO₂). Outputs are projections based on historical load curves, not guaranteed financial returns.
        </div>
      </div>

      {/* Sustainability Score Deep-Dive Card */}
      {sustainability && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" />
                <span>Household Sustainability Index</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  Score: {sustainability.score}/100 ({sustainability.rating})
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Transparent multi-criteria scoring balancing daily consumption, load regularity, and carbon profile
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {sustainability.components.map((comp, idx) => (
              <div key={idx} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-semibold">{comp.indicator}</span>
                    <span className="font-mono text-emerald-400 font-bold">{comp.points}/{comp.max_points} pts</span>
                  </div>
                  <div className="text-xs text-white font-mono">{comp.value}</div>
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    {comp.explanation}
                  </p>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{ width: `${(comp.points / comp.max_points) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-slate-500 mt-3 italic">
            * {sustainability.limitations}
          </p>
        </div>
      )}

      {/* Multi-Objective Priority Weights Configuration */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>Multi-Objective Priority Sliders</span>
            </h3>
            <p className="text-xs text-slate-400">
              Customize trade-offs between energy conservation, financial savings, and emissions reduction
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Total Weight: {weightKwh + weightCost + weightCo2}%
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Priority 1: kWh reduction */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400" /> kWh Reduction
              </span>
              <span className="font-mono text-emerald-400 font-bold">{weightKwh}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="70"
              value={weightKwh}
              onChange={e => setWeightKwh(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-400 mt-1">Weight for raw electricity conservation</p>
          </div>

          {/* Priority 2: Cost reduction */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-teal-400" /> Electricity Cost
              </span>
              <span className="font-mono text-teal-400 font-bold">{weightCost}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="70"
              value={weightCost}
              onChange={e => setWeightCost(Number(e.target.value))}
              className="w-full accent-teal-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-400 mt-1">Weight for financial expenditure savings</p>
          </div>

          {/* Priority 3: Carbon reduction */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Leaf className="w-3.5 h-3.5 text-cyan-400" /> Carbon Emissions
              </span>
              <span className="font-mono text-cyan-400 font-bold">{weightCo2}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="70"
              value={weightCo2}
              onChange={e => setWeightCo2(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-400 mt-1">Weight for avoiding peak carbon hours</p>
          </div>

          {/* Target Goal Slider */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-400" /> Conservation Target
              </span>
              <span className="font-mono text-amber-400 font-bold">{targetSavingsPct}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              value={targetSavingsPct}
              onChange={e => setTargetSavingsPct(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-400 mt-1">Monthly target reduction percentage</p>
          </div>
        </div>
      </div>

      {/* Dynamically Ranked Recommendations Feed */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>Optimized Energy-Saving Interventions</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                Pareto Ranked
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Ranked dynamically according to your custom multi-objective priority weights
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {recommendations.map(rec => (
            <div
              key={rec.id}
              className="p-5 rounded-xl border border-slate-800 bg-slate-950/50 hover:border-emerald-500/30 transition-all text-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono text-xs">
                    #{rec.rank}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-white">{rec.title}</h4>
                    <span className="text-[11px] text-slate-400 font-medium">{rec.action_category}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                      rec.priority === 'High'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {rec.priority} Priority
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                    Score: {rec.objective_score}/100
                  </span>
                </div>
              </div>

              {/* Projected Benefits Triad */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3 p-3 bg-slate-900/60 rounded-lg border border-slate-800/80 font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Projected Energy Saved:</span>
                  <span className="text-sm font-bold text-emerald-400">
                    {rec.projected_savings_kwh} kWh <span className="text-[10px] text-slate-400 font-normal">/ month</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Estimated Cost Savings:</span>
                  <span className="text-sm font-bold text-teal-400">
                    ${rec.estimated_cost_savings.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ month</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Estimated Carbon Reduction:</span>
                  <span className="text-sm font-bold text-cyan-400">
                    {rec.estimated_co2_reduction_kg.toFixed(2)} kg CO₂ <span className="text-[10px] text-slate-400 font-normal">/ month</span>
                  </span>
                </div>
              </div>

              {/* Rationale and Supporting Observation */}
              <div className="space-y-1.5 text-slate-300 text-xs">
                <div>
                  <strong className="text-slate-400 text-[11px]">Supporting Observation: </strong>
                  <span>{rec.underlying_observation}</span>
                </div>
                <div>
                  <strong className="text-slate-400 text-[11px]">Optimization Rationale: </strong>
                  <span>{rec.rationale}</span>
                </div>
                <div>
                  <strong className="text-slate-400 text-[11px]">Defensible Assumptions: </strong>
                  <span className="text-slate-400">{rec.defensible_assumptions}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
