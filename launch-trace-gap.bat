@echo off
setlocal
cd /d "%~dp0"

title CiFi Trace Gap Launcher
set START_TIME=%DATE% %TIME%
echo ============================================================
echo  CiFi Trace Gap Launcher
echo  V2 graph-obligation preflight and execution
echo ============================================================
echo.
echo Started: %START_TIME%
echo Mode: refresh V2 obligations, then execute the next graph question
echo.
echo [1/2] Preflight plan
title CiFi Trace Gap Launcher - Preflight
echo This step can take longer when the selected obligation needs graph refresh.
python scripts\unity\unity_trace_bundle_v2.py run-best-gap-v2 --dry-run %*
set PRECHECK_EXIT=%ERRORLEVEL%

echo.
if not "%PRECHECK_EXIT%"=="0" (
  echo Preflight failed with exit code %PRECHECK_EXIT%.
  echo Trace gap launcher did not start the execution run.
  pause
  exit /b %PRECHECK_EXIT%
)

echo [2/2] Execute selected gap
title CiFi Trace Gap Launcher - Execute
python scripts\unity\unity_trace_bundle_v2.py run-best-gap-v2 %*
set EXIT_CODE=%ERRORLEVEL%

echo.
if not "%EXIT_CODE%"=="0" (
  echo Trace gap launcher failed with exit code %EXIT_CODE%.
) else (
  echo Trace gap launcher completed successfully.
)
echo Finished: %DATE% %TIME%

pause
exit /b %EXIT_CODE%
