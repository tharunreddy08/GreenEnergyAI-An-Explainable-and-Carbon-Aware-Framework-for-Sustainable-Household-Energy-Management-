import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewPage } from './pages/OverviewPage';
import { DatasetPage } from './pages/DatasetPage';
import { SimulationPage } from './pages/SimulationPage';
import { DigitalTwinPage } from './pages/DigitalTwinPage';
import { ForecastingPage } from './pages/ForecastingPage';
import { AnomalyAlertsPage } from './pages/AnomalyAlertsPage';
import { ExplainabilityPage } from './pages/ExplainabilityPage';
import { EmissionsPage } from './pages/EmissionsPage';
import { OptimizerPage } from './pages/OptimizerPage';
import { ReportsPage } from './pages/ReportsPage';
import { fetchDatasets, selectUciDataset, generateSynthetic } from './services/api';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [datasetId, setDatasetId] = useState<string>('uci-household-sample');
  const [datasetName, setDatasetName] = useState<string>('UCI Household Benchmark');
  const [sourceType, setSourceType] = useState<string>('uci');
  const [tariff, setTariff] = useState<number>(0.18);
  const [emissionFactor, setEmissionFactor] = useState<number>(0.385);
  const [rowCount, setRowCount] = useState<number>(720);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    initApp();
  }, []);

  async function initApp() {
    try {
      const res = await fetchDatasets();
      if (res.datasets && res.datasets.length > 0) {
        const primary = res.datasets[0];
        setDatasetId(primary.id);
        setDatasetName(primary.name);
        setSourceType(primary.source_type);
        setRowCount(primary.row_count);
      }
    } catch (e) {
      console.error('Failed to initialize datasets list:', e);
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const res = await fetchDatasets();
      const current = res.datasets.find(d => d.id === datasetId) || res.datasets[0];
      if (current) {
        setDatasetId(current.id);
        setDatasetName(current.name);
        setSourceType(current.source_type);
        setRowCount(current.row_count);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  }

  async function handleSelectDatasetType(type: 'uci' | 'synthetic') {
    setIsRefreshing(true);
    try {
      if (type === 'uci') {
        const res = await selectUciDataset();
        setDatasetId(res.dataset_id);
        setDatasetName(res.name);
        setSourceType('uci');
        setRowCount(res.quality.valid_rows);
      } else {
        const res = await generateSynthetic(30);
        setDatasetId(res.dataset_id);
        setDatasetName(res.name);
        setSourceType('synthetic');
        setRowCount(res.quality.valid_rows);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleDatasetChange(id: string, name: string, type: string) {
    setDatasetId(id);
    setDatasetName(name);
    setSourceType(type);
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Persistent Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        datasetName={datasetName}
        rowCount={rowCount}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <Header
          currentTab={currentTab}
          datasetName={datasetName}
          sourceType={sourceType}
          tariff={tariff}
          emissionFactor={emissionFactor}
          onRefresh={handleRefresh}
          onSelectDatasetType={handleSelectDatasetType}
          onNavigate={setCurrentTab}
          isRefreshing={isRefreshing}
        />

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto pb-12">
            {currentTab === 'overview' && (
              <OverviewPage
                datasetId={datasetId}
                tariff={tariff}
                emissionFactor={emissionFactor}
                onNavigate={setCurrentTab}
              />
            )}
            {currentTab === 'datasets' && (
              <DatasetPage
                currentDatasetId={datasetId}
                onDatasetChange={handleDatasetChange}
              />
            )}
            {currentTab === 'simulation' && (
              <SimulationPage
                datasetId={datasetId}
                tariff={tariff}
                emissionFactor={emissionFactor}
                onUpdateTariff={setTariff}
                onUpdateEmissionFactor={setEmissionFactor}
              />
            )}
            {currentTab === 'digital-twin' && (
              <DigitalTwinPage datasetId={datasetId} />
            )}
            {currentTab === 'forecasting' && (
              <ForecastingPage datasetId={datasetId} />
            )}
            {currentTab === 'anomalies' && (
              <AnomalyAlertsPage datasetId={datasetId} />
            )}
            {currentTab === 'explainability' && (
              <ExplainabilityPage datasetId={datasetId} />
            )}
            {currentTab === 'emissions' && (
              <EmissionsPage
                datasetId={datasetId}
                emissionFactor={emissionFactor}
                onUpdateEmissionFactor={setEmissionFactor}
              />
            )}
            {currentTab === 'optimizer' && (
              <OptimizerPage
                datasetId={datasetId}
                tariff={tariff}
                emissionFactor={emissionFactor}
              />
            )}
            {currentTab === 'reports' && (
              <ReportsPage
                datasetId={datasetId}
                tariff={tariff}
                emissionFactor={emissionFactor}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
