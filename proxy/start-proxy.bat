@echo off
setlocal
set "ROOT=%~dp0"
start "" "%ROOT%bin\browos-backend-windows-amd64.exe"
echo Proxy running on http://127.0.0.1:8787
pause
taskkill /IM browos-backend-windows-amd64.exe >nul 2>&1
endlocal
