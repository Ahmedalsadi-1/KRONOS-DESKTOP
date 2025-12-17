import React, { useState, useEffect } from 'react';

const SystemMonitor = ({ systemStatus }) => {
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  useEffect(() => {
    let interval;
    if (isAutoRefresh) {
      interval = setInterval(() => {
        // Trigger a system status refresh
        window.electronAPI.getSystemStatus().then(status => {
          // This will be handled by the event listener in the parent component
        });
      }, refreshInterval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAutoRefresh, refreshInterval]);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (value, thresholds = { warning: 70, critical: 90 }) => {
    if (value >= thresholds.critical) return '#dc3545';
    if (value >= thresholds.warning) return '#ffc107';
    return '#28a745';
  };

  const getStatusText = (value, thresholds = { warning: 70, critical: 90 }) => {
    if (value >= thresholds.critical) return 'Critical';
    if (value >= thresholds.warning) return 'Warning';
    return 'Good';
  };

  const systemStats = [
    {
      title: 'CPU Usage',
      value: `${Math.round(systemStatus.cpu)}%`,
      color: getStatusColor(systemStatus.cpu),
      icon: '💻',
      description: 'Processor utilization'
    },
    {
      title: 'Memory Usage',
      value: `${Math.round(systemStatus.memory)}%`,
      color: getStatusColor(systemStatus.memory),
      icon: '🧠',
      description: 'RAM utilization'
    },
    {
      title: 'Disk Usage',
      value: `${Math.round(systemStatus.disk)}%`,
      color: getStatusColor(systemStatus.disk),
      icon: '💾',
      description: 'Storage utilization'
    },
    {
      title: 'Network Status',
      value: systemStatus.network === 'connected' ? 'Online' : 'Offline',
      color: systemStatus.network === 'connected' ? '#28a745' : '#dc3545',
      icon: systemStatus.network === 'connected' ? '🌐' : '📡',
      description: 'Internet connectivity'
    }
  ];

  const processes = systemStatus.processes || [];
  const topProcesses = processes
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, 10);

  return (
    <div>
      <div className="form-section">
        <div className="form-section-title">
          System Monitor
          <div style={{ float: 'right', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
              <input
                type="checkbox"
                checked={isAutoRefresh}
                onChange={(e) => setIsAutoRefresh(e.target.checked)}
              />
              Auto Refresh
            </label>
            <select
              className="form-control"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              style={{ width: 'auto' }}
            >
              <option value={2000}>2s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={30000}>30s</option>
            </select>
            <button
              className="btn btn-secondary"
              onClick={() => window.electronAPI.getSystemStatus()}
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* System Stats Grid */}
      <div className="system-stats">
        {systemStats.map((stat, index) => (
          <div key={index} className="stat-card">
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>{stat.icon}</div>
            <div className="stat-value" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="stat-label">{stat.title}</div>
            <div style={{ 
              fontSize: '12px', 
              color: '#666', 
              marginTop: '4px' 
            }}>
              {stat.description}
            </div>
          </div>
        ))}
      </div>

      {/* Progress Bars */}
      <div className="form-section">
        <h3 className="form-section-title">Resource Usage</h3>
        
        <div style={{ marginBottom: '24px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '8px' 
          }}>
            <span>CPU Usage</span>
            <span>{Math.round(systemStatus.cpu)}%</span>
          </div>
          <div className="progress">
            <div 
              className="progress-bar" 
              style={{ 
                width: `${systemStatus.cpu}%`,
                backgroundColor: getStatusColor(systemStatus.cpu)
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '8px' 
          }}>
            <span>Memory Usage</span>
            <span>{Math.round(systemStatus.memory)}%</span>
          </div>
          <div className="progress">
            <div 
              className="progress-bar" 
              style={{ 
                width: `${systemStatus.memory}%`,
                backgroundColor: getStatusColor(systemStatus.memory)
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '8px' 
          }}>
            <span>Disk Usage</span>
            <span>{Math.round(systemStatus.disk)}%</span>
          </div>
          <div className="progress">
            <div 
              className="progress-bar" 
              style={{ 
                width: `${systemStatus.disk}%`,
                backgroundColor: getStatusColor(systemStatus.disk)
              }}
            />
          </div>
        </div>
      </div>

      {/* Top Processes */}
      {topProcesses.length > 0 && (
        <div className="form-section">
          <h3 className="form-section-title">Top Processes</h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Process</th>
                  <th>CPU %</th>
                  <th>Memory</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {topProcesses.map((process, index) => (
                  <tr key={index}>
                    <td>
                      <div>
                        <strong>{process.name}</strong>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          PID: {process.pid}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ 
                        color: getStatusColor(process.cpu),
                        fontWeight: 'bold'
                      }}>
                        {process.cpu.toFixed(1)}%
                      </span>
                    </td>
                    <td>{formatBytes(process.memory)}</td>
                    <td>
                      <span className="status-indicator success">
                        {process.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* System Information */}
      <div className="form-section">
        <h3 className="form-section-title">System Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          <div className="card">
            <h4>Platform</h4>
            <p>{systemStatus.platform || 'Unknown'}</p>
          </div>
          <div className="card">
            <h4>Architecture</h4>
            <p>{systemStatus.architecture || 'Unknown'}</p>
          </div>
          <div className="card">
            <h4>Uptime</h4>
            <p>{systemStatus.uptime ? formatUptime(systemStatus.uptime) : 'Unknown'}</p>
          </div>
          <div className="card">
            <h4>Node Version</h4>
            <p>{systemStatus.nodeVersion || 'Unknown'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const formatUptime = (seconds) => {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export default SystemMonitor;
