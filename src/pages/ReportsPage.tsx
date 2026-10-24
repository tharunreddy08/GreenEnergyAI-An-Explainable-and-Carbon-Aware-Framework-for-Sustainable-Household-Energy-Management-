import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Shield,
  Layers,
  Database,
  Info,
  DollarSign,
  TrendingUp,
  Sliders,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  generateReport,
  fetchConsumptionSeries,
  fetchBillProjection,
} from '../services/api';
import { BillProjectionResult } from '../types';

interface ReportsPageProps {
  datasetId: string;
  tariff: number;
  emissionFactor: number;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  datasetId,
  tariff,
  emissionFactor,
}) => {
  // Budget & Projection state
  const [budget, setBudget] = useState<number>(120.0);
  const [localTariff, setLocalTariff] = useState<number>(tariff);
  const [trendMode, setTrendMode] = useState<'weighted_momentum' | 'uniform_average'>('weighted_momentum');
  const [projection, setProjection] = useState<BillProjectionResult | null>(null);
  const [loadingProjection, setLoadingProjection] = useState(false);

  // Report generation state
  const [generating, setGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    loadBillProjection();
  }, [datasetId, budget, localTariff, trendMode]);

  async function loadBillProjection() {
    setLoadingProjection(true);
    try {
      const res = await fetchBillProjection({
        dataset_id: datasetId,
        budget,
        tariff: localTariff,
        days_in_cycle: 30,
        trend_mode: trendMode,
      });
      setProjection(res);
    } catch (err: any) {
      console.error('Failed to load bill projection:', err);
    } finally {
      setLoadingProjection(false);
    }
  }

  async function handleGenerateReport() {
    setGenerating(true);
    setStatusMsg(null);
    try {
      const res = await generateReport(datasetId, budget, localTariff);
      setGeneratedReport(res.report);
      setStatusMsg('Consolidated Technical Audit Report successfully assembled.');
    } catch (err: any) {
      console.error(err);
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }

  function downloadReportJSON() {
    if (!generatedReport) return;
    const blob = new Blob([JSON.stringify(generatedReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GreenEnergyAI_Audit_Report_${datasetId}.json`;
    a.click();
  }

  async function downloadConsumptionCSV() {
    try {
      const data = await fetchConsumptionSeries(datasetId, 500);
      const headers = 'Timestamp,Global_Active_Power_kW,Energy_kWh,Voltage_V,Sub_Meter_1,Sub_Meter_2,Sub_Meter_3\n';
      const rows = data.series
        .map(
          r =>
            `"${r.timestamp}",${r.global_active_power},${r.energy_kwh},${r.voltage || ''},${r.sub_metering_1 || ''},${r.sub_metering_2 || ''},${r.sub_metering_3 || ''}`
        )
        .join('\n');
      const blob = new Blob([headers + rows], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consumption_series_${datasetId}.csv`;
      a.click();
    } catch (e: any) {
      alert(`Export error: ${e.message}`);
    }
  }

  const budgetPresets = [80, 100, 120, 150, 200];

  return (
    <div className="space-y-6">
      {/* Scope Disclaimer */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-400">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-200">Reproducible Audit Reports & Predictive Billing:</strong> End-of-month projections extrapolate measured historical consumption momentum against the user's defined tariff and budget. All calculations use transparent formulas; no hardware sensors or third-party utility APIs are required.
        </div>
      </div>

      {/* FEATURE 1: END-OF-MONTH ELECTRICITY BILL PROJECTION & BUDGET ALERT */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>End-of-Month Electricity Bill Projection & Budget Alert</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Predictive Billing Module
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Extrapolates full 30-day billing cycle expenditure based on current consumption trends with automatic threshold warning alerts.
            </p>
          </div>
        </div>

        {/* Configuration Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Defined Monthly Budget ($) */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Defined Monthly Budget</span>
              <span className="font-mono text-emerald-400 font-bold text-sm">${budget.toFixed(2)}</span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-slate-500 font-mono">$</span>
              <input
                type="number"
                step="5"
                min="20"
                max="1000"
                value={budget}
                onChange={e => setBudget(Math.max(1, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white font-mono focus:border-emerald-500 outline-none"
              />
            </div>
            {/* Quick preset buttons */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-500">Presets:</span>
              {budgetPresets.map(val => (
                <button
                  key={val}
                  onClick={() => setBudget(val)}
                  className={`px-2 py-0.5 text-[10px] rounded font-mono transition-colors ${
                    budget === val
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  ${val}
                </button>
              ))}
            </div>
          </div>

          {/* Electricity Tariff ($/kWh) */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Electricity Tariff Rate</span>
              <span className="font-mono text-cyan-400 font-bold text-sm">${localTariff.toFixed(3)}/kWh</span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-slate-500 font-mono">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="1.50"
                value={localTariff}
                onChange={e => setLocalTariff(Math.max(0.01, parseFloat(e.target.value) || 0.18))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Unit rate applied to convert total projected kWh into billing cost.
            </p>
          </div>

          {/* Trend Extrapolation Mode */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Trend Extrapolation Model</span>
              <span className="text-[10px] font-mono text-slate-400">30-Day Cycle</span>
            </div>
            <div className="flex flex-col gap-1.5 pt-0.5">
              <button
                onClick={() => setTrendMode('weighted_momentum')}
                className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                  trendMode === 'weighted_momentum'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium'
                    : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>7-Day Momentum Weighted</span>
                <span className="text-[9px] font-mono opacity-80">(Recommended)</span>
              </button>
              <button
                onClick={() => setTrendMode('uniform_average')}
                className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                  trendMode === 'uniform_average'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium'
                    : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Historical Overall Average</span>
                <span className="text-[9px] font-mono opacity-80">(Uniform)</span>
              </button>
            </div>
          </div>
        </div>

        {/* PROMINENT VISUAL ALERT BANNER (CRITICAL / WARNING / SAFE) */}
        {projection && (
          <div>
            {projection.is_exceeded ? (
              <div
                className={`p-5 rounded-xl border relative overflow-hidden transition-all ${
                  projection.alert_severity === 'critical'
                    ? 'bg-red-950/25 border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                    : 'bg-amber-950/25 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        projection.alert_severity === 'critical'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      }`}
                    >
                      <AlertTriangle className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold tracking-wider uppercase font-mono px-2 py-0.5 rounded border ${
                            projection.alert_severity === 'critical'
                              ? 'text-red-300 bg-red-500/20 border-red-500/30'
                              : 'text-amber-300 bg-amber-500/20 border-amber-500/30'
                          }`}
                        >
                          {projection.alert_severity === 'critical'
                            ? 'CRITICAL BUDGET OVERRUN ALERT'
                            : 'BUDGET EXCEEDED WARNING ALERT'}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          +{projection.variance_percentage}% Over Budget
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-white mt-1.5">
                        Projected End-of-Month Bill: ${projection.projected_bill.toFixed(2)} vs Budget: ${projection.defined_budget.toFixed(2)}
                      </h4>

                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        At your current consumption pace of <strong className="text-white">{projection.current_daily_pace_kwh} kWh/day</strong>, your monthly electricity cost is estimated to exceed your defined budget of <strong className="text-white">${projection.defined_budget.toFixed(2)}</strong> by <strong className="text-red-400 font-mono">+${projection.budget_variance.toFixed(2)}</strong>.
                      </p>

                      {projection.breach_day && (
                        <div className="mt-2 text-xs font-mono text-amber-300 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            Budget Exhaustion Point: Your budget limit will be breached on approximately <strong>Day {projection.breach_day}</strong> of the 30-day billing cycle.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actionable Mitigation Box */}
                  <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-xs shrink-0 md:max-w-xs space-y-1">
                    <span className="text-[11px] font-semibold text-slate-300 block flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Required Mitigation Pace:
                    </span>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      To stay strictly within ${projection.defined_budget.toFixed(2)}, limit daily usage to:
                    </p>
                    <div className="text-sm font-bold text-emerald-400 font-mono pt-0.5">
                      ≤ {projection.target_max_daily_kwh} kWh/day{' '}
                      <span className="text-[10px] text-amber-400 font-normal">
                        (-{projection.required_reduction_pct}% reduction)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 bg-emerald-950/20 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold tracking-wider uppercase font-mono px-2 py-0.5 rounded border text-emerald-300 bg-emerald-500/20 border-emerald-500/30">
                        WITHIN DEFINED BUDGET
                      </span>
                      <span className="text-xs font-mono text-emerald-400 font-medium">
                        Surplus Cushion: ${Math.abs(projection.budget_variance).toFixed(2)}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-white mt-1">
                      Projected Bill: ${projection.projected_bill.toFixed(2)} / ${projection.defined_budget.toFixed(2)} Budget
                    </h4>
                    <p className="text-slate-300 text-[11px] mt-0.5">
                      Your current pace ({projection.current_daily_pace_kwh} kWh/day) keeps your projected electricity expenditure comfortably within your monthly threshold with a {Math.abs(projection.variance_percentage)}% buffer.
                    </p>
                  </div>
                </div>

                <div className="hidden sm:block text-right font-mono shrink-0">
                  <span className="text-[10px] text-slate-400 block font-sans">Projected Month Total:</span>
                  <span className="text-sm font-bold text-emerald-400">{projection.projected_total_kwh} kWh</span>
                </div>
              </div>
            )}

            {/* Visual Budget Consumption Progress Bar */}
            <div className="mt-4 p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400 font-sans">
                  Billing Extrapolation: <strong className="text-white">${projection.projected_bill.toFixed(2)}</strong> of <strong className="text-white">${projection.defined_budget.toFixed(2)}</strong> Budget
                </span>
                <span
                  className={`font-bold ${
                    projection.is_exceeded ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {((projection.projected_bill / projection.defined_budget) * 100).toFixed(1)}% of Budget
                </span>
              </div>

              {/* Multi-segment progress track */}
              <div className="relative w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                {/* Standard within-budget portion */}
                <div
                  className={`h-full transition-all duration-500 ${
                    projection.is_exceeded ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.min(100, (projection.projected_bill / projection.defined_budget) * 100)}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>$0.00</span>
                <span>$50%</span>
                <span className="text-slate-300 font-semibold">100% Target Limit (${projection.defined_budget.toFixed(0)})</span>
                {projection.is_exceeded && (
                  <span className="text-red-400 font-semibold">
                    Overrun (+${projection.budget_variance.toFixed(2)})
                  </span>
                )}
              </div>
            </div>

            {/* Projection Technical Telemetry Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Daily Consumption Pace</span>
                <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                  {projection.current_daily_pace_kwh} kWh/day
                </span>
                <span className="text-[10px] text-slate-500">
                  {projection.trend_mode === 'weighted_momentum' ? '7-day momentum' : 'Overall average'}
                </span>
              </div>

              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Projected 30-Day Energy</span>
                <span className="text-sm font-bold text-cyan-400 font-mono mt-0.5 block">
                  {projection.projected_total_kwh} kWh
                </span>
                <span className="text-[10px] text-slate-500">Pace × 30 days</span>
              </div>

              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Budget Ceiling Pace</span>
                <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">
                  {projection.target_max_daily_kwh} kWh/day
                </span>
                <span className="text-[10px] text-slate-500">Max pace to hit budget</span>
              </div>

              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">Variance vs Budget</span>
                <span
                  className={`text-sm font-bold font-mono mt-0.5 block ${
                    projection.is_exceeded ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {projection.is_exceeded ? '+' : ''}${projection.budget_variance.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-500">
                  {projection.is_exceeded ? 'Estimated Overrun' : 'Remaining Cushion'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FEATURE 2: CONSOLIDATED TECHNICAL AUDIT REPORT GENERATION */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Generate Official Technical Audit Report</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Compiles complete system audit including dataset provenance, machine learning metrics, carbon calculations, and the active billing budget projection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={downloadConsumptionCSV}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export Raw CSV
          </button>

          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="px-4 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Layers className="w-3.5 h-3.5" />
            {generating ? 'Assembling Report...' : 'Compile Audit Report'}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Rendered Audit Report Paper / Printable Viewer */}
      {generatedReport && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-8 space-y-6 text-xs text-slate-300 print:bg-white print:text-black">
          {/* Header of Report */}
          <div className="border-b border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                OFFICIAL TECHNICAL AUDIT
              </span>
              <h2 className="text-base font-bold text-white mt-1.5">
                {generatedReport.project}
              </h2>
              <p className="text-[11px] text-slate-400">
                Generated: {new Date(generatedReport.generated_at).toLocaleString()} · Report ID: {generatedReport.report_id}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={downloadReportJSON}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Download JSON
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> Print / Save PDF
              </button>
            </div>
          </div>

          {/* Section 1: Ingested Dataset Provenance */}
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-100 uppercase tracking-wider text-[11px]">
              1. Dataset Provenance & Ingestion Metrics
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">Dataset Name:</span>
                <span className="text-white font-medium">{generatedReport.dataset.name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">Source Type:</span>
                <span className="text-emerald-400">{generatedReport.dataset.source_type}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">Rows Ingested:</span>
                <span className="text-white">{generatedReport.dataset.rows_analyzed.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">Total Energy:</span>
                <span className="text-emerald-400">{generatedReport.dataset.total_energy_kwh} kWh</span>
              </div>
            </div>
          </div>

          {/* Section 2: Machine Learning Evaluation */}
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-100 uppercase tracking-wider text-[11px]">
              2. Machine Learning Architecture & Validation
            </h4>
            <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">Forecasting Algorithm:</span>
                <span className="text-emerald-400 font-semibold">{generatedReport.ml_models.forecasting.algorithm}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">Anomaly Detection:</span>
                <span className="text-teal-400 font-semibold">{generatedReport.ml_models.anomaly_detection.algorithm}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">Explainable AI:</span>
                <span className="text-cyan-400 font-semibold">{generatedReport.ml_models.explainability.methods.join(', ')}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Carbon Footprint Summary */}
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-100 uppercase tracking-wider text-[11px]">
              3. Carbon Footprint & Environmental Impact
            </h4>
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 font-mono flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">Operational Emission Factor:</span>
                <span className="text-white">{generatedReport.environmental_impact.emission_factor}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">Total Estimated Carbon:</span>
                <span className="text-emerald-400 font-bold text-sm">{generatedReport.environmental_impact.estimated_co2_kg} kg CO₂</span>
              </div>
            </div>
          </div>

          {/* Section 4: End-of-Month Billing Projection & Budget Adherence */}
          {generatedReport.billing_projection && (
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-100 uppercase tracking-wider text-[11px]">
                4. End-of-Month Billing Projection & Budget Audit
              </h4>
              <div
                className={`p-4 rounded-lg border font-mono space-y-2 ${
                  generatedReport.billing_projection.is_exceeded
                    ? 'bg-red-950/20 border-red-500/40'
                    : 'bg-emerald-950/20 border-emerald-500/40'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-400 font-sans text-[11px]">Defined Budget:</span>{' '}
                    <strong className="text-white">${generatedReport.billing_projection.defined_budget.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-sans text-[11px]">Projected End-of-Month Bill:</span>{' '}
                    <strong
                      className={
                        generatedReport.billing_projection.is_exceeded ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'
                      }
                    >
                      ${generatedReport.billing_projection.projected_bill.toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-sans text-[11px]">Audit Status:</span>{' '}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        generatedReport.billing_projection.is_exceeded
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {generatedReport.billing_projection.status}
                    </span>
                  </div>
                </div>

                <p className="text-slate-300 font-sans text-xs pt-1 border-t border-slate-800/60">
                  {generatedReport.billing_projection.alert_message}
                </p>
              </div>
            </div>
          )}

          {/* Section 5: Documented Academic Scope & Known Limitations */}
          <div className="space-y-2 border-t border-slate-800 pt-4">
            <h4 className="font-semibold text-slate-100 uppercase tracking-wider text-[11px]">
              5. Documented Scope & Known Limitations
            </h4>
            <ul className="space-y-1 text-slate-400 text-xs">
              {generatedReport.limitations.map((lim: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-400">•</span>
                  <span>{lim}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
