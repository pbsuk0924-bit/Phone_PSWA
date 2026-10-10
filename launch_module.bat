@echo off
setlocal
set "APP_ROOT=%~dp0"
set "MODULE_PAGE=%~1"
if not defined MODULE_PAGE (
  echo Usage: launch_module.bat index.html ^| drafting.html ^| review.html
  pause
  exit /b 2
)

set "PY_CMD=python"
where python >nul 2>nul
if errorlevel 1 (
  where py >nul 2>nul
  if errorlevel 1 (
    echo Python 3 was not found. Install Python 3, then run setup_dependencies.bat.
    pause
    exit /b 1
  )
  set "PY_CMD=py -3"
)

cd /d "%APP_ROOT%"
%PY_CMD% -c "import docx" >nul 2>nul
if errorlevel 1 (
  echo Required package python-docx is missing.
  echo Run setup_dependencies.bat once, then retry.
  pause
  exit /b 1
)

powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8000/api/status' -TimeoutSec 1; if ($r.StatusCode -ne 200) { exit 1 } } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
  echo Starting the shared local server...
  start "Patent Workbench Server" /min cmd /c "cd /d ""%APP_ROOT%"" && %PY_CMD% run_server.py"
  for /l %%i in (1,1,10) do (
    powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8000/api/status' -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
    if not errorlevel 1 goto server_ready
    timeout /t 1 /nobreak >nul
  )
  echo The local server did not start. Check Python setup and port 8000.
  pause
  exit /b 1
)

:server_ready
start "" "http://127.0.0.1:8000/%MODULE_PAGE%"
endlocal
