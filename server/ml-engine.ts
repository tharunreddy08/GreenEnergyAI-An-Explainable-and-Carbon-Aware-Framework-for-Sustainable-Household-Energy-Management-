import { FeatureRow } from './data-processor';

export interface ForecastModelMetrics {
  mae: number;
  rmse: number;
  r2: number;
  test_rows: number;
  val_rows: number;
  train_rows: number;
  uncertainty_std: number; // 1-sigma prediction error
}

export interface ForecastPoint {
  timestamp: string;
  predicted: number;
  lower_bound: number; // 95% interval
  upper_bound: number;
  actual?: number;
}

export interface AnomalyPoint {
  timestamp: string;
  observed_kwh: number;
  anomaly_score: number; // 0..1 (higher = more anomalous)
  is_anomaly: boolean;
  severity: 'normal' | 'low_uncertainty_anomaly' | 'high_uncertainty_deviation' | 'severe_outlier';
  explanation: string;
}

export interface ShapValue {
  feature: string;
  displayName: string;
  value: number; // actual value in instance
  shap_value: number; // contribution to prediction
}

export interface ShapExplanation {
  base_value: number;
  prediction: number;
  features: ShapValue[];
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

// Feature column definitions
export const FEATURE_NAMES: (keyof Omit<FeatureRow, 'timestamp' | 'target'>)[] = [
  'hour',
  'day_of_week',
  'is_weekend',
  'month',
  'lag_1',
  'lag_2',
  'lag_24',
  'rolling_mean_6',
  'rolling_mean_24',
];

export const FEATURE_LABELS: Record<string, string> = {
  hour: 'Hour of Day (0-23)',
  day_of_week: 'Day of Week (0=Sun)',
  is_weekend: 'Weekend Indicator',
  month: 'Month of Year',
  lag_1: 'Previous Hour Load (Lag 1)',
  lag_2: '2 Hours Prior Load (Lag 2)',
  lag_24: 'Same Hour Yesterday (Lag 24)',
  rolling_mean_6: '6-Hour Rolling Mean',
  rolling_mean_24: '24-Hour Rolling Mean',
};

// Simple Regression Decision Tree
interface TreeNode {
  isLeaf: boolean;
  value?: number;
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}

function buildTree(
  X: number[][],
  y: number[],
  depth: number,
  maxDepth: number = 3,
  minSamplesSplit: number = 5
): TreeNode {
  if (depth >= maxDepth || X.length <= minSamplesSplit) {
    const mean = y.length > 0 ? y.reduce((a, b) => a + b, 0) / y.length : 0;
    return { isLeaf: true, value: mean };
  }

  let bestVarianceReduction = -1;
  let bestFeature = -1;
  let bestThreshold = 0;
  let bestLeftIndices: number[] = [];
  let bestRightIndices: number[] = [];

  const totalVar = calculateVariance(y);
  const nFeatures = X[0]?.length || 0;

  for (let f = 0; f < nFeatures; f++) {
    // Test 6 candidate percentiles
    const vals = X.map(row => row[f]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (min === max) continue;

    for (let step = 1; step <= 5; step++) {
      const threshold = min + (step / 6) * (max - min);
      const leftIdx: number[] = [];
      const rightIdx: number[] = [];

      for (let i = 0; i < X.length; i++) {
        if (X[i][f] <= threshold) leftIdx.push(i);
        else rightIdx.push(i);
      }

      if (leftIdx.length < 2 || rightIdx.length < 2) continue;

      const yLeft = leftIdx.map(i => y[i]);
      const yRight = rightIdx.map(i => y[i]);

      const varLeft = calculateVariance(yLeft);
      const varRight = calculateVariance(yRight);
      const weightedVar = (leftIdx.length * varLeft + rightIdx.length * varRight) / X.length;
      const reduction = totalVar - weightedVar;

      if (reduction > bestVarianceReduction) {
        bestVarianceReduction = reduction;
        bestFeature = f;
        bestThreshold = threshold;
        bestLeftIndices = leftIdx;
        bestRightIndices = rightIdx;
      }
    }
  }

  if (bestVarianceReduction <= 0 || bestFeature === -1) {
    const mean = y.reduce((a, b) => a + b, 0) / y.length;
    return { isLeaf: true, value: mean };
  }

  const leftX = bestLeftIndices.map(i => X[i]);
  const leftY = bestLeftIndices.map(i => y[i]);
  const rightX = bestRightIndices.map(i => X[i]);
  const rightY = bestRightIndices.map(i => y[i]);

  return {
    isLeaf: false,
    featureIndex: bestFeature,
    threshold: bestThreshold,
    left: buildTree(leftX, leftY, depth + 1, maxDepth, minSamplesSplit),
    right: buildTree(rightX, rightY, depth + 1, maxDepth, minSamplesSplit),
  };
}

function predictTree(node: TreeNode, x: number[]): number {
  if (node.isLeaf) return node.value ?? 0;
  if (node.featureIndex !== undefined && node.threshold !== undefined) {
    if (x[node.featureIndex] <= node.threshold) {
      return predictTree(node.left!, x);
    } else {
      return predictTree(node.right!, x);
    }
  }
  return 0;
}

function calculateVariance(nums: number[]): number {
  if (nums.length <= 1) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
}

/**
 * Gradient Boosted Trees Ensemble (XGBoost logic)
 */
export class BoostedTreeForecaster {
  private trees: TreeNode[] = [];
  private basePrediction: number = 0;
  private learningRate: number = 0.1;
  private nEstimators: number = 18;
  private maxDepth: number = 4;
  public metrics: ForecastModelMetrics | null = null;
  public trainFeatureMean: number[] = [];

  constructor(learningRate = 0.1, nEstimators = 18, maxDepth = 4) {
    this.learningRate = learningRate;
    this.nEstimators = nEstimators;
    this.maxDepth = maxDepth;
  }

  fit(trainData: FeatureRow[], valData: FeatureRow[], testData: FeatureRow[]): ForecastModelMetrics {
    const X_train = trainData.map(r => FEATURE_NAMES.map(f => r[f]));
    const y_train = trainData.map(r => r.target);

    // Compute base prediction (mean of target)
    this.basePrediction = y_train.reduce((a, b) => a + b, 0) / y_train.length;

    // Feature means for imputation/explanation
    this.trainFeatureMean = FEATURE_NAMES.map((_, col) => {
      const colVals = X_train.map(row => row[col]);
      return colVals.reduce((a, b) => a + b, 0) / colVals.length;
    });

    let currentPredictions = new Array(y_train.length).fill(this.basePrediction);
    this.trees = [];

    for (let t = 0; t < this.nEstimators; t++) {
      // Residuals: negative gradient for MSE = y - y_pred
      const residuals = y_train.map((y, i) => y - currentPredictions[i]);
      const tree = buildTree(X_train, residuals, 0, this.maxDepth, 6);
      this.trees.push(tree);

      for (let i = 0; i < X_train.length; i++) {
        currentPredictions[i] += this.learningRate * predictTree(tree, X_train[i]);
      }
    }

    // Evaluate on genuinely held-out test data
    const X_test = testData.map(r => FEATURE_NAMES.map(f => r[f]));
    const y_test = testData.map(r => r.target);

    const testPredictions = X_test.map(x => this.predict(x));
    const testErrors = y_test.map((y, i) => y - testPredictions[i]);

    const mae = testErrors.reduce((sum, err) => sum + Math.abs(err), 0) / Math.max(1, testErrors.length);
    const mse = testErrors.reduce((sum, err) => sum + err ** 2, 0) / Math.max(1, testErrors.length);
    const rmse = Math.sqrt(mse);

    // R2 on test
    const yTestMean = y_test.reduce((a, b) => a + b, 0) / Math.max(1, y_test.length);
    const ssTotal = y_test.reduce((sum, y) => sum + (y - yTestMean) ** 2, 0);
    const ssRes = testErrors.reduce((sum, err) => sum + err ** 2, 0);
    const r2 = ssTotal > 0 ? Math.max(-1, 1 - ssRes / ssTotal) : 0;

    // Validation residual standard deviation for prediction intervals
    const X_val = valData.map(r => FEATURE_NAMES.map(f => r[f]));
    const y_val = valData.map(r => r.target);
    const valErrors = y_val.map((y, i) => y - this.predict(X_val[i]));
    const valMse = valErrors.reduce((sum, e) => sum + e ** 2, 0) / Math.max(1, valErrors.length);
    const uncertaintyStd = Math.sqrt(valMse);

    this.metrics = {
      mae: Number(mae.toFixed(4)),
      rmse: Number(rmse.toFixed(4)),
      r2: Number(r2.toFixed(4)),
      train_rows: trainData.length,
      val_rows: valData.length,
      test_rows: testData.length,
      uncertainty_std: Number(uncertaintyStd.toFixed(4)),
    };

    return this.metrics;
  }

  predict(features: number[]): number {
    let pred = this.basePrediction;
    for (const tree of this.trees) {
      pred += this.learningRate * predictTree(tree, features);
    }
    return Math.max(0, pred);
  }

  /**
   * Multi-step recursive forecasting for horizon H steps
   */
  forecastHorizon(lastFeatures: FeatureRow[], horizonSteps: number = 24): ForecastPoint[] {
    const results: ForecastPoint[] = [];
    const history = [...lastFeatures];
    const std = this.metrics?.uncertainty_std || 0.25;

    for (let step = 0; step < horizonSteps; step++) {
      const last = history[history.length - 1];
      const prevDate = new Date(last.timestamp);
      const nextDate = new Date(prevDate.getTime() + 60 * 60 * 1000);

      const hour = nextDate.getUTCHours();
      const dayOfWeek = nextDate.getUTCDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;
      const month = nextDate.getUTCMonth() + 1;

      const lag1 = history[history.length - 1].target;
      const lag2 = history[history.length - 2]?.target ?? lag1;
      const lag24 = history[history.length - 24]?.target ?? lag1;

      // 6-step rolling
      const past6 = history.slice(-6).map(h => h.target);
      const rolling6 = past6.reduce((a, b) => a + b, 0) / past6.length;

      // 24-step rolling
      const past24 = history.slice(-24).map(h => h.target);
      const rolling24 = past24.reduce((a, b) => a + b, 0) / past24.length;

      const xVec = [hour, dayOfWeek, isWeekend, month, lag1, lag2, lag24, rolling6, rolling24];
      const yPred = this.predict(xVec);

      // Uncertainty expands slightly with horizon: std * sqrt(1 + 0.05 * step)
      const horizonFactor = Math.sqrt(1 + 0.04 * step);
      const margin = 1.96 * std * horizonFactor;

      const nextRow: FeatureRow = {
        timestamp: nextDate.toISOString(),
        target: yPred,
        hour,
        day_of_week: dayOfWeek,
        is_weekend: isWeekend,
        month,
        lag_1: lag1,
        lag_2: lag2,
        lag_24: lag24,
        rolling_mean_6: rolling6,
        rolling_mean_24: rolling24,
      };

      history.push(nextRow);

      results.push({
        timestamp: nextDate.toISOString(),
        predicted: Number(yPred.toFixed(3)),
        lower_bound: Number(Math.max(0, yPred - margin).toFixed(3)),
        upper_bound: Number((yPred + margin).toFixed(3)),
      });
    }

    return results;
  }

  /**
   * TreeSHAP feature attribution: computes Shapley values for an instance
   */
  explainSHAP(featureRow: FeatureRow, backgroundSample: FeatureRow[]): ShapExplanation {
    const x = FEATURE_NAMES.map(f => featureRow[f]);
    const pred = this.predict(x);
    const baseVal = this.basePrediction;

    // Estimate marginal contributions against background expectations
    const shapValues: number[] = new Array(FEATURE_NAMES.length).fill(0);

    // Approximate TreeSHAP by computing feature-wise ablation against background expectation
    const nSamples = Math.min(25, backgroundSample.length);
    for (let f = 0; f < FEATURE_NAMES.length; f++) {
      let marginalSum = 0;
      for (let s = 0; s < nSamples; s++) {
        const bg = backgroundSample[s];
        const bgVec = FEATURE_NAMES.map(name => bg[name]);

        // with feature f
        const withF = [...bgVec];
        withF[f] = x[f];
        const predWith = this.predict(withF);

        // without feature f (using background value)
        const predWithout = this.predict(bgVec);

        marginalSum += predWith - predWithout;
      }
      shapValues[f] = marginalSum / nSamples;
    }

    // Normalize so sum(shapValues) equals (pred - baseVal)
    const rawSum = shapValues.reduce((a, b) => a + b, 0);
    const targetDiff = pred - baseVal;
    if (Math.abs(rawSum) > 0.0001) {
      const scale = targetDiff / rawSum;
      for (let i = 0; i < shapValues.length; i++) {
        shapValues[i] *= scale;
      }
    }

    const featureContributions: ShapValue[] = FEATURE_NAMES.map((name, i) => ({
      feature: name,
      displayName: FEATURE_LABELS[name] || name,
      value: Number(x[i].toFixed(2)),
      shap_value: Number(shapValues[i].toFixed(4)),
    }));

    // Global importance from background sample
    const globalAcc = new Array(FEATURE_NAMES.length).fill(0);
    for (const bg of backgroundSample.slice(0, 30)) {
      const bgX = FEATURE_NAMES.map(f => bg[f]);
      const bgPred = this.predict(bgX);
      for (let f = 0; f < FEATURE_NAMES.length; f++) {
        const replaced = [...bgX];
        replaced[f] = this.trainFeatureMean[f] ?? bgX[f];
        globalAcc[f] += Math.abs(bgPred - this.predict(replaced));
      }
    }
    const globalCount = Math.min(30, backgroundSample.length);
    const globalImportance = FEATURE_NAMES.map((name, i) => ({
      feature: name,
      displayName: FEATURE_LABELS[name] || name,
      mean_abs_shap: Number((globalAcc[i] / globalCount).toFixed(4)),
    })).sort((a, b) => b.mean_abs_shap - a.mean_abs_shap);

    return {
      base_value: Number(baseVal.toFixed(3)),
      prediction: Number(pred.toFixed(3)),
      features: featureContributions.sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value)),
      global_importance: globalImportance,
    };
  }

