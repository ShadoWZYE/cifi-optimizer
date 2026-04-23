@echo off
setlocal
cd /d "%~dp0"

python scripts\unity\unity_trace_bundle.py --best-gap --level structured %*
set EXIT_CODE=%ERRORLEVEL%

echo.
if not "%EXIT_CODE%"=="0" (
  echo Trace gap launcher failed with exit code %EXIT_CODE%.
) else (
  echo Trace gap launcher completed successfully.
)

pause
exit /b %EXIT_CODE%
