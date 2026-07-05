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

echo Starting All Quality Gutters local review site...
echo.
echo Open this address if the browser does not open automatically:
echo http://127.0.0.1:8032/
echo.
echo Use the Pravki button on the page to leave visual notes.
echo.

start "" "http://127.0.0.1:8032/"
set AQG_REVIEW_PORT=8032
python scripts\review_server.py
