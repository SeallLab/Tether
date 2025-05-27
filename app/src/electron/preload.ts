import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants.js';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => {
      console.log(`Preload sending message on channel: ${channel}`, args);
      ipcRenderer.send(channel, ...args);
    },
    invoke: (channel: string, ...args: any[]) => {
      console.log(`Preload invoking on channel: ${channel}`, args);
      return ipcRenderer.invoke(channel, ...args);
    },
    on: (channel: string, listener: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (event, ...args) => listener(...args));
    },
    once: (channel: string, listener: (...args: any[]) => void) => {
      ipcRenderer.once(channel, (event, ...args) => listener(...args));
    },
    removeListener: (channel: string, listener: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, listener);
    }
  },
  
  // Activity monitoring API
  activityMonitoring: {
    start: () => ipcRenderer.invoke(IPC_CHANNELS.START_ACTIVITY_MONITORING),
    stop: () => ipcRenderer.invoke(IPC_CHANNELS.STOP_ACTIVITY_MONITORING),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GET_ACTIVITY_STATUS),
    getRecentActivity: (minutes?: number) => ipcRenderer.invoke(IPC_CHANNELS.GET_RECENT_ACTIVITY, minutes),
    updateConfig: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_MONITORING_CONFIG, config)
  },

  // LLM service API
  llm: {
    setApiKey: (apiKey: string) => ipcRenderer.invoke(IPC_CHANNELS.SET_LLM_API_KEY, apiKey),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GET_LLM_STATUS),
    onFocusNotification: (callback: (response: any) => void) => {
      ipcRenderer.on(IPC_CHANNELS.FOCUS_NOTIFICATION, (event, data) => callback(data));
    },
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.FOCUS_NOTIFICATION);
    }
  }
}); 