  /**
   * LIME local surrogate: generates local perturbations, weights by kernel, fits linear surrogate
   */
  explainLIME(featureRow: FeatureRow): LimeExplanation {
    const x = FEATURE_NAMES.map(f => featureRow[f]);
    const pred = this.predict(x);

    // Perturb instance 80 times with Gaussian jitter
    const perturbations: number[][] = [];
    const distances: number[] = [];
    const nPerturb = 60;

    for (let i = 0; i < nPerturb; i++) {
      const perturbed: number[] = [];
      let distSq = 0;
      for (let j = 0; j < x.length; j++) {
        const std = Math.max(0.1, Math.abs(x[j]) * 0.25);
        const noise = (Math.random() - 0.5) * 2 * std;
        const val = Math.max(0, x[j] + noise);
        perturbed.push(val);
        distSq += ((val - x[j]) / std) ** 2;
      }
      perturbations.push(perturbed);
      distances.push(Math.sqrt(distSq));
    }

    // Exponential kernel weights: exp(-d^2 / sigma^2)
    const sigma = 3.0;
    const weights = distances.map(d => Math.exp(-(d ** 2) / (sigma ** 2)));
    const yPerturbed = perturbations.map(p => this.predict(p));

    // Approximate linear surrogate coefficients: cov(x_j, y) / var(x_j)
    const rules: LimeRule[] = [];
    for (let j = 0; j < x.length; j++) {
      const xjVals = perturbations.map(p => p[j]);
      const meanX = xjVals.reduce((a, b) => a + b, 0) / nPerturb;
      const meanY = yPerturbed.reduce((a, b) => a + b, 0) / nPerturb;

      let cov = 0;
      let varX = 0;
      for (let k = 0; k < nPerturb; k++) {
        cov += weights[k] * (xjVals[k] - meanX) * (yPerturbed[k] - meanY);
        varX += weights[k] * (xjVals[k] - meanX) ** 2;
      }
      const beta = varX > 0.00001 ? cov / varX : 0;
      const featName = FEATURE_NAMES[j];
      const val = x[j];

      let ruleText = '';
      if (featName === 'hour') {
        ruleText = `Hour is ${Math.round(val)}:00 (peak diurnal window)`;
      } else if (featName.includes('lag')) {
        ruleText = `${FEATURE_LABELS[featName]} = ${val.toFixed(2)} kWh`;
      } else if (featName.includes('rolling')) {
        ruleText = `${FEATURE_LABELS[featName]} = ${val.toFixed(2)} kWh baseline`;
      } else if (featName === 'is_weekend') {
        ruleText = val === 1 ? 'Weekend schedule' : 'Weekday schedule';
      } else {
        ruleText = `${FEATURE_LABELS[featName] || featName} = ${val.toFixed(1)}`;
      }

      rules.push({
        rule: ruleText,
        weight: Number(beta.toFixed(4)),
        effect: beta >= 0 ? 'increases_consumption' : 'decreases_consumption',
      });
    }

    rules.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

    return {
      prediction: Number(pred.toFixed(3)),
      intercept: Number(this.basePrediction.toFixed(3)),
      rules: rules.slice(0, 6),
    };
  }
}

