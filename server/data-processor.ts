export interface RawEnergyRow {
  timestamp: string; // ISO string
  global_active_power: number; // kW
  energy_kwh: number;
  voltage?: number;
  global_intensity?: number;
  sub_metering_1?: number;
  sub_metering_2?: number;
  sub_metering_3?: number;
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

export interface FeatureRow {
  timestamp: string;
  target: number; // energy_kwh or active_power
  hour: number;
  day_of_week: number;
  is_weekend: number;
  month: number;
  lag_1: number;
  lag_2: number;
  lag_24: number;
  rolling_mean_6: number;
  rolling_mean_24: number;
}

/**
 * Parses raw text from UCI semicolon delimited or standard CSV
 */
export function parseCSVData(rawContent: string): { rows: RawEnergyRow[]; quality: DataQualityReport } {
  const lines = rawContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('Dataset must contain at least a header row and data rows.');
  }

  const headerLine = lines[0];
  const isSemicolon = headerLine.includes(';');
  const delimiter = isSemicolon ? ';' : ',';
  const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));

  // Detect column indices
  let dateIdx = headers.findIndex(h => /^(date|timestamp|datetime|time)$/i.test(h));
  let timeIdx = headers.findIndex(h => /^time$/i.test(h) && h.toLowerCase() !== headers[dateIdx]?.toLowerCase());
  let powerIdx = headers.findIndex(h => /^(global_active_power|active_power|power|kw|consumption|kwh)$/i.test(h));
  const voltageIdx = headers.findIndex(h => /^voltage$/i.test(h));
  const intensityIdx = headers.findIndex(h => /^(global_intensity|intensity)$/i.test(h));
  const sub1Idx = headers.findIndex(h => /^sub_metering_1$/i.test(h));
  const sub2Idx = headers.findIndex(h => /^sub_metering_2$/i.test(h));
  const sub3Idx = headers.findIndex(h => /^sub_metering_3$/i.test(h));

  if (powerIdx === -1) {
    // If not found, try 2nd or 3rd column if UCI
    if (isSemicolon && headers.length >= 3) {
      powerIdx = 2; // In UCI: Date;Time;Global_active_power
    } else {
      throw new Error(`Unable to find electricity power or consumption column in header: ${headers.join(', ')}. Supported columns: Global_active_power, active_power, power, kw, kwh.`);
    }
  }

  let missingCount = 0;
  let invalidRows = 0;
  const parsedRows: RawEnergyRow[] = [];
  const seenTimestamps = new Set<string>();
  let duplicates = 0;

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
    if (parts.length < 2) continue;

    // Parse timestamp
    let isoTimestamp = '';
    try {
      if (dateIdx !== -1 && timeIdx !== -1) {
        const rawDate = parts[dateIdx];
        const rawTime = parts[timeIdx];
        if (!rawDate || !rawTime || rawDate === '?' || rawTime === '?') {
          missingCount++;
          invalidRows++;
          continue;
        }
        isoTimestamp = parseDateTime(rawDate, rawTime);
      } else if (dateIdx !== -1) {
        const rawDateTime = parts[dateIdx];
        if (!rawDateTime || rawDateTime === '?') {
          missingCount++;
          invalidRows++;
          continue;
        }
        isoTimestamp = new Date(rawDateTime).toISOString();
      } else {
        // Fallback synthetic index
        const now = new Date('2026-01-01T00:00:00Z');
        now.setHours(now.getHours() + i - 1);
        isoTimestamp = now.toISOString();
      }
    } catch {
      invalidRows++;
      continue;
    }

    if (seenTimestamps.has(isoTimestamp)) {
      duplicates++;
      continue;
    }
    seenTimestamps.add(isoTimestamp);

    // Parse power
    const rawPower = parts[powerIdx];
    if (rawPower === '?' || rawPower === '' || rawPower === undefined) {
      missingCount++;
      invalidRows++;
      continue;
    }

    const powerVal = parseFloat(rawPower.replace(',', '.'));
    if (isNaN(powerVal) || powerVal < 0 || powerVal > 50) {
      invalidRows++;
      continue;
    }

    const voltVal = voltageIdx !== -1 && parts[voltageIdx] !== '?' ? parseFloat(parts[voltageIdx]?.replace(',', '.')) : undefined;
    const intVal = intensityIdx !== -1 && parts[intensityIdx] !== '?' ? parseFloat(parts[intensityIdx]?.replace(',', '.')) : undefined;
    const s1 = sub1Idx !== -1 && parts[sub1Idx] !== '?' ? parseFloat(parts[sub1Idx]?.replace(',', '.')) : undefined;
    const s2 = sub2Idx !== -1 && parts[sub2Idx] !== '?' ? parseFloat(parts[sub2Idx]?.replace(',', '.')) : undefined;
    const s3 = sub3Idx !== -1 && parts[sub3Idx] !== '?' ? parseFloat(parts[sub3Idx]?.replace(',', '.')) : undefined;

    parsedRows.push({
      timestamp: isoTimestamp,
      global_active_power: powerVal,
      energy_kwh: powerVal, // Will be scaled by interval below
      voltage: isNaN(voltVal ?? NaN) ? undefined : voltVal,
      global_intensity: isNaN(intVal ?? NaN) ? undefined : intVal,
      sub_metering_1: isNaN(s1 ?? NaN) ? undefined : s1,
      sub_metering_2: isNaN(s2 ?? NaN) ? undefined : s2,
      sub_metering_3: isNaN(s3 ?? NaN) ? undefined : s3,
    });
  }

  // Sort chronologically
  parsedRows.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Determine sampling interval
  let avgIntervalMinutes = 60; // Default 1 hour
  if (parsedRows.length >= 2) {
    const diffs: number[] = [];
    for (let i = 1; i < Math.min(parsedRows.length, 50); i++) {
      const diffMs = new Date(parsedRows[i].timestamp).getTime() - new Date(parsedRows[i - 1].timestamp).getTime();
      const diffMins = diffMs / (1000 * 60);
      if (diffMins > 0 && diffMins < 1440) {
        diffs.push(diffMins);
      }
    }
    if (diffs.length > 0) {
      avgIntervalMinutes = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    }
  }

  // Convert active power (kW) to energy (kWh): Energy (kWh) = Power (kW) * (interval in minutes / 60)
  const hourMultiplier = avgIntervalMinutes / 60;
  for (const row of parsedRows) {
    row.energy_kwh = Number((row.global_active_power * hourMultiplier).toFixed(4));
  }

  const powers = parsedRows.map(r => r.global_active_power);
  const minP = powers.length ? Math.min(...powers) : 0;
  const maxP = powers.length ? Math.max(...powers) : 0;
  const meanP = powers.length ? powers.reduce((a, b) => a + b, 0) / powers.length : 0;
  const totalKwh = parsedRows.reduce((a, b) => a + b.energy_kwh, 0);

  const quality: DataQualityReport = {
    total_raw_rows: lines.length - 1,
    valid_rows: parsedRows.length,
    missing_values_count: missingCount,
    invalid_rows_removed: invalidRows,
    duplicate_timestamps_found: duplicates,
    start_date: parsedRows[0]?.timestamp ?? '',
    end_date: parsedRows[parsedRows.length - 1]?.timestamp ?? '',
    sampling_interval_minutes: Number(avgIntervalMinutes.toFixed(2)),
    active_power_min: Number(minP.toFixed(3)),
    active_power_max: Number(maxP.toFixed(3)),
    active_power_mean: Number(meanP.toFixed(3)),
    total_energy_kwh: Number(totalKwh.toFixed(2)),
    assumptions: [
      `Primary power signal: Global_active_power in kW.`,
      `Sampling interval detected: ${avgIntervalMinutes.toFixed(1)} minutes.`,
      `Energy calculation formula: Energy (kWh) = Active Power (kW) × (${avgIntervalMinutes.toFixed(1)} / 60) hours.`,
      `Missing values ('?' or empty) strictly filtered without artificial zero-substitution.`,
      `Duplicate timestamps dropped keeping first occurrence. Chronologically sorted.`,
    ],
  };

  return { rows: parsedRows, quality };
}

