@echo off
setlocal
cd /d "%~dp0"
set "PY_CMD=python"
where python >nul 2>nul
if errorlevel 1 (
  where py >nul 2>nul
  if errorlevel 1 (
    echo Python 3 was not found. Install Python 3 first.
    pause
    exit /b 1
  )
  set "PY_CMD=py -3"
)
%PY_CMD% -m pip install -r requirements.txt
if errorlevel 1 (
  echo Dependency installation failed. Check your internet connection and Python pip setup.
  pause
  exit /b 1
)
echo Dependencies are installed. You can now start any module.
pause
endlocal
