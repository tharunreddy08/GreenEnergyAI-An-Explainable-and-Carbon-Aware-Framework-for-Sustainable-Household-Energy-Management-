# GreenEnergyAI: AI-Powered Household Energy Management System

> **Tagline:** Intelligent Energy Insights for a Sustainable Home  
> **Academic Engineering Project & Decision Engine Prototype**

---

## 1. Executive Summary & Problem Statement

Modern household electricity consumers face high energy bills, volatile tariffs, and increasing carbon footprints while lacking actionable insights into their power demand. Traditional residential electricity meters only record aggregate, monthly kilowatt-hour consumption figures after the billing cycle ends. They offer no forward-looking demand forecasting, no statistical detection of unusual consumption surges, no explainability for why demand fluctuates, and no capability to test "what-if" conservation scenarios before altering household routines.

**GreenEnergyAI** addresses these limitations by introducing a software-based **Smart Energy Decision Engine** combining:
1. **Historical Electricity Telemetry & Dataset Ingestion:** Handles the official benchmark UCI Individual Household Electric Power Consumption dataset and user-uploaded CSV files.
2. **AI Consumption Forecasting:** Uses **XGBoost** regression tree ensembles with chronological train-validation-test splitting to prevent future data leakage.
3. **Unusual Consumption Detection:** Uses **Isolation Forest** tree ensembles with calibrated sensitivity to isolate statistical anomalies.
4. **Explainable AI (XAI):** Deploys **TreeSHAP** (Shapley Additive Explanations) for global/local feature attributions and **LIME** (Local Interpretable Model-agnostic Explanations) for local rule surrogates.
5. **What-If Scenario Simulation:** Evaluates user-defined reduction targets, tariffs, and grid emission factors with transparent mathematical formulas.
6. **Household Energy Digital Twin (Innovation 1):** Unifies historical loads, machine learning demand forecasts, and what-if simulation overlays into a single virtual household model.
7. **Uncertainty-Aware Energy Alerts (Innovation 2):** Pairs Isolation Forest anomaly scores with XGBoost prediction intervals to distinguish high-confidence anomalies from lifestyle variance during high-uncertainty periods.
8. **Multi-Objective Recommendation Optimizer (Innovation 3):** Ranks candidate household interventions across user-weighted priorities (kWh volume, financial billing cost, and carbon emissions).

*Important Scope Notice:* This prototype is completely software-based and operates on historical and uploaded datasets. Physical IoT sensor hardware integration (PZEM-004T and ESP32 microcontrollers) is reserved as a future enhancement.

---

