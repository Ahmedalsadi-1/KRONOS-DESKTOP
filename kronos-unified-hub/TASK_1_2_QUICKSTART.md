# Task 1.2 Quick Start: Basic Window Management

## Overview
Task 1.2 implements basic window management features including resizing, dragging, and minimize/maximize/close buttons. This task is worth 8 story points and should take 2-3 days.

## Requirements

### 1. Window Resizing
- [ ] Resize handles on window edges (8 directions)
- [ ] Min/max width and height constraints
- [ ] Smooth resize animation
- [ ] Cursor changes on hover (resize cursor)
- [ ] Keyboard shortcuts for resize (optional)

### 2. Window Dragging
- [ ] Drag window by title bar
- [ ] Smooth drag animation
- [ ] Prevent dragging outside viewport
- [ ] Snap to edges (optional)
- [ ] Keyboard shortcuts for move (optional)

### 3. Window Controls
- [ ] Minimize button
- [ ] Maximize button
- [ ] Close button
- [ ] Keyboard shortcuts (Cmd+W to close, etc.)
- [ ] Hover effects and tooltips

### 4. State Persistence
- [ ] Save window position
- [ ] Save window size
- [ ] Restore on app restart
- [ ] Per-application state

### 5. Keyboard Shortcuts
- [ ] Cmd+W / Ctrl+W - Close window
- [ ] Cmd+M / Ctrl+M - Minimize window
- [ ] Cmd+Ctrl+F / F11 - Fullscreen (optional)
- [ ] Arrow keys - Move window (optional)

## Architecture

### New Services
```typescript
// src/main/services/window-manager.ts
export class WindowManager {
  createWindow(appId: string, options: WindowOptions): Window
  resizeWindow(windowId: string, width: number, height: number): void
  moveWindow(windowId: string, x: number, y: number): void
  minimizeWindow(windowId: string): void
  maximizeWindow(windowId: string): void
  closeWindow(windowId: string): void
  getWindowState(windowId: string): WindowState
  saveWindowState(windowId: string, state: WindowState): void
  restoreWindowState(windowId: string): WindowState | null
}
```

### New Components
```typescript
// src/renderer/components/WindowFrame.tsx
// Wrapper component for window with controls and resize handles

// src/renderer/components/WindowControls.tsx
// Title bar with minimize/maximize/close buttons

// src/renderer/components/ResizeHandle.tsx
// Resize handle for window edges
```

### New IPC Handlers
```typescript
ipcMain.handle('window:resize', (event, windowId, width, height) => {})
ipcMain.handle('window:move', (event, windowId, x, y) => {})
ipcMain.handle('window:minimize', (event, windowId) => {})
ipcMain.handle('window:maximize', (event, windowId) => {})
ipcMain.handle('window:close', (event, windowId) => {})
ipcMain.handle('window:state:get', (event, windowId) => {})
ipcMain.handle('window:state:save', (event, windowId, state) => {})
```

## Implementation Steps

### Phase 1: Window Manager Service (2 SP)
1. Create `WindowManager` class
2. Implement window state tracking
3. Add state persistence with electron-store
4. Create IPC handlers
5. Write unit tests

### Phase 2: UI Components (3 SP)
1. Create `WindowFrame` wrapper component
2. Create `WindowControls` component
3. Create `ResizeHandle` component
4. Integrate with ApplicationGrid
5. Write component tests

### Phase 3: Interactions & Polish (3 SP)
1. Implement drag functionality
2. Implement resize functionality
3. Add keyboard shortcuts
4. Add animations
5. Write integration tests

## File Structure

