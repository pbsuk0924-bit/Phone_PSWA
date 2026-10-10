@echo off
setlocal
call "%~dp0launch_module.bat" index.html
timeout /t 1 /nobreak >nul
call "%~dp0launch_module.bat" drafting.html
timeout /t 1 /nobreak >nul
call "%~dp0launch_module.bat" review.html
endlocal
