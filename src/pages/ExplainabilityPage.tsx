import React, { useState, useEffect } from 'react';
import {
  Lightbulb,
  Info,
  HelpCircle,
  TrendingUp,
  BarChart2,
  ListOrdered,
  ArrowRight,
  Shield,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { fetchGlobalShap, fetchLocalExplanation } from '../services/api';
import { ShapExplanation, LimeExplanation } from '../types';

interface ExplainabilityPageProps {
  datasetId: string;
}

export const ExplainabilityPage: React.FC<ExplainabilityPageProps> = ({ datasetId }) => {
  const [globalImportance, setGlobalImportance] = useState<any[]>([]);
  const [localShap, setLocalShap] = useState<ShapExplanation | null>(null);
  const [localLime, setLocalLime] = useState<LimeExplanation | null>(null);
  const [plainInterpretation, setPlainInterpretation] = useState('');
  const [selectedTimestamp, setSelectedTimestamp] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExplanations();
  }, [datasetId]);

  async function loadExplanations() {
    setLoading(true);
    try {
      const [gRes, lRes] = await Promise.all([
        fetchGlobalShap(datasetId),
        fetchLocalExplanation(datasetId),
      ]);
      setGlobalImportance(gRes.global_importance);
      setLocalShap(lRes.shap);
      setLocalLime(lRes.lime);
      setPlainInterpretation(lRes.plain_language_interpretation);
      setSelectedTimestamp(lRes.timestamp);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Waterfall Chart data preparation
  const waterfallData = localShap
    ? localShap.features.map(f => ({
        name: f.displayName,
        val: f.shap_value,
        isPositive: f.shap_value >= 0,
        actualVal: f.value,
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Scope and Anti-Causality Warning Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-400">
        <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-200">Interpretability vs Causality Distinction:</strong> SHAP and LIME explain the mathematical decision surface of the XGBoost regression tree ensemble. A positive feature contribution indicates that this input pushed the numerical prediction upward; it does not constitute physical causal proof without controlled intervention experiments.
        </div>
      </div>

      {/* Global SHAP Feature Importance */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              <span>Global Feature Importance (TreeSHAP Mean Absolute Attribution)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Evaluates average impact magnitude |E[φ]| of each engineered feature across background instances
            </p>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
            Overall Model Architecture
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={globalImportance}
              margin={{ top: 10, right: 30, left: 120, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis
                type="category"
                dataKey="displayName"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                width={120}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                formatter={(val: any) => [`${val} kWh`, 'Mean |SHAP|']}
              />
              <Bar dataKey="mean_abs_shap" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Local Instance Explanation Section (SHAP Waterfall + LIME Rules) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Local SHAP Waterfall Contributions */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <span>Local Instance SHAP Breakdown</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Target Timestamp: <span className="font-mono text-slate-300">{selectedTimestamp}</span>
                </p>
              </div>
            </div>

            {localShap && (
              <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 mb-4 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">Base Expected Value:</span>
                  <div className="font-mono font-bold text-slate-200 mt-0.5">{localShap.base_value} kWh</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600" />
                <div>
                  <span className="text-slate-400">Feature Pushes (Σ φ):</span>
                  <div className="font-mono font-bold text-emerald-400 mt-0.5">
                    {(localShap.prediction - localShap.base_value > 0 ? '+' : '')}
                    {(localShap.prediction - localShap.base_value).toFixed(3)} kWh
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600" />
                <div>
                  <span className="text-slate-400">Final Model Prediction:</span>
                  <div className="font-mono font-bold text-white mt-0.5">{localShap.prediction} kWh</div>
                </div>
              </div>
            )}

            <div className="space-y-2 mt-2">
              {waterfallData.map((item, idx) => {
                const isPos = item.isPositive;
                return (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-950/50 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-medium text-slate-200 truncate">{item.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Value: {item.actualVal}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`font-mono font-bold ${
                          isPos ? 'text-emerald-400' : 'text-cyan-400'
                        }`}
                      >
                        {isPos ? '+' : ''}
                        {item.val.toFixed(4)} kWh
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
            Green bars indicate upward pressure; cyan bars indicate downward pressure on the forecast.
          </div>
        </div>

        {/* LIME Local Surrogate Rules */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-400" />
                  <span>LIME Local Interpretable Rules</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Sparse linear surrogate fitted to local perturbation space around this instance
                </p>
              </div>
              <span className="text-[10px] font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded">
                Surrogate Fit
              </span>
            </div>

            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 mb-4 text-xs text-slate-300 leading-relaxed">
              <strong className="text-white block mb-0.5">Plain-Language Decision Summary:</strong>
              {plainInterpretation}
            </div>

            <div className="space-y-2 mt-2">
              {localLime?.rules.map((rule, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-950/50 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="text-slate-200 font-medium">{rule.rule}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Effect: {rule.effect === 'increases_consumption' ? 'Increases demand' : 'Lowers demand'}
                    </span>
                  </div>
                  <span
                    className={`font-mono font-bold text-xs ${
                      rule.weight >= 0 ? 'text-emerald-400' : 'text-cyan-400'
                    }`}
                  >
                    {rule.weight >= 0 ? '+' : ''}
                    {rule.weight.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
            LIME perturbs input features with exponential kernel weighting to derive local linear explanation.
          </div>
        </div>
      </div>
    </div>
  );
};
