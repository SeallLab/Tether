# Building Tether with Python Server

This guide explains how to build and package the Tether Electron application with the embedded Python Flask server.

## Overview

The Tether application now includes an embedded Python Flask server that provides RAG (Retrieval-Augmented Generation) functionality. When you package the app, the Python server is included and will run automatically in the background.

## Prerequisites

### Required Software

1. **Node.js 18+** - For the Electron app
2. **Python 3.8+** - For the Flask server
3. **pip** - Python package manager
4. **venv** - Python virtual environment module


## Build Process

### 1. Development Build

For local development with hot reload:

```bash
npm run dev
```

This starts both the React frontend and Electron app in development mode. The Python server is started automatically by the Electron app.

### 2. Production Build

To create a production build:

```bash
npm run build
```

This will:
1. Run environment checks
2. Clean up build artifacts
3. Build the React frontend
4. Transpile TypeScript

### 3. Package for Distribution

Create distributable packages:

```bash
# macOS (ARM64)
npm run dist:mac

# Windows (x64)
npm run dist:win

# Linux (x64)
npm run dist:linux

# All platforms
npm run dist:all
```

## How It Works

### Packaging Structure

When packaged, the application structure looks like:

```
YourApp.app/Contents/
├── Resources/
│   ├── server/           # Python server files
│   │   ├── app.py
│   │   ├── run.py
│   │   ├── requirements.txt
│   │   └── ...
│   └── app.asar         # Electron app files
└── MacOS/
    └── YourApp          # Electron executable
```

### Runtime Behavior

1. **First Launch**: 
   - Creates virtual environment in user data directory
   - Installs Python dependencies from requirements.txt
   - Creates database and vector store directories
   - May take 1-2 minutes depending on internet speed

2. **Subsequent Launches**:
   - Uses existing virtual environment
   - Starts quickly (usually < 10 seconds)

### File Locations

In packaged apps, the Python server uses these locations:

- **Server files**: `process.resourcesPath/server/` (read-only)
- **Virtual environment**: `userData/python-server/venv/`
- **Database**: `userData/python-server/db/`
- **Vector store**: `userData/python-server/vector_store/`

Where `userData` is:
- **macOS**: `~/Library/Application Support/YourApp/`
- **Windows**: `%APPDATA%/YourApp/`
- **Linux**: `~/.config/YourApp/`

## Troubleshooting

### Common Issues

#### Python Not Found

**Error**: "Python command failed" or "No Python installation found"

**Solution**: Install Python 3.8+ with pip and venv:
- **macOS**: `brew install python3`
- **Windows**: Download from python.org
- **Linux**: `sudo apt install python3 python3-pip python3-venv`

#### Virtual Environment Creation Failed

**Error**: "Virtual environment setup failed"

**Solutions**:
1. Ensure you have write permissions to the user data directory
2. Check disk space (need ~500MB for dependencies)
3. Try running with administrator privileges (Windows) or sudo (Linux/macOS)

#### Dependencies Installation Failed

**Error**: "Dependency installation failed"

**Solutions**:
1. Check internet connection
2. Verify pip is working: `python3 -m pip --version`
3. Clear pip cache: `python3 -m pip cache purge`

#### Server Won't Start

**Error**: "Flask server failed to start"

**Solutions**:
1. Check if port 5001 is available
2. Look for Python error messages in the console
3. Verify all server files are included in the package

### Debug Mode

Enable debug logging by setting environment variable:

```bash
export DEBUG=1
npm run dist:mac
```

### Manual Testing

Test the packaging without full distribution:

```bash
# Build but don't package
npm run build

# Test the built app
npm run transpile:electron
cross-env NODE_ENV=production electron .
```

## Advanced Configuration

### Custom Python Path

If Python isn't in your PATH, you can specify a custom path:

```typescript
// In main.ts or where PythonServerService is initialized
const pythonService = new PythonServerService({
  pythonPath: '/usr/local/bin/python3'
});
```

### Custom Server Port

Change the Flask server port:

```typescript
const pythonService = new PythonServerService({
  serverPort: 5001,
  serverHost: '127.0.0.1'
});
```

### Bundle Python Runtime

For completely self-contained distribution, you can bundle a Python runtime:

1. **pyinstaller**: Create standalone Python executables
2. **py2app** (macOS): Bundle Python with your app
3. **cx_Freeze**: Cross-platform Python bundling

This is more complex but eliminates the Python installation requirement on target systems.

## Build Scripts Reference

- `npm run prepare-build` - Clean and prepare for building
- `npm run build` - Create production build
- `npm run dist:mac` - Package for macOS
- `npm run dist:win` - Package for Windows
- `npm run dist:linux` - Package for Linux
- `npm run dist:all` - Package for all platforms

## CI/CD Integration

For automated builds, ensure your CI environment has:

```bash
# Install Python dependencies
pip install -r server/requirements.txt

# Set required environment variables
export GOOGLE_API_KEY="your_api_key"

# Run build
npm run dist:mac
```

Example GitHub Actions workflow:

```yaml
- name: Setup Python
  uses: actions/setup-python@v4
  with:
    python-version: '3.11'

- name: Setup Node.js
  uses: actions/setup-node@v3
  with:
    node-version: '18'

- name: Install dependencies
  run: npm install

- name: Build and package
  env:
    GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
  run: npm run dist:mac
```

## Security Considerations

1. **API Keys**: Store sensitive keys in environment variables, not in code
2. **File Permissions**: The app creates files in user data directory
3. **Network**: Flask server binds to localhost only by default
4. **Dependencies**: Keep Python dependencies updated for security

## Support

For issues with:
- **Electron packaging**: Check electron-builder documentation
- **Python environment**: Verify Python/pip installation
- **Server startup**: Check console logs for Python errors
- **Performance**: Monitor resource usage during first launch 