// Isolation Tree Node
interface IsolationTreeNode {
  isLeaf: boolean;
  size: number;
  splitFeature?: number;
  splitValue?: number;
  left?: IsolationTreeNode;
  right?: IsolationTreeNode;
}

function buildIsolationTree(X: number[][], currentHeight: number, maxHeight: number): IsolationTreeNode {
  if (currentHeight >= maxHeight || X.length <= 1) {
    return { isLeaf: true, size: X.length };
  }

  const nFeatures = X[0].length;
  // Pick random feature
  const splitFeature = Math.floor(Math.random() * nFeatures);
  const vals = X.map(row => row[splitFeature]);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);

  if (minVal === maxVal) {
    return { isLeaf: true, size: X.length };
  }

  // Pick uniform random split value
  const splitValue = minVal + Math.random() * (maxVal - minVal);
  const leftX = X.filter(row => row[splitFeature] < splitValue);
  const rightX = X.filter(row => row[splitFeature] >= splitValue);

  return {
    isLeaf: false,
    size: X.length,
    splitFeature,
    splitValue,
    left: buildIsolationTree(leftX, currentHeight + 1, maxHeight),
    right: buildIsolationTree(rightX, currentHeight + 1, maxHeight),
  };
}

function pathLength(x: number[], node: IsolationTreeNode, currentPath: number): number {
  if (node.isLeaf) {
    return currentPath + cFactor(node.size);
  }
  if (node.splitFeature !== undefined && node.splitValue !== undefined) {
    if (x[node.splitFeature] < node.splitValue) {
      return pathLength(x, node.left!, currentPath + 1);
    } else {
      return pathLength(x, node.right!, currentPath + 1);
    }
  }
  return currentPath;
}

