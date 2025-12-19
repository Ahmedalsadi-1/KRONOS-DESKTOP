/**
 * Application Registry Service
 * Manages application discovery, metadata loading, and validation
 */

import { Application, ApplicationMetadata } from '../types/application';

export class ApplicationRegistry {
  private applications: Map<string, Application> = new Map();
  private cache: { applications: Application[]; timestamp: number } | null = null;
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeApplications();
  }

  /**
   * Initialize available applications with their metadata
   */
  private initializeApplications(): void {
    const apps: Application[] = [
      {
        id: 'postiz',
        name: 'Postiz',
        description: 'Social media automation and scheduling platform',
        icon: '📱',
        category: 'automation',
        executable: 'npm',
        args: ['run', 'dev'],
        env: { NODE_ENV: 'development' },
        minWidth: 400,
        minHeight: 300,
        maxWidth: 1400,
        maxHeight: 900,
        defaultWidth: 1200,
        defaultHeight: 800,
        resizable: true,
        status: 'available',
        port: 3000,
      },
      {
        id: 'bytebot',
        name: 'Bytebot',
        description: 'AI-powered chatbot and automation engine',
        icon: '🤖',
        category: 'ai',
        executable: 'npm',
        args: ['run', 'dev'],
        env: { NODE_ENV: 'development' },
        minWidth: 400,
        minHeight: 300,
        maxWidth: 1400,
        maxHeight: 900,
        defaultWidth: 1000,
        defaultHeight: 700,
        resizable: true,
        status: 'available',
        port: 3001,
      },
      {
        id: 'open-computer-use',
        name: 'Open Computer Use',
        description: 'Computer vision and automation framework',
        icon: '👁️',
        category: 'automation',
        executable: 'npm',
        args: ['run', 'dev'],
        env: { NODE_ENV: 'development' },
        minWidth: 400,
        minHeight: 300,
        maxWidth: 1400,
        maxHeight: 900,
        defaultWidth: 1200,
        defaultHeight: 800,
        resizable: true,
        status: 'available',
        port: 3002,
      },
      {
        id: 'gbox',
        name: 'GBox',
        description: 'Android emulator and device management',
        icon: '📦',
        category: 'devices',
        executable: 'npm',
        args: ['run', 'dev'],
        env: { NODE_ENV: 'development' },
        minWidth: 400,
        minHeight: 300,
        maxWidth: 1400,
        maxHeight: 900,
        defaultWidth: 1000,
        defaultHeight: 800,
        resizable: true,
        status: 'available',
        port: 3003,
      },
      {
        id: 'ai-browser',
        name: 'AI Browser',
        description: 'Intelligent web browsing and scraping tool',
        icon: '🌐',
        category: 'tools',
        executable: 'npm',
        args: ['run', 'dev'],
        env: { NODE_ENV: 'development' },
        minWidth: 400,
        minHeight: 300,
        maxWidth: 1400,
        maxHeight: 900,
        defaultWidth: 1200,
        defaultHeight: 800,
        resizable: true,
        status: 'available',
        port: 3004,
      },
      {
        id: 'local-manus',
        name: 'Local Manus',
        description: 'Local machine control and automation',
        icon: '🖥️',
        category: 'automation',
        executable: 'npm',
        args: ['run', 'dev'],
        env: { NODE_ENV: 'development' },
        minWidth: 400,
        minHeight: 300,
        maxWidth: 1400,
        maxHeight: 900,
        defaultWidth: 1000,
        defaultHeight: 700,
        resizable: true,
        status: 'available',
        port: 3005,
      },
    ];

    apps.forEach((app) => {
      this.applications.set(app.id, app);
    });
  }

  /**
   * Get all available applications
   */
  getApplications(): Application[] {
    // Check cache
    if (this.cache && Date.now() - this.cache.timestamp < this.cacheExpiry) {
      return this.cache.applications;
    }

    const apps = Array.from(this.applications.values());
    this.cache = { applications: apps, timestamp: Date.now() };
    return apps;
  }

  /**
   * Get application metadata for display
   */
  getApplicationMetadata(): ApplicationMetadata[] {
    return this.getApplications().map((app) => ({
      id: app.id,
      name: app.name,
      description: app.description,
      icon: app.icon,
      category: app.category,
      status: app.status,
    }));
  }

  /**
   * Get a specific application by ID
   */
  getApplication(id: string): Application | undefined {
    return this.applications.get(id);
  }

  /**
   * Update application status
   */
  updateApplicationStatus(id: string, status: 'available' | 'running' | 'error'): void {
    const app = this.applications.get(id);
    if (app) {
      app.status = status;
      this.invalidateCache();
    }
  }

  /**
   * Get applications by category
   */
  getApplicationsByCategory(category: string): Application[] {
    return this.getApplications().filter((app) => app.category === category);
  }

  /**
   * Validate application configuration
   */
  validateApplication(app: Application): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!app.id || app.id.trim() === '') {
      errors.push('Application ID is required');
    }

    if (!app.name || app.name.trim() === '') {
      errors.push('Application name is required');
    }

    if (app.minWidth < 200) {
      errors.push('Minimum width must be at least 200px');
    }

    if (app.maxWidth > 2000) {
      errors.push('Maximum width cannot exceed 2000px');
    }

    if (app.minWidth > app.maxWidth) {
      errors.push('Minimum width cannot exceed maximum width');
    }

    if (app.minHeight < 150) {
      errors.push('Minimum height must be at least 150px');
    }

    if (app.maxHeight > 1600) {
      errors.push('Maximum height cannot exceed 1600px');
    }

    if (app.minHeight > app.maxHeight) {
      errors.push('Minimum height cannot exceed maximum height');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Invalidate cache
   */
  private invalidateCache(): void {
    this.cache = null;
  }

  /**
   * Clear all applications (for testing)
   */
  clear(): void {
    this.applications.clear();
    this.invalidateCache();
  }
}

// Export singleton instance
export const applicationRegistry = new ApplicationRegistry();
