import "reflect-metadata";
import { container } from "tsyringe";
import { app } from "electron";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Services
import { SettingsService } from "./services/SettingsService.js";
import { ActivityLogger } from "./services/ActivityLogger.js";
import { NotificationService } from "./services/NotificationService.js";
import { NotificationTracker } from "./services/NotificationTracker.js";
import { WorkPatternAnalyzer } from "./services/WorkPatternAnalyzer.js";
import { FocusRewardService } from "./services/FocusRewardService.js";
import { GamificationService } from "./services/GamificationService.js";
import { LLMService } from "./services/LLMService.js";
import { ActivityMonitoringService } from "./services/ActivityMonitoringService.js";
import { PythonServerService } from "./services/PythonServerService.js";
import { ChatService } from "./services/ChatService.js";

// Managers
import { AppManager } from "./managers/AppManager.js";
import { WindowManager } from "./managers/WindowManager.js";
import { NotificationManager } from "./managers/NotificationManager.js";
import { TrayManager } from "./managers/TrayManager.js";

/**
 * Load environment variables from .env file
 * This must be done before configuring services that depend on environment variables
 */
function loadEnvironmentVariables(): void {
  console.log('[Container] DEBUG: Loading environment variables...');
  console.log('[Container] DEBUG: isPackaged:', app.isPackaged);
  console.log('[Container] DEBUG: __dirname:', __dirname);
  
  // Load environment variables from .env file
  if (app.isPackaged) {
    // In packaged app, try to load from multiple possible locations
    const possiblePaths = [
      path.join(process.resourcesPath, '.env'),
      path.join(process.resourcesPath, 'app', '.env'),
      path.join(__dirname, '..', '..', '..', '.env'),
    ];
    
    console.log('[Container] DEBUG: Trying to load .env from paths:', possiblePaths);
    
    let envLoaded = false;
    for (const envPath of possiblePaths) {
      try {
        const result = dotenv.config({ path: envPath });
        if (!result.error) {
          console.log('[Container] DEBUG: Successfully loaded .env from:', envPath);
          envLoaded = true;
          break;
        }
      } catch (error) {
        console.log('[Container] DEBUG: Could not load .env from:', envPath, error);
      }
    }
    
    if (!envLoaded) {
      console.warn('[Container] WARNING: No .env file found in packaged app. Using system environment variables only.');
    }
  } else {
    // In development, load from app directory
    // __dirname is dist-electron/electron, so we need to go up 2 levels to reach app/
    const envPath = path.join(__dirname, '..', '..', '.env');
    console.log('[Container] DEBUG: Loading .env from development path:', envPath);
    const result = dotenv.config({ path: envPath });
    if (result.error) {
      console.warn('[Container] WARNING: Could not load .env file:', result.error);
    } else {
      console.log('[Container] DEBUG: Successfully loaded .env file');
    }
  }
  
  // Log environment variables after loading
  console.log('[Container] DEBUG: Environment variables after loading:');
  console.log('  GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? '***SET***' : '***NOT SET***');
  console.log('  ENV:', process.env.ENV);
  console.log('  NODE_ENV:', process.env.NODE_ENV);
}

/**
 * Configure the dependency injection container
 * This centralizes all service registrations and ensures proper singleton behavior
 */
export function configureContainer(): void {
  loadEnvironmentVariables();
  // Register all services as singletons
  // Register and immediately resolve SettingsService to ensure it initializes first
  container.registerSingleton(SettingsService);
  container.resolve(SettingsService);
  
  // ActivityLogger needs configuration from app settings
  container.registerSingleton(ActivityLogger);
  container.registerSingleton(NotificationTracker);
  container.registerSingleton(NotificationService);
  container.registerSingleton(WorkPatternAnalyzer);
  container.registerSingleton(FocusRewardService);
  container.registerSingleton(GamificationService);
  container.registerSingleton(LLMService);
  container.registerSingleton(ActivityMonitoringService);
  container.registerSingleton(ChatService);
  container.registerSingleton(NotificationManager);
  container.registerSingleton(TrayManager);
  
  // PythonServerService needs special configuration for API keys
  container.register(PythonServerService, {
    useFactory: () => {
      const googleApiKey = process.env.GOOGLE_API_KEY || '';
      return new PythonServerService({ googleApiKey });
    }
  });
  
  // Register AppManager as singleton
  container.registerSingleton(AppManager);
  
  // Register managers that need factory functions for their dependencies
  container.register(WindowManager, {
    useFactory: () => {
      const preloadPath = path.join(__dirname, 'preload.js');
      return new WindowManager(preloadPath);
    }
  });
}

export { container };
