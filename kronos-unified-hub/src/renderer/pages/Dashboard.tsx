import React, { useState, useEffect } from 'react';
import { Activity, Zap, Smartphone, Server, AlertCircle } from 'lucide-react';
import '../styles/Dashboard.css';

interface SystemStatus {
  servicesRunning: number;
  devicesConnected: number;
  workflowsActive: number;
  cpuUsage: number;
  memoryUsage: number;
}

interface DashboardProps {
  systemStatus: SystemStatus;
}

export function Dashboard({ systemStatus }: DashboardProps) {
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    // Load recent activities
    const mockActivities = [
      { id: 1, type: 'app', message: 'Postiz launched', timestamp: new Date() },
      { id: 2, type: 'device', message: 'Android device connected', timestamp: new Date(Date.now() - 60000) },
      { id: 3, type: 'service', message: 'OnlySnarf service started', timestamp: new Date(Date.now() - 120000) },
    ];
    setRecentActivities(mockActivities);

    // Load alerts
    const mockAlerts = [
      { id: 1, level: 'warning', message: 'High memory usage detected' },
      { id: 2, level: 'info', message: 'Workflow scheduled for 9:00 AM' },
    ];
    setAlerts(mockAlerts);
  }, []);

  const StatCard = ({ icon: Icon, label, value, color }: any) => (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>
        <Icon size={24} />
      </div>
      <div className="stat-content">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
      </div>
    </div>
  );

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Welcome back! Here's your system overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard
          icon={Server}
          label="Services Running"
          value={systemStatus.servicesRunning}
          color="blue"
        />
        <StatCard
          icon={Smartphone}
          label="Devices Connected"
          value={systemStatus.devicesConnected}
          color="green"
        />
        <StatCard
          icon={Zap}
          label="Active Workflows"
          value={systemStatus.workflowsActive}
          color="purple"
        />
        <StatCard
          icon={Activity}
          label="System Health"
          value="Healthy"
          color="emerald"
        />
      </div>

      {/* System Metrics */}
      <div className="metrics-section">
        <div className="metrics-card">
          <h3>CPU Usage</h3>
          <div className="metric-bar">
            <div
              className="metric-fill"
              style={{ width: `${systemStatus.cpuUsage}%` }}
            ></div>
          </div>
          <p className="metric-value">{systemStatus.cpuUsage.toFixed(1)}%</p>
        </div>

        <div className="metrics-card">
          <h3>Memory Usage</h3>
          <div className="metric-bar">
            <div
              className="metric-fill"
              style={{ width: `${systemStatus.memoryUsage}%` }}
            ></div>
          </div>
          <p className="metric-value">{systemStatus.memoryUsage.toFixed(1)}%</p>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="alerts-section">
          <h3>Alerts</h3>
          <div className="alerts-list">
            {alerts.map((alert) => (
              <div key={alert.id} className={`alert alert-${alert.level}`}>
                <AlertCircle size={18} />
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activities */}
      <div className="activities-section">
        <h3>Recent Activities</h3>
        <div className="activities-list">
          {recentActivities.map((activity) => (
            <div key={activity.id} className="activity-item">
              <div className="activity-icon">
                {activity.type === 'app' && <Zap size={16} />}
                {activity.type === 'device' && <Smartphone size={16} />}
                {activity.type === 'service' && <Server size={16} />}
              </div>
              <div className="activity-content">
                <p className="activity-message">{activity.message}</p>
                <p className="activity-time">
                  {activity.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
