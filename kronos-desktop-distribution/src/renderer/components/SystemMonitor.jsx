import React, { useState, useEffect } from 'react';
import { useKronosAPI } from '../hooks/useKronosAPI';
import '../App.css';

function SystemMonitor({ config }) {
  const { getAppInfo } = useKronosAPI();
  
  const [systemStats, setSystemStats] = useState({
    cpu: 0,
    memory: 0,
    disk: 0,
    network: 'connected',
    uptime: '0h 0m'
  });

  useEffect(() => {
    // Simulate real-time system monitoring
    const interval = setInterval(() => {
      // Simulate CPU usage (in real app, this would use actual system APIs)
      const cpuUsage = Math.floor(Math.random() * 30) + 20;
      
      // Simulate memory usage
      const memoryUsage = Math.floor(Math.random() * 40) + 30;
      
      // Simulate disk usage
      const diskUsage = Math.floor(Math.random() * 20) + 15;
      
      // Update uptime
      const now = new Date();
      const uptime = `${Math.floor((now - new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)) / 1000 / 60)}h ${Math.floor((now - new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)) % 60)}m`;

      setSystemStats({
        cpu: cpuUsage,
        memory: memoryUsage,
        disk: diskUsage,
        network: Math.random() > 0.3 ? 'slow' : 'connected',
        uptime
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getUsageColor = (usage) => {
    if (usage >= 80) return 'text-red-400';
    if (usage >= 60) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getNetworkIcon = (status) => {
    switch (status) {
      case 'connected': return '🟢';
      case 'slow': return '🟡';
      case 'disconnected': return '🔴';
      default: return '⚪';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold text-blue-400 mb-4">System Monitor</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* CPU Usage */}
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-white">CPU Usage</h4>
            <div className="flex items-center">
              <div className="w-16 bg-gray-600 rounded-full h-2 mr-2">
                <div 
                  className="bg-green-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${systemStats.cpu}%` }}
                ></div>
              </div>
              <span className={`text-sm font-medium ${getUsageColor(systemStats.cpu)}`}>
                {systemStats.cpu}%
              </span>
            </div>
          </div>
          
          {/* Memory Usage */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-white">Memory Usage</h4>
              <div className="flex items-center">
                <div className="w-16 bg-gray-600 rounded-full h-2 mr-2">
                  <div 
                    className="bg-yellow-400 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${systemStats.memory}%` }}
                  ></div>
                </div>
                <span className={`text-sm font-medium ${getUsageColor(systemStats.memory)}`}>
                  {systemStats.memory}%
                </span>
              </div>
            </div>
          </div>
          
          {/* Disk Usage */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-white">Disk Usage</h4>
              <div className="flex items-center">
                <div className="w-16 bg-gray-600 rounded-full h-2 mr-2">
                  <div 
                    className="bg-blue-400 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${systemStats.disk}%` }}
                  ></div>
                </div>
                <span className={`text-sm font-medium ${getUsageColor(systemStats.disk)}`}>
                  {systemStats.disk}%
                </span>
              </div>
            </div>
          </div>
          
          {/* Network Status */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-white">Network Status</h4>
              <div className="flex items-center">
                <span className="text-2xl mr-2">
                  {getNetworkIcon(systemStats.network)}
                </span>
                <span className={`text-sm font-medium ${
                  systemStats.network === 'connected' ? 'text-green-400' :
                  systemStats.network === 'slow' ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {systemStats.network}
                </span>
              </div>
            </div>
          </div>
        </div>

      {/* System Info */}
      <div className="mt-6">
        <h4 className="font-medium text-gray-300 mb-3">System Information</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Platform:</span>
            <span className="text-gray-300">{getAppInfo()?.platform || 'Unknown'}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">Architecture:</span>
            <span className="text-gray-300">{getAppInfo()?.arch || 'Unknown'}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">Uptime:</span>
            <span className="text-gray-300">{systemStats.uptime}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">Electron:</span>
            <span className="text-gray-300">{getAppInfo()?.electronVersion || 'Unknown'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SystemMonitor;