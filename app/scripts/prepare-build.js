#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Prepare build script for Tether Electron app
 * Ensures the server directory is ready for packaging
 */

const serverPath = path.join(__dirname, '../../server');
const appPath = path.join(__dirname, '..');

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dirPath}`);
  } else {
    console.log(`✅ Directory exists: ${dirPath}`);
  }
}

function cleanupBuildArtifacts() {
  console.log('🧹 Cleaning up build artifacts...');
  
  const cleanupPaths = [
    path.join(serverPath, '__pycache__'),
    path.join(serverPath, 'venv'),
    path.join(serverPath, 'vector_store'),
    path.join(serverPath, 'db')
  ];

  cleanupPaths.forEach(cleanupPath => {
    if (fs.existsSync(cleanupPath)) {
      fs.rmSync(cleanupPath, { recursive: true, force: true });
      console.log(`🗑️  Removed: ${cleanupPath}`);
    }
  });
}

function validateServerFiles() {
  console.log('📋 Validating server files...');
  
  const requiredFiles = [
    'app.py',
    'run.py',
    'index_pdfs.py',
    'config.py',
    'requirements.txt',
    'schema.sql'
  ];

  const missingFiles = requiredFiles.filter(file => 
    !fs.existsSync(path.join(serverPath, file))
  );

  if (missingFiles.length > 0) {
    console.error('❌ Missing required server files:', missingFiles);
    process.exit(1);
  }

  console.log('✅ All required server files are present');
}

function checkPythonEnvironment() {
  console.log('🐍 Checking Python environment...');
  console.log('ℹ️  Note: Python must be available on the target system');
  console.log('ℹ️  Recommended: Python 3.8 or higher');
  console.log('ℹ️  The app will create a virtual environment automatically');
}

function updatePackageJsonScripts() {
  console.log('📦 Updating package.json build scripts...');
  
  const packageJsonPath = path.join(appPath, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // Add prepare-build script if it doesn't exist
  if (!packageJson.scripts['prepare-build']) {
    packageJson.scripts['prepare-build'] = 'node scripts/prepare-build.js';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('✅ Added prepare-build script to package.json');
  }
}

function main() {
  console.log('🚀 Preparing Tether app for building...\n');

  try {
    // Validate server files
    validateServerFiles();

    // Clean up build artifacts
    cleanupBuildArtifacts();

    // Check Python environment
    checkPythonEnvironment();

    // Update package.json
    updatePackageJsonScripts();

    console.log('\n✅ Build preparation complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Run: npm run build');
    console.log('2. Run: npm run dist:mac (or dist:win/dist:linux)');
    console.log('\n⚠️  Important notes:');
    console.log('- Python 3.8+ must be installed on target systems');
    console.log('- First launch will take longer due to dependency installation');
    console.log('- The app will create necessary directories and virtual environment automatically');

  } catch (error) {
    console.error('❌ Build preparation failed:', error.message);
    process.exit(1);
  }
}

// Only run main if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main }; 