```
kronos-unified-hub/
├── src/
│   ├── main/
│   │   ├── services/
│   │   │   ├── window-manager.ts (NEW)
│   │   │   └── __tests__/
│   │   │       └── window-manager.spec.ts (NEW)
│   │   └── utils/
│   │       └── window-state.ts (NEW)
│   └── renderer/
│       ├── components/
│       │   ├── WindowFrame.tsx (NEW)
│       │   ├── WindowControls.tsx (NEW)
│       │   ├── ResizeHandle.tsx (NEW)
│       │   └── __tests__/
│       │       ├── WindowFrame.spec.tsx (NEW)
│       │       ├── WindowControls.spec.tsx (NEW)
│       │       └── ResizeHandle.spec.tsx (NEW)
│       └── hooks/
│           ├── useWindowDrag.ts (NEW)
│           ├── useWindowResize.ts (NEW)
│           └── useWindowState.ts (NEW)
├── TASK_1_2_COMPLETION.md (NEW)
└── TASK_1_2_QUICKSTART.md (this file)
```

## Key Interfaces

```typescript
// Window state interface
interface WindowState {
  id: string;
  appId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  fullscreen: boolean;
  createdAt: number;
  updatedAt: number;
}

// Window options interface
interface WindowOptions {
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  x?: number;
  y?: number;
  resizable?: boolean;
  draggable?: boolean;
}

// Resize handle props
interface ResizeHandleProps {
  position: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
  onResize: (width: number, height: number) => void;
}
```

## Testing Strategy

### Unit Tests
- WindowManager service (30+ tests)
  - Window creation/destruction
  - State persistence
  - Constraint validation
  - Edge cases

### Component Tests
- WindowFrame (15+ tests)
- WindowControls (10+ tests)
- ResizeHandle (10+ tests)

### Integration Tests
- Window drag and drop
- Window resize with constraints
- State persistence and restoration
- Keyboard shortcuts

### E2E Tests (Optional)
- Full window management workflow
- Multi-window scenarios
- State persistence across restarts

## Performance Considerations

1. **Debounce resize events** - Prevent excessive re-renders
2. **Memoize components** - Use React.memo for ResizeHandle
3. **Lazy load state** - Only restore state when needed
4. **Optimize animations** - Use CSS transforms for smooth performance

## Accessibility

1. **Keyboard navigation** - All controls accessible via keyboard
2. **ARIA labels** - Proper labels for all buttons
3. **Focus management** - Proper focus order
4. **Screen reader support** - Announce window state changes

## Dependencies

No new dependencies needed. Uses existing:
- `electron` - Window management
- `electron-store` - State persistence
- `framer-motion` - Animations
- `tailwindcss` - Styling

## Git Workflow

```bash
# Create feature branch
git checkout -b feat/task-1-2-window-management

# Commit incrementally
git commit -m "feat: Implement WindowManager service"
git commit -m "feat: Create WindowFrame component"
git commit -m "feat: Add window drag functionality"
git commit -m "feat: Add window resize functionality"
git commit -m "test: Add comprehensive tests"

# Push and create PR
git push origin feat/task-1-2-window-management
```

## Success Criteria

- ✅ All 8 requirements implemented
- ✅ 90%+ test coverage
- ✅ No TypeScript errors
- ✅ Accessibility compliant
- ✅ Performance optimized
- ✅ Documentation complete
- ✅ Code follows AGENTS.md guidelines

## Estimated Timeline

| Phase | Duration | SP |
|-------|----------|-----|
| Phase 1: WindowManager | 1 day | 2 |
| Phase 2: UI Components | 1 day | 3 |
| Phase 3: Interactions | 1 day | 3 |
| **Total** | **3 days** | **8** |

## Resources

- [Electron Window API](https://www.electronjs.org/docs/api/browser-window)
- [electron-store Documentation](https://github.com/sindresorhus/electron-store)
- [Framer Motion Docs](https://www.framer.com/motion/)
- [React Hooks Best Practices](https://react.dev/reference/react/hooks)

## Next Task

After Task 1.2 is complete, proceed to:
- **Task 1.3**: Window Lifecycle Management (7 SP)
  - Process monitoring
  - Graceful shutdown
  - Error recovery

## Questions?

Refer to:
- `.kiro/specs/kronos-app-launcher/design.md` - Design document
- `.kiro/specs/kronos-app-launcher/tasks.md` - Task breakdown
- `KRONOS_UNIFIED_CONTROL_HUB.md` - Architecture overview
