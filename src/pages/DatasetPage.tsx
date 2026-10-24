import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Database,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  Sparkles,
  Info,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import {
  fetchDatasetPreview,
  fetchDatasetQuality,
  uploadDataset,
  generateSynthetic,
  selectUciDataset,
  fetchDatasets,
} from '../services/api';
import { DataQualityReport, DatasetMeta } from '../types';

interface DatasetPageProps {
  currentDatasetId: string;
  onDatasetChange: (id: string, name: string, type: string) => void;
}

export const DatasetPage: React.FC<DatasetPageProps> = ({
  currentDatasetId,
  onDatasetChange,
}) => {
  const [quality, setQuality] = useState<DataQualityReport | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [syntheticDays, setSyntheticDays] = useState(30);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDatasetDetails();
  }, [currentDatasetId, page]);

  async function loadDatasetDetails() {
    setLoading(true);
    try {
      const [qRes, pRes] = await Promise.all([
        fetchDatasetQuality(currentDatasetId),
        fetchDatasetPreview(currentDatasetId, page, 25),
      ]);
      setQuality(qRes.quality);
      setPreviewRows(pRes.rows);
      setTotalRows(pRes.total_rows);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const text = event.target?.result as string;
        const res = await uploadDataset(text, file.name);
        setUploadSuccess(`Successfully ingested "${file.name}". ${res.message}`);
        onDatasetChange(res.dataset_id, res.name, 'uploaded');
        setPage(1);
      } catch (err: any) {
        setUploadError(err.message || 'Failed to parse uploaded dataset.');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  }

  async function handleSelectUCI() {
    setLoading(true);
    setUploadError(null);
    try {
      const res = await selectUciDataset();
      onDatasetChange(res.dataset_id, res.name, 'uci');
      setUploadSuccess('Active dataset switched to UCI Household Power Consumption benchmark.');
      setPage(1);
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateSynthetic() {
    setLoading(true);
    setUploadError(null);
    try {
      const res = await generateSynthetic(syntheticDays);
      onDatasetChange(res.dataset_id, res.name, 'synthetic');
      setUploadSuccess(`Generated ${syntheticDays}-day synthetic dataset with simulated diurnal load patterns and controlled anomalies.`);
      setPage(1);
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Dataset Sources Choice Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Source 1: Official UCI Dataset */}
        <div className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-5 flex flex-col justify-between transition-all">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-emerald-400 font-mono">OPTION A</span>
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">UCI Household Power Consumption</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Official benchmark dataset from UCI ML Repository. Semicolon-delimited, handles '?' missing values, parses DD/MM/YYYY, converts active power (kW) to energy (kWh).
            </p>
          </div>
          <button
            onClick={handleSelectUCI}
            className="mt-4 w-full py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-medium transition-colors"
          >
            Load UCI Historical Benchmark
          </button>
        </div>

        {/* Source 2: Synthetic Demo Generator */}
        <div className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-5 flex flex-col justify-between transition-all">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-teal-400 font-mono">OPTION B</span>
              <Sparkles className="w-4 h-4 text-teal-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Synthetic Household Generator</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Simulates realistic diurnal patterns (refrigeration base, breakfast/dinner peaks, weekend shifts, and 6 controlled anomalies). Labeled as synthetic demonstration.
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <span>Duration:</span>
              <select
                value={syntheticDays}
                onChange={e => setSyntheticDays(Number(e.target.value))}
                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
              >
                <option value={14}>14 Days (336 hrs)</option>
                <option value={30}>30 Days (720 hrs)</option>
                <option value={60}>60 Days (1440 hrs)</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleGenerateSynthetic}
            className="mt-4 w-full py-2 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-300 rounded-lg text-xs font-medium transition-colors"
          >
            Generate Synthetic Dataset
          </button>
        </div>

        {/* Source 3: Custom CSV Upload */}
        <div className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-5 flex flex-col justify-between transition-all">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-cyan-400 font-mono">OPTION C</span>
              <Upload className="w-4 h-4 text-cyan-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Upload Custom CSV</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Supports UCI format or normalized CSV with timestamp and active power / energy columns. Auto-detects delimiter and comma/dot decimals.
            </p>
          </div>
          <label className="mt-4 w-full py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 rounded-lg text-xs font-medium transition-colors text-center cursor-pointer block">
            {uploading ? 'Validating...' : 'Select CSV File to Ingest'}
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>

      {/* Upload Feedback Messages */}
      {uploadSuccess && (
        <div className="p-3 bg-emerald-950/30 border border-emerald-800/50 rounded-lg flex items-center gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{uploadSuccess}</span>
        </div>
      )}
      {uploadError && (
        <div className="p-3 bg-red-950/30 border border-red-800/50 rounded-lg flex items-center gap-2 text-xs text-red-300">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Data Quality & Ingestion Report */}
      {quality && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Dataset Quality & Ingestion Report</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  Status: Validated
                </span>
              </h3>
              <p className="text-xs text-slate-400">Statistical validation and preprocessing decisions</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
              <span className="text-[11px] text-slate-400">Total Raw Rows</span>
              <div className="text-sm font-bold text-white font-mono mt-0.5">
                {quality.total_raw_rows.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
              <span className="text-[11px] text-slate-400">Valid Ingested</span>
              <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                {quality.valid_rows.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
              <span className="text-[11px] text-slate-400">Missing '?' Rows</span>
              <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">
                {quality.missing_values_count}
              </div>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
              <span className="text-[11px] text-slate-400">Duplicates Filtered</span>
              <div className="text-sm font-bold text-slate-300 font-mono mt-0.5">
                {quality.duplicate_timestamps_found}
              </div>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
              <span className="text-[11px] text-slate-400">Sampling Interval</span>
              <div className="text-sm font-bold text-cyan-400 font-mono mt-0.5">
                {quality.sampling_interval_minutes} mins
              </div>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
              <span className="text-[11px] text-slate-400">Total Energy</span>
              <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                {quality.total_energy_kwh.toLocaleString()} kWh
              </div>
            </div>
          </div>

          {/* Documented Assumptions Box */}
          <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800/70 text-xs space-y-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
              <Info className="w-3.5 h-3.5 text-emerald-400" />
              Documented Preprocessing Assumptions:
            </span>
            {quality.assumptions.map((assump, idx) => (
              <div key={idx} className="flex items-start gap-2 text-slate-400">
                <span className="text-emerald-500 font-mono text-[11px]">•</span>
                <span>{assump}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Paginated Preview Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Ingested Observation Records</h3>
            <p className="text-xs text-slate-400">
              Showing page {page} ({previewRows.length} rows of {totalRows.toLocaleString()})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 bg-slate-850 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 rounded text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-slate-400 px-2">Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page * 25 >= totalRows}
              className="p-1.5 bg-slate-850 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 rounded text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Timestamp (UTC)</th>
                <th className="py-2.5 px-3">Global Active Power (kW)</th>
                <th className="py-2.5 px-3">Energy (kWh)</th>
                <th className="py-2.5 px-3">Voltage (V)</th>
                <th className="py-2.5 px-3">Intensity (A)</th>
                <th className="py-2.5 px-3">Sub Meter 1</th>
                <th className="py-2.5 px-3">Sub Meter 2</th>
                <th className="py-2.5 px-3">Sub Meter 3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {previewRows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 px-3 text-slate-400">{r.timestamp}</td>
                  <td className="py-2 px-3 font-semibold text-emerald-400">{r.global_active_power.toFixed(3)}</td>
                  <td className="py-2 px-3 text-white">{r.energy_kwh.toFixed(3)}</td>
                  <td className="py-2 px-3 text-slate-400">{r.voltage ?? '—'}</td>
                  <td className="py-2 px-3 text-slate-400">{r.global_intensity ?? '—'}</td>
                  <td className="py-2 px-3 text-slate-400">{r.sub_metering_1 ?? '0.0'}</td>
                  <td className="py-2 px-3 text-slate-400">{r.sub_metering_2 ?? '0.0'}</td>
                  <td className="py-2 px-3 text-slate-400">{r.sub_metering_3 ?? '0.0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
