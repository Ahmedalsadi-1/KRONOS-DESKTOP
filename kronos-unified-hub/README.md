# KRONOS Unified Control Hub 🎛️

A comprehensive master control application for the AI Emulators Ecosystem. This Electron application serves as the central hub for launching, managing, and orchestrating all automation tools, virtual machines, physical devices, and services.

## 🎯 Features

### Application Management
- **Launch Applications**: Start Postiz, Bytebot, Open Computer Use, GBox, and more
- **Window Management**: Resizable, draggable, tabbed, and split-view windows
- **Application Lifecycle**: Monitor, restart, and manage running applications
- **Resource Allocation**: Control CPU and memory allocation per application

### Device Management
- **Android Emulators**: Connect and control Android emulators via GBox
- **Physical Devices**: Manage USB-connected Android devices
- **Virtual Machines**: Control cloud instances and local VMs
- **Device Monitoring**: Real-time metrics (CPU, memory, storage, battery)
- **Remote Control**: Execute commands and take screenshots

### Service Orchestration
- **Docker Services**: Start, stop, and scale Docker containers
- **Health Monitoring**: Real-time health checks and status updates
- **Log Viewer**: Stream and search service logs
- **MCP Servers**: Manage 21+ integrated MCP servers
- **Performance Metrics**: Monitor CPU, memory, and network usage

### Workflow Automation
- **Visual Workflow Builder**: Create multi-step automation workflows
- **Scheduling**: Schedule workflows to run at specific times
- **Conditional Logic**: Add branching and conditional execution
- **Error Handling**: Retry logic and error recovery
- **Workflow History**: Track execution history and analytics

### Real-time Monitoring
- **Dashboard**: System overview with key metrics
- **Alerts**: Real-time notifications for system events
- **Activity Log**: Track all system activities
- **Performance Graphs**: Visualize system metrics over time

## 🏗️ Architecture

```
KRONOS Control Hub
├── Main Process (Electron)
│   ├── App Launcher Service
│   ├── Device Manager Service
│   ├── Service Orchestrator
│   └── Workflow Engine
├── Renderer Process (React)
│   ├── Dashboard
│   ├── Applications Manager
│   ├── Device Manager
│   ├── Service Monitor
│   ├── Workflow Builder
│   └── Settings
└── Backend Services (Docker)
    ├── OnlySnarf
    ├── InstaPy
    ├── InstaGrapi
    ├── TikTok API
    ├── PyTube
    └── YouTube Upload
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Docker and Docker Compose
- Electron 28+

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/kronos-unified-hub.git
cd kronos-unified-hub

# Install dependencies
npm install

# Install Electron
npm install electron --save-dev
```

### Development

```bash
# Start development server
npm run dev

# This will:
# 1. Start Vite dev server on http://localhost:5173
# 2. Launch Electron with hot reload
# 3. Open DevTools automatically
```

### Building

```bash
# Build for production
npm run build

# Build only Vite (React)
npm run build:vite

# Build only Electron
npm run build:electron

# Create distributable packages
npm run build:electron
```

## 📋 Project Structure

```
kronos-unified-hub/
├── src/
│   ├── main/
│   │   ├── main.ts                 # Electron main process
│   │   ├── preload.ts              # Secure preload script
│   │   ├── utils.ts                # Utility functions
│   │   ├── ipc/                    # IPC handlers
│   │   └── services/
│   │       ├── app-launcher.ts     # Launch/manage apps
│   │       ├── device-manager.ts   # Device control
│   │       ├── service-manager.ts  # Docker/service control
│   │       └── workflow-engine.ts  # Workflow execution
│   │
│   ├── renderer/
│   │   ├── App.tsx                 # Main app component
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Applications.tsx
│   │   │   ├── Devices.tsx
│   │   │   ├── Services.tsx
│   │   │   ├── Workflows.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   ├── WindowManager.tsx
│   │   │   ├── AppWindow.tsx
│   │   │   ├── DeviceCard.tsx
│   │   │   ├── ServiceMonitor.tsx
│   │   │   └── WorkflowBuilder.tsx
│   │   ├── hooks/
│   │   ├── store/
│   │   └── styles/
│   │
│   └── shared/
│       ├── types/
│       └── constants/
│
├── public/
│   └── icons/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── electron-builder.yml
```

## 🔌 IPC Communication

### App Launcher
```typescript
// Launch application
await window.electron.ipcRenderer.invoke('app:launch', 'postiz', {
  width: 1200,
  height: 800,
  resizable: true,
});

// List available apps
const apps = await window.electron.ipcRenderer.invoke('app:list');

// Close application
await window.electron.ipcRenderer.invoke('app:close', 'app-id');
```

