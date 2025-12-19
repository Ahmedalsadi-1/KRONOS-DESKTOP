/**
 * ApplicationGrid Component
 * Displays a responsive grid of available applications
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ApplicationMetadata } from '../../types/application';
import ApplicationCard from './ApplicationCard';

interface ApplicationGridProps {
  onLaunchApp?: (appId: string) => void;
}

interface GridState {
  applications: ApplicationMetadata[];
  loading: boolean;
  error: string | null;
  launchingAppId: string | null;
}

export const ApplicationGrid: React.FC<ApplicationGridProps> = ({ onLaunchApp }) => {
  const [state, setState] = useState<GridState>({
    applications: [],
    loading: true,
    error: null,
    launchingAppId: null,
  });

  /**
   * Fetch applications from IPC
   */
  const fetchApplications = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const apps = await window.electron?.ipcRenderer?.invoke('app:list');

      if (!apps || !Array.isArray(apps)) {
        throw new Error('Invalid response from app:list');
      }

      // Transform app configs to metadata for display
      const metadata: ApplicationMetadata[] = apps.map((app: any) => ({
        id: app.id,
        name: app.name,
        description: app.description || 'No description available',
        icon: app.icon || '📦',
        category: app.category,
        status: app.status || 'available',
      }));

      setState((prev) => ({
        ...prev,
        applications: metadata,
        loading: false,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load applications';
      console.error('Error fetching applications:', err);
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
    }
  }, []);

  /**
   * Handle application launch
   */
  const handleLaunchApp = useCallback(
    async (appId: string) => {
      try {
        setState((prev) => ({ ...prev, launchingAppId: appId }));

        await window.electron?.ipcRenderer?.invoke('app:launch', appId, {
          width: 1200,
          height: 800,
          resizable: true,
        });

        // Call parent callback if provided
        onLaunchApp?.(appId);

        // Update app status to running
        setState((prev) => ({
          ...prev,
          applications: prev.applications.map((app) =>
            app.id === appId ? { ...app, status: 'running' } : app
          ),
          launchingAppId: null,
        }));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to launch application';
        console.error('Error launching application:', err);
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          launchingAppId: null,
        }));
      }
    },
    [onLaunchApp]
  );

  /**
   * Retry loading applications
   */
  const handleRetry = useCallback(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Load applications on mount
  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Loading state
  if (state.loading) {
    return (
      <div
        className="flex h-full items-center justify-center"
        role="status"
        aria-label="Loading applications"
      >
        <div className="text-center">
          <div className="mb-4 inline-block">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          </div>
          <p className="text-gray-600">Loading applications...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div
        className="flex h-full items-center justify-center"
        role="alert"
        aria-label="Error loading applications"
      >
        <div className="text-center">
          <div className="mb-4 inline-block rounded-full bg-red-100 p-3">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">Failed to Load Applications</h3>
          <p className="mb-4 text-sm text-gray-600">{state.error}</p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            aria-label="Retry loading applications"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (state.applications.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center"
        role="status"
        aria-label="No applications available"
      >
        <div className="text-center">
          <div className="mb-4 text-4xl">📭</div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">No Applications Available</h3>
          <p className="text-sm text-gray-600">
            No applications are currently available to launch.
          </p>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="h-full overflow-auto">
      <div
        className="grid auto-rows-max grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        role="region"
        aria-label="Available applications"
      >
        {state.applications.map((app) => (
          <ApplicationCard
            key={app.id}
            app={app}
            onLaunch={handleLaunchApp}
            isLoading={state.launchingAppId === app.id}
          />
        ))}
      </div>
    </div>
  );
};

export default ApplicationGrid;
