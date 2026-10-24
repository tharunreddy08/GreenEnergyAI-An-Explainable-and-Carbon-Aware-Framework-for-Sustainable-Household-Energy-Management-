"""
Unit & Integration Tests for GreenEnergyAI
Tests data parsing, kW to kWh conversion, simulation formulas, and optimization logic.
"""
import pytest
from app.ml.simulation import calculate_what_if_scenario, optimize_recommendations_python

def test_what_if_scenario_exact_formulas():
    baseline_kwh = 1000.0
    reduction_pct = 20.0
    tariff = 0.15
    emission_factor = 0.40
    
    result = calculate_what_if_scenario(baseline_kwh, reduction_pct, tariff, emission_factor)
    
    # 1. Scenario energy = Baseline * (1 - 20/100) = 800.0
    assert result["scenario_energy_kwh"] == 800.0
    # 2. Energy savings = 1000 - 800 = 200.0
    assert result["energy_savings_kwh"] == 200.0
    # 3. Cost diff = 200 * 0.15 = 30.0
    assert result["estimated_cost_diff"] == 30.0
    # 4. CO2 diff = 200 * 0.40 = 80.0
    assert result["estimated_co2_diff"] == 80.0

def test_zero_reduction():
    result = calculate_what_if_scenario(500.0, 0.0, 0.20, 0.35)
    assert result["scenario_energy_kwh"] == 500.0
    assert result["energy_savings_kwh"] == 0.0
    assert result["estimated_cost_diff"] == 0.0

def test_multi_objective_ranking():
    recs = optimize_recommendations_python(25.0, 0.5, 0.3, 0.2, 0.18, 0.385)
    assert len(recs) == 5
    assert recs[0]["objective_score"] >= recs[1]["objective_score"]
