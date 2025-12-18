import React from 'react';
import { Sidebar } from './Sidebar';
import './App.css';

function StatusBar({ config, servicesStatus, appInfo }) {
  return (
    <div className="bg-gray-900 border-t border-gray-700 px-6 py-2">
      <div className="flex items-center justify-between text-sm text-gray-300">
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center">
            <span className="text-green-400 mr-1">●</span>
            <span>AI Services Connected</span>
          </div>
          
          {/* Theme Status */}
          <div className="flex items-center">
            <span className="text-blue-400 mr-1">●</span>
            <span>Theme: {config?.theme || 'dark'}</span>
          </div>
          
          {/* Auto-start Status */}
          {config?.autoStart && (
            <div className="flex items-center">
              <span className="text-yellow-400 mr-1">●</span>
              <span>Auto-start enabled</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-6">
          {/* App Version */}
          <div className="flex items-center">
            <span className="text-gray-400">v{appInfo?.version || '1.0.0'}</span>
            <span className="text-gray-500 bg-gray-700 px-2 py-1 rounded">
              {appInfo?.platform || 'Unknown'}
            </span>
          </div>

          {/* System Resources */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <span className="text-gray-400">CPU:</span>
              <span className="text-yellow-400">42%</span>
            </div>
            
            <div className="flex items-center">
              <span className="text-gray-400">Memory:</span>
              <span className="text-yellow-400">2.1GB</span>
            </div>
            
            <div className="flex items-center">
              <span className="text-gray-400">Disk:</span>
              <span className="text-green-400">15.3GB</span>
            </div>
          </div>
          
          {/* Time */}
          <div className="text-gray-400">
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatusBar;