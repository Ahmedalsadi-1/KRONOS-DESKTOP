# KRONOS Application Launcher - Design Document

## Overview

The KRONOS Application Launcher is a sophisticated window management system that enables users to launch, embed, and control multiple applications within a unified interface. It provides dynamic window management with resizing, dragging, tabbing, and split-view capabilities, inspired by professional workflow tools like Vy.

The system is built on a modular architecture with clear separation of concerns: Application Registry (discovery), Window Manager (lifecycle), Process Monitor (health), and State Persistence Layer (recovery). All components communicate via IPC and event-driven patterns.

---

## System Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    KRONOS Main Window                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Application Launcher UI                     │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  ApplicationGrid / ApplicationList                 │  │  │
│  │  │  (Postiz, Bytebot, Open Computer Use, etc.)       │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  WindowContainer (Main Content Area)              │  │  │
│  │  │  ┌──────────────┐  ┌──────────────┐              │  │  │
│  │  │  │ Window 1     │  │ Window 2     │              │  │  │
│  │  │  │ (Postiz)     │  │ (Bytebot)    │              │  │  │
│  │  │  └──────────────┘  └──────────────┘              │  │  │
│  │  │  ┌──────────────────────────────────┐            │  │  │
│  │  │  │ Minimized Windows List           │            │  │  │
│  │  │  └──────────────────────────────────┘            │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         ↓ IPC Communication ↓
┌─────────────────────────────────────────────────────────────────┐
│              Electron Main Process Services                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │ Application      │  │ Window Manager   │                   │
│  │ Registry         │  │                  │                   │
│  │ - List apps      │  │ - Create window  │                   │
│  │ - Get metadata   │  │ - Track state    │                   │
│  │ - Validate       │  │ - Manage layout  │                   │
│  └──────────────────┘  └──────────────────┘                   │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │ Process Monitor  │  │ State Persistence│                   │
│  │                  │  │ Layer            │                   │
│  │ - Track PIDs     │  │ - Save state     │                   │
│  │ - Monitor health │  │ - Load state     │                   │
│  │ - Detect crashes │  │ - Validate data  │                   │
│  └──────────────────┘  └──────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Component Interactions

```
User Action (Click Launch)
    ↓
ApplicationGrid Component
    ↓
IPC: app:launch
    ↓
AppLauncher Service
    ↓
Application Registry (validate app exists)
    ↓
Process Monitor (spawn process)
    ↓
Window Manager (create window state)
    ↓
State Persistence (save to localStorage)
    ↓
IPC Response: window created
    ↓
WindowContainer Component (render window)
    ↓
UI Updated
```

---

## Component Structure

### UI Component Hierarchy

```
App
├── Sidebar (existing)
├── MainContent
│   ├── ApplicationsPage
│   │   ├── ApplicationGrid
│   │   │   └── ApplicationCard (x6)
│   │   │       ├── AppIcon
│   │   │       ├── AppName
│   │   │       ├── AppStatus
│   │   │       └── LaunchButton
│   │   │
│   │   └── WindowManager
│   │       ├── WindowContainer
│   │       │   ├── TabManager (if tabbed)
│   │       │   │   └── Tab (x N)
│   │       │   │
│   │       │   ├── SplitViewContainer (if split)
│   │       │   │   ├── Pane (left/top)
│   │       │   │   ├── Divider (draggable)
│   │       │   │   └── Pane (right/bottom)
│   │       │   │
│   │       │   └── Window (x N)
│   │       │       ├── WindowHeader
│   │       │       │   ├── AppIcon
│   │       │       │   ├── AppName
│   │       │       │   ├── MinimizeButton
│   │       │       │   ├── MaximizeButton
│   │       │       │   └── CloseButton
│   │       │       │
│   │       │       ├── ResizeHandle (x 8)
│   │       │       │   ├── CornerHandle (x 4)
│   │       │       │   └── EdgeHandle (x 4)
│   │       │       │
│   │       │       └── WindowContent
│   │       │           └── EmbeddedApp
│   │       │
│   │       └── MinimizedWindowsList
│   │           └── MinimizedWindow (x N)
│   │               ├── AppIcon
│   │               ├── AppName
│   │               └── RestoreButton
│   │
│   └── StatusBar (existing)
```

### Component Responsibilities

