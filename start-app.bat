@echo off
echo ============================================
echo Starting YouTube Downloader with ngrok tunnel
echo ============================================

REM Change to the project directory
cd /d "%~dp0"

REM Check if ngrok is installed
where ngrok >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: ngrok is not installed or not in PATH
    echo Please install ngrok from https://ngrok.com/download
    pause
    exit /b 1
)

REM Check if npm is available
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo Starting the development server...
start "YouTube Downloader Dev Server" cmd /k "npm run dev"

echo Waiting 5 seconds for the server to start...
timeout /t 5 /nobreak >nul

echo Starting ngrok tunnel...
start "ngrok Tunnel" cmd /k "ngrok http 8080"

echo ============================================
echo Both processes are starting in separate windows
echo ============================================
echo.
echo Close this window to stop both processes
echo (or close the individual windows)
echo.
pause
