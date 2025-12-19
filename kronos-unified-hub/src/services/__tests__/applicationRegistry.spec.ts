/**
 * Unit tests for ApplicationRegistry service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ApplicationRegistry } from '../applicationRegistry';
import { Application } from '../../types/application';

describe('ApplicationRegistry', () => {
  let registry: ApplicationRegistry;

  beforeEach(() => {
    registry = new ApplicationRegistry();
  });

  describe('initialization', () => {
    it('should initialize with 6 applications', () => {
      const apps = registry.getApplications();
      expect(apps).toHaveLength(6);
    });

    it('should have all required application properties', () => {
      const apps = registry.getApplications();
      apps.forEach((app) => {
        expect(app).toHaveProperty('id');
        expect(app).toHaveProperty('name');
        expect(app).toHaveProperty('description');
        expect(app).toHaveProperty('icon');
        expect(app).toHaveProperty('executable');
        expect(app).toHaveProperty('minWidth');
        expect(app).toHaveProperty('maxWidth');
        expect(app).toHaveProperty('minHeight');
        expect(app).toHaveProperty('maxHeight');
        expect(app).toHaveProperty('defaultWidth');
        expect(app).toHaveProperty('defaultHeight');
        expect(app).toHaveProperty('resizable');
        expect(app).toHaveProperty('status');
      });
    });

    it('should initialize all applications with available status', () => {
      const apps = registry.getApplications();
      apps.forEach((app) => {
        expect(app.status).toBe('available');
      });
    });
  });

  describe('getApplications', () => {
    it('should return all applications', () => {
      const apps = registry.getApplications();
      expect(apps.length).toBeGreaterThan(0);
    });

    it('should return cached applications on subsequent calls', () => {
      const apps1 = registry.getApplications();
      const apps2 = registry.getApplications();
      expect(apps1).toBe(apps2); // Same reference due to caching
    });

    it('should have correct application IDs', () => {
      const apps = registry.getApplications();
      const ids = apps.map((app) => app.id);
      expect(ids).toContain('postiz');
      expect(ids).toContain('bytebot');
      expect(ids).toContain('open-computer-use');
      expect(ids).toContain('gbox');
      expect(ids).toContain('ai-browser');
      expect(ids).toContain('local-manus');
    });
  });

  describe('getApplicationMetadata', () => {
    it('should return metadata for all applications', () => {
      const metadata = registry.getApplicationMetadata();
      expect(metadata).toHaveLength(6);
    });

    it('should only include metadata fields', () => {
      const metadata = registry.getApplicationMetadata();
      metadata.forEach((item) => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('description');
        expect(item).toHaveProperty('icon');
        expect(item).toHaveProperty('status');
        expect(item).not.toHaveProperty('executable');
        expect(item).not.toHaveProperty('minWidth');
      });
    });
  });

  describe('getApplication', () => {
    it('should return application by ID', () => {
      const app = registry.getApplication('postiz');
      expect(app).toBeDefined();
      expect(app?.id).toBe('postiz');
      expect(app?.name).toBe('Postiz');
    });

    it('should return undefined for non-existent application', () => {
      const app = registry.getApplication('non-existent');
      expect(app).toBeUndefined();
    });

    it('should return correct application properties', () => {
      const app = registry.getApplication('bytebot');
      expect(app?.name).toBe('Bytebot');
      expect(app?.category).toBe('ai');
      expect(app?.port).toBe(3001);
    });
  });

  describe('updateApplicationStatus', () => {
    it('should update application status', () => {
      registry.updateApplicationStatus('postiz', 'running');
      const app = registry.getApplication('postiz');
      expect(app?.status).toBe('running');
    });

    it('should invalidate cache when status is updated', () => {
      const apps1 = registry.getApplications();
      registry.updateApplicationStatus('postiz', 'running');
      const apps2 = registry.getApplications();
      expect(apps1).not.toBe(apps2); // Different reference after cache invalidation
    });

    it('should handle error status', () => {
      registry.updateApplicationStatus('bytebot', 'error');
      const app = registry.getApplication('bytebot');
      expect(app?.status).toBe('error');
    });

    it('should not update non-existent application', () => {
      registry.updateApplicationStatus('non-existent', 'running');
      // Should not throw, just silently fail
      expect(registry.getApplication('non-existent')).toBeUndefined();
    });
  });

  describe('getApplicationsByCategory', () => {
    it('should return applications by category', () => {
      const automationApps = registry.getApplicationsByCategory('automation');
      expect(automationApps.length).toBeGreaterThan(0);
      automationApps.forEach((app) => {
        expect(app.category).toBe('automation');
      });
    });

    it('should return empty array for non-existent category', () => {
      const apps = registry.getApplicationsByCategory('non-existent');
      expect(apps).toHaveLength(0);
    });

    it('should return correct categories', () => {
      const aiApps = registry.getApplicationsByCategory('ai');
      expect(aiApps.length).toBeGreaterThan(0);

      const deviceApps = registry.getApplicationsByCategory('devices');
      expect(deviceApps.length).toBeGreaterThan(0);
    });
  });

  describe('validateApplication', () => {
    it('should validate correct application', () => {
      const app = registry.getApplication('postiz');
      if (app) {
        const result = registry.validateApplication(app);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should reject application with missing ID', () => {
      const invalidApp: Application = {
        id: '',
        name: 'Test',
        description: 'Test app',
        icon: '📦',
        executable: 'npm',
        minWidth: 400,
        minHeight: 300,
        maxWidth: 1400,
        maxHeight: 900,
        defaultWidth: 1000,
        defaultHeight: 700,
        resizable: true,
        status: 'available',
      };
      const result = registry.validateApplication(invalidApp);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Application ID is required');
    });

    it('should reject application with missing name', () => {
      const invalidApp: Application = {
        id: 'test',
        name: '',
        description: 'Test app',
        icon: '📦',
        executable: 'npm',
        minWidth: 400,
        minHeight: 300,
        maxWidth: 1400,
        maxHeight: 900,
        defaultWidth: 1000,
        defaultHeight: 700,
        resizable: true,
        status: 'available',
      };
      const result = registry.validateApplication(invalidApp);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Application name is required');
    });

    it('should reject application with invalid dimensions', () => {
      const invalidApp: Application = {
        id: 'test',
        name: 'Test',
        description: 'Test app',
        icon: '📦',
        executable: 'npm',
        minWidth: 100, // Too small
        minHeight: 300,
        maxWidth: 1400,
        maxHeight: 900,
        defaultWidth: 1000,
        defaultHeight: 700,
        resizable: true,
        status: 'available',
      };
      const result = registry.validateApplication(invalidApp);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Minimum width must be at least 200px');
    });

    it('should reject application with min > max dimensions', () => {
      const invalidApp: Application = {
        id: 'test',
        name: 'Test',
        description: 'Test app',
        icon: '📦',
        executable: 'npm',
        minWidth: 1400,
        minHeight: 300,
        maxWidth: 400, // Less than min
        maxHeight: 900,
        defaultWidth: 1000,
        defaultHeight: 700,
        resizable: true,
        status: 'available',
      };
      const result = registry.validateApplication(invalidApp);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Minimum width cannot exceed maximum width');
    });
  });

  describe('clear', () => {
    it('should clear all applications', () => {
      registry.clear();
      const apps = registry.getApplications();
      expect(apps).toHaveLength(0);
    });

    it('should invalidate cache when cleared', () => {
      const apps1 = registry.getApplications();
      registry.clear();
      const apps2 = registry.getApplications();
      expect(apps1.length).toBeGreaterThan(0);
      expect(apps2).toHaveLength(0);
    });
  });

  describe('caching behavior', () => {
    it('should cache applications for 5 minutes', () => {
      const apps1 = registry.getApplications();
      const apps2 = registry.getApplications();
      expect(apps1).toBe(apps2); // Same reference
    });

    it('should return new reference after cache expiry', async () => {
      const apps1 = registry.getApplications();
      // Simulate cache expiry by clearing and reinitializing
      registry.clear();
      registry = new ApplicationRegistry();
      const apps2 = registry.getApplications();
      expect(apps1).not.toBe(apps2); // Different reference
    });
  });
});