**ApplicationGrid**
- Display available applications in a grid/list layout
- Show app icon, name, description, status
- Handle launch button clicks
- Display loading state during launch

**WindowContainer**
- Manage overall window layout (single, tabbed, split-view)
- Track active window/tab
- Handle window focus and z-index
- Coordinate between multiple windows

**Window**
- Display individual application window
- Handle drag operations (title bar)
- Manage resize handles
- Display window controls (minimize, maximize, close)
- Render embedded application content

**TabManager**
- Display tabs for grouped windows
- Handle tab switching
- Manage tab drag-and-drop
- Display tab close buttons

**SplitViewContainer**
- Manage split pane layout
- Handle divider drag operations
- Resize panes proportionally
- Persist split configuration

**ResizeHandle**
- Detect mouse down/move/up events
- Calculate new dimensions
- Enforce min/max constraints
- Update window state

---

## Data Models

### TypeScript Interfaces

```typescript
// Application metadata
interface Application {
  id: string;                    // 'postiz', 'bytebot', etc.
  name: string;                  // Display name
  description: string;           // Short description
  icon: string;                  // Icon URL or path
  executable: string;            // Path to executable
  args?: string[];               // Command line arguments
  env?: Record<string, string>;  // Environment variables
  minWidth: number;              // Minimum window width
  minHeight: number;             // Minimum window height
  maxWidth: number;              // Maximum window width
  maxHeight: number;             // Maximum window height
  defaultWidth: number;          // Default launch width
  defaultHeight: number;         // Default launch height
  resizable: boolean;            // Can be resized
  status: 'available' | 'running' | 'error';
}

// Window state
interface WindowState {
  id: string;                    // Unique window ID
  appId: string;                 // Reference to Application
  x: number;                     // X position
  y: number;                     // Y position
  width: number;                 // Window width
  height: number;                // Window height
  isMinimized: boolean;          // Minimized state
  isMaximized: boolean;          // Maximized state
  zIndex: number;                // Stacking order
  tabGroupId?: string;           // Tab group ID if tabbed
  splitPaneId?: string;          // Split pane ID if split
  createdAt: number;             // Creation timestamp
  lastFocused: number;           // Last focus timestamp
}

// Process information
interface ProcessInfo {
  windowId: string;              // Reference to WindowState
  pid: number;                   // Process ID
  status: 'running' | 'stopped' | 'crashed';
  cpuUsage: number;              // CPU percentage
  memoryUsage: number;           // Memory in MB
  startTime: number;             // Start timestamp
  lastHeartbeat: number;         // Last health check
  error?: string;                // Error message if crashed
}

// Layout configuration
interface LayoutConfig {
  version: number;               // Config version
  windows: WindowState[];        // All window states
  tabGroups: TabGroup[];         // Tab group definitions
  splitLayouts: SplitLayout[];   // Split view layouts
  focusedWindowId?: string;      // Currently focused window
  savedAt: number;               // Save timestamp
}

// Tab group
interface TabGroup {
  id: string;                    // Unique tab group ID
  windowIds: string[];           // Window IDs in group
  activeTabIndex: number;        // Currently active tab
}

// Split layout
interface SplitLayout {
  id: string;                    // Unique split layout ID
  orientation: 'horizontal' | 'vertical';
  ratio: number;                 // Split ratio (0.5 = 50/50)
  leftPaneId: string;            // Left/top pane ID
  rightPaneId: string;           // Right/bottom pane ID
}

// Validation schemas (Zod)
import { z } from 'zod';

const ApplicationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  icon: z.string().url(),
  executable: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  minWidth: z.number().min(200),
  minHeight: z.number().min(150),
  maxWidth: z.number().max(2000),
  maxHeight: z.number().max(1600),
  defaultWidth: z.number(),
  defaultHeight: z.number(),
  resizable: z.boolean(),
  status: z.enum(['available', 'running', 'error']),
});

const WindowStateSchema = z.object({
  id: z.string().uuid(),
  appId: z.string(),
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(200),
  height: z.number().min(150),
  isMinimized: z.boolean(),
  isMaximized: z.boolean(),
  zIndex: z.number().min(0),
  tabGroupId: z.string().optional(),
  splitPaneId: z.string().optional(),
  createdAt: z.number(),
  lastFocused: z.number(),
});

const LayoutConfigSchema = z.object({
  version: z.number(),
  windows: z.array(WindowStateSchema),
  tabGroups: z.array(z.object({
    id: z.string(),
    windowIds: z.array(z.string()),
    activeTabIndex: z.number(),
  })),
  splitLayouts: z.array(z.object({
    id: z.string(),
    orientation: z.enum(['horizontal', 'vertical']),
    ratio: z.number().min(0.2).max(0.8),
    leftPaneId: z.string(),
    rightPaneId: z.string(),
  })),
  focusedWindowId: z.string().optional(),
  savedAt: z.number(),
});
```

