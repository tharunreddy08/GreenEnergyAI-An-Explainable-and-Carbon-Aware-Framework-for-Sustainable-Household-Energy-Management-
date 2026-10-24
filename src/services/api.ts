import {
  DatasetMeta,
  DataQualityReport,
  AnalyticsSummary,
  ConsumptionPoint,
  ForecastPoint,
  ForecastMetrics,
  AnomalyPoint,
  ShapExplanation,
  LimeExplanation,
  ScenarioResult,
  DigitalTwinState,
  UncertaintyAlert,
  RankedRecommendation,
  SustainabilityScoreResult,
  BillProjectionResult,
} from '../types';

const BASE_URL = '/api';

export async function fetchHealth(): Promise<any> {
  const res = await fetch(`${BASE_URL}/health`);
  return res.json();
}

export async function fetchDatasets(): Promise<{ datasets: DatasetMeta[] }> {
  const res = await fetch(`${BASE_URL}/datasets`);
  if (!res.ok) throw new Error('Failed to fetch datasets');
  return res.json();
}

export async function uploadDataset(csvContent: string, filename: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/datasets/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv_content: csvContent, filename }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Upload failed');
  }
  return res.json();
}

export async function generateSynthetic(days: number = 30): Promise<any> {
  const res = await fetch(`${BASE_URL}/datasets/generate-synthetic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  });
  if (!res.ok) throw new Error('Failed to generate synthetic dataset');
  return res.json();
}

export async function selectUciDataset(): Promise<any> {
  const res = await fetch(`${BASE_URL}/datasets/select-uci`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to load UCI dataset');
  return res.json();
}

export async function fetchDatasetPreview(datasetId: string, page = 1, limit = 50): Promise<any> {
  const res = await fetch(`${BASE_URL}/datasets/${datasetId}/preview?page=${page}&limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch dataset preview');
  return res.json();
}

export async function fetchDatasetQuality(datasetId: string): Promise<{ quality: DataQualityReport }> {
  const res = await fetch(`${BASE_URL}/datasets/${datasetId}/quality`);
  if (!res.ok) throw new Error('Failed to fetch data quality');
  return res.json();
}

export async function fetchAnalyticsSummary(datasetId: string): Promise<AnalyticsSummary> {
  const res = await fetch(`${BASE_URL}/analytics/${datasetId}/summary`);
  if (!res.ok) throw new Error('Failed to fetch analytics summary');
  return res.json();
}

export async function fetchConsumptionSeries(datasetId: string, limit = 168): Promise<{
  series: ConsumptionPoint[];
  daily_summaries: { date: string; total_kwh: number; peak_kw: number }[];
  hourly_profile: { hour: number; avg_kwh: number }[];
}> {
  const res = await fetch(`${BASE_URL}/analytics/${datasetId}/consumption?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch consumption series');
  return res.json();
}

export async function trainForecastModel(datasetId: string): Promise<{
  model_type: string;
  metrics: ForecastMetrics;
  interpretation: any;
}> {
  const res = await fetch(`${BASE_URL}/forecast/${datasetId}/train`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to train forecast model');
  return res.json();
}

export async function predictForecast(datasetId: string, horizon = 24): Promise<{
  forecast: ForecastPoint[];
  recent_actuals: ForecastPoint[];
  metrics: ForecastMetrics;
  assumptions: string[];
}> {
  const res = await fetch(`${BASE_URL}/forecast/${datasetId}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ horizon }),
  });
  if (!res.ok) throw new Error('Failed to predict forecast');
  return res.json();
}

