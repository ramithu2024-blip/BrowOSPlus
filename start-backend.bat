@echo off
cd /d "%~dp0backend"

if not exist node_modules (
  echo Installing backend dependencies...
  call npm install
)

echo Starting BrowOS+ backend on http://127.0.0.1:8787
set PORT=%PORT%
if "%PORT%"=="" set PORT=8787
set HOST=%HOST%
if "%HOST%"=="" set HOST=127.0.0.1
call npm start