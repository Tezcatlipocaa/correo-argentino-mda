@echo off
setlocal
cd /d "%~dp0.."

set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"

net session >nul 2>&1
if errorlevel 1 (
    echo [MDA Auto-Deploy] ERROR: Este script requiere privilegios de Administrador para operar PM2 y modulos nativos.
    exit /b 1
)

call npx tsx scripts/safe-deploy.mts %*
exit /b %ERRORLEVEL%
