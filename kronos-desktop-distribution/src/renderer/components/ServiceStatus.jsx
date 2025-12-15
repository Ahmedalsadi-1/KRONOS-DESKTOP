import React, { useState, useEffect } from 'react';
import { useKronosAPI } from '../hooks/useKronosAPI';
import '../App.css';

function ServiceStatus({ config, servicesStatus }) {
  const { getServicesStatus, restartServices } = useKronosAPI();

  const [isRestarting, setIsRestarting] = useState(false);

  const handleRestart = async () => {
    setIsRestarting(true);
    try {
      await restartServices();
      const updatedStatus = await getServicesStatus();
      // Update would come from parent
    } catch (error) {
      console.error('Failed to restart services:', error);
    } finally {
      setIsRestarting(false);
    }
  };

  const getServiceIcon = (service, isActive) => {
    const icons = {
      ai: isActive ? '🟢' : '🔴',
      webAutomation: isActive ? '🌐' : '⏸️',
      computerVision: isActive ? '👁️' : '👁️',
      androidControl: isActive ? '📱' : '📲',
      core: isActive ? '⚙️' : '⚠️'
    };
    return icons[service] || '❓';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold text-blue-400 mb-4">AI Services Status</h3>
      
      <div className="space-y-4">
        {/* Service Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* AI Core Services */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-white">AI Core Services</h4>
              <span className={`text-2xl ${isRestarting ? 'animate-pulse' : ''}`}>
                {getServiceIcon('ai', servicesStatus.ai)}
              </span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={servicesStatus.ai ? 'text-green-400' : 'text-red-400'}>
                  {servicesStatus.ai ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Version:</span>
                <span className="text-gray-300">2.1.0</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Uptime:</span>
                <span className="text-gray-300">2h 34m</span>
              </div>
            </div>
            
            <button
              onClick={handleRestart}
              disabled={isRestarting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-3 py-2 rounded text-sm transition-colors duration-200"
            >
              {isRestarting ? 'Restarting...' : 'Restart Services'}
            </button>
          </div>

          {/* Computer Vision */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-white">Computer Vision</h4>
              <span className="text-2xl">
                {getServiceIcon('computerVision', servicesStatus.computerVision)}
              </span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={servicesStatus.computerVision ? 'text-green-400' : 'text-red-400'}>
                  {servicesStatus.computerVision ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">OCR Engine:</span>
                <span className="text-gray-300">Tesseract.js</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Processing:</span>
                <span className="text-gray-300">Ready</span>
              </div>
            </div>
          </div>

          {/* Web Automation */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-white">Web Automation</h4>
              <span className="text-2xl">
                {getServiceIcon('webAutomation', servicesStatus.webAutomation)}
              </span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={servicesStatus.webAutomation ? 'text-green-400' : 'text-red-400'}>
                  {servicesStatus.webAutomation ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Browser:</span>
                <span className="text-gray-300">Chrome (Headless)</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Sessions:</span>
                <span className="text-gray-300">0 active</span>
              </div>
            </div>
          </div>

          {/* Android Control */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-white">Android Control</h4>
              <span className="text-2xl">
                {getServiceIcon('androidControl', servicesStatus.androidControl)}
              </span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={servicesStatus.androidControl ? 'text-green-400' : 'text-red-400'}>
                  {servicesStatus.androidControl ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">ADB:</span>
                <span className="text-gray-300">Connected</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Devices:</span>
                <span className="text-gray-300">1 detected</span>
              </div>
            </div>
          </div>
        </div>

        {/* System Resources */}
        <div className="mt-6">
          <h4 className="font-medium text-gray-300 mb-3">System Resources</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">CPU Usage:</span>
              <span className="text-yellow-400">45%</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Memory:</span>
              <span className="text-yellow-400">2.1GB / 8GB</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Disk Space:</span>
              <span className="text-yellow-400">15.3GB / 50GB</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Network:</span>
              <span className="text-green-400">Connected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ServiceStatus;