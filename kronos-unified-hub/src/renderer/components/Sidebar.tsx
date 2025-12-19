import React from 'react';
import {
  LayoutDashboard,
  Zap,
  Smartphone,
  Server,
  Workflow,
  Settings,
} from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: any) => void;
}

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'applications', label: 'Applications', icon: Zap },
    { id: 'devices', label: 'Devices', icon: Smartphone },
    { id: 'services', label: 'Services', icon: Server },
    { id: 'workflows', label: 'Workflows', icon: Workflow },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">⚙️</span>
          <span className="logo-text">KRONOS</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onPageChange(item.id)}
              title={item.label}
            >
              <Icon size={20} />
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">A</div>
          <div className="user-details">
            <div className="user-name">Ahmed</div>
            <div className="user-status">Online</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
