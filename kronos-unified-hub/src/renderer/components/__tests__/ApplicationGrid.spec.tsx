/**
 * Integration tests for ApplicationGrid component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApplicationGrid } from '../ApplicationGrid';
import { ApplicationMetadata } from '../../../types/application';

// Mock window.electron
const mockInvoke = vi.fn();
const mockElectron = {
  ipcRenderer: {
    invoke: mockInvoke,
  },
};

Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true,
});

describe('ApplicationGrid', () => {
  const mockApps: ApplicationMetadata[] = [
    {
      id: 'app-1',
      name: 'Application 1',
      description: 'First test application',
      icon: '📱',
      category: 'automation',
      status: 'available',
    },
    {
      id: 'app-2',
      name: 'Application 2',
      description: 'Second test application',
      icon: '🤖',
      category: 'ai',
      status: 'available',
    },
    {
      id: 'app-3',
      name: 'Application 3',
      description: 'Third test application',
      icon: '🌐',
      category: 'tools',
      status: 'running',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(mockApps);
  });

  describe('rendering', () => {
    it('should render loading state initially', () => {
      render(<ApplicationGrid />);
      expect(screen.getByText('Loading applications...')).toBeInTheDocument();
    });

    it('should render applications after loading', async () => {
      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(screen.getByText('Application 1')).toBeInTheDocument();
        expect(screen.getByText('Application 2')).toBeInTheDocument();
        expect(screen.getByText('Application 3')).toBeInTheDocument();
      });
    });

    it('should display all application cards', async () => {
      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(3);
      });
    });

    it('should display application descriptions', async () => {
      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(screen.getByText('First test application')).toBeInTheDocument();
        expect(screen.getByText('Second test application')).toBeInTheDocument();
        expect(screen.getByText('Third test application')).toBeInTheDocument();
      });
    });
  });

  describe('IPC communication', () => {
    it('should invoke app:list on mount', async () => {
      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('app:list');
      });
    });

    it('should handle IPC errors gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('IPC failed'));
      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Applications')).toBeInTheDocument();
        expect(screen.getByText('IPC failed')).toBeInTheDocument();
      });
    });

    it('should handle invalid response from IPC', async () => {
      mockInvoke.mockResolvedValueOnce(null);
      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Applications')).toBeInTheDocument();
      });
    });

    it('should handle non-array response from IPC', async () => {
      mockInvoke.mockResolvedValueOnce({ invalid: 'response' });
      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Applications')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('should display error state', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Network error'));
      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Failed to Load Applications')).toBeInTheDocument();
      });
    });

    it('should display retry button on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Network error'));
      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should retry loading on retry button click', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Network error'));
      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      mockInvoke.mockResolvedValueOnce(mockApps);
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getByText('Application 1')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('should display empty state when no applications', async () => {
      mockInvoke.mockResolvedValueOnce([]);
      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(screen.getByText('No Applications Available')).toBeInTheDocument();
      });
    });

    it('should display empty state message', async () => {
      mockInvoke.mockResolvedValueOnce([]);
      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(
          screen.getByText('No applications are currently available to launch.')
        ).toBeInTheDocument();
      });
    });
  });

  describe('launching applications', () => {
    it('should invoke app:launch when launch button clicked', async () => {
      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(screen.getByText('Application 1')).toBeInTheDocument();
      });

      const launchButtons = screen.getAllByRole('button', { name: /launch/i });
      fireEvent.click(launchButtons[0]);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('app:launch', 'app-1', {
          width: 1200,
          height: 800,
          resizable: true,
        });
      });
    });

    it('should show loading state while launching', async () => {
      mockInvoke.mockImplementation((channel) => {
        if (channel === 'app:list') {
          return Promise.resolve(mockApps);
        }
        return new Promise(() => {}); // Never resolves to keep loading state
      });

      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(screen.getByText('Application 1')).toBeInTheDocument();
      });

      const launchButtons = screen.getAllByRole('button', { name: /launch/i });
      fireEvent.click(launchButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Launching...')).toBeInTheDocument();
      });
    });

    it('should update app status to running after launch', async () => {
      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(screen.getByText('Application 1')).toBeInTheDocument();
      });

      const launchButtons = screen.getAllByRole('button', { name: /launch/i });
      fireEvent.click(launchButtons[0]);

      await waitFor(() => {
        const statusBadges = screen.getAllByRole('status');
        expect(statusBadges[0]).toHaveTextContent('Running');
      });
    });

    it('should call onLaunchApp callback', async () => {
      const mockOnLaunchApp = vi.fn();
      render(<ApplicationGrid onLaunchApp={mockOnLaunchApp} />);

      await waitFor(() => {
        expect(screen.getByText('Application 1')).toBeInTheDocument();
      });

      const launchButtons = screen.getAllByRole('button', { name: /launch/i });
      fireEvent.click(launchButtons[0]);

      await waitFor(() => {
        expect(mockOnLaunchApp).toHaveBeenCalledWith('app-1');
      });
    });

    it('should handle launch errors', async () => {
      mockInvoke.mockImplementation((channel) => {
        if (channel === 'app:list') {
          return Promise.resolve(mockApps);
        }
        return Promise.reject(new Error('Launch failed'));
      });

      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(screen.getByText('Application 1')).toBeInTheDocument();
      });

      const launchButtons = screen.getAllByRole('button', { name: /launch/i });
      fireEvent.click(launchButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Applications')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper region role', async () => {
      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(screen.getByRole('region')).toBeInTheDocument();
      });
    });

    it('should have aria-label on region', async () => {
      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(screen.getByRole('region')).toHaveAttribute(
          'aria-label',
          'Available applications'
        );
      });
    });

    it('should have status role for loading state', () => {
      render(<ApplicationGrid />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should have alert role for error state', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Error'));
      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('grid layout', () => {
    it('should render grid container', async () => {
      render(<ApplicationGrid />);

      await waitFor(() => {
        const grid = screen.getByRole('region');
        expect(grid).toHaveClass('grid');
      });
    });

    it('should have responsive grid classes', async () => {
      render(<ApplicationGrid />);

      await waitFor(() => {
        const grid = screen.getByRole('region');
        expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4');
      });
    });
  });

  describe('multiple launches', () => {
    it('should handle launching multiple applications', async () => {
      render(<ApplicationGrid />);

      await waitFor(() => {
        expect(screen.getByText('Application 1')).toBeInTheDocument();
      });

      const launchButtons = screen.getAllByRole('button', { name: /launch/i });
      fireEvent.click(launchButtons[0]);
      fireEvent.click(launchButtons[1]);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('app:launch', 'app-1', expect.any(Object));
        expect(mockInvoke).toHaveBeenCalledWith('app:launch', 'app-2', expect.any(Object));
      });
    });
  });
});
