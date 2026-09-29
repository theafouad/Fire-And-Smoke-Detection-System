@echo off
setlocal
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-all.ps1"
if errorlevel 1 (
  echo.
  echo FlameEye launcher exited with an error.
  pause
)
endlocal
