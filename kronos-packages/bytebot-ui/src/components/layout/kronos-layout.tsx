import React from 'react';
import { KronosLogo } from '@/components/ui/kronos-logo';

interface KronosLayoutProps {
  children: React.ReactNode;
}

export function KronosLayout({ children }: KronosLayoutProps) {
  return (
    <div className="min-h-screen bg-app text-primary flex">
      {/* Left Sidebar */}
      <aside className="w-64 bg-surface border-r border-glow shadow-glow flex flex-col">
        <div className="p-4 border-b border-glow">
          <KronosLogo />
        </div>
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            <a href="/" className="block px-3 py-2 rounded hover:bg-accent text-primary">Dashboard</a>
            <a href="/tasks" className="block px-3 py-2 rounded hover:bg-accent text-primary">Tasks</a>
            <a href="/desktop" className="block px-3 py-2 rounded hover:bg-accent text-primary">Desktop</a>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="bg-surface border-b border-glow shadow-glow px-6 py-4">
          <h1 className="text-xl font-bold text-accent">Kronos Console</h1>
        </header>

        {/* Main Panel */}
        <main className="flex-1 bg-panel p-6 overflow-auto">
          {children}
        </main>
      </div>

      {/* Right Panel - Timeline/Logs */}
      <aside className="w-80 bg-surface border-l border-glow shadow-glow p-4">
        <h2 className="text-lg font-semibold text-accent mb-4">Activity Log</h2>
        <div className="space-y-2 text-sm text-muted">
          <div className="p-2 bg-accent rounded">System initialized</div>
          <div className="p-2 bg-accent rounded">Models loaded</div>
          <div className="p-2 bg-accent rounded">Desktop ready</div>
        </div>
      </aside>
    </div>
  );
}