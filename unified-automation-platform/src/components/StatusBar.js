import React from 'react';

const StatusBar = ({ wsStatus, systemStatus, authStatus, projectCount, taskCount }) => {
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

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <div className="status-item">
          <div 
            className="status-indicator-dot" 
            style={{ backgroundColor: getStatusColor(wsStatus) }}
          />
          <span>WebSocket: {wsStatus}</span>
        </div>
        
        <div className="status-item">
          <span>Projects: {projectCount}</span>
        </div>
        
        <div className="status-item">
          <span>Tasks: {taskCount}</span>
        </div>
        
        <div className="status-item">
          <span>Auth: {authStatus.isAuthenticated ? 'Connected' : 'Not Connected'}</span>
        </div>
      </div>
      
      <div className="status-bar-right">
        <div className="status-item">
          <span>CPU: {Math.round(systemStatus.cpu)}%</span>
        </div>
        
        <div className="status-item">
          <span>Memory: {Math.round(systemStatus.memory)}%</span>
        </div>
        
        <div className="status-item">
          <span>Disk: {Math.round(systemStatus.disk)}%</span>
        </div>
        
        <div className="status-item">
          <span>{new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
