import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Applications } from './pages/Applications';
import { Devices } from './pages/Devices';
import { Services } from './pages/Services';
import { Workflows } from './pages/Workflows';
import { Settings } from './pages/Settings';
import { StatusBar } from './components/StatusBar';
import './App.css';

type Page = 'dashboard' | 'applications' | 'devices' | 'services' | 'workflows' | 'settings';

export function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [systemStatus, setSystemStatus] = useState({
    servicesRunning: 0,
    devicesConnected: 0,
    workflowsActive: 0,
    cpuUsage: 0,
    memoryUsage: 0,
  });

  useEffect(() => {
    // Update system status periodically
    const interval = setInterval(async () => {
      try {
        const services = await window.electron.ipcRenderer.invoke('service:list');
        const devices = await window.electron.ipcRenderer.invoke('device:list');
        const workflows = await window.electron.ipcRenderer.invoke('workflow:list');

        setSystemStatus({
          servicesRunning: services.filter((s: any) => s.status === 'running').length,
          devicesConnected: devices.filter((d: any) => d.status === 'connected').length,
          workflowsActive: workflows.filter((w: any) => w.enabled).length,
          cpuUsage: Math.random() * 100,
          memoryUsage: Math.random() * 100,
        });
      } catch (error) {
        console.error('Failed to update system status:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard systemStatus={systemStatus} />;
      case 'applications':
        return <Applications />;
      case 'devices':
        return <Devices />;
      case 'services':
        return <Services />;
      case 'workflows':
        return <Workflows />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard systemStatus={systemStatus} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      <div className="main-content">
        <div className="page-content">{renderPage()}</div>
        <StatusBar systemStatus={systemStatus} />
      </div>
    </div>
  );
}

export default App;
