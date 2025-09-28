import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { injectable } from 'tsyringe';
import { Logger } from '../utils/Logger.js';

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

@injectable()
export class PythonServerService {
  private flaskProcess: ChildProcess | null = null;
  private config: PythonServerConfig;
  private serverPath: string;
  private venvPath: string;
  private pythonExecutable: string;
  private isIndexingComplete = false;
  private isPackaged: boolean;
  private isInitializing = false;
  private logger: Logger;
  
  constructor(config: Partial<PythonServerConfig> = {}) {
    this.logger = new Logger({ name: 'PythonServerService' });
    this.config = {
      serverPort: 5001,
      serverHost: '127.0.0.1',
      venvName: 'venv',
      pythonPath: process.platform === 'win32' ? 'python' : 'python3',
      flaskEnv: process.env.ENV || 'development',
      googleApiKey: process.env.GOOGLE_API_KEY || '',
      ...config
    };

    this.logger.info('Final config:', {
      ...this.config,
      googleApiKey: this.config.googleApiKey ? '***SET***' : '***NOT SET***'
    });

    // Detect if running in packaged app
    this.isPackaged = app.isPackaged;
    this.logger.info('isPackaged:', this.isPackaged);
    
    // Set server path based on environment
    if (this.isPackaged) {
      // In packaged app, server files are in extraResources
      this.serverPath = path.join(process.resourcesPath, 'server');
      this.logger.info('Using packaged server path:', this.serverPath);
    } else {
      // In development, get paths relative to the app directory
      const appRoot = path.join(__dirname, '..', '..', '..', '..');
      this.serverPath = path.join(appRoot, 'server');
      this.logger.info('Using development server path:', this.serverPath);
    }

    // Detect and configure Python executable
    const pythonInfo = this.detectPythonExecutable();
    this.config.pythonPath = pythonInfo.pythonPath;

    // Virtual environment path - in packaged apps, create in user data directory
    if (this.isPackaged) {
      const userDataPath = app.getPath('userData');
      this.logger.info('User data path:', userDataPath);
      this.venvPath = path.join(userDataPath, 'python-server', this.config.venvName);
    } else {
      this.venvPath = path.join(this.serverPath, this.config.venvName);
    }
    
    // Determine Python executable path for virtual environment
    const isWindows = process.platform === 'win32';
    this.pythonExecutable = isWindows 
      ? path.join(this.venvPath, 'Scripts', 'python.exe')
      : path.join(this.venvPath, 'bin', 'python');
      
    this.logger.info(`Running in ${this.isPackaged ? 'packaged' : 'development'} mode`);
    this.logger.info(`Server path: ${this.serverPath}`);
    this.logger.info(`Python for venv creation: ${this.config.pythonPath}`);
    this.logger.info(`Virtual env path: ${this.venvPath}`);
    this.logger.info(`Python executable: ${this.pythonExecutable}`);
    this.logger.info(`Platform: ${process.platform}`);
    
    // Check if paths exist immediately
    this.logger.info(`Server path exists: ${fs.existsSync(this.serverPath)}`);
    if (fs.existsSync(this.venvPath)) {
      this.logger.info(`Virtual env exists: ${fs.existsSync(this.venvPath)}`);
      this.logger.info(`Python executable exists: ${fs.existsSync(this.pythonExecutable)}`);
    }
  }

  private detectPythonExecutable(): { pythonPath: string; isBundled: boolean } {
    this.logger.info('Detecting Python executable...');
    
    // Check for bundled Python first
    if (this.isPackaged) {
      const bundledPythonPath = this.findBundledPython();
      if (bundledPythonPath) {
        this.logger.info('✅ Found bundled Python:', bundledPythonPath);
        return { pythonPath: bundledPythonPath, isBundled: true };
      }
    }

    // In development, check if there's a bundled Python for testing
    if (!this.isPackaged) {
      const devBundledPythonPath = this.findDevBundledPython();
      if (devBundledPythonPath) {
        this.logger.info('Found development bundled Python:', devBundledPythonPath);
        return { pythonPath: devBundledPythonPath, isBundled: true };
      }
    }

    // Fallback to system Python
    this.logger.info('Using system Python (no bundled Python found)');
    const fallbackPython = process.platform === 'win32' ? 'python' : 'python3';
    return { pythonPath: this.config.pythonPath || fallbackPython, isBundled: false };
  }

