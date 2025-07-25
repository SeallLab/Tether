#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Python environment check script
 * Verifies that Python is available and meets minimum requirements
 */

function checkPythonVersion(pythonCmd) {
  return new Promise((resolve, reject) => {
    const python = spawn(pythonCmd, ['--version'], { stdio: 'pipe' });
    
    let output = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0) {
        const match = output.match(/Python (\d+)\.(\d+)\.(\d+)/);
        if (match) {
          const version = {
            major: parseInt(match[1]),
            minor: parseInt(match[2]),
            patch: parseInt(match[3]),
            full: match[0],
            command: pythonCmd
          };
          resolve(version);
        } else {
          reject(new Error(`Could not parse Python version from: ${output}`));
        }
      } else {
        reject(new Error(`Python command failed: ${output}`));
      }
    });
    
    python.on('error', (error) => {
      reject(error);
    });
  });
}

function checkPipAvailable(pythonCmd) {
  return new Promise((resolve, reject) => {
    const pip = spawn(pythonCmd, ['-m', 'pip', '--version'], { stdio: 'pipe' });
    
    let output = '';
    
    pip.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pip.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    pip.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`pip is not available: ${output}`));
      }
    });
    
    pip.on('error', (error) => {
      reject(error);
    });
  });
}

function checkVenvModule(pythonCmd) {
  return new Promise((resolve, reject) => {
    const venv = spawn(pythonCmd, ['-m', 'venv', '--help'], { stdio: 'pipe' });
    
    let output = '';
    
    venv.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    venv.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    venv.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`venv module is not available: ${output}`));
      }
    });
    
    venv.on('error', (error) => {
      reject(error);
    });
  });
}

async function checkPythonCommands() {
  const commands = ['python3', 'python'];
  const results = [];
  
  for (const cmd of commands) {
    try {
      const version = await checkPythonVersion(cmd);
      const pipAvailable = await checkPipAvailable(cmd).catch(() => false);
      const venvAvailable = await checkVenvModule(cmd).catch(() => false);
      
      results.push({
        command: cmd,
        version,
        pip: pipAvailable,
        venv: venvAvailable,
        suitable: version.major >= 3 && version.minor >= 8 && pipAvailable && venvAvailable
      });
    } catch (error) {
      // Command not available, skip
    }
  }
  
  return results;
}

async function main() {
  console.log('🐍 Checking Python environment...\n');
  
  try {
    const pythonResults = await checkPythonCommands();
    
    if (pythonResults.length === 0) {
      console.error('❌ No Python installation found!');
      console.log('\n📝 To install Python:');
      console.log('• macOS: brew install python3 (or download from python.org)');
      console.log('• Windows: Download from python.org or use Microsoft Store');
      console.log('• Linux: sudo apt install python3 python3-pip python3-venv (Ubuntu/Debian)');
      process.exit(1);
    }
    
    console.log('Found Python installations:');
    
    let bestPython = null;
    let hasSuitable = false;
    
    pythonResults.forEach((result, index) => {
      const status = result.suitable ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${result.command}: ${result.version.full}`);
      console.log(`   • pip: ${result.pip ? '✅' : '❌'}`);
      console.log(`   • venv: ${result.venv ? '✅' : '❌'}`);
      
      if (result.suitable && !bestPython) {
        bestPython = result;
        hasSuitable = true;
      }
    });
    
    if (hasSuitable) {
      console.log(`\n✅ Recommended Python: ${bestPython.command} (${bestPython.version.full})`);
      console.log('✅ Your system is ready for packaging the Electron app with Python server!');
      
      // Check if requirements can be installed
      console.log('\n🔍 Checking server dependencies...');
      const serverPath = path.join(__dirname, '../../server');
      const requirementsPath = path.join(serverPath, 'requirements.txt');
      
      if (fs.existsSync(requirementsPath)) {
        console.log('✅ requirements.txt found');
        console.log('ℹ️  Dependencies will be installed automatically when the app first runs');
      } else {
        console.warn('⚠️  requirements.txt not found in server directory');
      }
      
    } else {
      console.error('\n❌ No suitable Python installation found!');
      console.log('\n📋 Requirements:');
      console.log('• Python 3.8 or higher');
      console.log('• pip package manager');
      console.log('• venv module');
      console.log('\nPlease install or upgrade Python and try again.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error checking Python environment:', error.message);
    process.exit(1);
  }
}

// Only run main if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main, checkPythonCommands }; 