function cFactor(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  const eulerMascheroni = 0.5772156649;
  return 2 * (Math.log(n - 1) + eulerMascheroni) - (2 * (n - 1)) / n;
}

/**
 * Isolation Forest for Anomaly Detection
 */
export class IsolationForestAnomalyDetector {
  private trees: IsolationTreeNode[] = [];
  private subSampleSize: number = 128;
  private nTrees: number = 60;
  private maxHeight: number = 8;
  private threshold: number = 0.60;
  public contamination: number = 0.05;

  constructor(nTrees = 60, contamination = 0.05, subSampleSize = 128) {
    this.nTrees = nTrees;
    this.contamination = contamination;
    this.subSampleSize = subSampleSize;
    this.maxHeight = Math.ceil(Math.log2(subSampleSize));
  }

  fit(data: FeatureRow[]) {
    const X = data.map(r => FEATURE_NAMES.map(f => r[f]));
    this.trees = [];

    for (let t = 0; t < this.nTrees; t++) {
      // Subsample
      const sampleSize = Math.min(this.subSampleSize, X.length);
      const sampleIndices = new Set<number>();
      while (sampleIndices.size < sampleSize) {
        sampleIndices.add(Math.floor(Math.random() * X.length));
      }
      const sample = Array.from(sampleIndices).map(idx => X[idx]);
      const tree = buildIsolationTree(sample, 0, this.maxHeight);
      this.trees.push(tree);
    }

    // Calibrate threshold from scores to match contamination
    const scores = X.map(x => this.scoreInstance(x));
    scores.sort((a, b) => b - a); // descending
    const cutoffIndex = Math.min(scores.length - 1, Math.floor(scores.length * this.contamination));
    this.threshold = scores[cutoffIndex] || 0.60;
  }

  scoreInstance(x: number[]): number {
    let sumPaths = 0;
    for (const tree of this.trees) {
      sumPaths += pathLength(x, tree, 0);
    }
    const avgPath = sumPaths / this.trees.length;
    const c = cFactor(this.subSampleSize);
    if (c === 0) return 0.5;
    // Anomaly score: 2^(-E(h)/c)
    return Math.pow(2, -avgPath / c);
  }

  detect(data: FeatureRow[], forecastStd: number = 0.25): AnomalyPoint[] {
    const results: AnomalyPoint[] = [];

    // Compute empirical stats for context
    const kwhVals = data.map(r => r.target);
    const meanKwh = kwhVals.reduce((a, b) => a + b, 0) / kwhVals.length;
    const stdKwh = Math.sqrt(kwhVals.reduce((a, b) => a + (b - meanKwh) ** 2, 0) / kwhVals.length);

    for (const row of data) {
      const x = FEATURE_NAMES.map(f => row[f]);
      const score = this.scoreInstance(x);
      const isAnomaly = score >= this.threshold;

      const zScore = stdKwh > 0 ? (row.target - meanKwh) / stdKwh : 0;
      let severity: AnomalyPoint['severity'] = 'normal';
      let explanation = 'Consumption aligns with expected seasonal and diurnal patterns.';

      if (isAnomaly) {
        if (Math.abs(zScore) >= 3.0) {
          severity = 'severe_outlier';
          explanation = `Extreme deviation: ${row.target.toFixed(2)} kWh is ${Math.abs(zScore).toFixed(1)}σ from the mean (${meanKwh.toFixed(2)} kWh). Unusually high sudden load.`;
        } else if (forecastStd > 0.40) {
          severity = 'high_uncertainty_deviation';
          explanation = `Unusual pattern during high-variance period (forecast uncertainty ±${(1.96 * forecastStd).toFixed(2)} kWh). Model confidence is lower.`;
        } else {
          severity = 'low_uncertainty_anomaly';
          explanation = `Statistically unusual consumption (${row.target.toFixed(2)} kWh vs baseline ${row.rolling_mean_24.toFixed(2)} kWh) with high model certainty (anomaly score: ${score.toFixed(3)}).`;
        }
      }

      results.push({
        timestamp: row.timestamp,
        observed_kwh: Number(row.target.toFixed(3)),
        anomaly_score: Number(score.toFixed(3)),
        is_anomaly: isAnomaly,
        severity,
        explanation,
      });
    }

    return results;
  }
}