  private findBundledPython(): string | null {
    const currentPlatform = `${process.platform}-${process.arch}`;
    this.logger.info('Looking for bundled Python for platform:', currentPlatform);
    
    const bundlePath = path.join(process.resourcesPath, 'python-bundle', currentPlatform);
    this.logger.info('Bundle path:', bundlePath);
    
    if (!fs.existsSync(bundlePath)) {
      this.logger.info('Bundle path does not exist');
      return null;
    }

    // Different executable paths for different platforms
    const possiblePaths = [
      path.join(bundlePath, 'python', 'bin', 'python3'),      // Linux standalone
      path.join(bundlePath, 'python', 'bin', 'python'),       // Linux standalone alt
      path.join(bundlePath, 'python.exe'),                    // Windows embeddable
      path.join(bundlePath, 'Scripts', 'python.exe'),         // Windows alt
      path.join(bundlePath, 'bin', 'python3'),                // General Unix
      path.join(bundlePath, 'bin', 'python'),                 // General Unix alt
    ];

    for (const pythonPath of possiblePaths) {
      this.logger.info('Checking:', pythonPath);
      if (fs.existsSync(pythonPath)) {
        this.logger.info('Found bundled Python at:', pythonPath);
        return pythonPath;
      }
    }

    this.logger.info('No bundled Python executable found');
    return null;
  }

