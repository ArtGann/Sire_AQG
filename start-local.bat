@echo off
setlocal

cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel% neq 0 (
  echo Python was not found. Opening index.html directly instead.
  start "" "%~dp0index.html"
  pause
  exit /b 0
)

echo Starting All Quality Gutters local site...
echo.
echo Open this address if the browser does not open automatically:
echo http://127.0.0.1:8027/
echo.

start "" "http://127.0.0.1:8027/"
python -m http.server 8027 --bind 127.0.0.1

