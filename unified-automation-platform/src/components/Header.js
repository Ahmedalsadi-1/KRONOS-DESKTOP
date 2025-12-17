import React from 'react';

const Header = ({ currentView, onViewChange, wsStatus, systemStatus }) => {
  const views = [
    { id: 'projects', label: 'Projects', icon: '📁' },
    { id: 'tasks', label: 'Tasks', icon: '✅' },
    { id: 'auth', label: 'Authentication', icon: '🔐' },
    { id: 'system', label: 'System', icon: '💻' }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
      case 'healthy':
        return '#28a745';
      case 'disconnected':
      case 'error':
        return '#dc3545';
      case 'warning':
        return '#ffc107';
      default:
        return '#6c757d';
    }
  };

  return (
    <header className="header">
      <div className="header-content">
        <div>
          <h1 className="header-title">Unified Automation Platform</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
            Manage AI computer automation projects
          </p>
        </div>
        
        <nav className="header-nav">
          {views.map((view) => (
            <button
              key={view.id}
              className={`nav-button ${currentView === view.id ? 'active' : ''}`}
              onClick={() => onViewChange(view.id)}
            >
              <span style={{ marginRight: '4px' }}>{view.icon}</span>
              {view.label}
            </button>
          ))}
        </nav>
        
        <div className="header-status">
          <div className="status-item">
            <div 
              className="status-indicator-dot" 
              style={{ backgroundColor: getStatusColor(wsStatus) }}
            />
            <span>WebSocket: {wsStatus}</span>
          </div>
          
          <div className="status-item">
            <div 
              className="status-indicator-dot" 
              style={{ backgroundColor: getStatusColor(systemStatus.cpu < 80 ? 'healthy' : 'warning') }}
            />
            <span>CPU: {Math.round(systemStatus.cpu)}%</span>
          </div>
          
          <div className="status-item">
            <div 
              className="status-indicator-dot" 
              style={{ backgroundColor: getStatusColor(systemStatus.memory < 80 ? 'healthy' : 'warning') }}
            />
            <span>Memory: {Math.round(systemStatus.memory)}%</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
