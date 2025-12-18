import React, { useState, useEffect } from 'react';
import { AppBar } from './components/AppBar';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { StatusBar } from './components/StatusBar';
import { useKronosAPI } from './hooks/useKronosAPI';
import './App.css';

function App() {
  const [config, setConfig] = useState(null);
  const [servicesStatus, setServicesStatus] = useState({});
  const [appInfo, setAppInfo] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const { 
    getConfig, 
    getAppInfo, 
    getServicesStatus,
    restartServices 
  } = useKronosAPI();

  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoading(true);
        
        // Load configuration
        const configData = await getConfig();
        setConfig(configData);
        
        // Load app info
        const appInfoData = await getAppInfo();
        setAppInfo(appInfoData);
        
        // Load services status
        const statusData = await getServicesStatus();
        setServicesStatus(statusData);
        
      } catch (error) {
        console.error('Failed to load initial data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadInitialData();
  }, [getConfig, getAppInfo, getServicesStatus]);

  const handleConfigChange = async (newConfig) => {
    try {
      await window.kronosConfig.setConfig(newConfig);
      setConfig(newConfig);
    } catch (error) {
      console.error('Failed to update config:', error);
    }
  };

  const handleRestartServices = async () => {
    try {
      await restartServices();
      const statusData = await getServicesStatus();
      setServicesStatus(statusData);
    } catch (error) {
      console.error('Failed to restart services:', error);
    }
  };

  const handleOpenPreferences = () => {
    // Open preferences modal or navigate to settings
    window.kronosEvents.onPreferencesOpen(() => {
      // Handle preferences opening
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-t-blue-500 border-gray-300 rounded-full mb-4"></div>
          <p className="text-lg">Loading KRONOS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <AppBar 
        config={config}
        onConfigChange={handleConfigChange}
        onOpenPreferences={handleOpenPreferences}
      />
      
      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar 
          config={config}
          servicesStatus={servicesStatus}
        />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* App Info Bar */}
          <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-bold text-blue-400">KRONOS Desktop Agent</h1>
                <span className="text-sm text-gray-400">
                  v{appInfo.version || '1.0.0'}
                </span>
                <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
                  {appInfo.platform || 'Unknown'} {appInfo.arch || ''}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRestartServices}
                  className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm text-white transition-colors duration-200"
                  title="Restart AI Services"
                >
                  Restart Services
                </button>
                
                <button
                  onClick={handleOpenPreferences}
                  className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm text-white transition-colors duration-200"
                  title="Preferences"
                >
                  ⚙️ Settings
                </button>
              </div>
            </div>
          </div>
          
          {/* Main Content */}
          <MainContent 
            config={config}
            servicesStatus={servicesStatus}
          />
        </div>
      </div>
      
      {/* Status Bar */}
      <StatusBar 
        config={config}
        servicesStatus={servicesStatus}
        appInfo={appInfo}
      />
    </div>
  );
}

export default App;