@echo off
:: 生物课本检索系统 - 自动化安装及运行脚本
:: 功能：自动安装依赖、初始化系统并启动服务

SETLOCAL EnableDelayedExpansion

:: 1. 获取脚本所在路径
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"
title 生物课本检索系统控制台

:: 2. 检查Python环境
echo [1/5] 检查Python环境...
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 错误：未检测到Python，请先安装Python 3.8+
    echo 可从官网下载：https://www.python.org/downloads/
    pause
    exit /b 1
)

:: 3. 安装依赖
echo [2/5] 安装Python依赖...
set "REQ_FILE=requirements.txt"
if not exist "%REQ_FILE%" (
    echo 错误：找不到%REQ_FILE%
    echo 请确保脚本与requirements.txt在同一目录
    pause
    exit /b 1
)

python -m pip install --upgrade pip
if %ERRORLEVEL% neq 0 (
    echo 错误：pip升级失败
    pause
    exit /b 1
)

pip install -r "%REQ_FILE%"
if %ERRORLEVEL% neq 0 (
    echo 错误：依赖安装失败
    pause
    exit /b 1
)

:: 4. 创建必要目录
echo [3/5] 创建系统目录...
set "DIRS=static\pages static\thumbs uploads"

for %%d in (%DIRS%) do (
    if not exist "%%d" (
        mkdir "%%d"
        echo 创建目录：%%d
    ) else (
        echo 目录已存在：%%d
    )
)

:: 5. 检查OCR组件
echo [4/5] 检查OCR组件...
where tesseract >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 警告：未找到Tesseract OCR
    echo 建议安装：https://github.com/UB-Mannheim/tesseract/wiki
    echo 或运行：choco install tesseract -y
)

where pdftoppm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 警告：未找到Poppler工具包
    echo 建议安装：https://blog.alivate.com.au/poppler-windows/
    echo 或运行：choco install poppler -y
)

:: 6. 启动服务
echo [5/5] 启动服务...
echo ========================================
echo 服务已启动：http://localhost:8000
echo 按 Ctrl+C 停止服务
echo 或在此窗口按任意键关闭
echo ========================================

:: 启动服务并保持窗口
start "" /B "cmd.exe" /C "uvicorn app:app --reload && pause"

:: 等待用户按键关闭
timeout /t 3 >nul
start "" "http://localhost:8000"
pause >nul

:: 查找并结束uvicorn进程
taskkill /F /IM uvicorn.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1

echo 服务已停止
timeout /t 3 >nul
