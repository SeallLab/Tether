import { app } from 'electron';

export function isDev(): boolean {
  // In packaged apps, always use production mode regardless of NODE_ENV
  if (app.isPackaged) {
    return false;
  }
  return process.env.NODE_ENV === "development";
}