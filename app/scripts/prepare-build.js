#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";
import https from "https";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Prepare build script for Tether Electron app
 * Ensures the server directory is ready for packaging
 */

const serverPath = path.join(__dirname, "../../server");
const appPath = path.join(__dirname, "..");
const ragPath = path.join(__dirname, "../../rag");
const pythonBundlePath = path.join(appPath, "python-bundle");

// Python download URLs for different platforms
const PYTHON_DOWNLOADS = {
  "darwin-x64": {
    url: "https://github.com/indygreg/python-build-standalone/releases/download/20240415/cpython-3.11.9+20240415-x86_64-apple-darwin-install_only.tar.gz",
    extract: true,
    skipDownload: false,
  },
  "darwin-arm64": {
    url: "https://github.com/indygreg/python-build-standalone/releases/download/20240415/cpython-3.11.9+20240415-aarch64-apple-darwin-install_only.tar.gz",
    extract: true,
    skipDownload: false,
  },
  "win32-x64": {
    url: "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip",
    extract: true,
    skipDownload: false,
  },
  "linux-x64": {
    url: "https://github.com/indygreg/python-build-standalone/releases/download/20240415/cpython-3.11.9+20240415-x86_64-unknown-linux-gnu-install_only.tar.gz",
    extract: true,
    skipDownload: false,
  },
};

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  } else {
    console.log(`Directory exists: ${dirPath}`);
  }
}

function cleanupBuildArtifacts() {
  console.log("Cleaning up build artifacts");

  const cleanupPaths = [
    path.join(serverPath, "__pycache__"),
    path.join(serverPath, "venv"),
    path.join(serverPath, "db"),
  ];

  cleanupPaths.forEach((cleanupPath) => {
    if (fs.existsSync(cleanupPath)) {
      fs.rmSync(cleanupPath, { recursive: true, force: true });
      console.log(`Removed: ${cleanupPath}`);
    }
  });
}

function validateServerFiles() {
  console.log("Validating server files");

  const requiredFiles = [
    "app.py",
    "run.py",
    "index_pdfs.py",
    "config.py",
    "requirements.txt",
    "schema.sql",
  ];

  const missingFiles = requiredFiles.filter(
    (file) => !fs.existsSync(path.join(serverPath, file))
  );

  if (missingFiles.length > 0) {
    console.error("Missing required server files:", missingFiles);
    process.exit(1);
  }

  console.log("All required server files are present");
}

function checkEnvironmentVariables() {
  console.log("Checking environment variables...");

  // Check for .env file
  const envPath = path.join(appPath, ".env");
  if (!fs.existsSync(envPath)) {
    console.warn("No .env file found. PDF indexing will be skipped.");
    console.warn(
      "Create .env file with GOOGLE_API_KEY to enable RAG features."
    );
    return false;
  }

  // Read .env file and check for API key
  const envContent = fs.readFileSync(envPath, "utf8");
  const hasApiKey =
    envContent.includes("GOOGLE_API_KEY=") &&
    !envContent.includes('GOOGLE_API_KEY=""') &&
    !envContent.includes("GOOGLE_API_KEY=\n");

  if (!hasApiKey) {
    console.warn(
      "GOOGLE_API_KEY not found in .env file. PDF indexing will be skipped."
    );
    console.warn("Set GOOGLE_API_KEY in .env to enable RAG features.");
    return false;
  }

  console.log("Environment variables configured");
  return true;
}

async function downloadFile(url, filePath) {
  console.log(`Downloading: ${url}`);

  return new Promise((resolve, reject) => {
    const file = createWriteStream(filePath);

    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirects
          file.close();
          fs.unlinkSync(filePath);
          return downloadFile(response.headers.location, filePath)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(filePath);
          return reject(
            new Error(`Download failed with status ${response.statusCode}`)
          );
        }

        pipeline(response, file).then(resolve).catch(reject);
      })
      .on("error", (err) => {
        file.close();
        fs.unlinkSync(filePath);
        reject(err);
      });
  });
}

