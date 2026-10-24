import fs from 'fs';
import path from 'path';

export function ensureSampleDataExists() {
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const uciPath = path.join(dataDir, 'household_power_consumption_sample.txt');
  if (fs.existsSync(uciPath)) return;

  const lines: string[] = [];
  // Official UCI Header
  lines.push('Date;Time;Global_active_power;Global_reactive_power;Voltage;Global_intensity;Sub_metering_1;Sub_metering_2;Sub_metering_3');

  // Generate 720 hours (30 days) of hourly sampled UCI-format observations
  const startDate = new Date('2026-01-01T00:00:00Z');
  for (let i = 0; i < 720; i++) {
    const curDate = new Date(startDate.getTime() + i * 3600 * 1000);
    const day = String(curDate.getUTCDate()).padStart(2, '0');
    const month = String(curDate.getUTCMonth() + 1).padStart(2, '0');
    const year = curDate.getUTCFullYear();
    const dateStr = `${day}/${month}/${year}`;

    const hour = curDate.getUTCHours();
    const timeStr = `${String(hour).padStart(2, '0')}:00:00`;

    // Occasional '?' missing values in UCI dataset (e.g. at hour 35 and hour 120)
    if (i === 35 || i === 120 || i === 410) {
      lines.push(`${dateStr};${timeStr};?;?;?;?;?;?;?`);
      continue;
    }

    // Typical power in kW
    let power = 0.35 + Math.sin((hour - 6) / 24 * Math.PI * 2) * 0.2 + Math.random() * 0.15;
    if (hour >= 7 && hour <= 9) power += 1.2 + Math.random() * 0.8;
    if (hour >= 18 && hour <= 22) power += 2.0 + Math.random() * 1.4;
    if (i === 210 || i === 540) power += 4.2; // Anomaly spike

    const reactive = (power * 0.15 + Math.random() * 0.05).toFixed(3);
    const voltage = (235.0 + (Math.random() - 0.5) * 6).toFixed(2);
    const intensity = ((power * 1000) / 235).toFixed(1);
    const sub1 = hour >= 18 && hour <= 20 ? (15 + Math.random() * 8).toFixed(1) : '0.0';
    const sub2 = hour >= 7 && hour <= 9 ? (10 + Math.random() * 4).toFixed(1) : '0.0';
    const sub3 = (power > 1.2 ? 16 + Math.random() * 6 : 2 + Math.random() * 2).toFixed(1);

    lines.push(`${dateStr};${timeStr};${power.toFixed(3)};${reactive};${voltage};${intensity};${sub1};${sub2};${sub3}`);
  }

  fs.writeFileSync(uciPath, lines.join('\n'));
}
