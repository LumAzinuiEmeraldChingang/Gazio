@echo off
REM Start the Node server (server.js) in a new window and open the welcome page
cd /d "%~dp0"
echo Starting server from %cd%

REM Kill existing node processes to avoid port conflicts
taskkill /IM node.exe /F >nul 2>&1

REM Start server.js in a new cmd window
start "GAZIO Server" cmd /k "node server.js"

REM Wait a moment for the server to start
timeout /t 1 /nobreak >nul

REM Open the welcome page in the default browser
start "" "http://localhost:3000/"

echo Server started and welcome page opened.
exit /b 0
