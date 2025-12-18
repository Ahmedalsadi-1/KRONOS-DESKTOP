import React from 'react';
import { AppBar } from './AppBar';
import { ServiceStatus } from './ServiceStatus';
import { ChatInterface } from './ChatInterface';
import { SystemMonitor } from './SystemMonitor';
import { ProjectManager } from './ProjectManager';
import '../App.css';

function MainContent({ config, servicesStatus }) {
  return (
    <div className="flex-1 bg-gray-900 text-white overflow-auto">
      {/* Welcome Section */}
      <div className="p-6 border-b border-gray-700">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 mb-4">
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to KRONOS</h2>
          <p className="text-blue-100 leading-relaxed">
            Your AI-powered desktop automation platform is ready! Start exploring the features below.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-3xl mb-2">🤖</div>
            <h3 className="font-medium text-blue-400 mb-1">AI Services</h3>
            <p className="text-sm text-gray-400">
              {servicesStatus.ai ? 'Active' : 'Initializing...'}
            </p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-3xl mb-2">🔍</div>
            <h3 className="font-medium text-green-400 mb-1">Computer Vision</h3>
            <p className="text-sm text-gray-400">
              {servicesStatus.computerVision ? 'Ready' : 'Loading...'}
            </p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-3xl mb-2">🌐</div>
            <h3 className="font-medium text-purple-400 mb-1">Web Automation</h3>
            <p className="text-sm text-gray-400">
              {servicesStatus.webAutomation ? 'Active' : 'Loading...'}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-700">
        <div className="flex">
          <button className="px-6 py-3 text-blue-400 border-b-2 border-blue-400 font-medium hover:text-blue-300">
            Overview
          </button>
          <button className="px-6 py-3 text-gray-400 border-b-2 border-transparent hover:text-gray-300">
            AI Chat
          </button>
          <button className="px-6 py-3 text-gray-400 border-b-2 border-transparent hover:text-gray-300">
            Projects
          </button>
          <button className="px-6 py-3 text-gray-400 border-b-2 border-transparent hover:text-gray-300">
            Tools
          </button>
          <button className="px-6 py-3 text-gray-400 border-b-2 border-transparent hover:text-gray-300">
            Settings
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6">
        <ServiceStatus config={config} servicesStatus={servicesStatus} />
        <ChatInterface config={config} />
        <SystemMonitor config={config} />
        <ProjectManager config={config} />
      </div>
    </div>
  );
}

export default MainContent;