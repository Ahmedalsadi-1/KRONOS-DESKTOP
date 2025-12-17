# Unified AI Automation Platform Implementation Plan

## Overview
Create a comprehensive Electron desktop application that provides a single, unified interface for managing and interacting with all three AI computer automation projects: open-computer-use, UI-TARS-desktop, and gbox.

## Project Structure & Architecture Analysis

Based on the investigation, this unified platform will serve as an orchestration layer that:
- Provides project selection and status monitoring
- Manages service lifecycle (start/stop/monitor) for each project
- Offers unified task creation across all platforms
- Displays real-time execution streams from active projects
- Handles authentication and configuration management

### Four Project Integration Points:

**open-computer-use (Advanced Orchestration)**:
- Ports: 3000 (frontend), 8001 (backend)
- APIs: REST with WebSocket streaming, multi-agent coordination
- Architecture: FastAPI backend with Supabase + multi-agent executor

**UI-TARS-desktop (Vision-Language Focus)**:
- Local Python execution with PyAutoGUI integration
- APIs: Action parsing, coordinate processing
- Architecture: Standalone VLM with action interpreter

**gbox (Infrastructure Management)**:
- Go CLI with MCP server integration
- APIs: Device management, container provisioning
- Architecture: MCP-compliant tool ecosystem

## Types

Define unified data structures for cross-project compatibility.

### Core Type Definitions

```typescript
// Project state and status
enum ProjectStatus {
  UNINSTALLED = 'uninstalled',
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  ERROR = 'error'
}

enum TaskStatus {
  QUEUED = 'queued',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Cross-project task interface
interface UnifiedTask {
  id: string;
  projectId: ProjectId;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  result?: any;
  error?: string;
  streamUrl?: string; // WebSocket endpoint for live updates
}

// Platform configuration
interface PlatformConfig {
  id: string;
  name: string;
  description: string;
  ports: number[];
  dependencies: string[]; // Required services/tools
  startCommand: string;
  stopCommand: string;
  healthCheckUrl?: string;
  apiEndpoints: {
    tasks: string;
    status: string;
    auth?: string;
  };
}

// Inter-process communication
interface IPCMessage {
  type: 'status-update' | 'task-create' | 'task-result' | 'service-control';
  payload: any;
  timestamp: Date;
}

// Authentication state
interface AuthState {
  projectId: ProjectId;
  credentials: { [key: string]: string };
  tokens?: { [key: string]: string };
  expiresAt?: Date;
}
```

## Files

Create a structured Electron application with clear separation of concerns.

### New Files to Create

- `src/main/kronos-main.js` - Electron main process, IPC handlers, service management
- `src/main/services/project-manager.js` - Manages starting/stopping project services
- `src/main/services/process-monitor.js` - Monitors project health and processes
- `src/main/services/unified-api.js` - Cross-project API abstraction layer
- `src/main/services/auth-manager.js` - Handles authentication across platforms
- `src/main/services/websocket-manager.js` - Manages WebSocket connections for streaming
- `src/renderer/app.js` - React main application component
- `src/renderer/components/project-selector.jsx` - Platform selection UI
- `src/renderer/components/task-manager.jsx` - Unified task creation interface
- `src/renderer/components/status-dashboard.jsx` - Service status monitoring
- `src/renderer/components/live-stream.jsx` - Real-time execution monitoring
- `src/renderer/services/api.js` - Frontend API service layer
- `src/renderer/services/websocket.js` - Frontend WebSocket client
- `src/renderer/hooks/useProjects.js` - Project state management hook
- `src/renderer/hooks/useTasks.js` - Task management hook
- `src/renderer/hooks/useWebSocket.js` - WebSocket connection hook
- `src/shared/config.js` - Platform configuration data
- `src/shared/types.js` - Shared TypeScript type definitions
- `src/shared/constants.js` - Application constants and defaults

### Existing Files to Modify

- None - This is a new unified application

### Configuration and Build Files

- `package.json` - Electron dependencies and scripts
- `public/index.html` - Main HTML template
- `electron-builder.json` - Build configuration for distributables
- `scripts/start-services.js` - Service orchestration script
- `scripts/check-deps.js` - Dependency verification script

