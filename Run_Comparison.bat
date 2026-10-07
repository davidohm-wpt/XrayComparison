@echo off
title WIPOTEC X-Ray Comparison - Launcher
setlocal enabledelayedexpansion
cd /d "%~dp0"

:: ============================================================
:: Configuration
:: ============================================================
set GITHUB_REPO=https://github.com/davidohm-wpt/XrayComparison.git
set GITHUB_BRANCH=main
set WEB_DIR=%~dp0web
set PORT=8080

echo ===================================================
echo   WIPOTEC X-Ray Comparison Tool
echo ===================================================
echo.

:: ============================================================
:: Find PortableGit
:: ============================================================
set GIT_EXE=
if exist "%~dp0PortableGit\bin\git.exe" (
    set GIT_EXE=%~dp0PortableGit\bin\git.exe
    echo [Git] Using local PortableGit
) else if exist "%~dp0..\PortableGit\bin\git.exe" (
    set GIT_EXE=%~dp0..\PortableGit\bin\git.exe
    echo [Git] Using parent PortableGit
) else if exist "%~dp0..\XRPV_Generator\PortableGit\bin\git.exe" (
    set GIT_EXE=%~dp0..\XRPV_Generator\PortableGit\bin\git.exe
    echo [Git] Using XRPV_Generator PortableGit
) else (
    where git >nul 2>&1
    if !errorlevel! equ 0 (
        set GIT_EXE=git
        echo [Git] Using system Git
    )
)

:: ============================================================
:: Download/Update web files from GitHub
:: ============================================================
if "!GIT_EXE!"=="" (
    echo.
    echo [Error] PortableGit not found!
    echo Expected at: %~dp0PortableGit\bin\git.exe
    echo.
    pause
    exit /b 1
)

echo.
echo ===================================================
echo   Checking for updates from GitHub...
echo ===================================================
echo.

if exist "!WEB_DIR!\.git" (
    :: มี .git → pull
    pushd "!WEB_DIR!"
    "!GIT_EXE!" fetch origin !GITHUB_BRANCH! >nul 2>&1
    if !errorlevel! neq 0 (
        echo [Warning] Cannot reach GitHub - using local files.
    ) else (
        "!GIT_EXE!" reset --hard origin/!GITHUB_BRANCH! >nul 2>&1
        if !errorlevel! neq 0 (
            echo [Warning] git reset failed - using local files.
        ) else (
            echo Update completed.
        )
    )
    popd
) else (
    :: ยังไม่มี → clone ครั้งแรก
    echo First time setup - downloading from GitHub...
    echo This may take 5-10 seconds.
    if exist "!WEB_DIR!" rmdir /s /q "!WEB_DIR!"
    "!GIT_EXE!" clone --depth 1 --branch !GITHUB_BRANCH! !GITHUB_REPO! "!WEB_DIR!" >nul 2>&1
    if !errorlevel! neq 0 (
        echo.
        echo [Error] Cannot clone from GitHub!
        echo Please check your internet connection.
        echo.
        pause
        exit /b 1
    )
    echo Initial download completed.
)

:: ตรวจสอบว่า web/index.html มีอยู่จริง
if not exist "!WEB_DIR!\index.html" (
    echo.
    echo [Error] web\index.html not found!
    echo Download may have failed. Please try again.
    echo.
    pause
    exit /b 1
)

:: ============================================================
:: Find Python
:: ============================================================
set PYTHON_CMD=
if exist "%~dp0PythonPortable\python.exe" (
    set PYTHON_CMD="%~dp0PythonPortable\python.exe"
    echo [Python] Using local Portable Python
) else if exist "%~dp0..\PythonPortable\python.exe" (
    set PYTHON_CMD="%~dp0..\PythonPortable\python.exe"
    echo [Python] Using parent Portable Python
) else if exist "%~dp0..\XRPV_Generator\PythonPortable\python.exe" (
    set PYTHON_CMD="%~dp0..\XRPV_Generator\PythonPortable\python.exe"
    echo [Python] Using XRPV_Generator Portable Python
) else (
    where python >nul 2>&1
    if !errorlevel! equ 0 (
        set PYTHON_CMD=python
        echo [Python] Using system Python
    ) else (
        where py >nul 2>&1
        if !errorlevel! equ 0 (
            set PYTHON_CMD=py
            echo [Python] Using system Python ^(py launcher^)
        ) else (
            echo.
            echo [Error] Python not found!
            echo Expected at: %~dp0PythonPortable\python.exe
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
echo   Starting server at http://localhost:%PORT%
echo ===================================================
echo.
echo   A browser will open in 2 seconds.
echo   To STOP the server: close this window.
echo.

start "" cmd /c "timeout /t 2 >nul && start msedge http://localhost:%PORT%"

pushd "!WEB_DIR!"
!PYTHON_CMD! -m http.server %PORT%
popd

echo.
echo Server stopped.
pause