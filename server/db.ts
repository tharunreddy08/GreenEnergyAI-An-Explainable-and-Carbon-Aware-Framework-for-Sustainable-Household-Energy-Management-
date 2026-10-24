import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

let dbInstance: Database | null = null;
const DB_FILE = path.resolve(process.cwd(), 'data', 'greenenergy.db');

export async function getDatabase(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  const SQL = await initSqlJs();
  const dataDir = path.dirname(DB_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  initSchema(dbInstance);
  saveDatabase();
  return dbInstance;
}

function initSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL, -- 'uci', 'uploaded', 'synthetic'
      filename TEXT,
      created_at TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      start_date TEXT,
      end_date TEXT,
      sampling_interval_minutes REAL,
      missing_count INTEGER,
      cleaned_count INTEGER,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dataset_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dataset_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      global_active_power REAL NOT NULL, -- kW
      energy_kwh REAL NOT NULL,          -- calculated from interval
      voltage REAL,
      global_intensity REAL,
      sub_metering_1 REAL,
      sub_metering_2 REAL,
      sub_metering_3 REAL,
      is_anomaly INTEGER DEFAULT 0,
      FOREIGN KEY (dataset_id) REFERENCES datasets(id)
    );

    CREATE INDEX IF NOT EXISTS idx_records_dataset_time ON dataset_records(dataset_id, timestamp);

    CREATE TABLE IF NOT EXISTS model_runs (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL,
      model_type TEXT NOT NULL, -- 'xgboost_forecast', 'isolation_forest'
      created_at TEXT NOT NULL,
      mae REAL,
      rmse REAL,
      r2 REAL,
      train_rows INTEGER,
      val_rows INTEGER,
      test_rows INTEGER,
      hyperparameters TEXT,
      metrics_json TEXT
    );

    CREATE TABLE IF NOT EXISTS anomaly_runs (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL,
      contamination REAL NOT NULL,
      anomaly_count INTEGER NOT NULL,
      total_analyzed INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      results_json TEXT
    );

    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL,
      name TEXT NOT NULL,
      reduction_pct REAL NOT NULL,
      tariff_rate REAL NOT NULL,
      emission_factor REAL NOT NULL,
      baseline_kwh REAL NOT NULL,
      scenario_kwh REAL NOT NULL,
      saved_kwh REAL NOT NULL,
      cost_diff REAL NOT NULL,
      co2_diff REAL NOT NULL,
      assumptions TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generated_reports (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL,
      title TEXT NOT NULL,
      report_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      summary_json TEXT NOT NULL
    );
  `);
}

export function saveDatabase() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Failed to save SQLite database to disk:', err);
  }
}
