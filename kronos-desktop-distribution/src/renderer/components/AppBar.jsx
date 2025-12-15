import React from 'react';
import { useKronosAPI } from '../hooks/useKronosAPI';
import '../App.css';

function AppBar({ config, onConfigChange, onOpenPreferences }) {
  const { getAppInfo } = useKronosAPI();

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {/* KRONOS Logo */}
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">K</span>
            </div>
            
            {/* App Title */}
            <div>
              <h1 className="text-xl font-bold text-white">KRONOS Desktop Agent</h1>
              <div className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                AI Automation Platform
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenPreferences}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-white text-sm transition-colors duration-200"
              title="Preferences"
            >
              ⚙️
            </button>
            
            <button
              onClick={() => window.kronosApp.checkUpdates()}
              className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-white text-sm transition-colors duration-200"
              title="Check for Updates"
            >
              ↻
            </button>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center space-x-4 text-sm text-gray-300">
          <span>Theme:</span>
          <select
            value={config?.theme || 'dark'}
            onChange={(e) => onConfigChange({ ...config, theme: e.target.value })}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="auto">Auto</option>
          </select>
          
          <span className="ml-4">
            {config?.services?.ai ? '🟢 AI Active' : '🔴 AI Inactive'}
          </span>
          
          <span className="ml-2">
            v{getAppInfo()?.version || '1.0.0'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default AppBar;