async function setupBundledPython() {
  console.log("Setting up bundled Python distributions");

  // For now, we'll focus on the current platform for build-time setup
  const currentPlatform = `${process.platform}-${process.arch}`;
  console.log(`Current platform: ${currentPlatform}`);

  const pythonConfig = PYTHON_DOWNLOADS[currentPlatform];

  if (!pythonConfig) {
    console.warn(
      `No Python bundle configuration for platform: ${currentPlatform}`
    );
    console.warn(`Falling back to system Python for build process`);
    return null;
  }

  // Create python bundle directory
  ensureDirectoryExists(pythonBundlePath);

  const platformBundlePath = path.join(pythonBundlePath, currentPlatform);
  ensureDirectoryExists(platformBundlePath);

  // Check if already downloaded and extracted
  const pythonExecutable = findBundledPythonExecutable(platformBundlePath);
  if (pythonExecutable && fs.existsSync(pythonExecutable)) {
    console.log("Bundled Python already exists", pythonExecutable);
    return pythonExecutable;
  }

  console.log(`Downloading Python bundle for ${currentPlatform}`);

  // Download Python
  const downloadPath = path.join(platformBundlePath, "python-bundle.tar.gz");

  try {
    await downloadFile(pythonConfig.url, downloadPath);
    console.log("Python download completed");

    // Extract
    if (pythonConfig.extract) {
      console.log("Extracting Python bundle");
      await runCommand(
        "tar",
        ["-xzf", "python-bundle.tar.gz"],
        platformBundlePath
      );

      // Clean up download file
      fs.unlinkSync(downloadPath);
      console.log("Python extraction completed");
    }

    // Find the actual python executable after extraction
    const extractedPythonExecutable =
      findBundledPythonExecutable(platformBundlePath);
    if (
      extractedPythonExecutable &&
      fs.existsSync(extractedPythonExecutable)
    ) {
      console.log("Bundled Python setup complete:", extractedPythonExecutable);
      return extractedPythonExecutable;
    } else {
      console.error("Could not find Python executable after extraction");
      return null;
    }
  } catch (error) {
    console.error("Python bundle setup failed:", error.message);
    console.warn("Falling back to system Python");
    return null;
  }
}

function findBundledPythonExecutable(bundlePath) {
  // Different possible paths after extraction for python-build-standalone
  const possiblePaths = [
    path.join(bundlePath, "python", "bin", "python3"), // Standard layout
    path.join(bundlePath, "python", "bin", "python"), // Alternative
    path.join(bundlePath, "bin", "python3"), // Direct bin
    path.join(bundlePath, "bin", "python"), // Direct bin alt
    path.join(bundlePath, "install", "bin", "python3"), // Install layout
    path.join(bundlePath, "install", "bin", "python"), // Install layout alt
    path.join(bundlePath, "python.exe"), // Windows
    path.join(bundlePath, "Scripts", "python.exe"), // Windows alt
  ];

  for (const pythonPath of possiblePaths) {
    if (fs.existsSync(pythonPath)) {
      console.log("[DEBUG] Found bundled Python executable at:", pythonPath);
      return pythonPath;
    }
  }

  console.log("[DEBUG] No bundled Python executable found in:", bundlePath);
  return null;
}

async function setupPythonEnvironment(bundledPython = null) {
  console.log("Setting up Python environment for build...");

  const pythonCommand = bundledPython || "python3";
  const venvPath = path.join(serverPath, "build-venv");
  const pythonExecutable =
    process.platform === "win32"
      ? path.join(venvPath, "Scripts", "python.exe")
      : path.join(venvPath, "bin", "python");

  // Remove existing build venv
  if (fs.existsSync(venvPath)) {
    fs.rmSync(venvPath, { recursive: true, force: true });
  }

  // Create virtual environment
  console.log("Creating build virtual environment...");
  await runCommand(pythonCommand, ["-m", "venv", "build-venv"], serverPath);

  // Install dependencies
  console.log("Installing dependencies...");
  const pipExecutable =
    process.platform === "win32"
      ? path.join(venvPath, "Scripts", "pip.exe")
      : path.join(venvPath, "bin", "pip");

  await runCommand(
    pipExecutable,
    ["install", "-r", "requirements.txt"],
    serverPath
  );

  return pythonExecutable;
}

