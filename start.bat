@echo off
:: Presentation Forge — Windows launcher
:: Double-click this file or run from cmd.exe

title Presentation Forge

:: Check PowerShell is available (it is on every Windows 7+)
where powershell >nul 2>&1
if errorlevel 1 (
    echo ERROR: PowerShell not found. Please install it.
    pause
    exit /b 1
)

:: Run the PowerShell script, temporarily allowing local scripts to execute
:: (does not change system-wide policy)
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0start.ps1"

if errorlevel 1 (
    echo.
    echo Something went wrong. See messages above.
    pause
)