export async function detectAnomalies(datasetId: string, contamination = 0.05): Promise<{
  total_analyzed: number;
  anomaly_count: number;
  anomaly_percentage: number;
  contamination_parameter: number;
  points: AnomalyPoint[];
  flagged_anomalies: AnomalyPoint[];
}> {
  const res = await fetch(`${BASE_URL}/anomalies/${datasetId}/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contamination }),
  });
  if (!res.ok) throw new Error('Failed to run anomaly detection');
  return res.json();
}

export async function fetchGlobalShap(datasetId: string): Promise<{
  global_importance: { feature: string; displayName: string; mean_abs_shap: number }[];
  methodology: string;
  caution: string;
}> {
  const res = await fetch(`${BASE_URL}/explain/${datasetId}/global`);
  if (!res.ok) throw new Error('Failed to fetch global SHAP');
  return res.json();
}

export async function fetchLocalExplanation(datasetId: string, timestamp?: string): Promise<{
  timestamp: string;
  observed_target: number;
  shap: ShapExplanation;
  lime: LimeExplanation;
  plain_language_interpretation: string;
}> {
  const res = await fetch(`${BASE_URL}/explain/${datasetId}/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp }),
  });
  if (!res.ok) throw new Error('Failed to fetch local explanation');
  return res.json();
}

export async function calculateEmissions(datasetId: string, factor = 0.385, source = ''): Promise<{
  emission_factor_used: number;
  factor_source: string;
  formula: string;
  total_energy_kwh: number;
  total_co2_kg: number;
  average_daily_co2_kg: number;
  daily_trend: { date: string; energy_kwh: number; co2_kg: number }[];
  disclaimer: string;
}> {
  const res = await fetch(`${BASE_URL}/emissions/${datasetId}/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emission_factor: factor, source }),
  });
  if (!res.ok) throw new Error('Failed to calculate emissions');
  return res.json();
}

export async function calculateSustainability(
  datasetId: string,
  emissionFactor = 0.385,
  targetSavingsPct = 12
): Promise<SustainabilityScoreResult> {
  const res = await fetch(`${BASE_URL}/sustainability/${datasetId}/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emission_factor: emissionFactor, target_savings_pct: targetSavingsPct }),
  });
  if (!res.ok) throw new Error('Failed to calculate sustainability score');
  return res.json();
}

export async function evaluateSimulation(params: {
  dataset_id: string;
  name?: string;
  reduction_percentage: number;
  tariff: number;
  emission_factor: number;
}): Promise<ScenarioResult> {
  const res = await fetch(`${BASE_URL}/simulations/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to evaluate simulation');
  return res.json();
}

export async function saveScenario(scenario: ScenarioResult, datasetId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/scenarios/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...scenario, dataset_id: datasetId }),
  });
  if (!res.ok) throw new Error('Failed to save scenario');
  return res.json();
}

export async function fetchSavedScenarios(): Promise<{ scenarios: ScenarioResult[] }> {
  const res = await fetch(`${BASE_URL}/scenarios`);
  if (!res.ok) throw new Error('Failed to fetch saved scenarios');
  return res.json();
}

export async function fetchDigitalTwin(datasetId: string): Promise<DigitalTwinState> {
  const res = await fetch(`${BASE_URL}/digital-twin/${datasetId}`);
  if (!res.ok) throw new Error('Failed to fetch digital twin');
  return res.json();
}

export async function fetchUncertaintyAlerts(datasetId: string): Promise<{ total_alerts: number; alerts: UncertaintyAlert[] }> {
  const res = await fetch(`${BASE_URL}/alerts/${datasetId}`);
  if (!res.ok) throw new Error('Failed to fetch uncertainty alerts');
  return res.json();
}

export async function rankOptimizerRecommendations(params: {
  dataset_id: string;
  weight_kwh: number;
  weight_cost: number;
  weight_co2: number;
  tariff: number;
  emission_factor: number;
  target_savings_pct: number;
}): Promise<{
  ranked_recommendations: RankedRecommendation[];
  optimization_philosophy: string;
}> {
  const res = await fetch(`${BASE_URL}/optimizer/rank`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to rank recommendations');
  return res.json();
}

export async function fetchBillProjection(params: {
  dataset_id: string;
  budget: number;
  tariff: number;
  days_in_cycle?: number;
  trend_mode?: 'uniform_average' | 'weighted_momentum';
}): Promise<BillProjectionResult> {
  const res = await fetch(`${BASE_URL}/reports/${params.dataset_id}/bill-projection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to calculate bill projection');
  return res.json();
}

export async function generateReport(datasetId: string, budget?: number, tariff?: number): Promise<any> {
  const res = await fetch(`${BASE_URL}/reports/${datasetId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ budget, tariff }),
  });
  if (!res.ok) throw new Error('Failed to generate report');
  return res.json();
}
