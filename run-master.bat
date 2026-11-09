@echo off
title Industrial CRM Master (Port 3000)
echo Starting Backend on http://127.0.0.1:8000 ...
start "Industrial CRM Backend" cmd /k "cd /d %~dp0backend && php artisan serve --host=127.0.0.1 --port=8000"
echo Starting Frontend on http://127.0.0.1:3000 ...
start "Industrial CRM Frontend" cmd /k "cd /d %~dp0frontend && npm run dev -- --host 127.0.0.1 --port 3000"
echo CRM Master is running at http://localhost:3000
pause
