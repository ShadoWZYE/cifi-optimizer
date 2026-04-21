@echo off
setlocal
cd /d "%~dp0"

python scripts\unity\unity_trace_bundle.py --best-gap --level structured %*
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Trace gap launcher failed with exit code %EXIT_CODE%.
)

exit /b %EXIT_CODE%
