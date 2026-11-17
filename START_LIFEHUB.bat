@echo off
cd /d "%~dp0"
where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js / npm not installed. Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing LifeHub dependencies...
  call npm install
  if errorlevel 1 (
    echo Installation failed. Check internet connection and npm errors.
    pause
    exit /b 1
  )
)
echo Starting LifeHub...
call npm run dev
if errorlevel 1 pause
