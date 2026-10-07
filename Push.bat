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

:: ============================================================
:: Step 1: Show status
:: ============================================================
echo [1/6] Checking status...
echo ----------------------------------------
"%GIT%" status --short
echo ----------------------------------------
echo.

:: ============================================================
:: Step 2: Stage changes
:: ============================================================
echo [2/6] Staging changes...
"%GIT%" add -A
echo.

:: ============================================================
:: Step 3: Commit
:: ============================================================
echo [3/6] Committing...
set /p COMMIT_MSG="Commit message: "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Auto-update
"%GIT%" commit -m "%COMMIT_MSG%"
if %errorlevel% neq 0 (
    echo.
    echo [Info] Nothing to commit or commit failed.
    echo        Nothing to push.
    echo.
    pause
    exit /b 0
)
echo.

:: ============================================================
:: Step 4: Fetch from GitHub (safe)
:: ============================================================
echo [4/6] Fetching latest from GitHub...
"%GIT%" fetch origin main
if %errorlevel% neq 0 (
    echo [Warning] Cannot reach GitHub.
    echo           Continuing with push anyway...
    echo.
    goto :push
)
echo.

:: ============================================================
:: Step 5: Rebase with safety
:: ============================================================
echo [5/6] Rebasing on top of origin/main...
"%GIT%" rebase origin/main
if %errorlevel% neq 0 (
    echo.
    echo [Warning] Rebase conflict detected!
    echo           Aborting rebase - local files preserved.
    echo.
    "%GIT%" rebase --abort
    echo [Info] Your local files are safe.
    echo        Please resolve conflicts manually or contact support.
    echo.
    pause
    exit /b 1
)
echo.

:: ============================================================
:: Step 6: Push
:: ============================================================
:push
echo [6/6] Pushing to GitHub...
"%GIT%" push origin main
if %errorlevel% neq 0 (
    echo.
    echo [Error] Push failed. Check message above.
    echo.
    echo [Tip] Try running this command manually:
    echo       PortableGit\bin\git.exe push origin main --force
    echo.
    pause
    exit /b 1
)

echo.
echo ===================================================
echo   SUCCESS! Pushed to GitHub.
echo ===================================================
timeout /t 3