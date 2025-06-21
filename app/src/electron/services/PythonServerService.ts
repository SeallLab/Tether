import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PythonServerConfig {
  serverPort: number;
  pythonPath?: string;
  serverHost: string;
  venvName: string;
}

export class PythonServerService {
  private flaskProcess: ChildProcess | null = null;
  private config: PythonServerConfig;
  private serverPath: string;
  private venvPath: string;
  private pythonExecutable: string;
  private isServerRunning = false;
  private isIndexingComplete = false;

  constructor(config: Partial<PythonServerConfig> = {}) {
    this.config = {
      serverPort: 5000,
      serverHost: '127.0.0.1',
      venvName: 'venv',
      pythonPath: 'python3',
      ...config
    };

    // Get paths relative to the app directory
    const appRoot = path.join(__dirname, '..', '..', '..', '..');
    this.serverPath = path.join(appRoot, 'server');
    this.venvPath = path.join(this.serverPath, this.config.venvName);
    
    // Determine Python executable path based on platform
    const isWindows = process.platform === 'win32';
    this.pythonExecutable = isWindows 
      ? path.join(this.venvPath, 'Scripts', 'python.exe')
      : path.join(this.venvPath, 'bin', 'python');
  }

  async initialize(): Promise<void> {
    console.log('[PythonServerService] Initializing Python server service...');
    
    try {
      await this.setupVirtualEnvironment();
      await this.installDependencies();
      await this.runIndexing();
      await this.startFlaskServer();
      
      console.log('[PythonServerService] Python server service initialized successfully');
    } catch (error) {
      console.error('[PythonServerService] Failed to initialize:', error);
      throw error;
    }
  }

  private async setupVirtualEnvironment(): Promise<void> {
    console.log('[PythonServerService] Setting up virtual environment...');
    
    // Check if virtual environment already exists
    if (fs.existsSync(this.venvPath)) {
      console.log('[PythonServerService] Virtual environment already exists');
      return;
    }

    return new Promise((resolve, reject) => {
      const venvProcess = spawn(this.config.pythonPath!, ['-m', 'venv', this.config.venvName], {
        cwd: this.serverPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      venvProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      venvProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      venvProcess.on('close', (code) => {
        if (code === 0) {
          console.log('[PythonServerService] Virtual environment created successfully');
          resolve();
        } else {
          console.error('[PythonServerService] Failed to create virtual environment:', stderr);
          reject(new Error(`Virtual environment setup failed with code ${code}: ${stderr}`));
        }
      });

      venvProcess.on('error', (error) => {
        console.error('[PythonServerService] Error creating virtual environment:', error);
        reject(error);
      });
    });
  }

  private async installDependencies(): Promise<void> {
    console.log('[PythonServerService] Installing Python dependencies...');
    
    const requirementsPath = path.join(this.serverPath, 'requirements.txt');
    if (!fs.existsSync(requirementsPath)) {
      console.log('[PythonServerService] No requirements.txt found, skipping dependency installation');
      return;
    }

    return new Promise((resolve, reject) => {
      const pipExecutable = process.platform === 'win32' 
        ? path.join(this.venvPath, 'Scripts', 'pip.exe')
        : path.join(this.venvPath, 'bin', 'pip');

      const installProcess = spawn(pipExecutable, ['install', '-r', 'requirements.txt'], {
        cwd: this.serverPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      installProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('[PythonServerService] Pip install:', output.trim());
      });

      installProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.warn('[PythonServerService] Pip install warning:', output.trim());
      });

      installProcess.on('close', (code) => {
        if (code === 0) {
          console.log('[PythonServerService] Dependencies installed successfully');
          resolve();
        } else {
          console.error('[PythonServerService] Failed to install dependencies:', stderr);
          reject(new Error(`Dependency installation failed with code ${code}: ${stderr}`));
        }
      });

      installProcess.on('error', (error) => {
        console.error('[PythonServerService] Error installing dependencies:', error);
        reject(error);
      });
    });
  }

  private async runIndexing(): Promise<void> {
    console.log('[PythonServerService] Running PDF indexing...');
    
    const indexScriptPath = path.join(this.serverPath, 'index_pdfs.py');
    if (!fs.existsSync(indexScriptPath)) {
      console.log('[PythonServerService] No index_pdfs.py found, skipping indexing');
      return;
    }

    return new Promise((resolve, reject) => {
      const indexProcess = spawn(this.pythonExecutable, ['index_pdfs.py'], {
        cwd: this.serverPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...this.getEnvironmentVariables()
        }
      });

      let stdout = '';
      let stderr = '';

      indexProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('[PythonServerService] Indexing:', output.trim());
      });

      indexProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.warn('[PythonServerService] Indexing warning:', output.trim());
      });

      indexProcess.on('close', (code) => {
        if (code === 0) {
          console.log('[PythonServerService] PDF indexing completed successfully');
          this.isIndexingComplete = true;
          resolve();
        } else {
          console.error('[PythonServerService] PDF indexing failed:', stderr);
          reject(new Error(`PDF indexing failed with code ${code}: ${stderr}`));
        }
      });

      indexProcess.on('error', (error) => {
        console.error('[PythonServerService] Error running indexing:', error);
        reject(error);
      });
    });
  }

  private async startFlaskServer(): Promise<void> {
    console.log('[PythonServerService] Starting Flask server...');
    
    if (this.flaskProcess) {
      console.log('[PythonServerService] Flask server is already running');
      return;
    }

    return new Promise((resolve, reject) => {
      this.flaskProcess = spawn(this.pythonExecutable, ['run.py'], {
        cwd: this.serverPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...this.getEnvironmentVariables()
        }
      });

      let startupTimeout: NodeJS.Timeout;
      let serverStarted = false;

      const cleanup = () => {
        if (startupTimeout) {
          clearTimeout(startupTimeout);
        }
      };

      // Set a timeout for server startup
      startupTimeout = setTimeout(() => {
        if (!serverStarted) {
          console.error('[PythonServerService] Flask server startup timeout');
          cleanup();
          reject(new Error('Flask server startup timeout'));
        }
      }, 30000); // 30 second timeout

      this.flaskProcess!.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('[PythonServerService] Flask:', output.trim());
        
        // Check for server startup indicators
        if (output.includes('Running on') || output.includes('* Serving Flask app')) {
          if (!serverStarted) {
            serverStarted = true;
            this.isServerRunning = true;
            console.log('[PythonServerService] Flask server started successfully');
            cleanup();
            resolve();
          }
        }
      });

      this.flaskProcess!.stderr?.on('data', (data) => {
        const output = data.toString();
        console.error('[PythonServerService] Flask error:', output.trim());
        
        if (!serverStarted) {
          cleanup();
          reject(new Error(`Flask server failed to start: ${output}`));
        }
      });

      this.flaskProcess!.on('close', (code) => {
        console.log('[PythonServerService] Flask server process closed with code:', code);
        this.isServerRunning = false;
        this.flaskProcess = null;
        
        if (!serverStarted) {
          cleanup();
          reject(new Error(`Flask server exited with code ${code}`));
        }
      });

      this.flaskProcess!.on('error', (error) => {
        console.error('[PythonServerService] Flask server error:', error);
        this.isServerRunning = false;
        this.flaskProcess = null;
        
        if (!serverStarted) {
          cleanup();
          reject(error);
        }
      });
    });
  }

  private getEnvironmentVariables(): Record<string, string> {
    return {
      FLASK_HOST: this.config.serverHost,
      FLASK_PORT: this.config.serverPort.toString(),
      FLASK_ENV: 'production',
      GOOGLE_API_KEY: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
      VECTOR_STORE_PATH: path.join(this.serverPath, 'vector_store'),
      DATABASE_PATH: path.join(this.serverPath, 'db', 'dev.db')
    };
  }

  async shutdown(): Promise<void> {
    console.log('[PythonServerService] Shutting down Python server service...');
    
    if (this.flaskProcess) {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log('[PythonServerService] Force killing Flask server process');
          this.flaskProcess?.kill('SIGKILL');
          resolve();
        }, 5000);

        this.flaskProcess!.on('close', () => {
          clearTimeout(timeout);
          console.log('[PythonServerService] Flask server shut down gracefully');
          this.flaskProcess = null;
          this.isServerRunning = false;
          resolve();
        });

        console.log('[PythonServerService] Sending SIGTERM to Flask server');
        this.flaskProcess!.kill('SIGTERM');
      });
    }
  }

  getServerUrl(): string {
    return `http://${this.config.serverHost}:${this.config.serverPort}`;
  }

  getServerStatus(): { 
    isRunning: boolean; 
    isIndexingComplete: boolean; 
    serverUrl: string;
    port: number;
  } {
    return {
      isRunning: this.isServerRunning,
      isIndexingComplete: this.isIndexingComplete,
      serverUrl: this.getServerUrl(),
      port: this.config.serverPort
    };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isServerRunning) {
      return false;
    }

    try {
      // Use built-in fetch (available in Node.js 18+) or implement basic health check
      if (typeof fetch !== 'undefined') {
        const response = await fetch(`${this.getServerUrl()}/health`, {
          method: 'GET'
        });
        return response.ok;
      } else {
        // Fallback: just check if server is marked as running
        return this.isServerRunning;
      }
    } catch (error) {
      console.error('[PythonServerService] Health check failed:', error);
      return false;
    }
  }
} 