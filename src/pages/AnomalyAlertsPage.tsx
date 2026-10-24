import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Sliders,
  ShieldAlert,
  Info,
  CheckCircle2,
  ChevronRight,
  Download,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { detectAnomalies, fetchUncertaintyAlerts } from '../services/api';
import { AnomalyPoint, UncertaintyAlert } from '../types';

interface AnomalyAlertsPageProps {
  datasetId: string;
}

export const AnomalyAlertsPage: React.FC<AnomalyAlertsPageProps> = ({ datasetId }) => {
  const [contamination, setContamination] = useState(0.05);
  const [loading, setLoading] = useState(true);
  const [anomalyPoints, setAnomalyPoints] = useState<AnomalyPoint[]>([]);
  const [flaggedOnly, setFlaggedOnly] = useState<AnomalyPoint[]>([]);
  const [alerts, setAlerts] = useState<UncertaintyAlert[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    loadAnomalyData();
  }, [datasetId, contamination]);

  async function loadAnomalyData() {
    setLoading(true);
    try {
      const [anomRes, alertRes] = await Promise.all([
        detectAnomalies(datasetId, contamination),
        fetchUncertaintyAlerts(datasetId),
      ]);
      setAnomalyPoints(anomRes.points);
      setFlaggedOnly(anomRes.flagged_anomalies);
      setAlerts(alertRes.alerts);
    } catch (err: any) {
      console.error(err);
      setStatusMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Filter alerts based on severity
  const filteredAlerts = alerts.filter(a => {
    if (filterSeverity === 'all') return true;
    return a.severity === filterSeverity;
  });

  // Chart data preparing: timeline of observed load with anomaly markers
  const timelineData = anomalyPoints.map(pt => ({
    time: new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    observed: pt.observed_kwh,
    anomaly: pt.is_anomaly ? pt.observed_kwh : null,
    score: pt.anomaly_score,
  }));

  function exportAnomaliesCSV() {
    const headers = 'Timestamp,Observed_kWh,Anomaly_Score,Severity,Explanation\n';
    const rows = alerts
      .map(
        a =>
          `"${a.timestamp}",${a.observed_kwh},${a.anomaly_score},"${a.severity_label}","${a.plain_language_explanation.replace(/"/g, '""')}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uncertainty_alerts_${datasetId}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      {/* Scope Disclaimer Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-400">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-200">Uncertainty-Aware Energy Alerts (Innovation Module 2):</strong> Statistical anomaly detection identifies unusual patterns relative to expected diurnal distributions. It does not treat forecasting variance as proof of an anomaly, nor does it claim to identify appliance-level equipment faults without dedicated circuit hardware.
        </div>
      </div>

      {/* Control Header & Parameters */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Isolation Forest Anomaly Calibration</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Tune tree ensemble contamination rate to adjust sensitivity to statistical consumption deviations.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400">Contamination:</span>
            <input
              type="range"
              min="0.01"
              max="0.12"
              step="0.01"
              value={contamination}
              onChange={e => setContamination(parseFloat(e.target.value))}
              className="w-24 accent-amber-500 cursor-pointer"
            />
            <span className="font-mono text-amber-400 font-bold">{(contamination * 100).toFixed(0)}%</span>
          </div>

          <button
            onClick={exportAnomaliesCSV}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400">Total Flagged Records</span>
          <div className="text-xl font-bold text-amber-400 font-mono mt-1">{flaggedOnly.length}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Points scoring above threshold</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400">High Confidence Anomalies</span>
          <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
            {alerts.filter(a => a.severity === 'low_uncertainty_anomaly').length}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Low forecast uncertainty envelope</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400">Potential High-Uncertainty Deviations</span>
          <div className="text-xl font-bold text-cyan-400 font-mono mt-1">
            {alerts.filter(a => a.severity === 'high_uncertainty_deviation').length}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Wide forecast prediction interval</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400">Severe Extreme Outliers</span>
          <div className="text-xl font-bold text-red-400 font-mono mt-1">
            {alerts.filter(a => a.severity === 'severe_outlier').length}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Deviation &gt; 3.0σ from baseline</p>
        </div>
      </div>

      {/* Anomaly Timeline Chart */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Consumption Timeline with Anomaly Flags</h3>
            <p className="text-xs text-slate-400">Recent sequence with statistical outliers marked in amber</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Regular Load
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Flagged Outlier
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timelineData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
              />
              <Line type="monotone" dataKey="observed" stroke="#10b981" strokeWidth={1.5} dot={false} name="Load (kWh)" />
              <Line
                type="monotone"
                dataKey="anomaly"
                stroke="#f59e0b"
                strokeWidth={0}
                dot={{ r: 5, fill: '#f59e0b', strokeWidth: 1, stroke: '#ffffff' }}
                name="Flagged Anomaly"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Uncertainty-Aware Energy Alerts Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>Uncertainty-Calibrated Alert Digest</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                Ranked Feed
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Correlates statistical anomaly score with forecast prediction uncertainty intervals
            </p>
          </div>

          {/* Severity filter selector */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterSeverity}
              onChange={e => setFilterSeverity(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200"
            >
              <option value="all">All Severities</option>
              <option value="low_uncertainty_anomaly">High Confidence (Low Uncertainty)</option>
              <option value="high_uncertainty_deviation">Potential (High Uncertainty)</option>
              <option value="severe_outlier">Severe Outlier</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {filteredAlerts.map((alert, idx) => {
            const isSevere = alert.severity === 'severe_outlier';
            const isHighConf = alert.severity === 'low_uncertainty_anomaly';
            const borderCol = isSevere
              ? 'border-red-500/40 bg-red-950/10'
              : isHighConf
              ? 'border-emerald-500/40 bg-emerald-950/10'
              : 'border-cyan-500/30 bg-cyan-950/10';

            const badgeCol = isSevere
              ? 'text-red-400 bg-red-500/10 border-red-500/20'
              : isHighConf
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';

            return (
              <div key={alert.id || idx} className={`p-4 rounded-xl border ${borderCol} transition-all text-xs`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${badgeCol}`}>
                      {alert.severity_label}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">{alert.timestamp}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-slate-400">
                      Observed: <strong className="text-white">{alert.observed_kwh} kWh</strong>
                    </span>
                    <span className="text-slate-400">
                      Interval: <strong className="text-slate-200">[{alert.uncertainty_interval[0]} - {alert.uncertainty_interval[1]} kWh]</strong>
                    </span>
                    <span className="text-slate-400">
                      Score: <strong className="text-amber-400">{alert.anomaly_score}</strong>
                    </span>
                  </div>
                </div>

                <p className="text-slate-300 text-xs leading-relaxed mt-1">
                  {alert.plain_language_explanation}
                </p>

                <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="font-medium text-slate-300">Suggested Action:</span>
                  <span>{alert.suggested_action}</span>
                </div>
              </div>
            );
          })}

          {filteredAlerts.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-500">
              No alerts match the selected severity category.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
