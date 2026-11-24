@echo off
cd /d "%~dp0"
where npm >nul 2>nul || (echo Install Node.js 22.12 or newer first. & pause & exit /b 1)
if not exist node_modules\electron\path.txt (
  call npm ci --no-audit --no-fund || (pause & exit /b 1)
  node node_modules\electron\install.js || (pause & exit /b 1)
)
call npm start
