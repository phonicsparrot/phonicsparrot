@echo off
title Phonics Parrot
echo.
echo    🦜  Phonics Parrot — Digital Learning Suite
echo    ==========================================
echo.

:: Use bundled Node.js if present, otherwise fall back to system node
if exist "%~dp0bin\node.exe" (
    set NODE_EXE=%~dp0bin\node.exe
) else (
    set NODE_EXE=node
)

echo    Starting server...
echo.

:: Launch browser after a 2-second delay in background
start /b cmd /c "ping 127.0.0.1 -n 3 >nul && start http://127.0.0.1:3000"

:: Start node server in foreground
"%NODE_EXE%" "%~dp0server.js"
pause
