# KRONOS Application Launcher Requirements

## Introduction

The KRONOS Unified Control Hub needs a sophisticated application launcher system that allows users to launch, manage, and control multiple applications (Postiz, Bytebot, Open Computer Use, GBox, AI-Browser, Local-Manus) as embedded windows within a single master interface. This system must support dynamic window management including resizing, dragging, tabbing, and split-view layouts.

## Glossary

- **Application**: External software (Postiz, Bytebot, etc.) that can be launched and embedded
- **Window**: A container within KRONOS that displays an embedded application
- **Tab**: A grouped collection of windows that can be switched between
- **Split View**: A layout where multiple windows are displayed side-by-side or stacked
- **Window Manager**: The service that handles window lifecycle and layout management
- **App Launcher**: The service that initiates application processes and manages their lifecycle
- **IPC**: Inter-Process Communication between Electron main and renderer processes
- **Embedded Window**: An application window displayed within the KRONOS UI (not a separate OS window)

## Requirements

### Requirement 1: Application Discovery and Listing

**User Story:** As a user, I want to see all available applications that can be launched, so that I can choose which application to start.

#### Acceptance Criteria

1. WHEN the Applications page loads, THE System SHALL display a list of all available applications (Postiz, Bytebot, Open Computer Use, GBox, AI-Browser, Local-Manus)
2. WHEN an application is listed, THE System SHALL show the application name, icon, description, and current status (running/stopped)
3. WHEN the user views the application list, THE System SHALL indicate which applications are currently running
4. THE System SHALL retrieve the application list from the AppLauncher service via IPC

### Requirement 2: Launch Applications

**User Story:** As a user, I want to launch applications with a single click, so that I can quickly start the tools I need.

#### Acceptance Criteria

1. WHEN a user clicks the launch button for an application, THE System SHALL invoke the app:launch IPC handler with the application name
2. WHEN an application is launched, THE System SHALL create a new window container within KRONOS
3. WHEN an application launches successfully, THE System SHALL display it in the main content area
4. IF an application fails to launch, THE System SHALL display an error message to the user
5. WHEN an application is launched, THE System SHALL update the application status to "running"

### Requirement 3: Window Management - Resizing

**User Story:** As a user, I want to resize application windows, so that I can optimize my workspace layout.

#### Acceptance Criteria

1. WHEN a window is displayed, THE System SHALL show resize handles on the window edges and corners
2. WHEN a user drags a resize handle, THE System SHALL update the window dimensions in real-time
3. WHEN a window is resized, THE System SHALL persist the new dimensions to local storage
4. WHEN a window is resized below minimum dimensions, THE System SHALL enforce minimum width (400px) and height (300px)
5. WHEN a window is resized above maximum dimensions, THE System SHALL enforce maximum width (1400px) and height (900px)

### Requirement 4: Window Management - Dragging

**User Story:** As a user, I want to drag windows to reposition them, so that I can organize my workspace.

#### Acceptance Criteria

1. WHEN a user clicks and drags the window title bar, THE System SHALL move the window to the new position
2. WHEN a window is dragged, THE System SHALL update its position in real-time
3. WHEN a window is dragged, THE System SHALL persist the new position to local storage
4. WHEN a window is dragged outside the visible area, THE System SHALL constrain it within the viewport bounds

### Requirement 5: Window Management - Minimize/Maximize

**User Story:** As a user, I want to minimize and maximize windows, so that I can manage my screen space efficiently.

#### Acceptance Criteria

1. WHEN a window is displayed, THE System SHALL show minimize and maximize buttons in the window header
2. WHEN a user clicks the minimize button, THE System SHALL hide the window and add it to a minimized windows list
3. WHEN a user clicks the maximize button, THE System SHALL expand the window to fill the available space
4. WHEN a maximized window is clicked again, THE System SHALL restore it to its previous size
5. WHEN a minimized window is clicked in the minimized list, THE System SHALL restore it to its previous position and size

### Requirement 6: Window Management - Close

**User Story:** As a user, I want to close application windows, so that I can stop running applications and free up resources.

#### Acceptance Criteria

