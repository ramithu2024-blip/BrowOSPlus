@echo off
setlocal

set "ROOT=%~dp0"
set "PORT=8787"
if not "%PORT%"=="" set "PORT=%PORT%"

set "STATIC_DIR=%ROOT%"
start "" "%ROOT%proxy\bin\browos-backend-windows-amd64.exe"

timeout /t 2 /nobreak >nul

start "" "http://127.0.0.1:8787/"

echo BrowOS+ is running. Press any key to stop the backend...
pause >nul

taskkill /IM browos-backend-windows-amd64.exe >nul 2>&1
endlocal