---

## Persistence Strategy

### localStorage Structure

```json
{
  "kronos:layout:current": {
    "version": 1,
    "windows": [...],
    "tabGroups": [...],
    "splitLayouts": [...],
    "focusedWindowId": "window-123",
    "savedAt": 1703000000000
  },
  "kronos:layout:backup": {
    "version": 1,
    "windows": [...],
    "savedAt": 1702999000000
  },
  "kronos:app:postiz:config": {
    "defaultWidth": 1200,
    "defaultHeight": 800,
    "resizable": true
  }
}
```

### Persistence Flow

```
User Action (Resize Window)
    ↓
WindowState Updated
    ↓
Debounced Save (500ms)
    ↓
Validate with Zod Schema
    ↓
Save to localStorage
    ↓
Create Backup (every 10 saves)
    ↓
Emit 'layout:saved' event
```

---

## Event System

### Event Types

```typescript
// Window events
type WindowEvent = 
  | { type: 'window:created'; windowId: string; appId: string }
  | { type: 'window:closed'; windowId: string }
  | { type: 'window:focused'; windowId: string }
  | { type: 'window:blurred'; windowId: string }
  | { type: 'window:moved'; windowId: string; x: number; y: number }
  | { type: 'window:resized'; windowId: string; width: number; height: number }
  | { type: 'window:minimized'; windowId: string }
  | { type: 'window:maximized'; windowId: string }
  | { type: 'window:restored'; windowId: string };

// Tab events
type TabEvent =
  | { type: 'tab:created'; tabGroupId: string; windowId: string }
  | { type: 'tab:switched'; tabGroupId: string; activeIndex: number }
  | { type: 'tab:closed'; tabGroupId: string; windowId: string };

// Split view events
type SplitEvent =
  | { type: 'split:created'; splitId: string; orientation: 'horizontal' | 'vertical' }
  | { type: 'split:resized'; splitId: string; ratio: number }
  | { type: 'split:closed'; splitId: string };

// Application events
type AppEvent =
  | { type: 'app:launched'; appId: string; windowId: string }
  | { type: 'app:closed'; appId: string; windowId: string }
  | { type: 'app:crashed'; appId: string; windowId: string; error: string };

// Layout events
type LayoutEvent =
  | { type: 'layout:saved'; timestamp: number }
  | { type: 'layout:restored'; timestamp: number }
  | { type: 'layout:reset'; timestamp: number };
```

### Event Emitter Pattern

```typescript
class WindowEventEmitter extends EventEmitter {
  emit(event: WindowEvent | TabEvent | SplitEvent | AppEvent | LayoutEvent) {
    super.emit(event.type, event);
  }

  on(eventType: string, handler: (event: any) => void) {
    super.on(eventType, handler);
  }
}

// Usage
eventEmitter.on('window:resized', (event) => {
  console.log(`Window ${event.windowId} resized to ${event.width}x${event.height}`);
  saveLayoutState();
});
```

### Keyboard Shortcuts

```typescript
const KeyboardShortcuts = {
  'Alt+Tab': 'cycle-windows',
  'Ctrl+Tab': 'cycle-windows-forward',
  'Ctrl+Shift+Tab': 'cycle-windows-backward',
  'Ctrl+W': 'close-focused-window',
  'Ctrl+M': 'minimize-focused-window',
  'Ctrl+Shift+M': 'maximize-focused-window',
  'Ctrl+L': 'reset-layout',
  'Ctrl+S': 'save-layout',
};
```



---

## Integration Points