1. WHEN a window is displayed, THE System SHALL show a close button in the window header
2. WHEN a user clicks the close button, THE System SHALL invoke the app:close IPC handler
3. WHEN an application is closed, THE System SHALL remove the window from the UI
4. WHEN an application is closed, THE System SHALL update the application status to "stopped"
5. WHEN an application is closed, THE System SHALL clean up any associated resources

### Requirement 7: Tabbed Window Management

**User Story:** As a user, I want to organize multiple windows into tabs, so that I can group related applications together.

#### Acceptance Criteria

1. WHEN multiple windows are open, THE System SHALL allow the user to create a new tab group
2. WHEN a user drags a window onto another window's tab bar, THE System SHALL add it to that tab group
3. WHEN windows are in a tab group, THE System SHALL display tabs at the top of the container
4. WHEN a user clicks a tab, THE System SHALL switch to that window while hiding others in the group
5. WHEN a tab is closed, THE System SHALL remove that window from the tab group
6. WHEN the last tab in a group is closed, THE System SHALL remove the tab group container

### Requirement 8: Split View Layout

**User Story:** As a user, I want to view multiple applications side-by-side, so that I can work with multiple tools simultaneously.

#### Acceptance Criteria

1. WHEN a user right-clicks on a window, THE System SHALL show a context menu with split options (split left, split right, split top, split bottom)
2. WHEN a user selects a split option, THE System SHALL divide the available space and create a new pane
3. WHEN windows are in a split view, THE System SHALL display a divider between panes that can be dragged to resize
4. WHEN a user drags the divider, THE System SHALL resize both panes proportionally
5. WHEN a pane is closed, THE System SHALL remove that pane and expand the remaining pane to fill the space
6. WHEN multiple split views exist, THE System SHALL persist the layout configuration to local storage

### Requirement 9: Window State Persistence

**User Story:** As a user, I want my window layout to be remembered, so that I don't have to reconfigure it every time I restart KRONOS.

#### Acceptance Criteria

1. WHEN a window is created, moved, resized, or closed, THE System SHALL save the window state to local storage
2. WHEN KRONOS starts, THE System SHALL restore all previously open windows with their saved positions and sizes
3. WHEN a window state is saved, THE System SHALL include the application name, position, size, and tab group information
4. WHEN KRONOS restarts, THE System SHALL restore windows in the same layout as they were before shutdown
5. WHEN a user manually resets the layout, THE System SHALL clear the saved window state

### Requirement 10: Application Lifecycle Management

**User Story:** As a user, I want applications to be properly managed, so that resources are freed when applications are closed.

#### Acceptance Criteria

1. WHEN an application is launched, THE System SHALL track its process ID and status
2. WHEN an application is running, THE System SHALL monitor its status and update the UI accordingly
3. WHEN an application crashes, THE System SHALL detect the crash and display an error notification
4. WHEN an application is closed, THE System SHALL terminate its process and clean up resources
5. WHEN KRONOS is closed, THE System SHALL gracefully close all running applications

### Requirement 11: Window Switching and Focus

**User Story:** As a user, I want to easily switch between open windows, so that I can navigate between applications efficiently.

#### Acceptance Criteria

1. WHEN multiple windows are open, THE System SHALL display a window switcher (Alt+Tab style or visual switcher)
2. WHEN a user clicks on a window, THE System SHALL bring it to focus and highlight it
3. WHEN a window is in focus, THE System SHALL display a visual indicator (border highlight or shadow)
4. WHEN a user uses keyboard shortcuts (Ctrl+Tab), THE System SHALL cycle through open windows
5. WHEN a window is minimized, THE System SHALL exclude it from the window switcher until restored

### Requirement 12: Application-Specific Configuration

**User Story:** As a user, I want to configure application-specific settings, so that each application can be customized for my workflow.

#### Acceptance Criteria

1. WHEN launching an application, THE System SHALL accept configuration options (width, height, resizable, floating, tab)
2. WHEN an application is launched with specific options, THE System SHALL apply those options to the window
3. WHEN a user right-clicks on an application in the launcher, THE System SHALL show options to configure launch settings
4. WHEN launch settings are saved, THE System SHALL apply them automatically on future launches
5. WHEN an application is launched, THE System SHALL pass any required credentials or environment variables securely



