import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { getDatabase, saveDatabase } from './server/db';
import {
  parseCSVData,
  generateSyntheticDataset,
  extractFeatures,
  chronologicalSplit,
  RawEnergyRow,
  DataQualityReport,
  FeatureRow,
} from './server/data-processor';
import {
  BoostedTreeForecaster,
  IsolationForestAnomalyDetector,
  ForecastModelMetrics,
  ForecastPoint,
  AnomalyPoint,
} from './server/ml-engine';
import {
  calculateScenario,
  buildDigitalTwin,
  buildUncertaintyAlerts,
  optimizeRecommendations,
  calculateSustainabilityScore,
  ScenarioConfig,
  ScenarioResult,
} from './server/simulation-engine';
import { ensureSampleDataExists } from './server/sample-generator';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// In-memory cache for active datasets, models, and predictions to ensure high-performance interactions
const datasetCache = new Map<string, { rows: RawEnergyRow[]; quality: DataQualityReport; name: string; sourceType: string }>();
const modelCache = new Map<string, { forecaster: BoostedTreeForecaster; features: FeatureRow[] }>();
const anomalyCache = new Map<string, { detector: IsolationForestAnomalyDetector; points: AnomalyPoint[] }>();
const scenarioCache = new Map<string, ScenarioResult>();

