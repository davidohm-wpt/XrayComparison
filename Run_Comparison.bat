@echo off
title WIPOTEC X-Ray Comparison - Launcher
setlocal enabledelayedexpansion
cd /d "%~dp0"

:: ============================================================
:: Configuration
:: ============================================================
set "GITHUB_REPO=https://github.com/davidohm-wpt/XrayComparison.git"
set "GITHUB_BRANCH=main"
set "ROOT=%~dp0"
set "REPO=!ROOT!repo"
set "GITLOG=!ROOT!_git.log"
set "PORT=8080"

echo ===================================================
echo   WIPOTEC X-Ray Comparison Tool
echo ===================================================
echo.

:: Developer machine: this folder is itself a git repository
set "DEV_MODE=0"
if exist "!ROOT!.git" set "DEV_MODE=1"

:: ============================================================
:: Find PortableGit (not needed on developer machine)
:: ============================================================
set "GIT_EXE="
if "!DEV_MODE!"=="1" goto :git_done

if exist "!ROOT!PortableGit\bin\git.exe" (
    set "GIT_EXE=!ROOT!PortableGit\bin\git.exe"
    echo [Git] Using local PortableGit
) else if exist "!ROOT!..\PortableGit\bin\git.exe" (
    set "GIT_EXE=!ROOT!..\PortableGit\bin\git.exe"
    echo [Git] Using parent PortableGit
) else if exist "!ROOT!..\XRPV_Generator\PortableGit\bin\git.exe" (
    set "GIT_EXE=!ROOT!..\XRPV_Generator\PortableGit\bin\git.exe"
    echo [Git] Using XRPV_Generator PortableGit
) else (
    where git >nul 2>&1
    if !errorlevel! equ 0 (
        set "GIT_EXE=git"
        echo [Git] Using system Git
    )
)

if "!GIT_EXE!"=="" (
    echo.
    echo [Error] PortableGit not found!
    echo Expected at: !ROOT!PortableGit\bin\git.exe
    echo.
    pause
    exit /b 1
)
:git_done

:: ============================================================
:: Download / update from GitHub
:: ============================================================
echo.
echo ===================================================
echo   Checking for updates from GitHub...
echo ===================================================
echo.

if "!DEV_MODE!"=="1" (
    echo [Dev] Git repository detected in this folder.
    echo       Using local files - no update from GitHub.
    set "SRC=!ROOT!"
    goto :update_done
)

set "SRC=!REPO!\"

if exist "!REPO!\.git" (
    :: Repo already downloaded - fetch the latest version
    "!GIT_EXE!" -C "!REPO!" fetch --depth 1 origin !GITHUB_BRANCH! >"!GITLOG!" 2>&1
    if !errorlevel! neq 0 (
        echo [Warning] Cannot reach GitHub - using the local copy.
    ) else (
        "!GIT_EXE!" -C "!REPO!" reset --hard FETCH_HEAD >>"!GITLOG!" 2>&1
        if !errorlevel! neq 0 (
            echo [Warning] git reset failed - using the local copy.
        ) else (
            echo Update completed.
        )
    )
) else (
    :: First time - clone the repository
    echo First time setup - downloading from GitHub...
    echo This may take 5-10 seconds.

    if exist "!REPO!" rmdir /s /q "!REPO!"

    "!GIT_EXE!" clone --depth 1 --branch !GITHUB_BRANCH! "!GITHUB_REPO!" "!REPO!" >"!GITLOG!" 2>&1
    if !errorlevel! neq 0 (
        echo.
        echo [Error] Cannot clone from GitHub!
        echo Please check your internet connection.
        echo.
        echo --- git output ---
        type "!GITLOG!"
        echo.
        pause
        exit /b 1
    )
    echo Initial download completed.
)

:update_done

:: Make sure the web files exist
if not exist "!SRC!web\index.html" (
    echo.
    echo [Error] web\index.html not found!
    echo Download may have failed. Please try again.
    echo.
    pause
    exit /b 1
)

:: Remove the old "web" folder left by previous versions (no longer used).
:: Only runs on sales machines, and only after the new files are confirmed above.
if "!DEV_MODE!"=="0" (
    if exist "!ROOT!web\" (
        rmdir /s /q "!ROOT!web" >nul 2>&1
        if exist "!ROOT!web\" (
            echo [Info] Could not delete the old "web" folder - you can delete it manually.
        ) else (
            echo [Info] Old "web" folder removed.
        )
    )
)

:: ============================================================
:: Find Python
:: ============================================================
set "PYTHON_EXE="
if exist "!ROOT!PythonPortable\python.exe" (
    set "PYTHON_EXE=!ROOT!PythonPortable\python.exe"
    echo [Python] Using local Portable Python
) else if exist "!ROOT!..\PythonPortable\python.exe" (
    set "PYTHON_EXE=!ROOT!..\PythonPortable\python.exe"
    echo [Python] Using parent Portable Python
) else if exist "!ROOT!..\XRPV_Generator\PythonPortable\python.exe" (
    set "PYTHON_EXE=!ROOT!..\XRPV_Generator\PythonPortable\python.exe"
    echo [Python] Using XRPV_Generator Portable Python
) else (
    where python >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_EXE=python"
        echo [Python] Using system Python
    ) else (
        where py >nul 2>&1
        if !errorlevel! equ 0 (
            set "PYTHON_EXE=py"
            echo [Python] Using system Python ^(py launcher^)
        ) else (
            echo.
            echo [Error] Python not found!
            echo Expected at: !ROOT!PythonPortable\python.exe
            echo.
            pause
            exit /b 1
        )
    )
)

:: ============================================================
:: Start server
:: ============================================================
echo.
echo ===================================================
echo   Starting server...
echo ===================================================
echo.
echo   To STOP the server: close this window.
echo.

if exist "!SRC!serve.py" (
    :: serve.py: localhost only, no-cache, picks a free port, opens the browser
    "!PYTHON_EXE!" "!SRC!serve.py"
) else (
    echo [Info] serve.py not found - using the basic server on port !PORT!.
    echo        A browser will open in 2 seconds.
    start "" cmd /c "timeout /t 2 >nul & start http://localhost:%PORT%"
    pushd "!SRC!web"
    "!PYTHON_EXE!" -m http.server !PORT! --bind 127.0.0.1
    popd
)

echo.
echo Server stopped.
pause