## Functions

Define core functions for unified platform operation.

### New Functions

**Main Process Functions:**
```javascript
// Service lifecycle management
function startProjectService(ProjectId projectId): Promise<void>
function stopProjectService(ProjectId projectId): Promise<void>
function getProjectStatus(ProjectId projectId): Promise<ProjectStatus>
function checkServiceHealth(ProjectId projectId): Promise<HealthStatus>

// Cross-platform task operations
function createUnifiedTask(ProjectId projectId, TaskData data): Promise<TaskId>
function monitorTaskExecution(TaskId taskId): Promise<TaskStream>
function cancelTaskExecution(TaskId taskId): Promise<boolean>

// Authentication management
function authenticatePlatform(ProjectId projectId, Credentials creds): Promise<AuthTokens>
function refreshAuthTokens(ProjectId projectId): Promise<AuthTokens>
function validatePlatformAuth(ProjectId projectId): Promise<boolean>

// IPC communication handlers
function handleIPCTaskCreate(event, args): Promise<TaskResult>
function handleIPCServiceControl(event, args): Promise<ServiceStatus>
function handleIPCStatusUpdate(event, args): Promise<UIUpdate>
```

**Renderer Process Functions:**
```javascript
// UI state management
function updateProjectStatus(ProjectId projectId, ProjectStatus status): void
function addTaskToUI(Task task): void
function updateTaskProgress(TaskId taskId, ProgressData progress): void
function displayErrorMessage(string message, ErrorLevel level): void

// API integration
function fetchProjectTasks(ProjectId projectId): Promise<Task[]>
function submitTaskToPlatform(ProjectId projectId, TaskData data): Promise<TaskResult>
function createWebSocketConnection(ProjectId projectId): WebSocket

// User interaction handlers
function handleProjectSelection(ProjectId projectId): Promise<void>
function handleTaskSubmission(TaskData data): Promise<void>
function handleStreamConnection(TaskId taskId): Promise<void>
```

### Service Layer Functions

```javascript
// Project-specific API adapters
function bytebotCreateTask(string description, Auth auth): Promise<TaskResult>
function opencomputerCreateTask(string description, StreamConfig config): Promise<TaskResult>
function uitarsProcessAction(string action, Screenshot screenshot): Promise<ExecutionResult>
function gboxExecuteCommand(string command, Device device): Promise<CommandResult>
```

## Classes

Object-oriented design for complex service management.

### New Classes

**Main Process Classes:**

```javascript
class ProjectManager {
  constructor() {
    this.projects = new Map();
    this.processes = new Map();
  }

  async startProject(projectId: ProjectId): void
  async stopProject(projectId: ProjectId): void
  getProjectStatus(projectId: ProjectId): ProjectStatus
  checkDependencies(projectId: ProjectId): DependencyStatus[]
}

class APIServiceAdapter {
  constructor(platformConfig: PlatformConfig)

  authenticate(credentials: Credentials): Promise<AuthTokens>
  createTask(data: TaskData): Promise<TaskResult>
  getTaskStatus(taskId: TaskId): Promise<TaskStatus>
  cancelTask(taskId: TaskId): Promise<boolean>
  createWebSocketStream(): WebSocket
}

class WebSocketManager {
  constructor()

  connectToTaskStream(projectId: ProjectId, taskId: TaskId): Promise<WebSocketConnection>
  disconnectTaskStream(taskId: TaskId): void
  broadcastToRenderer(data: IPCMessage): void
}
```

**Renderer Process Classes:**

```javascript
class TaskManager {
  constructor(apiService: APIService)

  async createTask(projectId: ProjectId, data: TaskData): Promise<Task>
  async cancelTask(taskId: TaskId): Promise<boolean>
  subscribeToTaskUpdates(taskId: TaskId): Observable<TaskUpdate>
}

class ProjectStatusMonitor {
  constructor(projectManager: ProjectManager)

  watchProjectStatus(projectId: ProjectId): Observable<ProjectStatus>
  watchTaskProgress(taskId: TaskId): Observable<TaskProgress>
  watchServiceHealth(): Observable<ServiceHealth[]>
}

class AuthenticationManager {
  constructor()

  authenticateProject(projectId: ProjectId, credentials: Credentials): Promise<AuthState>
  refreshTokens(projectId: ProjectId): Promise<AuthState>
  clearAuthData(projectId: ProjectId): void
}
```

