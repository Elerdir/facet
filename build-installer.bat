@echo off
rem ── Sestaveni plnohodnotnych instalatoru Facet pro Windows ──────────────
rem Vysledkem je NSIS setup .exe a .msi v src-tauri\target\release\bundle\

cd /d "%~dp0"

if exist node_modules (
    echo [1/2] Zavislosti uz jsou nainstalovane - preskakuji.
) else (
    echo [1/2] Instalace zavislosti...
    call npm install
    if errorlevel 1 goto :fail
)

echo [2/2] Sestaveni aplikace a instalatoru (release, par minut)...
call npm run tauri build
if errorlevel 1 goto :fail

echo.
echo ========================================================
echo  Hotovo! Instalatory najdes v:
echo    src-tauri\target\release\bundle\nsis\   (setup .exe)
echo    src-tauri\target\release\bundle\msi\    (.msi)
echo ========================================================
start "" "%~dp0src-tauri\target\release\bundle"
pause
exit /b 0

:fail
echo.
echo Sestaveni selhalo - zkontroluj vystup vyse.
pause
exit /b 1
