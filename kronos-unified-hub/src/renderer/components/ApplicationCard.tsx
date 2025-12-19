/**
 * ApplicationCard Component
 * Displays individual application information and launch button
 */

import React from 'react';
import { Play, AlertCircle } from 'lucide-react';
import { ApplicationMetadata } from '../../types/application';

interface ApplicationCardProps {
  app: ApplicationMetadata;
  onLaunch: (appId: string) => void;
  isLoading?: boolean;
}

export const ApplicationCard: React.FC<ApplicationCardProps> = ({
  app,
  onLaunch,
  isLoading = false,
}) => {
  const handleClick = () => {
    if (!isLoading) {
      onLaunch(app.id);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'available':
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getStatusLabel = (status: string): string => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div
      className="group relative flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-300"
      role="article"
      aria-label={`${app.name} application`}
    >
      {/* Header with icon and status */}
      <div className="mb-3 flex items-start justify-between">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-2xl"
          aria-hidden="true"
        >
          {app.icon}
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${getStatusColor(
            app.status
          )}`}
          role="status"
          aria-label={`Status: ${getStatusLabel(app.status)}`}
        >
          {app.status === 'error' && <AlertCircle className="mr-1 h-3 w-3" />}
          {getStatusLabel(app.status)}
        </span>
      </div>

      {/* Content */}
      <div className="mb-4 flex-1">
        <h3 className="mb-1 text-sm font-semibold text-gray-900">{app.name}</h3>
        <p className="text-xs text-gray-600 line-clamp-2">{app.description}</p>
        {app.category && (
          <div className="mt-2">
            <span className="inline-block rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
              {app.category}
            </span>
          </div>
        )}
      </div>

      {/* Launch button */}
      <button
        onClick={handleClick}
        disabled={isLoading || app.status === 'error'}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        aria-label={`Launch ${app.name}`}
        title={app.status === 'error' ? 'Application has an error' : `Launch ${app.name}`}
      >
        <Play size={16} />
        {isLoading ? 'Launching...' : 'Launch'}
      </button>

      {/* Keyboard focus indicator */}
      <div className="absolute inset-0 rounded-lg ring-2 ring-transparent transition-all duration-200 group-focus-within:ring-blue-500" />
    </div>
  );
};

export default ApplicationCard;
