export interface DatasetMeta {
  id: string;
  name: string;
  source_type: string;
  row_count: number;
  start_date: string;
  end_date: string;
  sampling_interval_minutes: number;
  total_energy_kwh: number;
}

export interface DataQualityReport {
  total_raw_rows: number;
  valid_rows: number;
  missing_values_count: number;
  invalid_rows_removed: number;
  duplicate_timestamps_found: number;
  start_date: string;
  end_date: string;
  sampling_interval_minutes: number;
  active_power_min: number;
  active_power_max: number;
  active_power_mean: number;
  total_energy_kwh: number;
  assumptions: string[];
}

export interface AnalyticsSummary {
  dataset_id: string;
  name: string;
  source_type: string;
  total_energy_kwh: number;
  average_daily_kwh: number;
  peak_active_power_kw: number;
  basal_power_kw: number;
  mean_active_power_kw: number;
  load_factor: number;
  total_observations: number;
  days_covered: number;
  detected_anomalies_count: number;
}

export interface ConsumptionPoint {
  timestamp: string;
  global_active_power: number;
  energy_kwh: number;
  voltage?: number;
  sub_metering_1?: number;
  sub_metering_2?: number;
  sub_metering_3?: number;
}

export interface ForecastPoint {
  timestamp: string;
  predicted: number;
  lower_bound: number;
  upper_bound: number;
  actual?: number;
}

export interface ForecastMetrics {
  mae: number;
  rmse: number;
  r2: number;
  test_rows: number;
  val_rows: number;
  train_rows: number;
  uncertainty_std: number;
}

export interface AnomalyPoint {
  timestamp: string;
  observed_kwh: number;
  anomaly_score: number;
  is_anomaly: boolean;
  severity: 'normal' | 'low_uncertainty_anomaly' | 'high_uncertainty_deviation' | 'severe_outlier';
  explanation: string;
}

export interface ShapItem {
  feature: string;
  displayName: string;
  value: number;
  shap_value: number;
}

export interface ShapExplanation {
  base_value: number;
  prediction: number;
  features: ShapItem[];
  global_importance: { feature: string; displayName: string; mean_abs_shap: number }[];
}

export interface LimeRule {
  rule: string;
  weight: number;
  effect: 'increases_consumption' | 'decreases_consumption';
}

export interface LimeExplanation {
  prediction: number;
  intercept: number;
  rules: LimeRule[];
}

export interface ScenarioResult {
  scenario_id: string;
  name: string;
  baseline_energy_kwh: number;
  scenario_energy_kwh: number;
  energy_savings_kwh: number;
  estimated_cost_diff: number;
  estimated_co2_diff: number;
  tariff_rate: number;
  emission_factor: number;
  reduction_percentage: number;
  formulas_used: {
    scenario_energy: string;
    energy_savings: string;
    cost_difference: string;
    co2_difference: string;
  };
  assumptions: string[];
  created_at: string;
}

export interface DigitalTwinState {
  household_id: string;
  virtual_profile: {
    base_load_kw: number;
    peak_load_kw: number;
    daily_average_kwh: number;
    load_factor: number;
    most_active_hours: string;
    efficiency_rating: string;
  };
  synthetic_disaggregation: {
    category: string;
    estimated_share_pct: number;
    estimated_daily_kwh: number;
    confidence_note: string;
  }[];
  load_curve_24h: {
    hour: number;
    historical_avg: number;
    forecast_expected: number;
    forecast_lower: number;
    forecast_upper: number;
    simulated_10pct_cut: number;
  }[];
  active_scenarios_count: number;
  last_updated: string;
  disclaimer: string;
}

export interface UncertaintyAlert {
  id: string;
  timestamp: string;
  observed_kwh: number;
  forecast_kwh: number;
  uncertainty_interval: [number, number];
  anomaly_score: number;
  severity: 'normal' | 'low_uncertainty_anomaly' | 'high_uncertainty_deviation' | 'severe_outlier';
  severity_label: string;
  plain_language_explanation: string;
  suggested_action: string;
}

export interface RankedRecommendation {
  id: string;
  rank: number;
  title: string;
  action_category: string;
  projected_savings_kwh: number;
  estimated_cost_savings: number;
  estimated_co2_reduction_kg: number;
  objective_score: number;
  priority: 'High' | 'Medium' | 'Low';
  rationale: string;
  underlying_observation: string;
  defensible_assumptions: string;
}

export interface SustainabilityScoreResult {
  score: number;
  rating: 'Superior' | 'Good' | 'Moderate' | 'High Consumption';
  components: {
    indicator: string;
    value: string;
    weight_pct: number;
    points: number;
    max_points: number;
    explanation: string;
  }[];
  methodology: string;
  limitations: string;
}

export interface BillProjectionResult {
  dataset_id: string;
  defined_budget: number;
  tariff_rate: number;
  days_in_cycle: number;
  trend_mode: 'uniform_average' | 'weighted_momentum';
  current_daily_pace_kwh: number;
  overall_daily_kwh: number;
  recent_7day_daily_kwh: number;
  projected_total_kwh: number;
  projected_bill: number;
  budget_variance: number;
  variance_percentage: number;
  is_exceeded: boolean;
  breach_day: number | null;
  target_max_daily_kwh: number;
  required_reduction_pct: number;
  alert_severity: 'safe' | 'warning' | 'critical';
  timestamp: string;
}

