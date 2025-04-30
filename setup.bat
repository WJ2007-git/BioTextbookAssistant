@echo off
:: 生物课本检索系统 - 自动化安装脚本
:: 版本：1.2
:: 功能：自动安装依赖并初始化系统

SETLOCAL EnableDelayedExpansion

:: 1. 获取脚本所在路径
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: 2. 检查Python环境
echo [1/4] 检查Python环境...
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 错误：未检测到Python，请先安装Python 3.8+
    echo 可从官网下载：https://www.python.org/downloads/
    pause
    exit /b 1
)

:: 3. 安装依赖
echo [2/4] 安装Python依赖...
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
echo [3/4] 创建系统目录...
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
echo [4/4] 检查OCR组件...
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

:: 完成提示
echo.
echo ========================================
echo 安装完成！请按以下步骤操作：
echo 1. 确保Tesseract和Poppler已加入系统PATH
echo 2. 运行启动命令：uvicorn app:app --reload
echo 3. 浏览器访问 http://localhost:8000
echo ========================================
pause