### KRONOS Ecosystem Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                    KRONOS Control Hub                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Application Launcher (This Module)                      │  │
│  │  - Launch and embed applications                         │  │
│  │  - Manage windows and layouts                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                    ↓ IPC ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Device Manager                                          │  │
│  │  - Control Android emulators (GBox)                      │  │
│  │  - Manage physical devices                               │  │
│  │  - Monitor VM resources                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                    ↓ IPC ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Service Manager                                         │  │
│  │  - Orchestrate Docker services                           │  │
│  │  - Manage MCP servers                                    │  │
│  │  - Monitor service health                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                    ↓ IPC ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Workflow Engine                                         │  │
│  │  - Create automation workflows                           │  │
│  │  - Execute multi-step tasks                              │  │
│  │  - Schedule workflows                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### IPC API Endpoints

```typescript
// App Launcher IPC Handlers
ipcMain.handle('app:launch', async (event, appName, options) => {
  // Launch application and return window ID
  return { windowId, appId, status: 'running' };
});

ipcMain.handle('app:list', async () => {
  // Return list of available applications
  return applications;
});

ipcMain.handle('app:close', async (event, appId) => {
  // Close application and cleanup
  return { status: 'closed' };
});

ipcMain.handle('window:state', async (event, windowId) => {
  // Get current window state
  return windowState;
});

ipcMain.handle('window:update', async (event, windowId, updates) => {
  // Update window state (position, size, etc.)
  return updatedWindowState;
});

ipcMain.handle('layout:save', async (event, layoutConfig) => {
  // Save layout configuration
  return { status: 'saved', timestamp };
});

ipcMain.handle('layout:restore', async (event) => {
  // Restore saved layout
  return layoutConfig;
});

ipcMain.handle('layout:reset', async (event) => {
  // Reset to default layout
  return { status: 'reset' };
});
```

### Sidebar Navigation Integration

The Application Launcher integrates with the existing Sidebar component:

```typescript
// Sidebar menu item
{
  id: 'applications',
  label: 'Applications',
  icon: Zap,
  // Clicking navigates to Applications page
  // Shows badge with number of running apps
}

// Applications page shows:
// 1. Application grid/list (top section)
// 2. Window manager (main content area)
// 3. Minimized windows list (bottom)
```

---

## Performance Considerations

### Rendering Optimization

**Virtual Scrolling for Application Grid**
```typescript
// Use react-window for large application lists
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={applications.length}
  itemSize={120}
  width="100%"
>
  {({ index, style }) => (
    <ApplicationCard
      app={applications[index]}
      style={style}
    />
  )}
</FixedSizeList>
```

**Lazy Loading for Window Content**
```typescript
// Load embedded app content only when window is visible
const WindowContent = ({ appId, isVisible }) => {
  const [content, setContent] = useState(null);

  useEffect(() => {
    if (isVisible) {
      loadAppContent(appId).then(setContent);
    }
  }, [isVisible, appId]);

  return content ? <div>{content}</div> : <LoadingSpinner />;
};
```

**Debounced State Updates**
```typescript
// Debounce window resize/move events to avoid excessive re-renders
const debouncedSaveState = debounce((windowId, state) => {
  saveWindowState(windowId, state);
}, 500);

const handleWindowResize = (windowId, newSize) => {
  updateLocalState(windowId, newSize);
  debouncedSaveState(windowId, newSize);
};
```

### Memory Management

**Process Pooling**
```typescript
// Reuse process resources for frequently launched apps
class ProcessPool {
  private pool: Map<string, Process[]> = new Map();
  private maxPoolSize = 3;

  async getProcess(appId: string): Promise<Process> {
    let processes = this.pool.get(appId) || [];
    if (processes.length > 0) {
      return processes.pop()!;
    }
    return this.createNewProcess(appId);
  }

  releaseProcess(appId: string, process: Process) {
    let processes = this.pool.get(appId) || [];
    if (processes.length < this.maxPoolSize) {
      processes.push(process);
      this.pool.set(appId, processes);
    } else {
      process.kill();
    }
  }
}
```

**Garbage Collection for Closed Windows**
```typescript
// Clean up resources when windows are closed
const handleWindowClose = (windowId: string) => {
  const windowState = windowStates.get(windowId);
  
  // Kill process
  if (windowState.pid) {
    process.kill(windowState.pid);
  }

  // Remove from state
  windowStates.delete(windowId);
  
  // Clear event listeners
  eventEmitter.removeAllListeners(`window:${windowId}`);
  
  // Trigger garbage collection
  if (global.gc) {
    global.gc();
  }
};
```