function parseDateTime(dateStr: string, timeStr: string): string {
  // UCI date is DD/MM/YYYY
  let year: number, month: number, day: number;
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
    } else {
      throw new Error('Invalid date');
    }
  } else if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    }
  } else {
    throw new Error('Invalid date');
  }

  const timeParts = timeStr.split(':');
  const hours = parseInt(timeParts[0] || '0', 10);
  const minutes = parseInt(timeParts[1] || '0', 10);
  const seconds = parseInt(timeParts[2] || '0', 10);

  const d = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  return d.toISOString();
}

/**
 * Generates synthetic household energy consumption data
 */
export function generateSyntheticDataset(days: number = 30): { rows: RawEnergyRow[]; quality: DataQualityReport } {
  const rows: RawEnergyRow[] = [];
  const startDate = new Date('2026-02-01T00:00:00Z');
  const totalHours = days * 24;

  for (let h = 0; h < totalHours; h++) {
    const currentDate = new Date(startDate.getTime() + h * 60 * 60 * 1000);
    const hour = currentDate.getUTCHours();
    const dayOfWeek = currentDate.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Basal load (refrigerator, standby, electronics)
    let powerKw = 0.25 + Math.random() * 0.15;

    // Morning peak (7:00 - 9:00): breakfast, kettle, shower
    if (hour >= 7 && hour <= 9) {
      const peakFactor = isWeekend ? 0.8 : 1.4;
      powerKw += peakFactor * (1.2 + Math.random() * 0.9);
    }

    // Midday (11:00 - 14:00): lunch, appliances
    if (hour >= 11 && hour <= 14) {
      const middayFactor = isWeekend ? 1.2 : 0.4;
      powerKw += middayFactor * (0.8 + Math.random() * 0.6);
    }

    // Evening peak (17:00 - 22:00): cooking, lighting, HVAC, entertainment
    if (hour >= 17 && hour <= 22) {
      powerKw += 2.1 + Math.random() * 1.5;
    }

    // Night minimum (01:00 - 05:00)
    if (hour >= 1 && hour <= 5) {
      powerKw = Math.max(0.15, powerKw * 0.6);
    }

    // Occasional controlled anomaly: unexpected heavy load spikes or irregular daytime surge
    let isAnomaly = false;
    if (h === 48 || h === 150 || h === 312 || h === 480) {
      powerKw += 4.5 + Math.random() * 2.0; // heavy abnormal draw (e.g. heating left running or space heater)
      isAnomaly = true;
    } else if (h === 96 || h === 240) {
      powerKw = 0.05; // abnormal drop
      isAnomaly = true;
    }

    // Synthetic sub-meterings
    const sm1 = hour >= 18 && hour <= 20 ? 12 + Math.random() * 8 : (Math.random() < 0.1 ? 5 : 0); // Kitchen
    const sm2 = (hour >= 7 && hour <= 9) || (hour >= 20 && hour <= 22) ? 8 + Math.random() * 5 : 0; // Laundry / water heater
    const sm3 = powerKw > 1.5 ? 18 + Math.random() * 6 : 4 + Math.random() * 2; // Water heater & AC

    const energyKwh = Number((powerKw * 1.0).toFixed(3)); // 1 hour interval -> 1 hour * power kW = kWh

    rows.push({
      timestamp: currentDate.toISOString(),
      global_active_power: Number(powerKw.toFixed(3)),
      energy_kwh: energyKwh,
      voltage: Number((230 + (Math.random() - 0.5) * 8).toFixed(1)),
      global_intensity: Number(((powerKw * 1000) / 230).toFixed(2)),
      sub_metering_1: Number(sm1.toFixed(1)),
      sub_metering_2: Number(sm2.toFixed(1)),
      sub_metering_3: Number(sm3.toFixed(1)),
    });
  }

  const powers = rows.map(r => r.global_active_power);
  const minP = Math.min(...powers);
  const maxP = Math.max(...powers);
  const meanP = powers.reduce((a, b) => a + b, 0) / powers.length;
  const totalKwh = rows.reduce((a, b) => a + b.energy_kwh, 0);

  const quality: DataQualityReport = {
    total_raw_rows: rows.length,
    valid_rows: rows.length,
    missing_values_count: 0,
    invalid_rows_removed: 0,
    duplicate_timestamps_found: 0,
    start_date: rows[0].timestamp,
    end_date: rows[rows.length - 1].timestamp,
    sampling_interval_minutes: 60,
    active_power_min: Number(minP.toFixed(3)),
    active_power_max: Number(maxP.toFixed(3)),
    active_power_mean: Number(meanP.toFixed(3)),
    total_energy_kwh: Number(totalKwh.toFixed(2)),
    assumptions: [
      'Synthetic demonstration dataset: Simulated hourly household load patterns over 30 days.',
      'Includes diurnal rhythm (morning/evening peaks, weekend variations, basal refrigerator load).',
      'Contains 6 controlled anomalous periods for anomaly detection calibration.',
      'Clearly labeled as synthetic demonstration data (never claimed as real physical sensor measurements).',
      'Energy formula: Energy (kWh) = Active Power (kW) × 1.0 hour.',
    ],
  };

  return { rows, quality };
}

