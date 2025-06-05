# Electron Main Process Architecture

This directory contains the refactored Electron main process code, organized into a clean, modular structure.

## Structure

```
electron/
├── main.ts                 # Main entry point - orchestrates everything
├── handlers/               # IPC handlers organized by domain
│   ├── activityHandlers.ts # Activity monitoring IPC handlers
│   ├── llmHandlers.ts      # LLM service IPC handlers
│   ├── windowHandlers.ts   # Window management IPC handlers
│   └── index.ts           # Exports all handlers
├── managers/               # Business logic managers
│   ├── AppManager.ts       # App lifecycle and configuration
│   ├── WindowManager.ts    # Window creation and management
│   ├── NotificationManager.ts # Notification system
│   └── index.ts           # Exports all managers
├── services/               # External services
└── monitors/               # System monitoring
```

## Key Components

### Main.ts
- **Purpose**: Entry point that orchestrates the entire application
- **Responsibilities**: 
  - Initialize managers
  - Set up IPC handlers
  - Handle app lifecycle events
- **Clean**: Only ~45 lines, focused on coordination

### Managers

#### AppManager
- **Purpose**: Handles app-level configuration and lifecycle
- **Responsibilities**:
  - Environment variable loading
  - Startup behavior configuration
  - Activity monitoring service initialization
  - Global shortcuts setup
  - App event handlers

#### WindowManager
- **Purpose**: Manages all application windows
- **Responsibilities**:
  - Main window creation and configuration
  - Chat window management
  - Window visibility toggling
  - Window event handling

#### NotificationManager
- **Purpose**: Handles system notifications
- **Responsibilities**:
  - Startup notification scheduling
  - Daily plan notifications
  - Notification click handling
  - Timer management

### Handlers

#### Activity Handlers
- All IPC handlers related to activity monitoring
- Start/stop monitoring, status checks, configuration updates

#### LLM Handlers
- All IPC handlers related to LLM services
- API key management, status checks

#### Window Handlers
- All IPC handlers related to window management
- Window opening, dock toggling, child window updates

## Benefits of This Structure

1. **Separation of Concerns**: Each file has a single, clear responsibility
2. **Maintainability**: Easy to find and modify specific functionality
3. **Testability**: Each manager/handler can be tested independently
4. **Scalability**: Easy to add new features without cluttering main.ts
5. **Readability**: Clear organization makes the codebase easier to understand

## Usage

The main.ts file now serves as a clean orchestrator:

```typescript
// Initialize managers
const appManager = new AppManager();
const windowManager = new WindowManager(appManager.getPreloadPath());
const notificationManager = new NotificationManager((context: string) => {
  windowManager.openChatWindow(context);
});

// Setup everything
app.on("ready", async () => {
  // Create windows
  const mainWindow = windowManager.createMainWindow();
  
  // Start services
  await appManager.startActivityMonitoring();
  
  // Setup handlers
  setupActivityHandlers(activityService);
  setupLLMHandlers(activityService);
  setupWindowHandlers(/* ... */);
  
  // Schedule notifications
  notificationManager.scheduleStartupNotification(30000);
});
```

This architecture makes it easy to:
- Add new IPC channels (create new handler files)
- Add new services (create new manager classes)
- Modify app behavior (update AppManager)
- Change notification logic (update NotificationManager) 