import { ipcMain } from 'electron';
import { PythonServerService } from '../services/PythonServerService.js';

export function setupPythonServerHandlers(pythonServerService: PythonServerService): void {
  // Get server status
  ipcMain.handle('python-server:get-status', async () => {
    try {
      return pythonServerService.getServerStatus();
    } catch (error) {
      console.error('[PythonServerHandlers] Error getting server status:', error);
      throw error;
    }
  });

  // Get server URL
  ipcMain.handle('python-server:get-url', async () => {
    try {
      return pythonServerService.getServerUrl();
    } catch (error) {
      console.error('[PythonServerHandlers] Error getting server URL:', error);
      throw error;
    }
  });

  // Health check
  ipcMain.handle('python-server:health-check', async () => {
    try {
      return await pythonServerService.healthCheck();
    } catch (error) {
      console.error('[PythonServerHandlers] Error performing health check:', error);
      return false;
    }
  });

  // Make API request (proxy to avoid CORS issues)
  ipcMain.handle('python-server:api-request', async (event, { method, endpoint, data }) => {
    try {
      const url = `${pythonServerService.getServerUrl()}${endpoint}`;
      
      // Use built-in fetch if available (Node.js 18+)
      if (typeof fetch !== 'undefined') {
        const options: RequestInit = {
          method: method || 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
          options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        const responseData = await response.json();

        return {
          ok: response.ok,
          status: response.status,
          data: responseData
        };
      } else {
        throw new Error('Fetch not available');
      }
    } catch (error) {
      console.error('[PythonServerHandlers] Error making API request:', error);
      return {
        ok: false,
        status: 500,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  console.log('[PythonServerHandlers] Python server IPC handlers registered');
} 