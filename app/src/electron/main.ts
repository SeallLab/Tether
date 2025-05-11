import { app, BrowserWindow } from "electron";
import path from "path";
import { isDev } from "./util.js";
app.on("ready", () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
  });

  if (isDev()) {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), "dist-react/index.html"));
  }
});
