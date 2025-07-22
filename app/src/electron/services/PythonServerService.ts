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
  googleApiKey: string;
  flaskEnv: string;
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
  private isPackaged: boolean;

  constructor(config: Partial<PythonServerConfig> = {}) {
    console.log('[PythonServerService] DEBUG: Constructor called with config:', JSON.stringify(config, null, 2));
    
    this.config = {
      serverPort: 5001,
      serverHost: '127.0.0.1',
      venvName: 'venv',
      pythonPath: 'python3',
      flaskEnv: process.env.ENV || 'development',
      googleApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
      ...config
    };

    console.log('[PythonServerService] DEBUG: Final config:', {
      ...this.config,
      googleApiKey: this.config.googleApiKey ? '***SET***' : '***NOT SET***'
    });

    // Detect if running in packaged app
    this.isPackaged = app.isPackaged;
    console.log('[PythonServerService] DEBUG: isPackaged:', this.isPackaged);
    
    // Set server path based on environment
    if (this.isPackaged) {
      // In packaged app, server files are in extraResources
      this.serverPath = path.join(process.resourcesPath, 'server');
      console.log('[PythonServerService] DEBUG: Using packaged server path:', this.serverPath);
    } else {
      // In development, get paths relative to the app directory
      const appRoot = path.join(__dirname, '..', '..', '..', '..');
      this.serverPath = path.join(appRoot, 'server');
      console.log('[PythonServerService] DEBUG: Using development server path:', this.serverPath);
    }

    // Virtual environment path - in packaged apps, create in user data directory
    if (this.isPackaged) {
      const userDataPath = app.getPath('userData');
      console.log('[PythonServerService] DEBUG: User data path:', userDataPath);
      this.venvPath = path.join(userDataPath, 'python-server', this.config.venvName);
    } else {
      this.venvPath = path.join(this.serverPath, this.config.venvName);
    }
    
    // Determine Python executable path based on platform
    const isWindows = process.platform === 'win32';
    this.pythonExecutable = isWindows 
      ? path.join(this.venvPath, 'Scripts', 'python.exe')
      : path.join(this.venvPath, 'bin', 'python');
      
    console.log(`[PythonServerService] Running in ${this.isPackaged ? 'packaged' : 'development'} mode`);
    console.log(`[PythonServerService] Server path: ${this.serverPath}`);
    console.log(`[PythonServerService] Virtual env path: ${this.venvPath}`);
    console.log(`[PythonServerService] Python executable: ${this.pythonExecutable}`);
    console.log(`[PythonServerService] Platform: ${process.platform}`);
    
    // Check if paths exist immediately
    console.log(`[PythonServerService] DEBUG: Server path exists: ${fs.existsSync(this.serverPath)}`);
    if (fs.existsSync(this.venvPath)) {
      console.log(`[PythonServerService] DEBUG: Virtual env exists: ${fs.existsSync(this.venvPath)}`);
      console.log(`[PythonServerService] DEBUG: Python executable exists: ${fs.existsSync(this.pythonExecutable)}`);
    }
  }

  async initialize(): Promise<void> {
    console.log('[PythonServerService] DEBUG: Initialize called');
    console.log('[PythonServerService] Initializing Python server service...');
    
    try {
      // Ensure server path exists
      console.log('[PythonServerService] DEBUG: Checking server path existence...');
      if (!fs.existsSync(this.serverPath)) {
        const error = `Server path does not exist: ${this.serverPath}`;
        console.error('[PythonServerService] ERROR:', error);
        throw new Error(error);
      }
      console.log('[PythonServerService] DEBUG: Server path exists ✓');

      // List server directory contents
      try {
        const serverContents = fs.readdirSync(this.serverPath);
        console.log('[PythonServerService] DEBUG: Server directory contents:', serverContents);
      } catch (listError) {
        console.error('[PythonServerService] DEBUG: Could not list server directory:', listError);
      }

      console.log('[PythonServerService] DEBUG: Starting virtual environment setup...');
      await this.setupVirtualEnvironment();
      console.log('[PythonServerService] DEBUG: Virtual environment setup complete ✓');

      console.log('[PythonServerService] DEBUG: Starting dependency installation...');
      await this.installDependencies();
      console.log('[PythonServerService] DEBUG: Dependency installation complete ✓');

      console.log('[PythonServerService] DEBUG: Starting PDF indexing...');
      await this.runIndexing();
      console.log('[PythonServerService] DEBUG: PDF indexing complete ✓');

      console.log('[PythonServerService] DEBUG: Starting Flask server...');
      await this.startFlaskServer();
      console.log('[PythonServerService] DEBUG: Flask server startup complete ✓');
      
      console.log('[PythonServerService] Python server service initialized successfully!');
    } catch (error) {
      console.error('[PythonServerService] ERROR: Failed to initialize:', error);
      console.error('[PythonServerService] ERROR: Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  }

  private async setupVirtualEnvironment(): Promise<void> {
    console.log('[PythonServerService] DEBUG: setupVirtualEnvironment called');
    console.log('[PythonServerService] Setting up virtual environment...');
    
    // Check if virtual environment already exists
    if (fs.existsSync(this.venvPath)) {
      console.log('[PythonServerService] DEBUG: Virtual environment already exists at:', this.venvPath);
      console.log('[PythonServerService] Virtual environment already exists');
      return;
    }

    console.log('[PythonServerService] DEBUG: Virtual environment does not exist, creating...');

    // Ensure parent directory exists for packaged apps
    if (this.isPackaged) {
      const parentDir = path.dirname(this.venvPath);
      console.log('[PythonServerService] DEBUG: Ensuring parent directory exists:', parentDir);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
        console.log('[PythonServerService] DEBUG: Created parent directory');
      }
    }

    return new Promise((resolve, reject) => {
      // For packaged apps, we might need to use a different working directory
      const cwd = this.isPackaged ? path.dirname(this.venvPath) : this.serverPath;
      const venvName = this.isPackaged ? path.basename(this.venvPath) : this.config.venvName;
      
      console.log('[PythonServerService] DEBUG: Virtual env creation details:');
      console.log('  - Python command:', this.config.pythonPath);
      console.log('  - Working directory:', cwd);
      console.log('  - Venv name:', venvName);
      console.log('  - Full command: python3 -m venv', venvName);

      const venvProcess = spawn(this.config.pythonPath!, ['-m', 'venv', venvName], {
        cwd: cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      venvProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('[PythonServerService] VENV STDOUT:', output.trim());
      });

      venvProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log('[PythonServerService] VENV STDERR:', output.trim());
      });

      venvProcess.on('close', (code) => {
        console.log('[PythonServerService] DEBUG: Virtual env creation finished with code:', code);
        console.log('[PythonServerService] DEBUG: Final stdout:', stdout);
        console.log('[PythonServerService] DEBUG: Final stderr:', stderr);
        
        if (code === 0) {
          console.log('[PythonServerService] Virtual environment created successfully');
          // Verify the python executable exists
          if (fs.existsSync(this.pythonExecutable)) {
            console.log('[PythonServerService] DEBUG: Python executable created successfully ✓');
          } else {
            console.error('[PythonServerService] DEBUG: Python executable not found after creation:', this.pythonExecutable);
          }
          resolve();
        } else {
          const error = `Virtual environment setup failed with code ${code}: ${stderr}`;
          console.error('[PythonServerService] ERROR:', error);
          reject(new Error(error));
        }
      });

      venvProcess.on('error', (error) => {
        console.error('[PythonServerService] ERROR: Virtual env creation error:', error);
        console.error('[PythonServerService] ERROR: This might indicate Python is not installed or not in PATH');
        reject(error);
      });
    });
  }

  private async installDependencies(): Promise<void> {
    console.log('[PythonServerService] DEBUG: installDependencies called');
    console.log('[PythonServerService] Installing Python dependencies...');
    
    const requirementsPath = path.join(this.serverPath, 'requirements.txt');
    console.log('[PythonServerService] DEBUG: Requirements path:', requirementsPath);
    
    if (!fs.existsSync(requirementsPath)) {
      console.log('[PythonServerService] No requirements.txt found, skipping dependency installation');
      return;
    }

    console.log('[PythonServerService] DEBUG: Requirements file exists ✓');

    // Check if pip executable exists
    const pipExecutable = process.platform === 'win32' 
      ? path.join(this.venvPath, 'Scripts', 'pip.exe')
      : path.join(this.venvPath, 'bin', 'pip');
    
    console.log('[PythonServerService] DEBUG: Pip executable path:', pipExecutable);
    console.log('[PythonServerService] DEBUG: Pip executable exists:', fs.existsSync(pipExecutable));

    return new Promise((resolve, reject) => {
      console.log('[PythonServerService] DEBUG: Starting pip install process...');
      
      const installProcess = spawn(pipExecutable, ['install', '-r', requirementsPath], {
        cwd: this.serverPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      installProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('[PythonServerService] PIP INSTALL:', output.trim());
      });

      installProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.warn('[PythonServerService] PIP WARNING:', output.trim());
      });

      installProcess.on('close', (code) => {
        console.log('[PythonServerService] DEBUG: Pip install finished with code:', code);
        
        if (code === 0) {
          console.log('[PythonServerService] Dependencies installed successfully');
          resolve();
        } else {
          const error = `Dependency installation failed with code ${code}: ${stderr}`;
          console.error('[PythonServerService] ERROR:', error);
          reject(new Error(error));
        }
      });

      installProcess.on('error', (error) => {
        console.error('[PythonServerService] ERROR: Dependency installation error:', error);
        reject(error);
      });
    });
  }

  private async runIndexing(): Promise<void> {
    console.log('[PythonServerService] DEBUG: runIndexing called');
    console.log('[PythonServerService] Running PDF indexing...');
    
    const indexScriptPath = path.join(this.serverPath, 'index_pdfs.py');
    console.log('[PythonServerService] DEBUG: Index script path:', indexScriptPath);
    
    if (!fs.existsSync(indexScriptPath)) {
      console.log('[PythonServerService] No index_pdfs.py found, skipping indexing');
      this.isIndexingComplete = true; // Mark as complete since there's nothing to index
      return;
    }

    console.log('[PythonServerService] DEBUG: Index script exists ✓');

    const envVars = this.getEnvironmentVariables();
    console.log('[PythonServerService] DEBUG: Environment variables for indexing:', {
      ...envVars,
      GOOGLE_API_KEY: envVars.GOOGLE_API_KEY ? '***SET***' : '***NOT SET***'
    });

    // Check if Google API key is available
    if (!envVars.GOOGLE_API_KEY) {
      console.warn('[PythonServerService] WARNING: Google API key not available, skipping PDF indexing');
      console.warn('[PythonServerService] WARNING: RAG features will not work, but basic Flask server will still start');
      this.isIndexingComplete = false; // Mark as incomplete but don't fail
      return;
    }

    // Determine the correct PDF directory path based on environment
    const pdfDirectory = this.isPackaged 
      ? path.join(process.resourcesPath, 'rag', 'pdfs')
      : path.join(this.serverPath, '..', 'rag', 'pdfs');
    
    // Use the vector store path from environment variables
    const vectorStorePath = envVars.VECTOR_STORE_PATH;
    
    console.log('[PythonServerService] DEBUG: PDF directory path:', pdfDirectory);
    console.log('[PythonServerService] DEBUG: Vector store output path:', vectorStorePath);
    console.log('[PythonServerService] DEBUG: PDF directory exists:', fs.existsSync(pdfDirectory));

    return new Promise((resolve, reject) => {
      const indexArgs = [
        'index_pdfs.py',
        '--pdf-dir', pdfDirectory,
        '--output', vectorStorePath
      ];
      
      console.log('[PythonServerService] DEBUG: Running indexing with args:', indexArgs);
      
      const indexProcess = spawn(this.pythonExecutable, indexArgs, {
        cwd: this.serverPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...envVars
        }
      });

      let stdout = '';
      let stderr = '';

      indexProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('[PythonServerService] INDEXING:', output.trim());
      });

      indexProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.warn('[PythonServerService] INDEXING WARNING:', output.trim());
      });

      indexProcess.on('close', (code) => {
        console.log('[PythonServerService] DEBUG: Indexing finished with code:', code);
        
        if (code === 0) {
          console.log('[PythonServerService] PDF indexing completed successfully');
          this.isIndexingComplete = true;
          resolve();
        } else {
          console.error('[PythonServerService] PDF indexing failed with code:', code);
          console.error('[PythonServerService] PDF indexing stderr:', stderr);
          
          // Don't fail the entire service if indexing fails - just warn and continue
          console.warn('[PythonServerService] WARNING: PDF indexing failed, but continuing to start Flask server');
          console.warn('[PythonServerService] WARNING: RAG features may not work properly');
          this.isIndexingComplete = false;
          resolve(); // Resolve instead of reject
        }
      });

      indexProcess.on('error', (error) => {
        console.error('[PythonServerService] ERROR: Indexing process error:', error);
        console.warn('[PythonServerService] WARNING: Indexing process failed, but continuing to start Flask server');
        this.isIndexingComplete = false;
        resolve(); // Resolve instead of reject
      });
    });
  }

  private async startFlaskServer(): Promise<void> {
    console.log('[PythonServerService] DEBUG: startFlaskServer called');
    console.log('[PythonServerService] Starting Flask server...');
    
    if (this.flaskProcess) {
      console.log('[PythonServerService] Flask server is already running');
      return;
    }

    const envVars = this.getEnvironmentVariables();
    console.log('[PythonServerService] DEBUG: Environment variables for Flask:', {
      ...envVars,
      GOOGLE_API_KEY: envVars.GOOGLE_API_KEY ? '***SET***' : '***NOT SET***'
    });

    return new Promise((resolve, reject) => {
      this.flaskProcess = spawn(this.pythonExecutable, ['run.py'], {
        cwd: this.serverPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...envVars
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
        console.log('[PythonServerService] FLASK STDOUT:', output.trim());
        
        // Check for server startup indicators
        const isServerStarting = output.includes('🚀 Starting RAG Pipeline Flask Server') ||
                                  output.includes('Starting server on') ||
                                  output.includes('Running on') || 
                                  output.includes('* Serving Flask app') ||
                                  output.includes('Database initialization complete') ||
                                  output.includes('Configuration validated');
                                  
        if (isServerStarting && !serverStarted) {
          // Give the server a moment to fully start up
          setTimeout(() => {
            if (!serverStarted) {
              serverStarted = true;
              this.isServerRunning = true;
              console.log('[PythonServerService] Flask server started successfully');
              cleanup();
              resolve();
            }
          }, 2000); // Wait 2 seconds for full startup
        }
      });

      this.flaskProcess!.stderr?.on('data', (data) => {
        const output = data.toString();
        
        // Check if this is a normal Flask access log (not an actual error)
        const isAccessLog = output.includes(' - - [') && output.includes('] "') && output.includes(' HTTP/1.1" ');
        const isFlaskStartupInfo = output.includes('* Serving Flask app') || 
                                   output.includes('* Debug mode:') ||
                                   output.includes('* Running on');
        const isSSLWarning = output.includes('NotOpenSSLWarning') || output.includes('urllib3') || output.includes('LibreSSL');
        const isVectorStoreWarning = output.includes('Vector store directory not found') || 
                                     output.includes('Make sure to run the indexing script');
        
        if (isAccessLog || isFlaskStartupInfo) {
          // This is normal Flask logging, log as info
          console.log('[PythonServerService] FLASK INFO:', output.trim());
        } else if (isSSLWarning) {
          // SSL warnings are not critical - just log as warning
          console.warn('[PythonServerService] FLASK SSL WARNING:', output.trim());
        } else if (isVectorStoreWarning) {
          // Vector store warnings are expected if indexing failed - log as warning
          console.warn('[PythonServerService] FLASK VECTOR WARNING:', output.trim());
        } else {
          // This is likely an actual error
          console.error('[PythonServerService] FLASK ERROR:', output.trim());
        }
        
        if (!serverStarted) {
          // Only treat as startup error if it's not a normal log, SSL warning, or vector store warning
          if (!isAccessLog && !isFlaskStartupInfo && !isSSLWarning && !isVectorStoreWarning) {
            cleanup();
            reject(new Error(`Flask server failed to start: ${output}`));
          }
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
    console.log('[PythonServerService] DEBUG: getEnvironmentVariables called');
    
    // Use appropriate paths for packaged vs development
    const vectorStorePath = this.isPackaged 
      ? path.join(app.getPath('userData'), 'python-server', 'vector_store')
      : path.join(this.serverPath, 'vector_store');
    
    const databasePath = this.isPackaged 
      ? path.join(app.getPath('userData'), 'python-server', 'db', 'dev.db')
      : path.join(this.serverPath, 'db', 'dev.db');

    console.log('[PythonServerService] DEBUG: Vector store path:', vectorStorePath);
    console.log('[PythonServerService] DEBUG: Database path:', databasePath);

    // Ensure directories exist
    if (this.isPackaged) {
      const vectorStoreDir = path.dirname(vectorStorePath);
      const dbDir = path.dirname(databasePath);
      
      console.log('[PythonServerService] DEBUG: Creating directories...');
      console.log('  - Vector store dir:', vectorStoreDir);
      console.log('  - DB dir:', dbDir);
      
      if (!fs.existsSync(vectorStoreDir)) {
        fs.mkdirSync(vectorStoreDir, { recursive: true });
        console.log('[PythonServerService] DEBUG: Created vector store directory');
      }
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log('[PythonServerService] DEBUG: Created database directory');
      }
    }

    const envVars = {
      FLASK_HOST: this.config.serverHost,
      FLASK_PORT: this.config.serverPort.toString(),
      FLASK_ENV: this.config.flaskEnv,
      FLASK_DEBUG: 'false',
      GOOGLE_API_KEY: this.config.googleApiKey,
      VECTOR_STORE_PATH: vectorStorePath,
      DATABASE_PATH: databasePath
    };

    console.log('[PythonServerService] DEBUG: Environment variables created:', {
      ...envVars,
      GOOGLE_API_KEY: envVars.GOOGLE_API_KEY ? '***SET***' : '***NOT SET***'
    });

    return envVars;
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
    isPackaged: boolean;
    serverPath: string;
  } {
    return {
      isRunning: this.isServerRunning,
      isIndexingComplete: this.isIndexingComplete,
      serverUrl: this.getServerUrl(),
      port: this.config.serverPort,
      isPackaged: this.isPackaged,
      serverPath: this.serverPath
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

  async apiRequest(method: string, endpoint: string, data?: any): Promise<{
    ok: boolean;
    status: number;
    data?: any;
    error?: string;
  }> {
    if (!this.isServerRunning) {
      return {
        ok: false,
        status: 503,
        error: 'Server not running'
      };
    }

    try {
      const url = `${this.getServerUrl()}${endpoint}`;
      
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
      console.error('[PythonServerService] API request failed:', error);
      return {
        ok: false,
        status: 500,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
} 