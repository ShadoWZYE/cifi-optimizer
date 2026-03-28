@echo off
setlocal

cd /d "%~dp0"

if not exist "C:\Program Files\nodejs\npm.cmd" (
  echo Node.js npm launcher was not found at C:\Program Files\nodejs\npm.cmd
  echo Install Node.js or update this batch file to match your install path.
  pause
  exit /b 1
)

echo Starting CiFi Optimization Suite...
echo.
echo Local URL: http://localhost:4173
echo Press Ctrl+C in this window to stop the server.
echo.

"C:\Program Files\nodejs\npm.cmd" run dev
