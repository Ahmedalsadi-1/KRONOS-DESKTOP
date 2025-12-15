import React from 'react';
import { ServiceStatus } from './ServiceStatus';
import { SystemMonitor } from './SystemMonitor';
import { ProjectManager } from './ProjectManager';
import './App.css';

function Sidebar({ config, servicesStatus }) {
  const [activeSection, setActiveSection] = useState('overview');

  const menuItems = [
    {
      id: 'overview',
      name: 'Overview',
      icon: '🏠',
      component: Overview
    },
    {
      id: 'services',
      name: 'AI Services',
      icon: '🤖',
      component: ServiceStatus
    },
    {
      id: 'system',
      name: 'System Monitor',
      icon: '📊',
      component: SystemMonitor
    },
    {
      id: 'projects',
      name: 'Projects',
      icon: '📁',
      component: ProjectManager
    }
  ];

  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">K</span>
          </div>
          <div>
            <div className="text-white font-bold">KRONOS</div>
            <div className="text-xs text-gray-400">Desktop Agent</div>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 py-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={`w-full flex items-center px-4 py-3 text-left transition-colors duration-200 ${
              activeSection === item.id
                ? 'bg-gray-700 text-white border-l-2 border-blue-400'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white border-l-2 border-transparent'
            }`}
          >
            <span className="text-xl mr-3">{item.icon}</span>
            <span className="font-medium">{item.name}</span>
          </button>
        ))}
      </div>

      {/* Configuration Quick Access */}
      <div className="border-t border-gray-700 p-4">
        <div className="text-xs text-gray-400 font-medium mb-2">Quick Access</div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs">Auto-start</span>
            <button className="text-xs bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded text-gray-300">
              {config?.autoStart ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs">Dark Theme</span>
            <button className="text-xs bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded text-gray-300">
              {config?.theme === 'dark' ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs">AI Services</span>
            <button className="text-xs bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded text-gray-300">
              {config?.services?.ai ? 'Active' : 'Inactive'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;