### Shared Utility Classes

```javascript
class ConfigManager {
  constructor()

  loadPlatformConfig(projectId: ProjectId): PlatformConfig
  saveUserPreferences(preferences: UserPrefs): void
  getDefaultSettings(): AppSettings
}

class IPCBridge {
  constructor(ipcRenderer: Electron.IPCRenderer)

  sendAsync(channel: string, data: any): Promise<any>
  registerHandler(channel: string, handler: Function): void
  unregisterHandler(channel: string): void
}
```

## Dependencies

npm packages required for unified platform functionality.

### Core Electron Dependencies
- `electron`: ^28.0.0 - Desktop application framework
- `electron-store`: ^8.1.0 - Configuration persistence
- `electron-builder`: ^24.0.0 - Application packaging

### API and Networking
- `axios`: ^1.6.0 - HTTP client for API calls
- `ws`: ^8.14.0 - WebSocket client for streaming
- `socket.io-client`: ^4.7.0 - Socket.IO client for real-time updates

### React and UI Framework
- `react`: ^18.2.0 - UI framework
- `react-dom`: ^18.2.0 - DOM rendering
- `react-router-dom`: ^6.8.0 - Client-side routing
- `@tanstack/react-query`: ^4.29.0 - Data fetching and caching
- `tailwindcss`: ^3.2.0 - Utility-first CSS framework

### Development Tools
- `concurrently`: ^7.6.0 - Run multiple commands
- `nodemon`: ^2.0.20 - Development server with auto-restart
- `cross-env`: ^7.0.3 - Cross-platform environment variables

### Testing Dependencies
- `jest`: ^29.5.0 - Testing framework
- `spectron`: ^19.0.0 - Electron app testing utilities

## Testing

Define testing strategy for integrated application.

### Test File Requirements

**Unit Tests:**
- `tests/unit/services/project-manager.test.js` - Service management testing
- `tests/unit/services/api-adapter.test.js` - API abstraction testing
- `tests/unit/components/TaskManager.test.jsx` - React component testing

**Integration Tests:**
- `tests/integration/project-lifecycle.test.js` - End-to-end project management
- `tests/integration/cross-platform-tasks.test.js` - Task creation across platforms
- `tests/integration/websocket-streaming.test.js` - Real-time streaming testing

**E2E Tests:**
- `tests/e2e/project-selection.e2e.test.js` - Complete user workflow testing

### Existing Tests to Modify
- None - New application

### Validation Strategies
- Mock API responses for testing without real services
- Isolated testing for each platform adapter
- UI component behavior testing with React Testing Library
- Integration tests using test Docker containers

## Implementation Order

Numbered implementation sequence prioritizing stability and integration.

1. **Project 1: Core Electron Infrastructure**
   - Set up basic Electron app structure
   - Implement main process with IPC communication
   - Create basic renderer with React setup
   - Add build configuration and packaging

2. **Project 2: Configuration and Types**
   - Define TypeScript interfaces and types
   - Create platform configuration management
   - Set up shared constants and utilities
   - Implement configuration persistence

3. **Project 3: Service Management Layer**
   - Implement ProjectManager class
   - Add service lifecycle management (start/stop)
   - Create process monitoring capabilities
   - Add dependency checking and health monitoring

4. **Project 4: API Abstraction Layer**
   - Create platform-specific API adapters
   - Implement unified task creation interface
   - Add authentication management
   - Create error handling and retries

5. **Project 5: Real-time Streaming**
   - Implement WebSocket manager for task streams
   - Add streaming UI components
   - Create live execution monitoring
   - Handle connection management and reconnection

6. **Project 6: Core UI Components**
   - Build project selector interface
   - Create unified task creation forms
   - Implement status dashboard
   - Add notification and error display

7. **Project 7: Integration and Testing**
   - Connect UI to backend services
   - Add comprehensive error handling
   - Implement logging and debugging
   - Create integration tests and documentation