## 2. System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          GreenEnergyAI Platform                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   [ Client Layer - React 19 + TypeScript + Tailwind CSS + Recharts ]   │
│   ├─ Overview Dashboard (KPIs, diurnal curve, demand forecast)        │
│   ├─ Dataset Management (UCI semicolon ingestion, missing '?' handler)│
│   ├─ What-If Energy Simulation (Scenario comparison dashboard)         │
│   ├─ Household Energy Digital Twin (Virtual profile & load curves)    │
│   ├─ XGBoost Forecasting (Recursive horizon, prediction intervals)    │
│   ├─ Uncertainty-Aware Alerts (Calibrated alert digest)               │
│   ├─ Explainable AI (Global SHAP, local waterfall, LIME rules)        │
│   ├─ Carbon Emissions & Sustainability Score Calculator               │
│   ├─ Multi-Objective Recommendation Optimizer (Pareto ranking)         │
│   └─ Technical Audit Reports (JSON, CSV, and printable views)          │
│                                                                        │
│                              ▲                                         │
│                              │ REST APIs (/api/*)                      │
│                              ▼                                         │
│                                                                        │
│   [ Server & ML Engine - Node/Express + Python/FastAPI Standalone ]    │
│   ├─ Ingestion Pipeline (Delimiter sniffing, DD/MM/YYYY parsing)      │
│   ├─ Power-to-Energy Converter (Energy = Power [kW] × Δt [hr])        │
│   ├─ Feature Engineering (Lags 1/2/24, rolling means 6/24, diurnal)   │
│   ├─ Chronological Splitting (70% train / 15% val / 15% test)         │
│   ├─ XGBoost Gradient Boosted Trees Ensemble                          │
│   ├─ Isolation Forest Anomaly Detection (c(n) average path length)    │
│   ├─ TreeSHAP Attribution & LIME Sparse Surrogate Engine              │
│   ├─ Multi-Objective Weighted Ranking Optimizer                       │
│   └─ Persistence Layer (SQLite: greenenergy.db)                       │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Supported Datasets & Ingestion Pipeline

### A. Official Benchmark Dataset: UCI Individual Household Electric Power Consumption
- **Source:** [UCI Machine Learning Repository](https://archive.ics.uci.edu/dataset/235/individual+household+electric+power+consumption)
- **Format:** Semicolon-delimited (`;`), with decimal numbers using either periods or commas.
- **Missing Values:** Represented as `'?'` in the original raw telemetry.
- **Signal Definition:** `Global_active_power` is measured in **kilowatts (kW)**.
- **Conversion Formula:**
  $$\text{Energy (kWh)} = \text{Global\_active\_power (kW)} \times \left(\frac{\Delta t \text{ (minutes)}}{60}\right)$$
  For hourly sampling ($\Delta t = 60$), $1.0\text{ kW} \times 1.0\text{ hr} = 1.0\text{ kWh}$.
- **Cleaning Policy:** Rows with `'?'` or missing timestamps are filtered and reported rather than artificially substituted with zero, avoiding artificial distortion of nocturnal baseline load.

### B. Synthetic Household Demonstration Dataset
- Simulates realistic 24-hour diurnal patterns:
  - Basal continuous load (0.25 - 0.40 kW) for refrigeration and standby electronics.
  - Morning shower and breakfast spike (7:00 - 9:00).
  - Midday plateau (11:00 - 14:00) with weekend afternoon variation.
  - Evening cooking, lighting, and HVAC surge (18:00 - 22:00).
  - Controlled anomalous spikes (e.g., continuous heating or unexpected load drops) for calibrating anomaly detectors.
- Clearly labeled as synthetic demonstration data (never claimed as real physical sensor readings).

---

## 4. Machine Learning & Analytical Methodology

### A. AI Demand Forecasting (XGBoost)
- **Algorithm:** Gradient Boosted Decision Tree Ensemble.
- **Feature Set:**
  - `lag_1`: Electricity consumption 1 hour prior.
  - `lag_2`: Electricity consumption 2 hours prior.
  - `lag_24`: Electricity consumption at the same hour yesterday.
  - `rolling_mean_6`: 6-hour moving average baseline.
  - `rolling_mean_24`: 24-hour daily moving average.
  - Diurnal calendar features: `hour` (0-23), `day_of_week` (0-6), `is_weekend`, `month`.
- **Chronological Split:**
  - Training Set: First 70% of chronological observations.
  - Validation Set: Middle 15% (used for hyperparameter calibration and residual standard deviation estimation).
  - Test Set: Final 15% (strictly held out for MAE, RMSE, and $R^2$ reporting).
- **Multi-Step Recursive Horizon:** Previous model predictions dynamically populate lags for steps $t+1, t+2, \dots, t+H$.
- **Prediction Interval:**
  $$\left[\hat{y} - 1.96 \cdot \sigma_{\text{resid}} \sqrt{1 + 0.04 \cdot h}, \; \hat{y} + 1.96 \cdot \sigma_{\text{resid}} \sqrt{1 + 0.04 \cdot h}\right]$$

### B. Anomaly Detection (Isolation Forest)
- **Algorithm:** Isolation Forest constructing ensemble isolation trees via random attribute cuts.
- **Anomaly Score:**
  $$s(x, n) = 2^{-\frac{\mathbb{E}[h(x)]}{c(n)}}$$
  where $h(x)$ is path length and $c(n)$ is average path length of unsuccessful searches in a Binary Search Tree.
- **Contamination Parameter:** User-configurable (1% to 12%) to adjust statistical sensitivity.

### C. Explainable AI (TreeSHAP & LIME)
- **TreeSHAP:** Decomposes prediction $f(x) = \phi_0 + \sum_{i=1}^M \phi_i$, where $\phi_0 = \mathbb{E}[f(X)]$ is the base expectation and $\phi_i$ is feature attribution.
- **LIME:** Generates Gaussian perturbations in the local neighborhood of an observation, weights instances using an exponential kernel $\pi_x(z) = \exp(-D(x, z)^2 / \sigma^2)$, and fits an interpretable linear surrogate with transparent rule boundaries.
- **Interpretability Disclaimer:** Feature importance reflects mathematical model attribution, not physical causation.

---

## 5. Innovation Modules

### Innovation Module 1: Household Energy Digital Twin
Maintains a virtual household profile integrating:
1. Historical baseline parameters (base load kW, peak surge kW, daily average kWh, load regularity factor).
2. Continuous 24-hour synchronized trajectory comparing historical load, XGBoost machine learning demand, and what-if simulation overlays with uncertainty envelopes.
3. Statistical demand disaggregation across primary household load categories (Refrigeration/Base, HVAC/Thermal, Kitchen/Cooking, Lighting/Tech) with explicit confidence notes.

### Innovation Module 2: Uncertainty-Aware Energy Alerts
Combines Isolation Forest anomaly scores with XGBoost prediction intervals to categorize alerts into:
- **High-Confidence Anomaly (Low Uncertainty):** Observation deviates from expectations while the forecast prediction interval is narrow (high model confidence).
- **Potential Deviation (High Uncertainty):** Observation falls outside nominal bounds, but forecast variance is also elevated (model uncertainty is high; user advised to monitor before acting).
- **Severe Extreme Outlier:** Observed load exceeds $3.0\sigma$ from baseline.

### Innovation Module 3: Multi-Objective Recommendation Optimizer
Ranks potential household energy conservation actions based on user-weighted objective priorities:
$$\text{Score} = w_{\text{kWh}} \cdot \bar{S}_{\text{kWh}} + w_{\text{Cost}} \cdot \bar{S}_{\text{Cost}} + w_{\text{CO}_2} \cdot \bar{S}_{\text{CO}_2}$$
where $\sum w_i = 1.0$.

Each recommendation provides:
- Title and category.
- Projected 30-day energy savings (kWh).
- Estimated cost difference ($) using the configured tariff.
- Estimated carbon reduction (kg CO₂) using the configured grid emission factor.
- Supporting historical observation from dataset.
- Defensible physical assumptions.

---

## 6. What-If Energy Simulation Formulas

$$\text{Scenario Energy} = \text{Baseline Energy} \times \left(1 - \frac{\text{Reduction \%}}{100}\right)$$
$$\text{Energy Savings} = \text{Baseline Energy} - \text{Scenario Energy}$$
$$\text{Estimated Cost Difference} = \text{Energy Savings} \times \text{Tariff Rate (\$/kWh)}$$
$$\text{Estimated }\text{CO}_2\text{ Difference} = \text{Energy Savings} \times \text{Emission Factor (kg }\text{CO}_2\text{/kWh)}$$

---

## 7. Windows PowerShell Setup & Execution Instructions

### A. Running the Full-Stack Web Application (Node / Vite / Express)
The repository includes a self-contained fullstack Node/TypeScript server running on port 3000:

```powershell
# 1. Install dependencies
npm install

# 2. Start the integrated dev server (Port 3000)
npm run dev

# 3. Open browser
Start-Process "http://localhost:3000"
```

### B. Running the Standalone Python 3.11 + FastAPI Backend (Optional)
If running with a local Python 3.11 environment:

```powershell
# 1. Open PowerShell and navigate to backend directory
cd backend

# 2. Create and activate a Python virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Run automated test suite
pytest tests/test_pipeline.py -v

# 5. Start FastAPI backend with Uvicorn
uvicorn app.main:app --reload --port 8000

# 6. Access interactive Swagger API documentation
Start-Process "http://localhost:8000/docs"
```

---
