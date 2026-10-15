@echo off
title Untrack developer scripts (run once)
cd /d "%~dp0"
set "GIT=%~dp0PortableGit\bin\git.exe"

echo ===================================================
echo   Stop sending Push.bat and Run_Comparison.bat
echo   to GitHub (run this ONCE on the developer PC)
echo ===================================================
echo.

if not exist "%GIT%" (
    echo [Error] PortableGit not found.
    pause
    exit /b 1
)

if not exist ".git" (
    echo [Error] No .git folder here.
    echo         Run this file in your developer folder, next to Push.bat.
    pause
    exit /b 1
)

:: Step 1: add both files to .gitignore (only if missing)
echo [1/3] Updating .gitignore...
findstr /x /c:"Push.bat" ".gitignore" >nul 2>&1
if errorlevel 1 (
    echo.>>".gitignore"
    echo Push.bat>>".gitignore"
    echo   Added: Push.bat
) else (
    echo   Already there: Push.bat
)
findstr /x /c:"Run_Comparison.bat" ".gitignore" >nul 2>&1
if errorlevel 1 (
    echo Run_Comparison.bat>>".gitignore"
    echo   Added: Run_Comparison.bat
) else (
    echo   Already there: Run_Comparison.bat
)
echo.

:: Step 2: stop tracking them (files stay on this PC, they are NOT deleted)
echo [2/3] Removing them from Git tracking (local files are kept)...
"%GIT%" rm --cached --ignore-unmatch Push.bat Run_Comparison.bat
echo.

:: Step 3: show result
echo [3/3] Current status:
echo ----------------------------------------
"%GIT%" status --short
echo ----------------------------------------
echo.
echo Done. You should see "D  Push.bat" and "D  Run_Comparison.bat" above.
echo ("D" here only means: removed from GitHub - your local files are safe.)
echo.
echo NEXT STEP: run Push.bat as usual to send this change to GitHub.
echo.
pause
