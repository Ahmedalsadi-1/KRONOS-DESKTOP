/**
 * Unit tests for ApplicationCard component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplicationCard } from '../ApplicationCard';
import { ApplicationMetadata } from '../../../types/application';

describe('ApplicationCard', () => {
  const mockApp: ApplicationMetadata = {
    id: 'test-app',
    name: 'Test Application',
    description: 'A test application for unit testing',
    icon: '🧪',
    category: 'testing',
    status: 'available',
  };

  describe('rendering', () => {
    it('should render application card', () => {
      const mockOnLaunch = vi.fn();
      render(<ApplicationCard app={mockApp} onLaunch={mockOnLaunch} />);

      expect(screen.getByText('Test Application')).toBeInTheDocument();
      expect(screen.getByText('A test application for unit testing')).toBeInTheDocument();
    });

    it('should display application icon', () => {
      const mockOnLaunch = vi.fn();
      render(<ApplicationCard app={mockApp} onLaunch={mockOnLaunch} />);

      expect(screen.getByText('🧪')).toBeInTheDocument();
    });

    it('should display category badge', () => {
      const mockOnLaunch = vi.fn();
      render(<ApplicationCard app={mockApp} onLaunch={mockOnLaunch} />);

      expect(screen.getByText('testing')).toBeInTheDocument();
    });

    it('should display status badge', () => {
      const mockOnLaunch = vi.fn();
      render(<ApplicationCard app={mockApp} onLaunch={mockOnLaunch} />);

      expect(screen.getByText('Available')).toBeInTheDocument();
    });

    it('should display launch button', () => {
      const mockOnLaunch = vi.fn();
      render(<ApplicationCard app={mockApp} onLaunch={mockOnLaunch} />);

      expect(screen.getByRole('button', { name: /launch/i })).toBeInTheDocument();
    });
  });

  describe('status display', () => {
    it('should display running status with correct styling', () => {
      const mockOnLaunch = vi.fn();
      const runningApp: ApplicationMetadata = { ...mockApp, status: 'running' };
      render(<ApplicationCard app={runningApp} onLaunch={mockOnLaunch} />);

      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('should display error status with alert icon', () => {
      const mockOnLaunch = vi.fn();
      const errorApp: ApplicationMetadata = { ...mockApp, status: 'error' };
      render(<ApplicationCard app={errorApp} onLaunch={mockOnLaunch} />);

      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('should disable launch button when status is error', () => {
      const mockOnLaunch = vi.fn();
      const errorApp: ApplicationMetadata = { ...mockApp, status: 'error' };
      render(<ApplicationCard app={errorApp} onLaunch={mockOnLaunch} />);

      const launchButton = screen.getByRole('button', { name: /launch/i });
      expect(launchButton).toBeDisabled();
    });
  });

  describe('interactions', () => {
    it('should call onLaunch when launch button is clicked', () => {
      const mockOnLaunch = vi.fn();
      render(<ApplicationCard app={mockApp} onLaunch={mockOnLaunch} />);

      const launchButton = screen.getByRole('button', { name: /launch/i });
      fireEvent.click(launchButton);

      expect(mockOnLaunch).toHaveBeenCalledWith('test-app');
      expect(mockOnLaunch).toHaveBeenCalledTimes(1);
    });

    it('should not call onLaunch when loading', () => {
      const mockOnLaunch = vi.fn();
      render(<ApplicationCard app={mockApp} onLaunch={mockOnLaunch} isLoading={true} />);

      const launchButton = screen.getByRole('button', { name: /launching/i });
      fireEvent.click(launchButton);

      expect(mockOnLaunch).not.toHaveBeenCalled();
    });

    it('should show loading state', () => {
      const mockOnLaunch = vi.fn();
      render(<ApplicationCard app={mockApp} onLaunch={mockOnLaunch} isLoading={true} />);

      expect(screen.getByText('Launching...')).toBeInTheDocument();
    });

    it('should disable button when loading', () => {
      const mockOnLaunch = vi.fn();
      render(<ApplicationCard app={mockApp} onLaunch={mockOnLaunch} isLoading={true} />);

      const launchButton = screen.getByRole('button', { name: /launching/i });
      expect(launchButton).toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      const mockOnLaunch = vi.fn();
      render(<ApplicationCard app={mockApp} onLaunch={mockOnLaunch} />);

      expect(screen.getByRole('article')).toHaveAttribute(
        'aria-label',
        'Test Application application'
      );
    });

    it('should have status role', () => {
      const mockOnLaunch = vi.fn();
      render(<ApplicationCard app={mockApp} onLaunch={mockOnLaunch} />);

      const statusBadge = screen.getByRole('status');
      expect(statusBadge).toBeInTheDocument();
    });

    it('should have launch button with proper label', () => {
      const mockOnLaunch = vi.fn();
      render(<ApplicationCard app={mockApp} onLaunch={mockOnLaunch} />);

      const launchButton = screen.getByRole('button', { name: /launch test application/i });
      expect(launchButton).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle missing category', () => {
      const mockOnLaunch = vi.fn();
      const appWithoutCategory: ApplicationMetadata = {
        ...mockApp,
        category: undefined,
      };
      render(<ApplicationCard app={appWithoutCategory} onLaunch={mockOnLaunch} />);

      expect(screen.queryByText('testing')).not.toBeInTheDocument();
    });

    it('should handle long description with truncation', () => {
      const mockOnLaunch = vi.fn();
      const appWithLongDesc: ApplicationMetadata = {
        ...mockApp,
        description:
          'This is a very long description that should be truncated to prevent layout issues and maintain a clean card appearance',
      };
      render(<ApplicationCard app={appWithLongDesc} onLaunch={mockOnLaunch} />);

      const description = screen.getByText(/This is a very long description/);
      expect(description).toHaveClass('line-clamp-2');
    });

    it('should handle special characters in name', () => {
      const mockOnLaunch = vi.fn();
      const appWithSpecialChars: ApplicationMetadata = {
        ...mockApp,
        name: 'Test & App (v2.0)',
      };
      render(<ApplicationCard app={appWithSpecialChars} onLaunch={mockOnLaunch} />);

      expect(screen.getByText('Test & App (v2.0)')).toBeInTheDocument();
    });
  });
});
