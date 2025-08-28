@echo off
REM Debug script for Tether Windows build
REM This script runs the Tether executable with detailed logging

echo ========================================
echo Tether Debug Script
echo ========================================
echo.

REM Set up logging directory
set LOG_DIR=%~dp0debug-logs
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Generate timestamp for log files
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
set "timestamp=%YYYY%-%MM%-%DD%_%HH%-%Min%-%Sec%"

REM Set log file paths
set MAIN_LOG=%LOG_DIR%\tether-main-%timestamp%.log
set ERROR_LOG=%LOG_DIR%\tether-error-%timestamp%.log
set PYTHON_LOG=%LOG_DIR%\python-server-%timestamp%.log

echo Timestamp: %timestamp%
echo Main log: %MAIN_LOG%
echo Error log: %ERROR_LOG%
echo Python log: %PYTHON_LOG%
echo.

REM Set environment variables for enhanced logging
set ELECTRON_ENABLE_LOGGING=1
set ELECTRON_LOG_ASAR_READS=1
set ELECTRON_LOG_SENSITIVE=1
set NODE_ENV=development
set DEBUG=*

REM Check which executable to run
set EXE_PATH=""
if exist "dist\win-unpacked\Tether.exe" (
    set EXE_PATH="dist\win-unpacked\Tether.exe"
    echo Using unpacked executable: dist\win-unpacked\Tether.exe
) else if exist "dist\Tether 0.1.0.exe" (
    set EXE_PATH="dist\Tether 0.1.0.exe"
    echo Using portable executable: dist\Tether 0.1.0.exe
) else (
    echo ERROR: No Tether executable found!
    echo Please make sure you've run: npm run dist:win
    pause
    exit /b 1
)

echo.
echo ========================================
echo Starting Tether with logging...
echo ========================================
echo.
echo Press Ctrl+C to stop the application
echo All logs will be saved to: %LOG_DIR%
echo.

REM Start the application with logging
%EXE_PATH% > "%MAIN_LOG%" 2> "%ERROR_LOG%"

echo.
echo ========================================
echo Application closed
echo ========================================
echo.

REM Show log file sizes
echo Log files created:
for %%f in ("%MAIN_LOG%" "%ERROR_LOG%") do (
    if exist "%%f" (
        for %%s in ("%%f") do echo   %%~nxf: %%~zs bytes
    )
)

echo.
echo Opening log directory...
explorer "%LOG_DIR%"

echo.
echo Press any key to view the main log file...
pause > nul
if exist "%MAIN_LOG%" (
    notepad "%MAIN_LOG%"
)

echo.
echo Press any key to view the error log file...
pause > nul
if exist "%ERROR_LOG%" (
    notepad "%ERROR_LOG%"
)