async function indexPDFs(pythonExecutable) {
  console.log("Indexing PDFs for build...");

  const pdfDirectory = path.join(ragPath, "pdfs");
  const vectorStorePath = path.join(serverPath, "vector_store");

  // Check if PDF directory exists
  if (!fs.existsSync(pdfDirectory)) {
    console.warn("PDF directory not found, skipping indexing");
    return false;
  }

  // Check if there are any PDFs
  const pdfFiles = fs
    .readdirSync(pdfDirectory)
    .filter((file) => file.endsWith(".pdf"));
  if (pdfFiles.length === 0) {
    console.warn("No PDF files found, skipping indexing");
    return false;
  }

  console.log(`Found ${pdfFiles.length} PDF files to index`);

  // Load environment variables from .env file
  const envPath = path.join(appPath, ".env");
  const envVars = { ...process.env };

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const lines = envContent.split("\n");

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (
        trimmedLine &&
        !trimmedLine.startsWith("#") &&
        trimmedLine.includes("=")
      ) {
        const [key, ...valueParts] = trimmedLine.split("=");
        const value = valueParts.join("=").replace(/^["']|["']$/g, ""); // Remove quotes
        envVars[key] = value;
      }
    }

    console.log(`Loaded environment variables from .env file`);
  }

  // Run indexing with environment variables
  await runCommand(
    pythonExecutable,
    ["index_pdfs.py", "--pdf-dir", pdfDirectory, "--output", vectorStorePath],
    serverPath,
    envVars
  );

  console.log("PDF indexing completed successfully");
  return true;
}

function runCommand(command, args, cwd, env = process.env) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(" ")}`);

    const process = spawn(command, args, {
      cwd: cwd,
      env: env,
      stdio: ["inherit", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    process.stdout?.on("data", (data) => {
      const output = data.toString();
      stdout += output;
      console.log(output.trim());
    });

    process.stderr?.on("data", (data) => {
      const output = data.toString();
      stderr += output;
      // Only show non-warning stderr
      if (!output.includes("WARNING") && !output.includes("urllib3")) {
        console.warn(output.trim());
      }
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    process.on("error", (error) => {
      reject(error);
    });
  });
}

function cleanupBuildEnvironment() {
  console.log("Cleaning up build environment...");

  const buildVenvPath = path.join(serverPath, "build-venv");
  if (fs.existsSync(buildVenvPath)) {
    fs.rmSync(buildVenvPath, { recursive: true, force: true });
    console.log("Removed build virtual environment");
  }
}

function checkPythonEnvironment() {
  console.log("Python environment requirements:");
  console.log("Build process requires Python 3.8+ with pip and venv");
  console.log(
    "Target systems will use bundled Python (completely self-contained)"
  );
}

function updatePackageJsonScripts() {
  console.log("Updating package.json build scripts...");

  const packageJsonPath = path.join(appPath, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  // Add prepare-build script if it doesn't exist
  if (!packageJson.scripts["prepare-build"]) {
    packageJson.scripts["prepare-build"] = "node scripts/prepare-build.js";
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log("Added prepare-build script to package.json");
  }
}

async function main() {
  console.log("Preparing Tether app for building\n");

  let pythonExecutable = null;
  let bundledPython = null;

  try {
    // Validate server files
    validateServerFiles();

    // Clean up build artifacts (but keep any existing vector_store)
    cleanupBuildArtifacts();

    // Setup bundled Python distributions
    bundledPython = await setupBundledPython();

    // Check environment variables
    const hasApiKey = checkEnvironmentVariables();

    // Setup Python environment for indexing
    if (hasApiKey) {
      pythonExecutable = await setupPythonEnvironment(bundledPython);

      // Index PDFs during build
      await indexPDFs(pythonExecutable);
    } else {
      console.log("Skipping PDF indexing (no API key configured)");
    }

    // Update package.json
    updatePackageJsonScripts();

    console.log("\nBuild preparation complete");
    console.log("\nNext steps:");
    console.log("1. Run: npm run build");
    console.log("2. Run: npm run dist:mac (or dist:win/dist:linux)");

    if (hasApiKey) {
      console.log("\nFeatures included:");
      console.log("- Pre-indexed PDF vector store (faster first launch)");
      console.log("- RAG features will be available immediately");
    } else {
      console.log("\nLimited features:");
      console.log("- RAG features will be disabled (no API key)");
      console.log("- To enable: Set GOOGLE_API_KEY in .env file and rebuild");
    }

    if (bundledPython) {
      console.log("- Bundled Python distribution (completely self-contained)");
    } else {
      console.log(
        "- Uses system Python (requires Python installation on target)"
      );
    }
  } catch (error) {
    console.error("Build preparation failed:", error.message);
    process.exit(1);
  } finally {
    // Always clean up build environment
    if (pythonExecutable) {
      cleanupBuildEnvironment();
    }
  }
}

// Only run main if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