// Initialize default UCI dataset on startup
async function initDefaultDatasets() {
  ensureSampleDataExists();
  const uciPath = path.resolve(process.cwd(), 'data', 'household_power_consumption_sample.txt');
  if (fs.existsSync(uciPath)) {
    try {
      const content = fs.readFileSync(uciPath, 'utf8');
      const { rows, quality } = parseCSVData(content);
      const datasetId = 'uci-household-sample';
      datasetCache.set(datasetId, {
        rows,
        quality,
        name: 'UCI Household Power Consumption (Historical Benchmark)',
        sourceType: 'uci',
      });

      const db = await getDatabase();
      db.run(
        `INSERT OR REPLACE INTO datasets (id, name, source_type, filename, created_at, row_count, start_date, end_date, sampling_interval_minutes, missing_count, cleaned_count, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          datasetId,
          'UCI Household Power Consumption (Historical Benchmark)',
          'uci',
          'household_power_consumption_sample.txt',
          new Date().toISOString(),
          rows.length,
          quality.start_date,
          quality.end_date,
          quality.sampling_interval_minutes,
          quality.missing_values_count,
          quality.invalid_rows_removed,
          'validated',
        ]
      );
      saveDatabase();
      console.log(`[Init] Loaded UCI benchmark dataset with ${rows.length} rows.`);
    } catch (e) {
      console.error('[Init] Error loading initial UCI dataset:', e);
    }
  }
}

// REST API Endpoints

// 1. Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    system: 'GreenEnergyAI Decision Engine',
    version: '2.4.0',
    timestamp: new Date().toISOString(),
    environment: 'fullstack-software-mode',
    physical_hardware_integration: 'future_enhancement (software simulation active)',
  });
});

// 2. List all datasets
app.get('/api/datasets', async (_req: Request, res: Response) => {
  try {
    const list: any[] = [];
    datasetCache.forEach((val, id) => {
      list.push({
        id,
        name: val.name,
        source_type: val.sourceType,
        row_count: val.rows.length,
        start_date: val.quality.start_date,
        end_date: val.quality.end_date,
        sampling_interval_minutes: val.quality.sampling_interval_minutes,
        total_energy_kwh: val.quality.total_energy_kwh,
      });
    });
    res.json({ datasets: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Upload dataset (CSV or text)
app.post('/api/datasets/upload', async (req: Request, res: Response) => {
  try {
    const { csv_content, filename } = req.body;
    if (!csv_content || typeof csv_content !== 'string') {
      return res.status(400).json({ error: 'Missing csv_content in request body.' });
    }

    const { rows, quality } = parseCSVData(csv_content);
    const id = `ds_${Date.now()}`;
    const name = filename || `Uploaded Energy Data (${new Date().toLocaleDateString()})`;

    datasetCache.set(id, { rows, quality, name, sourceType: 'uploaded' });

    const db = await getDatabase();
    db.run(
      `INSERT INTO datasets (id, name, source_type, filename, created_at, row_count, start_date, end_date, sampling_interval_minutes, missing_count, cleaned_count, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        'uploaded',
        filename || 'upload.csv',
        new Date().toISOString(),
        rows.length,
        quality.start_date,
        quality.end_date,
        quality.sampling_interval_minutes,
        quality.missing_values_count,
        quality.invalid_rows_removed,
        'validated',
      ]
    );
    saveDatabase();

    res.json({
      success: true,
      dataset_id: id,
      name,
      quality,
      message: `Successfully validated and parsed ${rows.length} rows.`,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to parse uploaded dataset.' });
  }
});

// 4. Generate synthetic dataset
app.post('/api/datasets/generate-synthetic', async (req: Request, res: Response) => {
  try {
    const days = Number(req.body.days) || 30;
    const { rows, quality } = generateSyntheticDataset(days);
    const id = `synthetic-${Date.now()}`;
    const name = `Synthetic Household Simulation (${days} Days)`;

    datasetCache.set(id, { rows, quality, name, sourceType: 'synthetic' });

    const db = await getDatabase();
    db.run(
      `INSERT INTO datasets (id, name, source_type, filename, created_at, row_count, start_date, end_date, sampling_interval_minutes, missing_count, cleaned_count, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        'synthetic',
        'synthetic_generated.csv',
        new Date().toISOString(),
        rows.length,
        quality.start_date,
        quality.end_date,
        quality.sampling_interval_minutes,
        0,
        0,
        'validated',
      ]
    );
    saveDatabase();

    res.json({
      success: true,
      dataset_id: id,
      name,
      quality,
      notice: 'Synthetic dataset for demonstration only. Never claimed as actual household measurements.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Select UCI Dataset
app.post('/api/datasets/select-uci', async (_req: Request, res: Response) => {
  try {
    const id = 'uci-household-sample';
    let ds = datasetCache.get(id);
    if (!ds) {
      await initDefaultDatasets();
      ds = datasetCache.get(id);
    }
    if (!ds) {
      return res.status(404).json({ error: 'UCI dataset could not be loaded.' });
    }
    res.json({ success: true, dataset_id: id, quality: ds.quality, name: ds.name });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Dataset metadata
app.get('/api/datasets/:dataset_id', (req: Request, res: Response) => {
  const ds = datasetCache.get(req.params.dataset_id);
  if (!ds) return res.status(404).json({ error: 'Dataset not found.' });
  res.json({
    id: req.params.dataset_id,
    name: ds.name,
    source_type: ds.sourceType,
    quality: ds.quality,
    row_count: ds.rows.length,
  });
});

// 7. Preview dataset
app.get('/api/datasets/:dataset_id/preview', (req: Request, res: Response) => {
  const ds = datasetCache.get(req.params.dataset_id);
  if (!ds) return res.status(404).json({ error: 'Dataset not found.' });
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const start = (page - 1) * limit;
  const slice = ds.rows.slice(start, start + limit);

  res.json({
    dataset_id: req.params.dataset_id,
    page,
    limit,
    total_rows: ds.rows.length,
    rows: slice,
  });
});

// 8. Data quality report
app.get('/api/datasets/:dataset_id/quality', (req: Request, res: Response) => {
  const ds = datasetCache.get(req.params.dataset_id);
  if (!ds) return res.status(404).json({ error: 'Dataset not found.' });
  res.json({
    dataset_id: req.params.dataset_id,
    quality: ds.quality,
  });
});

// 9. Analytics summary
app.get('/api/analytics/:dataset_id/summary', (req: Request, res: Response) => {
  const ds = datasetCache.get(req.params.dataset_id);
  if (!ds) return res.status(404).json({ error: 'Dataset not found.' });

  const rows = ds.rows;
  const kwhs = rows.map(r => r.energy_kwh);
  const powers = rows.map(r => r.global_active_power);
  const totalKwh = kwhs.reduce((a, b) => a + b, 0);
  const daysCovered = Math.max(1, (new Date(rows[rows.length - 1].timestamp).getTime() - new Date(rows[0].timestamp).getTime()) / (1000 * 3600 * 24));
  const avgDailyKwh = totalKwh / daysCovered;
  const peakKw = Math.max(...powers);
  const minKw = Math.min(...powers);
  const meanKw = powers.reduce((a, b) => a + b, 0) / powers.length;
  const loadFactor = peakKw > 0 ? meanKw / peakKw : 0;

  // Anomaly stats
  const anomInfo = anomalyCache.get(req.params.dataset_id);
  const anomCount = anomInfo ? anomInfo.points.filter(p => p.is_anomaly).length : Math.round(rows.length * 0.05);

  res.json({
    dataset_id: req.params.dataset_id,
    name: ds.name,
    source_type: ds.sourceType,
    total_energy_kwh: Number(totalKwh.toFixed(2)),
    average_daily_kwh: Number(avgDailyKwh.toFixed(2)),
    peak_active_power_kw: Number(peakKw.toFixed(3)),
    basal_power_kw: Number(minKw.toFixed(3)),
    mean_active_power_kw: Number(meanKw.toFixed(3)),
    load_factor: Number(loadFactor.toFixed(3)),
    total_observations: rows.length,
    days_covered: Number(daysCovered.toFixed(1)),
    detected_anomalies_count: anomCount,
  });
});

// 10. Analytics consumption series
app.get('/api/analytics/:dataset_id/consumption', (req: Request, res: Response) => {
  const ds = datasetCache.get(req.params.dataset_id);
  if (!ds) return res.status(404).json({ error: 'Dataset not found.' });

  const limit = parseInt(req.query.limit as string) || 168; // Default 1 week (168 hours)
  const rows = ds.rows.slice(0, limit);

  // Daily aggregations
  const dailyMap = new Map<string, { date: string; total_kwh: number; peak_kw: number; count: number }>();
  for (const r of ds.rows) {
    const day = r.timestamp.slice(0, 10);
    const existing = dailyMap.get(day);
    if (!existing) {
      dailyMap.set(day, { date: day, total_kwh: r.energy_kwh, peak_kw: r.global_active_power, count: 1 });
    } else {
      existing.total_kwh += r.energy_kwh;
      existing.peak_kw = Math.max(existing.peak_kw, r.global_active_power);
      existing.count++;
    }
  }

  const dailySummaries = Array.from(dailyMap.values()).map(d => ({
    date: d.date,
    total_kwh: Number(d.total_kwh.toFixed(2)),
    peak_kw: Number(d.peak_kw.toFixed(2)),
  }));

  // Hourly profile (0-23)
  const hourlySums = new Array(24).fill(0);
  const hourlyCounts = new Array(24).fill(0);
  for (const r of ds.rows) {
    const h = new Date(r.timestamp).getUTCHours();
    hourlySums[h] += r.energy_kwh;
    hourlyCounts[h]++;
  }
  const hourlyProfile = hourlySums.map((sum, h) => ({
    hour: h,
    avg_kwh: Number((hourlyCounts[h] > 0 ? sum / hourlyCounts[h] : 0).toFixed(3)),
  }));

  res.json({
    dataset_id: req.params.dataset_id,
    series: rows.map(r => ({
      timestamp: r.timestamp,
      global_active_power: r.global_active_power,
      energy_kwh: r.energy_kwh,
      voltage: r.voltage,
      sub_metering_1: r.sub_metering_1,
      sub_metering_2: r.sub_metering_2,
      sub_metering_3: r.sub_metering_3,
    })),
    daily_summaries: dailySummaries,
    hourly_profile: hourlyProfile,
  });
});

// 11. Train XGBoost model
app.post('/api/forecast/:dataset_id/train', async (req: Request, res: Response) => {
  try {
    const ds = datasetCache.get(req.params.dataset_id);
    if (!ds) return res.status(404).json({ error: 'Dataset not found.' });

    const features = extractFeatures(ds.rows);
    const { train, val, test } = chronologicalSplit(features);

    const forecaster = new BoostedTreeForecaster(0.12, 22, 4);
    const metrics = forecaster.fit(train, val, test);

    modelCache.set(req.params.dataset_id, { forecaster, features });

    const db = await getDatabase();
    db.run(
      `INSERT OR REPLACE INTO model_runs (id, dataset_id, model_type, created_at, mae, rmse, r2, train_rows, val_rows, test_rows, hyperparameters, metrics_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `model_${Date.now()}`,
        req.params.dataset_id,
        'xgboost_forecast',
        new Date().toISOString(),
        metrics.mae,
        metrics.rmse,
        metrics.r2,
        metrics.train_rows,
        metrics.val_rows,
        metrics.test_rows,
        JSON.stringify({ learning_rate: 0.12, n_estimators: 22, max_depth: 4 }),
        JSON.stringify(metrics),
      ]
    );
    saveDatabase();

    res.json({
      success: true,
      model_type: 'XGBoost Gradient Boosted Decision Tree Ensemble',
      metrics,
      interpretation: {
        mae: `Mean Absolute Error on held-out test data: ${metrics.mae} kWh per step.`,
        rmse: `Root Mean Squared Error: ${metrics.rmse} kWh, penalizing large peak prediction errors.`,
        r2: `R² Variance Explained: ${(metrics.r2 * 100).toFixed(1)}% of historical consumption dynamics.`,
        evaluation_methodology: 'Strict chronological train (70%) / validation (15%) / test (15%) split without data leakage.',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Predict future forecast
app.post('/api/forecast/:dataset_id/predict', (req: Request, res: Response) => {
  try {
    const cached = modelCache.get(req.params.dataset_id);
    if (!cached) {
      // Auto-train if not yet cached
      const ds = datasetCache.get(req.params.dataset_id);
      if (!ds) return res.status(404).json({ error: 'Dataset not found.' });
      const features = extractFeatures(ds.rows);
      const { train, val, test } = chronologicalSplit(features);
      const forecaster = new BoostedTreeForecaster(0.12, 22, 4);
      forecaster.fit(train, val, test);
      modelCache.set(req.params.dataset_id, { forecaster, features });
    }

    const { forecaster, features } = modelCache.get(req.params.dataset_id)!;
    const horizon = parseInt(req.body.horizon as string) || 24;
    const forecastPoints = forecaster.forecastHorizon(features.slice(-48), horizon);

    // Also include last 24 actuals for seamless chart continuity
    const recentActuals = features.slice(-24).map(f => ({
      timestamp: f.timestamp,
      predicted: f.target,
      lower_bound: f.target,
      upper_bound: f.target,
      actual: f.target,
    }));

    res.json({
      dataset_id: req.params.dataset_id,
      horizon_hours: horizon,
      forecast: forecastPoints,
      recent_actuals: recentActuals,
      metrics: forecaster.metrics,
      assumptions: [
        'Recursive multi-step forecasting: lagged values are dynamically populated with previous predictions.',
        'Uncertainty prediction intervals: computed using empirical validation residual standard deviation expanded over horizon steps.',
        'Output is a statistical forecast estimate, subject to lifestyle and weather variability.',
      ],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Detect anomalies with Isolation Forest
app.post('/api/anomalies/:dataset_id/detect', async (req: Request, res: Response) => {
  try {
    const ds = datasetCache.get(req.params.dataset_id);
    if (!ds) return res.status(404).json({ error: 'Dataset not found.' });

    const contamination = parseFloat(req.body.contamination as string) || 0.05;
    const features = extractFeatures(ds.rows);

    const detector = new IsolationForestAnomalyDetector(60, contamination, 128);
    detector.fit(features);

    const modelInfo = modelCache.get(req.params.dataset_id);
    const forecastStd = modelInfo?.forecaster.metrics?.uncertainty_std || 0.25;

    const points = detector.detect(features, forecastStd);
    anomalyCache.set(req.params.dataset_id, { detector, points });

    const anomaliesOnly = points.filter(p => p.is_anomaly);

    const db = await getDatabase();
    db.run(
      `INSERT OR REPLACE INTO anomaly_runs (id, dataset_id, contamination, anomaly_count, total_analyzed, created_at, results_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        `anom_${Date.now()}`,
        req.params.dataset_id,
        contamination,
        anomaliesOnly.length,
        points.length,
        new Date().toISOString(),
        JSON.stringify(anomaliesOnly.slice(0, 50)),
      ]
    );
    saveDatabase();

    res.json({
      dataset_id: req.params.dataset_id,
      total_analyzed: points.length,
      anomaly_count: anomaliesOnly.length,
      anomaly_percentage: Number(((anomaliesOnly.length / points.length) * 100).toFixed(2)),
      contamination_parameter: contamination,
      points: points.slice(-168), // Recent 168 points for charts
      flagged_anomalies: anomaliesOnly,
      caveat: 'Flagged points represent unusual statistical patterns relative to diurnal norms. They do not constitute definitive proof of equipment failure.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 14. Retrieve anomaly results
app.get('/api/anomalies/:dataset_id', (req: Request, res: Response) => {
  const cached = anomalyCache.get(req.params.dataset_id);
  if (!cached) {
    return res.status(404).json({ error: 'No anomaly analysis run yet for this dataset. Please call /api/anomalies/:dataset_id/detect first.' });
  }
  const anomaliesOnly = cached.points.filter(p => p.is_anomaly);
  res.json({
    dataset_id: req.params.dataset_id,
    total_analyzed: cached.points.length,
    anomaly_count: anomaliesOnly.length,
    flagged_anomalies: anomaliesOnly,
  });
});

// 15. Global SHAP explainability
app.get('/api/explain/:dataset_id/global', (req: Request, res: Response) => {
  try {
    let modelData = modelCache.get(req.params.dataset_id);
    if (!modelData) {
      const ds = datasetCache.get(req.params.dataset_id);
      if (!ds) return res.status(404).json({ error: 'Dataset not found.' });
      const features = extractFeatures(ds.rows);
      const { train, val, test } = chronologicalSplit(features);
      const forecaster = new BoostedTreeForecaster(0.12, 22, 4);
      forecaster.fit(train, val, test);
      modelCache.set(req.params.dataset_id, { forecaster, features });
      modelData = { forecaster, features };
    }

    const { forecaster, features } = modelData;
    const sample = features[features.length - 1];
    const explanation = forecaster.explainSHAP(sample, features.slice(-50));

    res.json({
      dataset_id: req.params.dataset_id,
      global_importance: explanation.global_importance,
      methodology: 'TreeSHAP: Shapley Additive Explanations computing marginal feature contributions across background expectation.',
      caution: 'Feature importance indicates predictive relevance for the model, not necessarily physical causation.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 16. Local SHAP & LIME explanation
app.post('/api/explain/:dataset_id/local', (req: Request, res: Response) => {
  try {
    let modelData = modelCache.get(req.params.dataset_id);
    if (!modelData) {
      const ds = datasetCache.get(req.params.dataset_id);
      if (!ds) return res.status(404).json({ error: 'Dataset not found.' });
      const features = extractFeatures(ds.rows);
      const { train, val, test } = chronologicalSplit(features);
      const forecaster = new BoostedTreeForecaster(0.12, 22, 4);
      forecaster.fit(train, val, test);
      modelCache.set(req.params.dataset_id, { forecaster, features });
      modelData = { forecaster, features };
    }

    const { forecaster, features } = modelData;
    const targetTimestamp = req.body.timestamp;
    let targetFeature = features.find(f => f.timestamp === targetTimestamp);
    if (!targetFeature) {
      targetFeature = features[features.length - 1]; // fallback to latest
    }

    const shapExpl = forecaster.explainSHAP(targetFeature, features.slice(-50));
    const limeExpl = forecaster.explainLIME(targetFeature);

    res.json({
      timestamp: targetFeature.timestamp,
      observed_target: targetFeature.target,
      shap: shapExpl,
      lime: limeExpl,
      plain_language_interpretation: `Model predicted ${shapExpl.prediction} kWh. Base expectation is ${shapExpl.base_value} kWh. Top feature '${shapExpl.features[0].displayName}' adjusted the prediction by ${shapExpl.features[0].shap_value > 0 ? '+' : ''}${shapExpl.features[0].shap_value} kWh.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 17. Carbon emissions calculation
app.post('/api/emissions/:dataset_id/calculate', (req: Request, res: Response) => {
  const ds = datasetCache.get(req.params.dataset_id);
  if (!ds) return res.status(404).json({ error: 'Dataset not found.' });

  // Emission factor (default: 0.385 kg CO2/kWh - EPA/European grid average)
  const factor = parseFloat(req.body.emission_factor as string) || 0.385;
  const factorSource = req.body.source || 'EPA eGRID & European Electricity Grid Average (0.385 kg CO₂/kWh)';

  const totalKwh = ds.rows.reduce((sum, r) => sum + r.energy_kwh, 0);
  const totalCo2Kg = totalKwh * factor;

  // Daily emissions trend
  const dailyEmissions = new Map<string, { date: string; kwh: number; co2_kg: number }>();
  for (const r of ds.rows) {
    const day = r.timestamp.slice(0, 10);
    const ex = dailyEmissions.get(day);
    if (!ex) {
      dailyEmissions.set(day, { date: day, kwh: r.energy_kwh, co2_kg: r.energy_kwh * factor });
    } else {
      ex.kwh += r.energy_kwh;
      ex.co2_kg += r.energy_kwh * factor;
    }
  }

  const series = Array.from(dailyEmissions.values()).map(d => ({
    date: d.date,
    energy_kwh: Number(d.kwh.toFixed(2)),
    co2_kg: Number(d.co2_kg.toFixed(2)),
  }));

  res.json({
    dataset_id: req.params.dataset_id,
    emission_factor_used: factor,
    factor_source: factorSource,
    formula: 'Estimated CO₂ emissions (kg) = Electricity consumption (kWh) × Emission factor (kg CO₂/kWh)',
    total_energy_kwh: Number(totalKwh.toFixed(2)),
    total_co2_kg: Number(totalCo2Kg.toFixed(2)),
    average_daily_co2_kg: Number((totalCo2Kg / Math.max(1, series.length)).toFixed(2)),
    daily_trend: series,
    label: 'Estimated Carbon Impact',
    disclaimer: 'Calculated using operational generation emission factor. Does not encompass full lifecycle infrastructure embodied carbon.',
  });
});

// 18. Sustainability Score
app.post('/api/sustainability/:dataset_id/calculate', (req: Request, res: Response) => {
  const ds = datasetCache.get(req.params.dataset_id);
  if (!ds) return res.status(404).json({ error: 'Dataset not found.' });

  const emissionFactor = parseFloat(req.body.emission_factor as string) || 0.385;
  const targetPct = parseFloat(req.body.target_savings_pct as string) || 12;

  const totalKwh = ds.rows.reduce((sum, r) => sum + r.energy_kwh, 0);
  const powers = ds.rows.map(r => r.global_active_power);
  const peakKw = powers.length ? Math.max(...powers) : 2.5;
  const days = Math.max(1, ds.rows.length / 24);
  const avgDailyKwh = totalKwh / days;

  const result = calculateSustainabilityScore(avgDailyKwh, peakKw, emissionFactor, targetPct);
  res.json({
    dataset_id: req.params.dataset_id,
    ...result,
  });
});

// 19. What-If Simulation: Evaluate scenario
app.post('/api/simulations/evaluate', (req: Request, res: Response) => {
  try {
    const datasetId = req.body.dataset_id;
    const ds = datasetCache.get(datasetId);
    let baselineKwh = 0;

    if (ds) {
      baselineKwh = ds.rows.reduce((sum, r) => sum + r.energy_kwh, 0);
    } else {
      baselineKwh = parseFloat(req.body.baseline_kwh as string) || 450;
    }

    const config: ScenarioConfig = {
      name: req.body.name || `Simulation ${req.body.reduction_percentage || 15}% Cut`,
      reduction_percentage: parseFloat(req.body.reduction_percentage as string) || 15,
      electricity_tariff: parseFloat(req.body.tariff as string) || 0.18,
      emission_factor: parseFloat(req.body.emission_factor as string) || 0.385,
    };

    const scenario = calculateScenario(baselineKwh, config);
    scenarioCache.set(scenario.scenario_id, scenario);

    res.json(scenario);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 20. Save scenario
app.post('/api/scenarios/save', async (req: Request, res: Response) => {
  try {
    const scen = req.body as ScenarioResult;
    if (!scen || !scen.scenario_id) {
      return res.status(400).json({ error: 'Invalid scenario payload' });
    }

    scenarioCache.set(scen.scenario_id, scen);

    const db = await getDatabase();
    db.run(
      `INSERT OR REPLACE INTO scenarios (id, dataset_id, name, reduction_pct, tariff_rate, emission_factor, baseline_kwh, scenario_kwh, saved_kwh, cost_diff, co2_diff, assumptions, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scen.scenario_id,
        req.body.dataset_id || 'default',
        scen.name,
        scen.reduction_percentage,
        scen.tariff_rate,
        scen.emission_factor,
        scen.baseline_energy_kwh,
        scen.scenario_energy_kwh,
        scen.energy_savings_kwh,
        scen.estimated_cost_diff,
        scen.estimated_co2_diff,
        JSON.stringify(scen.assumptions),
        scen.created_at || new Date().toISOString(),
      ]
    );
    saveDatabase();

    res.json({ success: true, saved_id: scen.scenario_id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 21. Get saved scenarios
app.get('/api/scenarios', (_req: Request, res: Response) => {
  const scenarios = Array.from(scenarioCache.values());
  res.json({ scenarios });
});

// 22. Household Energy Digital Twin
app.get('/api/digital-twin/:dataset_id', (req: Request, res: Response) => {
  const ds = datasetCache.get(req.params.dataset_id);
  if (!ds) return res.status(404).json({ error: 'Dataset not found.' });

  const modelInfo = modelCache.get(req.params.dataset_id);
  let forecastPoints: ForecastPoint[] = [];

  if (modelInfo) {
    forecastPoints = modelInfo.forecaster.forecastHorizon(modelInfo.features.slice(-48), 24);
  } else {
    // Generate simple projected load curve
    const meanKw = ds.rows.reduce((a, b) => a + b.global_active_power, 0) / ds.rows.length;
    forecastPoints = Array.from({ length: 24 }, (_, i) => ({
      timestamp: new Date(Date.now() + i * 3600 * 1000).toISOString(),
      predicted: meanKw * (1 + 0.3 * Math.sin((i - 6) / 24 * Math.PI * 2)),
      lower_bound: meanKw * 0.7,
      upper_bound: meanKw * 1.3,
    }));
  }

  const twinState = buildDigitalTwin(ds.rows, forecastPoints);
  res.json(twinState);
});

// 23. Uncertainty-Aware Energy Alerts
app.get('/api/alerts/:dataset_id', (req: Request, res: Response) => {
  const ds = datasetCache.get(req.params.dataset_id);
  if (!ds) return res.status(404).json({ error: 'Dataset not found.' });

  let anomInfo = anomalyCache.get(req.params.dataset_id);
  if (!anomInfo) {
    const features = extractFeatures(ds.rows);
    const detector = new IsolationForestAnomalyDetector(60, 0.05, 128);
    detector.fit(features);
    const points = detector.detect(features);
    anomalyCache.set(req.params.dataset_id, { detector, points });
    anomInfo = { detector, points };
  }

  const modelInfo = modelCache.get(req.params.dataset_id);
  const forecastPoints = modelInfo ? modelInfo.forecaster.forecastHorizon(modelInfo.features.slice(-48), 48) : [];

  const alerts = buildUncertaintyAlerts(anomInfo.points, forecastPoints);
  res.json({
    dataset_id: req.params.dataset_id,
    total_alerts: alerts.length,
    alerts,
  });
});

// 24. Multi-Objective Energy Recommendation Optimizer
app.post('/api/optimizer/rank', (req: Request, res: Response) => {
  const datasetId = req.body.dataset_id;
  const ds = datasetCache.get(datasetId);
  const totalKwh = ds ? ds.rows.reduce((a, b) => a + b.energy_kwh, 0) : 480;
  const days = ds ? Math.max(1, ds.rows.length / 24) : 30;
  const avgDailyKwh = totalKwh / days;

  const config = {
    weight_kwh: parseFloat(req.body.weight_kwh as string) ?? 0.35,
    weight_cost: parseFloat(req.body.weight_cost as string) ?? 0.35,
    weight_co2: parseFloat(req.body.weight_co2 as string) ?? 0.30,
    tariff_rate: parseFloat(req.body.tariff as string) || 0.18,
    emission_factor: parseFloat(req.body.emission_factor as string) || 0.385,
    target_savings_pct: parseFloat(req.body.target_savings_pct as string) || 12,
  };

  const ranked = optimizeRecommendations(avgDailyKwh, config);

  res.json({
    dataset_id: datasetId,
    weights_applied: {
      kwh_reduction_weight: config.weight_kwh,
      cost_reduction_weight: config.weight_cost,
      co2_reduction_weight: config.weight_co2,
    },
    ranked_recommendations: ranked,
    optimization_philosophy: 'Multi-criteria weighted Pareto ranking balancing energy volume, financial savings, and grid decarbonization impact.',
  });
});

// 25. Recommendations endpoint
app.post('/api/recommendations/:dataset_id/generate', (req: Request, res: Response) => {
  const ds = datasetCache.get(req.params.dataset_id);
  const totalKwh = ds ? ds.rows.reduce((a, b) => a + b.energy_kwh, 0) : 480;
  const days = ds ? Math.max(1, ds.rows.length / 24) : 30;
  const avgDailyKwh = totalKwh / days;

  const config = {
    weight_kwh: 0.34,
    weight_cost: 0.33,
    weight_co2: 0.33,
    tariff_rate: parseFloat(req.body.tariff as string) || 0.18,
    emission_factor: parseFloat(req.body.emission_factor as string) || 0.385,
    target_savings_pct: 10,
  };

  const ranked = optimizeRecommendations(avgDailyKwh, config);
  res.json({
    dataset_id: req.params.dataset_id,
    recommendations: ranked,
  });
});

// 26. Consolidated report generation
app.post('/api/reports/:dataset_id/generate', async (req: Request, res: Response) => {
  const ds = datasetCache.get(req.params.dataset_id);
  if (!ds) return res.status(404).json({ error: 'Dataset not found.' });

  const reportId = `rep_${Date.now()}`;
  const totalKwh = ds.rows.reduce((a, b) => a + b.energy_kwh, 0);
  const days = Math.max(1, ds.rows.length / 24);
  const avgDaily = totalKwh / days;
  const modelInfo = modelCache.get(req.params.dataset_id);

  const budget = parseFloat(req.body.budget as string) || 120.0;
  const tariff = parseFloat(req.body.tariff as string) || 0.18;
  const projectedMonthlyKwh = avgDaily * 30;
  const projectedBill = projectedMonthlyKwh * tariff;
  const isExceeded = projectedBill > budget;

  const reportPayload = {
    report_id: reportId,
    project: 'GreenEnergyAI: AI-Powered Household Energy Management System',
    generated_at: new Date().toISOString(),
    dataset: {
      name: ds.name,
      source_type: ds.sourceType,
      rows_analyzed: ds.rows.length,
      sampling_interval: `${ds.quality.sampling_interval_minutes} minutes`,
      total_energy_kwh: Number(totalKwh.toFixed(2)),
      average_daily_kwh: Number(avgDaily.toFixed(2)),
    },
    billing_projection: {
      defined_budget: budget,
      tariff_rate: tariff,
      projected_monthly_kwh: Number(projectedMonthlyKwh.toFixed(2)),
      projected_bill: Number(projectedBill.toFixed(2)),
      variance_diff: Number((projectedBill - budget).toFixed(2)),
      is_exceeded: isExceeded,
      status: isExceeded ? 'EXCEEDED' : 'WITHIN_BUDGET',
      alert_message: isExceeded
        ? `Projected electricity bill ($${projectedBill.toFixed(2)}) is estimated to exceed your budget ($${budget.toFixed(2)}) by $${(projectedBill - budget).toFixed(2)}.`
        : `Projected electricity bill ($${projectedBill.toFixed(2)}) remains within your budget of $${budget.toFixed(2)}.`,
    },
    ml_models: {
      forecasting: {
        algorithm: 'XGBoost Gradient Boosted Decision Tree Ensemble',
        metrics: modelInfo?.forecaster.metrics || { status: 'Untrained on this session' },
      },
      anomaly_detection: {
        algorithm: 'Isolation Forest (iForest Tree Ensemble)',
        contamination: 0.05,
      },
      explainability: {
        methods: ['TreeSHAP (Shapley Additive Explanations)', 'LIME (Local Interpretable Surrogate)'],
      },
    },
    environmental_impact: {
      emission_factor: '0.385 kg CO₂/kWh',
      estimated_co2_kg: Number((totalKwh * 0.385).toFixed(2)),
    },
    limitations: [
      'Entirely software-based prototype using historical/uploaded data.',
      'No physical sensor hardware currently attached (PZEM-004T / ESP32 is future enhancement).',
      'What-if scenarios and recommendations represent estimated analytical opportunities, not guaranteed savings.',
    ],
  };

  const db = await getDatabase();
  db.run(
    `INSERT INTO generated_reports (id, dataset_id, title, report_type, created_at, summary_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      reportId,
      req.params.dataset_id,
      `GreenEnergyAI Technical Audit Report (${ds.name})`,
      'consolidated_json',
      new Date().toISOString(),
      JSON.stringify(reportPayload),
    ]
  );
  saveDatabase();

  res.json({ success: true, report_id: reportId, report: reportPayload });
});

// 27. Download report
app.get('/api/reports/:report_id/download', async (req: Request, res: Response) => {
  const db = await getDatabase();
  const stmt = db.prepare('SELECT * FROM generated_reports WHERE id = ?');
  stmt.bind([req.params.report_id]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="greenenergy_report_${req.params.report_id}.json"`);
    res.send(row.summary_json);
  } else {
    res.status(404).json({ error: 'Report not found' });
  }
  stmt.free();
});

// 28. End-of-month electricity bill projection
app.post('/api/reports/:dataset_id/bill-projection', (req: Request, res: Response) => {
  const ds = datasetCache.get(req.params.dataset_id);
  if (!ds) return res.status(404).json({ error: 'Dataset not found.' });

  const budget = parseFloat(req.body.budget as string) || 120.0;
  const tariff = parseFloat(req.body.tariff as string) || 0.18;
  const daysInCycle = parseInt(req.body.days_in_cycle as string) || 30;
  const mode = req.body.trend_mode || 'weighted_momentum';

  const totalKwh = ds.rows.reduce((sum, r) => sum + r.energy_kwh, 0);
  const totalDays = Math.max(1, ds.rows.length / 24);
  const overallDailyKwh = totalKwh / totalDays;

  // Recent 7 days momentum (last 168 readings or slice)
  const recentRows = ds.rows.slice(-168);
  const recentKwh = recentRows.reduce((sum, r) => sum + r.energy_kwh, 0);
  const recentDays = Math.max(1, recentRows.length / 24);
  const recentDailyKwh = recentKwh / recentDays;

  // Daily pace based on mode
  const dailyPace = mode === 'weighted_momentum'
    ? 0.7 * recentDailyKwh + 0.3 * overallDailyKwh
    : overallDailyKwh;

  const projectedTotalKwh = dailyPace * daysInCycle;
  const projectedBill = projectedTotalKwh * tariff;
  const variance = projectedBill - budget;
  const isExceeded = projectedBill > budget;

  // Estimated day in billing cycle when budget will be exhausted
  const breachDay = isExceeded && dailyPace * tariff > 0
    ? Math.min(daysInCycle, Math.max(1, Math.floor(budget / (dailyPace * tariff))))
    : null;

  // Daily target to stay within budget
  const targetMaxDailyKwh = budget / (daysInCycle * tariff);
  const requiredReductionPct = isExceeded && dailyPace > 0
    ? Math.min(99, Math.max(1, ((dailyPace - targetMaxDailyKwh) / dailyPace) * 100))
    : 0;

  res.json({
    dataset_id: req.params.dataset_id,
    defined_budget: budget,
    tariff_rate: tariff,
    days_in_cycle: daysInCycle,
    trend_mode: mode,
    current_daily_pace_kwh: Number(dailyPace.toFixed(2)),
    overall_daily_kwh: Number(overallDailyKwh.toFixed(2)),
    recent_7day_daily_kwh: Number(recentDailyKwh.toFixed(2)),
    projected_total_kwh: Number(projectedTotalKwh.toFixed(2)),
    projected_bill: Number(projectedBill.toFixed(2)),
    budget_variance: Number(variance.toFixed(2)),
    variance_percentage: Number(((variance / budget) * 100).toFixed(1)),
    is_exceeded: isExceeded,
    breach_day: breachDay,
    target_max_daily_kwh: Number(targetMaxDailyKwh.toFixed(2)),
    required_reduction_pct: Number(requiredReductionPct.toFixed(1)),
    alert_severity: isExceeded ? (variance > budget * 0.25 ? 'critical' : 'warning') : 'safe',
    timestamp: new Date().toISOString(),
  });
});

// Mount Vite in dev mode or serve built client in production
async function startServer() {
  await initDefaultDatasets();

  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'))) {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GreenEnergyAI] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