### Animation Performance

**CSS Transitions for Window Operations**
```css
.window {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.window.minimizing {
  opacity: 0;
  transform: scale(0.8);
}

.window.maximizing {
  animation: maximize 0.3s ease-out;
}

@keyframes maximize {
  from {
    transform: scale(0.95);
  }
  to {
    transform: scale(1);
  }
}
```

**Framer Motion for Complex Animations**
```typescript
import { motion } from 'framer-motion';

<motion.div
  layout
  initial={{ opacity: 0, scale: 0.8 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.8 }}
  transition={{ duration: 0.3 }}
>
  <Window />
</motion.div>
```

---

## Error Handling and Recovery

### Application Launch Failures

```typescript
async function launchAppWithRetry(
  appId: string,
  maxRetries: number = 3
): Promise<WindowState> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const windowState = await launchApp(appId);
      return windowState;
    } catch (error) {
      if (attempt === maxRetries) {
        // Final attempt failed
        notifyUser({
          type: 'error',
          title: 'Failed to Launch Application',
          message: `Could not launch ${appId} after ${maxRetries} attempts`,
          action: 'Retry',
          onAction: () => launchAppWithRetry(appId, maxRetries),
        });
        throw error;
      }

      // Wait before retry (exponential backoff)
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Window State Corruption Recovery

```typescript
function recoverLayoutState(): LayoutConfig {
  try {
    // Try to load current layout
    const current = localStorage.getItem('kronos:layout:current');
    if (current) {
      const parsed = JSON.parse(current);
      LayoutConfigSchema.parse(parsed);
      return parsed;
    }
  } catch (error) {
    console.error('Current layout corrupted:', error);
  }

  try {
    // Try to load backup layout
    const backup = localStorage.getItem('kronos:layout:backup');
    if (backup) {
      const parsed = JSON.parse(backup);
      LayoutConfigSchema.parse(parsed);
      notifyUser({
        type: 'warning',
        message: 'Layout recovered from backup',
      });
      return parsed;
    }
  } catch (error) {
    console.error('Backup layout corrupted:', error);
  }

  // Return default layout
  return getDefaultLayout();
}
```

### Graceful Degradation

```typescript
// If window management fails, fall back to basic mode
function renderApplications() {
  try {
    return <AdvancedWindowManager />;
  } catch (error) {
    console.error('Window manager failed:', error);
    return <BasicApplicationList />;
  }
}

// If split view fails, show single window
function renderLayout() {
  try {
    return <SplitViewContainer />;
  } catch (error) {
    console.error('Split view failed:', error);
    return <SingleWindowContainer />;
  }
}
```

---

## Testing Strategy

### Unit Tests (Jest)

```typescript
// ApplicationGrid.test.tsx
describe('ApplicationGrid', () => {
  it('should render all available applications', () => {
    const apps = [
      { id: 'postiz', name: 'Postiz', status: 'available' },
      { id: 'bytebot', name: 'Bytebot', status: 'available' },
    ];
    const { getByText } = render(<ApplicationGrid apps={apps} />);
    expect(getByText('Postiz')).toBeInTheDocument();
    expect(getByText('Bytebot')).toBeInTheDocument();
  });

  it('should call onLaunch when launch button is clicked', () => {
    const onLaunch = jest.fn();
    const apps = [{ id: 'postiz', name: 'Postiz', status: 'available' }];
    const { getByRole } = render(
      <ApplicationGrid apps={apps} onLaunch={onLaunch} />
    );
    fireEvent.click(getByRole('button', { name: /launch/i }));
    expect(onLaunch).toHaveBeenCalledWith('postiz');
  });
});

// WindowManager.test.tsx
describe('WindowManager', () => {
  it('should create a new window when app is launched', () => {
    const { getByTestId } = render(<WindowManager />);
    const windowContainer = getByTestId('window-container');
    expect(windowContainer.children).toHaveLength(0);
    
    // Simulate launch
    act(() => {
      launchApp('postiz');
    });
    
    expect(windowContainer.children).toHaveLength(1);
  });

  it('should remove window when close button is clicked', () => {
    const { getByTestId, getByRole } = render(<WindowManager />);
    act(() => {
      launchApp('postiz');
    });
    
    const closeButton = getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    
    expect(getByTestId('window-container').children).toHaveLength(0);
  });
});

