// logger.ts
import { app } from "electron";
import fs from "fs";
import path from "path";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LoggerOptions {
  name: string;
}

export class Logger {
  private logFile: string;
  private name?: string;

  constructor(opts: LoggerOptions = { name: "" }) {
    this.logFile = path.join(app.getPath('userData'), "app.log");
    this.name = opts.name;
  }

  private format(level: LogLevel, message: string, data?: any) {
    const name = this.name;
    const scope = name ? `[${name}]` : "";
    return `[${level.toUpperCase()}]${scope} ${message} ${data ? JSON.stringify(data) : ""}`;
  }

  private write(line: string) {
    console.log(line);
    try {
      // Ensure the directory exists
      const logDir = path.dirname(this.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      // Write to log file without double JSON serialization
      fs.appendFileSync(this.logFile, line + "\n", { encoding: "utf8" });
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }

  info(msg: string, data?: any)  { this.write(this.format("info", msg, data)); }
  warn(msg: string, data?: any)  { this.write(this.format("warn", msg, data)); }
  error(msg: string, error?: any) { this.write(this.format("error", msg, error)); }
  debug(msg: string, data?: any) {
    if (process.env.NODE_ENV !== "production") {
      this.write(this.format("debug", msg, data));
    }
  }
}