### Device Manager
```typescript
// List devices
const devices = await window.electron.ipcRenderer.invoke('device:list');

// Connect device
await window.electron.ipcRenderer.invoke('device:connect', 'device-id', {
  type: 'android-emulator',
});

// Execute command
await window.electron.ipcRenderer.invoke('device:execute', 'device-id', {
  command: 'screenshot',
});
```

### Service Manager
```typescript
// List services
const services = await window.electron.ipcRenderer.invoke('service:list');

// Start services
await window.electron.ipcRenderer.invoke('service:start', ['onlysnarf', 'instapy']);

// Get service logs
const logs = await window.electron.ipcRenderer.invoke('service:logs', 'onlysnarf', {
  lines: 100,
});

// Get health status
const health = await window.electron.ipcRenderer.invoke('service:health');
```

### Workflow Engine
```typescript
// Create workflow
const workflow = await window.electron.ipcRenderer.invoke('workflow:create', {
  name: 'Daily Automation',
  steps: [...],
  schedule: 'daily-09:00',
});

// Execute workflow
await window.electron.ipcRenderer.invoke('workflow:execute', 'workflow-id');

// List workflows
const workflows = await window.electron.ipcRenderer.invoke('workflow:list');
```

## 🎨 UI Components

### Dashboard
- System overview with key metrics
- Real-time status indicators
- Quick access buttons
- Alert notifications
- Activity log

### Applications Manager
- Launch applications
- Manage windows (resize, minimize, maximize)
- Monitor application status
- View application logs
- Restart applications

### Device Manager
- List connected devices
- Connect/disconnect devices
- Execute device commands
- Monitor device metrics
- Take screenshots
- Install/uninstall apps

### Service Monitor
- List Docker services
- Start/stop services
- Scale services
- View service logs
- Monitor service health
- Performance metrics

### Workflow Builder
- Visual workflow editor
- Drag-and-drop steps
- Conditional logic
- Scheduling interface
- Execution history
- Analytics dashboard

## 🔐 Security

- **Context Isolation**: Renderer process is sandboxed
- **Preload Script**: Secure IPC communication
- **Credential Storage**: Encrypted credential management
- **Input Validation**: All inputs are validated
- **Environment Variables**: Secrets stored in environment

## 📊 Performance

- **Launch Time**: < 3 seconds
- **Memory Usage**: < 500MB baseline
- **App Switching**: < 500ms
- **Device Detection**: < 2 seconds
- **Service Startup**: < 10 seconds

## 🧪 Testing

```bash
# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Run specific test
npm run test -- Dashboard.test.tsx
```

## 📝 Development Guidelines

### Code Style
- TypeScript strict mode
- ESLint + Prettier
- Descriptive variable names
- Modular component structure

### Naming Conventions
- **Components**: PascalCase (`Dashboard.tsx`)
- **Functions**: camelCase (`launchApp()`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Files**: kebab-case for utilities, PascalCase for components

### Component Structure
```typescript
// Imports
import React from 'react';
import { useEffect, useState } from 'react';

// Types
interface Props {
  // ...
}

// Component
export function MyComponent({ prop }: Props) {
  // State
  const [state, setState] = useState();

  // Effects
  useEffect(() => {
    // ...
  }, []);

  // Handlers
  const handleClick = () => {
    // ...
  };

  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

## 🚀 Deployment

### macOS
```bash
npm run build
# Creates: dist-electron/KRONOS Control Hub.dmg
```

### Windows
```bash
npm run build
# Creates: dist-electron/KRONOS Control Hub Setup.exe
```

### Linux
```bash
npm run build
# Creates: dist-electron/kronos-control-hub.AppImage
```

## 📚 Documentation

- [Architecture Guide](./docs/ARCHITECTURE.md)
- [API Reference](./docs/API.md)
- [Component Guide](./docs/COMPONENTS.md)
- [Workflow Guide](./docs/WORKFLOWS.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- UI powered by [React](https://react.dev/) and [Tailwind CSS](https://tailwindcss.com/)
- Icons from [Lucide React](https://lucide.dev/)
- State management with [Zustand](https://github.com/pmndrs/zustand)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/kronos-unified-hub/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/kronos-unified-hub/discussions)
- **Documentation**: [docs.kronos.dev](https://docs.kronos.dev)

---

**Built with ❤️ for the AI Automation Community**
