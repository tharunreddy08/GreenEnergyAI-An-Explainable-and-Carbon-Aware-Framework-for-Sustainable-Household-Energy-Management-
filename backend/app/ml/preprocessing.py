"""
GreenEnergyAI - Preprocessing & Feature Engineering Pipeline
Handles UCI semicolon format, missing values '?', interval detection, and kW to kWh conversion.
"""
import pandas as pd
import numpy as np
from typing import Tuple, Dict, Any

def parse_uci_dataset(file_path_or_buffer) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    # Read semicolon separated with ? as NA
    df = pd.read_csv(
        file_path_or_buffer,
        sep=';',
        na_values=['?'],
        low_memory=False
    )
    
    total_raw = len(df)
    missing_count = df.isna().sum().sum()
    
    # Drop rows where Date, Time or Global_active_power are missing
    df = df.dropna(subset=['Date', 'Time', 'Global_active_power'])
    valid_rows = len(df)
    
    # Parse DateTime (UCI is DD/MM/YYYY)
    df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'], format='%d/%m/%Y %H:%M:%S', errors='coerce')
    df = df.dropna(subset=['Datetime'])
    df = df.sort_values('Datetime').drop_duplicates(subset=['Datetime'])
    
    # Convert numeric fields
    numeric_cols = ['Global_active_power', 'Global_reactive_power', 'Voltage', 'Global_intensity', 'Sub_metering_1', 'Sub_metering_2', 'Sub_metering_3']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            
    # Interval in minutes
    if len(df) > 1:
        time_diffs = df['Datetime'].diff().dt.total_seconds().dropna() / 60.0
        median_interval = float(time_diffs.median())
    else:
        median_interval = 60.0
        
    # Power (kW) to Energy (kWh): Energy = Power * (interval_minutes / 60)
    df['Energy_kWh'] = df['Global_active_power'] * (median_interval / 60.0)
    
    quality_report = {
        "total_raw_rows": total_raw,
        "valid_rows": valid_rows,
        "missing_values_count": int(missing_count),
        "sampling_interval_minutes": median_interval,
        "start_date": str(df['Datetime'].min()),
        "end_date": str(df['Datetime'].max()),
        "total_energy_kwh": float(df['Energy_kWh'].sum()),
        "assumptions": [
            "Primary power: Global_active_power in kW",
            f"Interval: {median_interval:.1f} minutes",
            "Energy formula: Energy (kWh) = Active Power (kW) * (interval / 60)",
            "Strictly dropped rows with '?' rather than artificial zero substitution"
        ]
    }
    
    return df, quality_report

def create_time_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df['hour'] = df['Datetime'].dt.hour
    df['day_of_week'] = df['Datetime'].dt.dayofweek
    df['is_weekend'] = df['day_of_week'].apply(lambda x: 1 if x in [5, 6] else 0)
    df['month'] = df['Datetime'].dt.month
    
    df['lag_1'] = df['Energy_kWh'].shift(1)
    df['lag_2'] = df['Energy_kWh'].shift(2)
    df['lag_24'] = df['Energy_kWh'].shift(24)
    
    df['rolling_mean_6'] = df['Energy_kWh'].shift(1).rolling(window=6).mean()
    df['rolling_mean_24'] = df['Energy_kWh'].shift(1).rolling(window=24).mean()
    
    return df.dropna()