  private findDevBundledPython(): string | null {
    const currentPlatform = `${process.platform}-${process.arch}`;
    const appRoot = path.join(__dirname, '..', '..', '..', '..');
    const bundlePath = path.join(appRoot, 'python-bundle', currentPlatform);
    
    this.logger.info('Looking for dev bundled Python at:', bundlePath);
    
    if (!fs.existsSync(bundlePath)) {
      return null;
    }

    // Same logic as findBundledPython but for development
    const possiblePaths = [
      path.join(bundlePath, 'python', 'bin', 'python3'),
      path.join(bundlePath, 'python', 'bin', 'python'),
      path.join(bundlePath, 'python.exe'),
      path.join(bundlePath, 'Scripts', 'python.exe'),
      path.join(bundlePath, 'bin', 'python3'),
      path.join(bundlePath, 'bin', 'python'),
    ];

    for (const pythonPath of possiblePaths) {
      if (fs.existsSync(pythonPath)) {
        return pythonPath;
      }
    }

    return null;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initialize called');
    
    // Prevent multiple simultaneous initialization attempts
    if (this.isInitializing) {
      this.logger.info('Initialization already in progress, skipping...');
      return;
    }
    
    this.isInitializing = true;
    this.logger.info('Initializing Python server service...');
    
    try {
      // Ensure server path exists
      this.logger.info('Checking server path existence...');
      if (!fs.existsSync(this.serverPath)) {
        const error = `Server path does not exist: ${this.serverPath}`;
        this.logger.error(error);
        throw new Error(error);
      }
      this.logger.info('Server path exists ✓');

      // List server directory contents
      try {
        const serverContents = fs.readdirSync(this.serverPath);
        this.logger.info('Server directory contents:', serverContents);
      } catch (listError) {
        this.logger.error('Could not list server directory:', listError);
      }

      this.logger.info('Starting virtual environment setup...');
      await this.setupVirtualEnvironment();
      this.logger.info('Virtual environment setup complete ✓');

      this.logger.info('Starting dependency installation...');
      await this.installDependencies();
      this.logger.info('Dependency installation complete ✓');

      this.logger.info('Starting PDF indexing...');
      await this.runIndexing();
      this.logger.info('PDF indexing complete ✓');

      this.logger.info('Starting Flask server...');
      await this.startFlaskServer();
      this.logger.info('Python server service initialized successfully!');
    } catch (error) {
      this.logger.error('Failed to initialize:', error);
      this.logger.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  private async setupVirtualEnvironment(): Promise<void> {
    this.logger.info('setupVirtualEnvironment called');
    this.logger.info('Setting up virtual environment...');
    
    // Check if virtual environment already exists
    if (fs.existsSync(this.venvPath)) {
      this.logger.info('Virtual environment already exists at:', this.venvPath);
      this.logger.info('Virtual environment already exists');
      return;
    }

    this.logger.info('Virtual environment does not exist, creating...');

    // Ensure parent directory exists for packaged apps
    if (this.isPackaged) {
      const parentDir = path.dirname(this.venvPath);
      this.logger.info('Ensuring parent directory exists:', parentDir);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
        this.logger.info('Created parent directory');
      }
    }

    return new Promise((resolve, reject) => {
      // For packaged apps, we might need to use a different working directory
      const cwd = this.isPackaged ? path.dirname(this.venvPath) : this.serverPath;
      const venvName = this.isPackaged ? path.basename(this.venvPath) : this.config.venvName;
      
      this.logger.info('Virtual env creation details:');
      this.logger.info('  - Python command:', this.config.pythonPath);
      this.logger.info('  - Working directory:', cwd);
      this.logger.info('  - Venv name:', venvName);
      this.logger.info('  - Full command: python3 -m venv', venvName);

      const venvProcess = spawn(this.config.pythonPath!, ['-m', 'venv', venvName], {
        cwd: cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      venvProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        this.logger.info('VENV STDOUT:', output.trim());
      });

      venvProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        this.logger.info('VENV STDERR:', output.trim());
      });

      venvProcess.on('close', (code) => {
        this.logger.info('Virtual env creation finished with code:', code);
        this.logger.info('Final stdout:', stdout);
        this.logger.info('Final stderr:', stderr);
        
        if (code === 0) {
          this.logger.info('Virtual environment created successfully');
          // Verify the python executable exists
          if (fs.existsSync(this.pythonExecutable)) {
            this.logger.info('Python executable created successfully ✓');
          } else {
            console.error('[PythonServerService] DEBUG: Python executable not found after creation:', this.pythonExecutable);
          }
          resolve();
        } else {
          const error = `Virtual environment setup failed with code ${code}: ${stderr}`;
          this.logger.error(error);
          reject(new Error(error));
        }
      });

      venvProcess.on('error', (error) => {
        this.logger.error('Virtual env creation error:', error);
        this.logger.error('This might indicate Python is not installed or not in PATH');
        reject(error);
      });
    });
  }

  private async installDependencies(): Promise<void> {
    this.logger.info('installDependencies called');
    this.logger.info('Installing Python dependencies...');
    
    const requirementsPath = path.join(this.serverPath, 'requirements.txt');
    this.logger.info('Requirements path:', requirementsPath);
    
    if (!fs.existsSync(requirementsPath)) {
      this.logger.info('No requirements.txt found, skipping dependency installation');
      return;
    }

    this.logger.info('Requirements file exists ✓');

    // Check if pip executable exists
    const pipExecutable = process.platform === 'win32' 
      ? path.join(this.venvPath, 'Scripts', 'pip.exe')
      : path.join(this.venvPath, 'bin', 'pip');
    
    this.logger.info('Pip executable path:', pipExecutable);
    this.logger.info('Pip executable exists:', fs.existsSync(pipExecutable));

    return new Promise((resolve, reject) => {
      this.logger.info('Starting pip install process...');
      
      const installProcess = spawn(pipExecutable, ['install', '-r', requirementsPath], {
        cwd: this.serverPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      installProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // this.logger.info('PIP INSTALL:', output.trim());
      });

      installProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        this.logger.warn('PIP WARNING:', output.trim());
      });

      installProcess.on('close', (code) => {
        this.logger.info('Pip install finished with code:', code);
        
        if (code === 0) {
          this.logger.info('Dependencies installed successfully');
          resolve();
        } else {
          const error = `Dependency installation failed with code ${code}: ${stderr}`;
          this.logger.error(error);
          reject(new Error(error));
        }
      });

      installProcess.on('error', (error) => {
        this.logger.error('Dependency installation error:', error);
        reject(error);
      });
    });
  }

  private async runIndexing(): Promise<void> {
    this.logger.info('Running PDF indexing...');
    
    const indexScriptPath = path.join(this.serverPath, 'index_pdfs.py');
    this.logger.info('Index script path:', indexScriptPath);
    
    if (!fs.existsSync(indexScriptPath)) {
      this.logger.info('No index_pdfs.py found, skipping indexing');
      this.isIndexingComplete = true; // Mark as complete since there's nothing to index
      return;
    }

    this.logger.info('Index script exists ✓');

    const envVars = this.getEnvironmentVariables();
    this.logger.info('Environment variables for indexing:', {
      ...envVars,
      GOOGLE_API_KEY: envVars.GOOGLE_API_KEY ? '***SET***' : '***NOT SET***'
    });

    // Check if vector store already exists from build-time indexing
    const vectorStorePath = envVars.VECTOR_STORE_PATH;
    this.logger.info('Checking for existing vector store at:', vectorStorePath);
    
    if (fs.existsSync(vectorStorePath)) {
      const vectorStoreFiles = fs.readdirSync(vectorStorePath);
      const hasFaissIndex = vectorStoreFiles.some(file => file.includes('index'));
      
      if (hasFaissIndex) {
        this.logger.info('Found existing vector store from build-time indexing');
        this.logger.info('Skipping runtime PDF indexing (using pre-indexed data)');
        this.isIndexingComplete = true;
        return;
      } else {
        this.logger.info('Vector store directory exists but appears empty');
      }
    } else {
      this.logger.info('No existing vector store found');
    }

    // Check if Google API key is available
    if (!envVars.GOOGLE_API_KEY) {
      this.logger.warn('Google API key not available, skipping PDF indexing');
      this.logger.warn('RAG features will not work, but basic Flask server will still start');
      this.isIndexingComplete = false; // Mark as incomplete but don't fail
      return;
    }

    // Determine the correct PDF directory path based on environment
    const pdfDirectory = this.isPackaged 
      ? path.join(process.resourcesPath, 'rag', 'pdfs')
      : path.join(this.serverPath, '..', 'rag', 'pdfs');
    
    this.logger.info('PDF directory path:', pdfDirectory);
    this.logger.info('Vector store output path:', vectorStorePath);
    this.logger.info('PDF directory exists:', fs.existsSync(pdfDirectory));

    if (!fs.existsSync(pdfDirectory)) {
      this.logger.warn('PDF directory not found, skipping indexing');
      this.logger.warn('RAG features will not work');
      this.isIndexingComplete = false;
      return;
    }

    return new Promise((resolve, reject) => {
      const indexArgs = [
        'index_pdfs.py',
        '--pdf-dir', pdfDirectory,
        '--output', vectorStorePath
      ];
      
      this.logger.info('Running runtime indexing with args:', indexArgs);
      this.logger.info('This may take a while for large PDF collections...');
      
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
        this.logger.info('INDEXING:', output.trim());
      });

      indexProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        this.logger.warn('INDEXING WARNING:', output.trim());
      });

      indexProcess.on('close', (code) => {
        this.logger.info('Indexing finished with code:', code);
        
        if (code === 0) {
          this.logger.info('PDF indexing completed successfully');
          this.isIndexingComplete = true;
          resolve();
        } else {
          this.logger.error('PDF indexing failed with code:', code);
          this.logger.error('PDF indexing stderr:', stderr);
          
          // Don't fail the entire service if indexing fails - just warn and continue
          this.logger.warn('PDF indexing failed, but continuing to start Flask server');
          this.logger.warn('RAG features may not work properly');
          this.isIndexingComplete = false;
          resolve(); // Resolve instead of reject
        }
      });

      indexProcess.on('error', (error) => {
        this.logger.error('Indexing process error:', error);
        this.logger.warn('Indexing process failed, but continuing to start Flask server');
        this.isIndexingComplete = false;
        resolve(); // Resolve instead of reject
      });
    });
  }

  private async startFlaskServer(): Promise<void> {
    if (this.flaskProcess) {
      this.logger.info('Flask server is already running');
      return;
    }

    const envVars = this.getEnvironmentVariables();
    this.logger.info('Environment variables for Flask:', {
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
          this.logger.error('Flask server startup timeout');
          cleanup();
          reject(new Error('Flask server startup timeout'));
        }
      }, 30000); // 30 second timeout

      this.flaskProcess!.stdout?.on('data', (data) => {
        const output = data.toString();
        this.logger.info('FLASK STDOUT:', output.trim());
        
        // Check for server startup indicators
        const isServerStarting = output.includes('Starting RAG Pipeline Flask Server') ||
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
              this.logger.info('Flask server started successfully');
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
                                   output.includes('* Running on') ||
                                   output.includes('* Debugger is active!') ||
                                   output.includes('* Debugger PIN:');
        const isSSLWarning = output.includes('NotOpenSSLWarning') || output.includes('urllib3') || output.includes('LibreSSL');
        const isVectorStoreWarning = output.includes('Vector store directory not found') || 
                                     output.includes('Make sure to run the indexing script');
        const isGoogleCloudWarning = output.includes('ALTS creds ignored') || 
                                     output.includes('absl::InitializeLog') ||
                                     output.includes('Not running on GCP') ||
                                     output.includes('All log messages before absl::InitializeLog');
        
        if (isAccessLog || isFlaskStartupInfo) {
          // This is normal Flask logging, log as info
          this.logger.info('FLASK INFO:', output.trim());
        } else if (isSSLWarning) {
          // SSL warnings are not critical - just log as warning
          this.logger.warn('FLASK SSL WARNING:', output.trim());
        } else if (isVectorStoreWarning) {
          // Vector store warnings are expected if indexing failed - log as warning
          this.logger.warn('FLASK VECTOR WARNING:', output.trim());
        } else if (isGoogleCloudWarning) {
          // Google Cloud warnings are not critical - just log as warning
          this.logger.warn('FLASK GCP WARNING:', output.trim());
        } else {
          // This is likely an actual error
          this.logger.error('FLASK ERROR:', output.trim());
        }
        
        if (!serverStarted) {
          // Only treat as startup error if it's not a normal log, SSL warning, vector store warning, or Google Cloud warning
          if (!isAccessLog && !isFlaskStartupInfo && !isSSLWarning && !isVectorStoreWarning && !isGoogleCloudWarning) {
            cleanup();
            reject(new Error(`Flask server failed to start: ${output}`));
          }
        }
      });

      this.flaskProcess!.on('close', (code) => {
        this.logger.info('Flask server process closed with code:', code);
        this.flaskProcess = null;
        
        if (!serverStarted) {
          cleanup();
          reject(new Error(`Flask server exited with code ${code}`));
        }
      });

      this.flaskProcess!.on('error', (error) => {
        this.logger.error('Flask server error:', error);
        this.flaskProcess = null;
        
        if (!serverStarted) {
          cleanup();
          reject(error);
        }
      });
    });
  }

  private getEnvironmentVariables(): Record<string, string> {
    this.logger.info('getEnvironmentVariables called');
    
    // Use appropriate paths for packaged vs development
    let vectorStorePath: string;
    
    if (this.isPackaged) {
      // First check for build-time vector store in packaged resources
      const packagedVectorStorePath = path.join(process.resourcesPath, 'server', 'vector_store');
      const userDataVectorStorePath = path.join(app.getPath('userData'), 'python-server', 'vector_store');
      
      // Check if build-time vector store exists and has index files
      if (fs.existsSync(packagedVectorStorePath)) {
        const vectorStoreFiles = fs.readdirSync(packagedVectorStorePath);
        const hasFaissIndex = vectorStoreFiles.some(file => file.includes('index'));
        
        if (hasFaissIndex) {
          this.logger.info('Using build-time vector store from packaged resources');
          vectorStorePath = packagedVectorStorePath;
        } else {
          this.logger.info('Packaged vector store exists but appears empty, using user data path');
          vectorStorePath = userDataVectorStorePath;
        }
      } else {
        this.logger.info('No packaged vector store found, using user data path');
        vectorStorePath = userDataVectorStorePath;
      }
    } else {
      vectorStorePath = path.join(this.serverPath, 'vector_store');
    }
    
    const databasePath = this.isPackaged 
      ? path.join(app.getPath('userData'), 'python-server', 'db', 'dev.db')
      : path.join(this.serverPath, 'db', 'dev.db');

    this.logger.info('Vector store path:', vectorStorePath);
    this.logger.info('Database path:', databasePath);

    // Ensure directories exist (only for user data paths, not packaged resources)
    if (this.isPackaged) {
      const dbDir = path.dirname(databasePath);
      
      this.logger.info('Creating directories...');
      this.logger.info('  - Vector store path:', vectorStorePath);
      this.logger.info('  - DB dir:', dbDir);
      
      // Only create vector store directory if it's in user data (writable)
      if (vectorStorePath.includes(app.getPath('userData'))) {
        const vectorStoreDir = path.dirname(vectorStorePath);
        if (!fs.existsSync(vectorStoreDir)) {
          fs.mkdirSync(vectorStoreDir, { recursive: true });
          this.logger.info('Created vector store directory');
        }
      } else {
        this.logger.info('Using read-only packaged vector store');
      }
      
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        this.logger.info('Created database directory');
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

    this.logger.info('Environment variables created:', {
      ...envVars,
      GOOGLE_API_KEY: envVars.GOOGLE_API_KEY ? '***SET***' : '***NOT SET***'
    });

    return envVars;
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Python server service...');
    
    if (!this.flaskProcess) {
      this.logger.info('No Flask process to shutdown');
      return;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
          this.logger.info('Graceful shutdown timeout, force killing Flask server process');
        try {
          if (this.flaskProcess && !this.flaskProcess.killed) {
            this.flaskProcess.kill('SIGKILL');
          }
        } catch (error) {
          this.logger.error('Error force killing process:', error);
        }
        this.cleanup();
        resolve();
      }, 3000); // Reduced timeout to 3 seconds

      const cleanup = () => {
        clearTimeout(timeout);
        this.cleanup();
        resolve();
      };

      this.flaskProcess!.on('close', (code) => {
        this.logger.info('Flask server shut down gracefully with code:', code);
        cleanup();
      });

      this.flaskProcess!.on('error', (error) => {
        this.logger.error('Flask server shutdown error:', error);
        cleanup();
      });

      try {
        this.logger.info('Sending SIGTERM to Flask server');
        this.flaskProcess!.kill('SIGTERM');
      } catch (error) {
        this.logger.error('Error sending SIGTERM:', error);
        cleanup();
      }
    });
  }

  private cleanup(): void {
    this.flaskProcess = null;
    this.logger.info('Cleanup complete');
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
      isRunning: this.flaskProcess !== null,
      isIndexingComplete: this.isIndexingComplete,
      serverUrl: this.getServerUrl(),
      port: this.config.serverPort,
      isPackaged: this.isPackaged,
      serverPath: this.serverPath
    };
  }

  async healthCheck(): Promise<boolean> {
    if (this.flaskProcess === null) {
      return false;
    }

    try {
        const response = await fetch(`${this.getServerUrl()}/health`, {
          method: 'GET'
        });
        return response.ok;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }

  async apiRequest(method: string, endpoint: string, data?: any): Promise<{
    ok: boolean;
    status: number;
    data?: any;
    error?: string;
  }> {
    try {
      const url = `${this.getServerUrl()}${endpoint}`;
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
    } catch (error) {
      this.logger.error('API request failed:', error);
      return {
        ok: false,
        status: 500,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
} 