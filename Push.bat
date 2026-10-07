@echo off
title Push to GitHub - XrayComparison
cd /d "%~dp0"
set GIT=%~dp0PortableGit\bin\git.exe

echo ===================================================
echo   Push to GitHub - XrayComparison
echo ===================================================
echo.

if not exist "%GIT%" (
    echo [Error] PortableGit not found.
    pause
    exit /b 1
)

:: --- Step 1: Status check ---
echo [1/5] Checking status...
"%GIT%" status --short
echo.

:: --- Step 2: Add all changes ---
echo [2/5] Staging changes...
"%GIT%" add -A
echo.

:: --- Step 3: Commit ---
echo [3/5] Committing...
set /p COMMIT_MSG="Commit message: "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Auto-update
"%GIT%" commit -m "%COMMIT_MSG%"
if %errorlevel% neq 0 (
    echo.
    echo [Info] Nothing to commit or commit failed.
    echo.
    pause
    exit /b 0
)
echo.

:: --- Step 4: Pull (rebase) with safer approach ---
echo [4/5] Fetching latest from GitHub...
"%GIT%" fetch origin main
if %errorlevel% neq 0 (
    echo [Warning] Cannot reach GitHub.
    echo Continuing with push anyway...
) else (
    :: Try rebase, but if it fails, abort safely
    "%GIT%" rebase origin/main
    if %errorlevel% neq 0 (
        echo.
        echo [Warning] Rebase conflict detected. Aborting rebase...
        "%GIT%" rebase --abort
        echo [Info] Local files preserved. Manual merge needed.
        echo.
        pause
        exit /b 1
    )
)
echo.

:: --- Step 5: Push ---
echo [5/5] Pushing to GitHub...
"%GIT%" push origin main
if %errorlevel% neq 0 (
    echo.
    echo [Error] Push failed. Check message above.
    echo [Tip] Try running: git pull --rebase origin main
    pause
    exit /b 1
)

echo.
echo ===================================================
echo   SUCCESS! Pushed to GitHub.
echo ===================================================
timeout /t 3