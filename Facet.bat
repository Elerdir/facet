@echo off
rem ── Launcher pro Facet ────────────────────────────────────────────────
rem Dvojklik spustí appku. Když release build ještě neexistuje, jednou ho
rem sestaví (chvíli to potrvá), pak už se spouští okamžitě bez konzole.

set "EXE=%~dp0src-tauri\target\release\facet.exe"

if exist "%EXE%" (
    start "" "%EXE%"
    exit /b 0
)

echo Sestavuji Facet (jen poprve, par minut)...
cd /d "%~dp0"
call npm run tauri build -- --no-bundle
if exist "%EXE%" (
    start "" "%EXE%"
) else (
    echo.
    echo Sestaveni se nezdarilo. Spust v projektu: npm run tauri dev
    pause
)
