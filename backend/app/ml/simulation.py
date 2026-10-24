"""
GreenEnergyAI - What-If Energy Simulation, Digital Twin & Multi-Objective Optimizer
"""
from typing import Dict, Any, List

def calculate_what_if_scenario(
    baseline_energy_kwh: float,
    reduction_percentage: float,
    tariff_rate: float,
    emission_factor: float
) -> Dict[str, Any]:
    reduction_frac = max(0.0, min(100.0, reduction_percentage)) / 100.0
    scenario_energy_kwh = baseline_energy_kwh * (1.0 - reduction_frac)
    energy_savings_kwh = baseline_energy_kwh - scenario_energy_kwh
    estimated_cost_diff = energy_savings_kwh * tariff_rate
    estimated_co2_diff = energy_savings_kwh * emission_factor
    
    return {
        "baseline_energy_kwh": round(baseline_energy_kwh, 2),
        "scenario_energy_kwh": round(scenario_energy_kwh, 2),
        "energy_savings_kwh": round(energy_savings_kwh, 2),
        "estimated_cost_diff": round(estimated_cost_diff, 2),
        "estimated_co2_diff": round(estimated_co2_diff, 2),
        "formulas": {
            "scenario_energy": "Scenario energy = Baseline energy * (1 - reduction_percentage / 100)",
            "energy_savings": "Energy savings = Baseline energy - Scenario energy",
            "cost_difference": "Estimated cost difference = Energy savings * configured tariff",
            "co2_difference": "Estimated CO2 difference = Energy savings * configured emission factor"
        }
    }

def optimize_recommendations_python(
    avg_daily_kwh: float,
    w_kwh: float,
    w_cost: float,
    w_co2: float,
    tariff: float,
    emission_factor: float
) -> List[Dict[str, Any]]:
    actions = [
        {"title": "Peak Load Shifting to Off-Peak Windows", "pct": 0.10, "cost_bonus": 1.25, "co2_bonus": 1.15},
        {"title": "Standby Base Load Mitigation", "pct": 0.08, "cost_bonus": 1.0, "co2_bonus": 1.0},
        {"title": "Thermal Setpoint Optimization", "pct": 0.14, "cost_bonus": 1.1, "co2_bonus": 1.2},
        {"title": "Appliance Eco-Cycle Utilization", "pct": 0.06, "cost_bonus": 1.0, "co2_bonus": 1.05},
        {"title": "Weekend Concurrency Load Management", "pct": 0.09, "cost_bonus": 1.0, "co2_bonus": 1.0},
    ]
    
    total_w = (w_kwh + w_cost + w_co2) or 1.0
    w1, w2, w3 = w_kwh / total_w, w_cost / total_w, w_co2 / total_w
    
    results = []
    for a in actions:
        saved_kwh = avg_daily_kwh * a["pct"] * 30
        cost_diff = saved_kwh * tariff * a["cost_bonus"]
        co2_diff = saved_kwh * emission_factor * a["co2_bonus"]
        raw_score = (w1 * a["pct"] * 10 + w2 * (cost_diff / 50) + w3 * (co2_diff / 25)) * 10
        score = min(98, max(45, int(raw_score)))
        results.append({
            "title": a["title"],
            "projected_savings_kwh": round(saved_kwh, 1),
            "estimated_cost_diff": round(cost_diff, 2),
            "estimated_co2_diff": round(co2_diff, 2),
            "objective_score": score
        })
    results.sort(key=lambda x: x["objective_score"], reverse=True)
    return results
