@echo off
echo [MDA Backup] Iniciando copia de seguridad de la base de datos...

:: 1. Obtenemos la fecha actual para el nombre del archivo (ej. 18-05-2026)
set FECHA=%DATE:/=-%
set FECHA=%FECHA: =_%

:: 2. Definimos dónde está la DB original y dónde queremos guardarla
set RUTA_ORIGEN=%~dp0..\database\mda.db
if not exist "%RUTA_ORIGEN%" (
    echo [MDA Backup] ERROR: No se encontro la base de datos de origen: %RUTA_ORIGEN%
    exit /b 1
)
set RUTA_DESTINO_LOCAL="%~dp0..\..\correo-argentino-mda-database-backup\database\mda_backup_%FECHA%.db"
:: set RUTA_DESTINO_RED="\\servidor-correo\backups\mda_backup_%FECHA%.db" (Descomentar si tienen red)

:: 3. Creamos la carpeta local si no existe
if not exist "%~dp0..\..\correo-argentino-mda-database-backup\database\" mkdir "%~dp0..\..\correo-argentino-mda-database-backup\database"

:: 4. Hacemos la copia
copy "%RUTA_ORIGEN%" %RUTA_DESTINO_LOCAL% /Y
if errorlevel 1 (
    echo [MDA Backup] ERROR: No se pudo crear la copia de seguridad.
    exit /b 1
)

echo [MDA Backup] Copia de seguridad completada con exito: %RUTA_DESTINO_LOCAL%