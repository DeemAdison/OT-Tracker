@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ระบบบันทึกและคำนวณเงิน OT

:: Search for Microsoft Edge or Google Chrome
set "BROWSER="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"
)

:: Fixed port to ensure constant Web Origin and persistent LocalStorage across runs
set "PORT=53123"

:: Terminate any stale previous server on this port
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:%PORT%/__exit__' -TimeoutSec 1 } catch {}" >nul 2>&1

:: Start local web server in background silently
start /b "" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port %PORT% -DistPath "%~dp0dist"

:: Wait brief moment for server to listen
timeout /t 1 /nobreak >nul

set "APP_URL=http://127.0.0.1:%PORT%"
set "USER_DATA=%LOCALAPPDATA%\OT_Tracker\UserData"

if defined BROWSER (
    :: Run Edge/Chrome in Native Standalone App Window Mode
    start "" /wait "%BROWSER%" --app="%APP_URL%" --window-size=1260,860 --app-id="OT_Tracker" --user-data-dir="%USER_DATA%"
) else (
    :: Fallback to default browser
    start "" "%APP_URL%"
)

:: Terminate background server gracefully on window exit
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:%PORT%/__exit__' -TimeoutSec 1 } catch {}"
exit /b
