@echo off
setlocal

cd /d "%~dp0"

set "NPM_CMD="

for /f "delims=" %%I in ('where npm.cmd 2^>nul') do (
  if not defined NPM_CMD set "NPM_CMD=%%I"
)

if not defined NPM_CMD if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPM_CMD if exist "%ProgramFiles(x86)%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles(x86)%\nodejs\npm.cmd"
if not defined NPM_CMD if exist "%LocalAppData%\Programs\nodejs\npm.cmd" set "NPM_CMD=%LocalAppData%\Programs\nodejs\npm.cmd"

if not defined NPM_CMD (
  echo Node.js npm launcher could not be found.
  echo.
  echo Install Node.js 18+ from https://nodejs.org/ and make sure the installer adds Node.js to PATH.
  echo You can also verify with: where node
  pause
  exit /b 1
)

echo Starting CiFi Optimization Suite debug launcher...
echo.
echo Local URL: http://localhost:4173
echo Press Ctrl+C in this window to stop the server.
echo.
echo For normal double-click use without a terminal window, use launch-cifi.vbs
echo.
echo Using npm at: %NPM_CMD%
echo.

"%NPM_CMD%" run dev