/**
 * Builds chronological time-series features without data leakage
 */
export function extractFeatures(rows: RawEnergyRow[]): FeatureRow[] {
  if (rows.length < 25) {
    throw new Error('At least 25 consecutive observations are required to engineer lag and rolling window features.');
  }

  const features: FeatureRow[] = [];

  for (let i = 24; i < rows.length; i++) {
    const row = rows[i];
    const d = new Date(row.timestamp);
    const hour = d.getUTCHours();
    const dayOfWeek = d.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;
    const month = d.getUTCMonth() + 1;

    const lag1 = rows[i - 1].energy_kwh;
    const lag2 = rows[i - 2].energy_kwh;
    const lag24 = rows[i - 24].energy_kwh;

    // Rolling 6 steps
    let sum6 = 0;
    for (let k = 1; k <= 6; k++) {
      sum6 += rows[i - k].energy_kwh;
    }
    const rolling6 = sum6 / 6;

    // Rolling 24 steps
    let sum24 = 0;
    for (let k = 1; k <= 24; k++) {
      sum24 += rows[i - k].energy_kwh;
    }
    const rolling24 = sum24 / 24;

    features.push({
      timestamp: row.timestamp,
      target: row.energy_kwh,
      hour,
      day_of_week: dayOfWeek,
      is_weekend: isWeekend,
      month,
      lag_1: Number(lag1.toFixed(4)),
      lag_2: Number(lag2.toFixed(4)),
      lag_24: Number(lag24.toFixed(4)),
      rolling_mean_6: Number(rolling6.toFixed(4)),
      rolling_mean_24: Number(rolling24.toFixed(4)),
    });
  }

  return features;
}

/**
 * Chronological split: Train (70%), Validation (15%), Test (15%)
 */
export function chronologicalSplit<T>(data: T[]): { train: T[]; val: T[]; test: T[] } {
  const n = data.length;
  const trainEnd = Math.floor(n * 0.70);
  const valEnd = Math.floor(n * 0.85);

  return {
    train: data.slice(0, trainEnd),
    val: data.slice(trainEnd, valEnd),
    test: data.slice(valEnd),
  };
}
