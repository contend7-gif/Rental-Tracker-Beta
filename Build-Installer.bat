@echo off
setlocal
cd /d "%~dp0"

echo [1/3] Installing dependencies...
call npm install
if errorlevel 1 (
  echo Failed to install dependencies.
  pause
  exit /b 1
)

echo [2/3] Building Windows installer...
call npm run desktop:dist
if errorlevel 1 (
  echo Installer build failed.
  pause
  exit /b 1
)

echo [3/3] Build complete. Looking for installer...
for /f "delims=" %%F in ('dir /b /a-d /o-d "%cd%\release\*Setup*.exe" 2^>nul') do (
  echo Launching installer: %%F
  start "" "%cd%\release\%%F"
  echo Installer launched.
  pause
  exit /b 0
)

echo Installer .exe was not found in "%cd%\release".
echo Opening release folder instead.
start "" "%cd%\release"
pause
exit /b 1
