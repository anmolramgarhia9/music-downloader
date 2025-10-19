# PowerShell script to start YouTube Downloader with ngrok tunnel
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Starting YouTube Downloader with ngrok tunnel" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Check if ngrok is installed
try {
    $ngrokVersion = & ngrok version 2>$null
    Write-Host "✓ ngrok found: $ngrokVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ ERROR: ngrok is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install ngrok from https://ngrok.com/download" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if npm is available
try {
    $npmVersion = & npm --version 2>$null
    Write-Host "✓ npm found: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ ERROR: npm is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Change to script directory
Set-Location $PSScriptRoot

Write-Host "Starting the development server..." -ForegroundColor Yellow
Start-Process -FilePath "cmd" -ArgumentList "/k npm run dev" -WindowStyle Normal

Write-Host "Waiting 5 seconds for the server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "Starting ngrok tunnel..." -ForegroundColor Yellow
Start-Process -FilePath "cmd" -ArgumentList "/k ngrok http 8080" -WindowStyle Normal

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Both processes are starting in separate windows" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Close the command windows to stop the processes" -ForegroundColor Yellow
Write-Host "(or close this PowerShell window)" -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit (processes will continue running)"