// ResizeHandle.test.tsx
describe('ResizeHandle', () => {
  it('should resize window when dragged', () => {
    const onResize = jest.fn();
    const { container } = render(
      <ResizeHandle position="bottom-right" onResize={onResize} />
    );
    
    const handle = container.querySelector('.resize-handle');
    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(window, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(window);
    
    expect(onResize).toHaveBeenCalled();
  });

  it('should enforce minimum dimensions', () => {
    const onResize = jest.fn();
    const { container } = render(
      <ResizeHandle
        position="bottom-right"
        minWidth={400}
        minHeight={300}
        onResize={onResize}
      />
    );
    
    // Attempt to resize below minimum
    const handle = container.querySelector('.resize-handle');
    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(window, { clientX: 50, clientY: 50 });
    fireEvent.mouseUp(window);
    
    // Should not resize below minimum
    expect(onResize).toHaveBeenCalledWith(
      expect.objectContaining({
        width: expect.any(Number),
        height: expect.any(Number),
      })
    );
  });
});
```

### Integration Tests (Cypress)

```typescript
// cypress/e2e/app-launcher.cy.ts
describe('Application Launcher', () => {
  beforeEach(() => {
    cy.visit('/applications');
  });

  it('should launch an application and display it in a window', () => {
    cy.get('[data-testid="app-card-postiz"]').within(() => {
      cy.get('button').contains('Launch').click();
    });

    cy.get('[data-testid="window-container"]').should('have.length', 1);
    cy.get('[data-testid="window-header"]').should('contain', 'Postiz');
  });

  it('should support multiple windows', () => {
    cy.get('[data-testid="app-card-postiz"]').within(() => {
      cy.get('button').contains('Launch').click();
    });
    cy.get('[data-testid="app-card-bytebot"]').within(() => {
      cy.get('button').contains('Launch').click();
    });

    cy.get('[data-testid="window-container"]').should('have.length', 2);
  });

  it('should resize window when dragging resize handle', () => {
    cy.get('[data-testid="app-card-postiz"]').within(() => {
      cy.get('button').contains('Launch').click();
    });

    cy.get('[data-testid="resize-handle-bottom-right"]')
      .trigger('mousedown')
      .trigger('mousemove', { clientX: 100, clientY: 100 })
      .trigger('mouseup');

    cy.get('[data-testid="window"]').should(($window) => {
      expect($window.width()).to.be.greaterThan(800);
    });
  });

  it('should create tabs when dragging window onto another', () => {
    cy.get('[data-testid="app-card-postiz"]').within(() => {
      cy.get('button').contains('Launch').click();
    });
    cy.get('[data-testid="app-card-bytebot"]').within(() => {
      cy.get('button').contains('Launch').click();
    });

    // Drag second window onto first
    cy.get('[data-testid="window-header"]').eq(1)
      .trigger('mousedown')
      .trigger('dragover', { clientX: 400, clientY: 100 })
      .trigger('drop')
      .trigger('mouseup');

    cy.get('[data-testid="tab"]').should('have.length', 2);
  });

  it('should persist layout on page reload', () => {
    cy.get('[data-testid="app-card-postiz"]').within(() => {
      cy.get('button').contains('Launch').click();
    });

    cy.reload();

    cy.get('[data-testid="window-container"]').should('have.length', 1);
    cy.get('[data-testid="window-header"]').should('contain', 'Postiz');
  });
});
```

### End-to-End Tests

```typescript
// cypress/e2e/full-workflow.cy.ts
describe('Full Application Launcher Workflow', () => {
  it('should complete full workflow: launch, resize, tab, split, save', () => {
    cy.visit('/applications');

    // 1. Launch Postiz
    cy.get('[data-testid="app-card-postiz"]').within(() => {
      cy.get('button').contains('Launch').click();
    });
    cy.get('[data-testid="window"]').should('have.length', 1);

    // 2. Resize window
    cy.get('[data-testid="resize-handle-bottom-right"]')
      .trigger('mousedown')
      .trigger('mousemove', { clientX: 100, clientY: 100 })
      .trigger('mouseup');

    // 3. Launch Bytebot
    cy.get('[data-testid="app-card-bytebot"]').within(() => {
      cy.get('button').contains('Launch').click();
    });
    cy.get('[data-testid="window"]').should('have.length', 2);

    // 4. Create tab group
    cy.get('[data-testid="window-header"]').eq(1)
      .trigger('mousedown')
      .trigger('dragover', { clientX: 400, clientY: 100 })
      .trigger('drop')
      .trigger('mouseup');
    cy.get('[data-testid="tab"]').should('have.length', 2);

    // 5. Launch Open Computer Use
    cy.get('[data-testid="app-card-open-computer-use"]').within(() => {
      cy.get('button').contains('Launch').click();
    });

    // 6. Create split view
    cy.get('[data-testid="window"]').eq(0)
      .rightclick();
    cy.get('[data-testid="context-menu"]').within(() => {
      cy.get('button').contains('Split Right').click();
    });

    // 7. Verify layout
    cy.get('[data-testid="split-container"]').should('exist');
    cy.get('[data-testid="tab"]').should('have.length', 2);

    // 8. Reload and verify persistence
    cy.reload();
    cy.get('[data-testid="split-container"]').should('exist');
    cy.get('[data-testid="tab"]').should('have.length', 2);
  });
});
```

### Coverage Metrics

- **Target Coverage**: 80% overall
  - Statements: 80%
  - Branches: 75%
  - Functions: 80%
  - Lines: 80%

- **Critical Paths** (100% coverage required):
  - Window lifecycle (create, close, minimize, maximize)
  - State persistence (save, load, recovery)
  - Error handling (launch failures, corruption recovery)

---

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Window State Consistency

**For any** window operation (resize, move, minimize, maximize), the persisted window state SHALL match the rendered window state.

**Validates: Requirements 3, 4, 5, 9**

### Property 2: Application Lifecycle Integrity

**For any** application launch, the process ID tracked in ProcessInfo SHALL correspond to an actual running process, and when the window is closed, the process SHALL be terminated.

**Validates: Requirements 2, 10**

### Property 3: Layout Persistence Round-Trip

**For any** valid layout configuration, saving the layout and then reloading KRONOS SHALL restore the layout to an equivalent state (same windows, positions, sizes, tabs, splits).

**Validates: Requirement 9**

### Property 4: Window Constraint Enforcement

**For any** window resize operation, the resulting window dimensions SHALL be within the enforced min/max constraints defined for that application.

**Validates: Requirement 3**

### Property 5: Tab Group Consistency

**For any** tab group, the number of tabs displayed SHALL equal the number of windows in the tab group, and switching tabs SHALL display the correct window.

**Validates: Requirement 7**

### Property 6: Split View Ratio Validity

**For any** split view operation, the split ratio SHALL remain between 0.2 and 0.8 (20%-80%), and resizing the divider SHALL maintain this constraint.

**Validates: Requirement 8**

### Property 7: Focus State Uniqueness

**For any** moment in time, at most one window SHALL have focus, and the focused window SHALL be visually highlighted.

**Validates: Requirement 11**

### Property 8: Application Status Accuracy

**For any** application, the displayed status (running/stopped/error) SHALL accurately reflect the actual process state.

**Validates: Requirements 1, 2, 10**

---

## Implementation Priority & Effort Estimation

### Phase 1: MVP (Weeks 1-2) - 40 Story Points

- [ ] **1.1 Application Discovery** (5 SP)
  - Display available applications in grid
  - Show app metadata (icon, name, description)
  - Implement launch button

- [ ] **1.2 Basic Window Management** (8 SP)
  - Create window container
  - Implement window header with controls
  - Add minimize/maximize/close functionality
  - Implement window focus management

- [ ] **1.3 Window Resizing** (8 SP)
  - Add resize handles (8 positions)
  - Implement drag-to-resize logic
  - Enforce min/max constraints
  - Add visual feedback during resize

- [ ] **1.4 Window Dragging** (6 SP)
  - Implement title bar drag
  - Update position in real-time
  - Constrain within viewport
  - Add visual feedback

- [ ] **1.5 State Persistence** (8 SP)
  - Save window state to localStorage
  - Load state on startup
  - Implement backup mechanism
  - Add recovery logic

- [ ] **1.6 Basic Testing** (5 SP)
  - Unit tests for core components
  - Integration tests for window lifecycle
  - E2E tests for basic workflow

### Phase 2: Enhanced Features (Weeks 3-4) - 35 Story Points

- [ ] **2.1 Tabbed Windows** (10 SP)
  - Implement tab manager component
  - Add drag-to-tab functionality
  - Implement tab switching
  - Add tab close buttons

- [ ] **2.2 Split View Layout** (12 SP)
  - Implement split container
  - Add split divider with drag-to-resize
  - Implement context menu for split options
  - Add split layout persistence

- [ ] **2.3 Window Switching** (5 SP)
  - Implement Alt+Tab switcher
  - Add keyboard navigation
  - Implement visual focus indicators

- [ ] **2.4 Application Configuration** (5 SP)
  - Add launch options dialog
  - Implement app-specific settings
  - Add configuration persistence

- [ ] **2.5 Enhanced Testing** (3 SP)
  - Add tests for tabbed windows
  - Add tests for split view
  - Increase coverage to 80%

### Phase 3: Polish & Optimization (Weeks 5-6) - 25 Story Points

- [ ] **3.1 Performance Optimization** (8 SP)
  - Implement virtual scrolling for app grid
  - Add lazy loading for window content
  - Optimize re-renders with React.memo
  - Implement debounced state updates

- [ ] **3.2 Error Handling** (7 SP)
  - Add retry logic for launch failures
  - Implement state corruption recovery
  - Add graceful degradation
  - Implement error notifications

- [ ] **3.3 Animations & UX** (5 SP)
  - Add smooth transitions for window operations
  - Implement Framer Motion animations
  - Add loading states
  - Improve visual feedback

- [ ] **3.4 Accessibility & i18n** (3 SP)
  - Add ARIA labels and roles
  - Implement keyboard navigation
  - Add i18n support for UI text

- [ ] **3.5 Documentation** (2 SP)
  - Write component documentation
  - Create usage examples
  - Document IPC API

### Total Effort: 100 Story Points (~6 weeks)

---

## Accessibility Considerations

### ARIA Support

```typescript
<div
  role="window"
  aria-label="Postiz Application Window"
  aria-describedby="window-description"
  aria-modal="false"
>
  <div
    role="heading"
    aria-level={2}
    className="window-header"
  >
    Postiz
  </div>
  <button
    aria-label="Minimize window"
    aria-pressed={isMinimized}
  >
    −
  </button>
  <button
    aria-label="Maximize window"
    aria-pressed={isMaximized}
  >
    □
  </button>
  <button
    aria-label="Close window"
  >
    ×
  </button>
</div>
```

### Keyboard Navigation

- **Tab**: Navigate between windows and controls
- **Enter/Space**: Activate buttons
- **Alt+Tab**: Cycle through windows
- **Ctrl+W**: Close focused window
- **Escape**: Cancel drag operations

### Color Contrast

- Minimum WCAG AA contrast ratio (4.5:1 for text)
- Visual indicators not solely dependent on color
- High contrast mode support

---

## Internationalization (i18n)

### Supported Languages

- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Chinese (zh)
- Japanese (ja)

### Translation Keys

```typescript
const translations = {
  'app.launch': 'Launch',
  'app.close': 'Close',
  'app.minimize': 'Minimize',
  'app.maximize': 'Maximize',
  'app.restore': 'Restore',
  'window.untitled': 'Untitled Window',
  'error.launch_failed': 'Failed to launch application',
  'error.process_crashed': 'Application crashed',
  'layout.saved': 'Layout saved',
  'layout.restored': 'Layout restored',
};
```

---

## Conclusion

The KRONOS Application Launcher provides a sophisticated, modular window management system that enables users to launch, embed, and control multiple applications within a unified interface. The design prioritizes:

1. **Modularity**: Clear separation of concerns with independent services
2. **Scalability**: Support for multiple applications and complex layouts
3. **Performance**: Optimized rendering and memory management
4. **Reliability**: Comprehensive error handling and state recovery
5. **Accessibility**: Full ARIA support and keyboard navigation
6. **User Experience**: Smooth animations and intuitive controls

The implementation follows a phased approach, starting with MVP features and progressively adding enhancements, ensuring a solid foundation while maintaining flexibility for future improvements.

