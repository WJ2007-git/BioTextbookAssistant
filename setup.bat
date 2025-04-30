@echo off
:: ����α�����ϵͳ - �Զ�����װ�����нű�
:: ���ܣ��Զ���װ��������ʼ��ϵͳ����������

SETLOCAL EnableDelayedExpansion

:: 1. ��ȡ�ű�����·��
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"
title ����α�����ϵͳ����̨

:: 2. ���Python����
echo [1/5] ���Python����...
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ����δ��⵽Python�����Ȱ�װPython 3.8+
    echo �ɴӹ������أ�https://www.python.org/downloads/
    pause
    exit /b 1
)

:: 3. ��װ����
echo [2/5] ��װPython����...
set "REQ_FILE=requirements.txt"
if not exist "%REQ_FILE%" (
    echo �����Ҳ���%REQ_FILE%
    echo ��ȷ���ű���requirements.txt��ͬһĿ¼
    pause
    exit /b 1
)

python -m pip install --upgrade pip
if %ERRORLEVEL% neq 0 (
    echo ����pip����ʧ��
    pause
    exit /b 1
)

pip install -r "%REQ_FILE%"
if %ERRORLEVEL% neq 0 (
    echo ����������װʧ��
    pause
    exit /b 1
)

:: 4. ������ҪĿ¼
echo [3/5] ����ϵͳĿ¼...
set "DIRS=static\pages static\thumbs uploads"

for %%d in (%DIRS%) do (
    if not exist "%%d" (
        mkdir "%%d"
        echo ����Ŀ¼��%%d
    ) else (
        echo Ŀ¼�Ѵ��ڣ�%%d
    )
)

:: 5. ���OCR���
echo [4/5] ���OCR���...
where tesseract >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ���棺δ�ҵ�Tesseract OCR
    echo ���鰲װ��https://github.com/UB-Mannheim/tesseract/wiki
    echo �����У�choco install tesseract -y
)

where pdftoppm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ���棺δ�ҵ�Poppler���߰�
    echo ���鰲װ��https://blog.alivate.com.au/poppler-windows/
    echo �����У�choco install poppler -y
)

:: 6. ��������
echo [5/5] ��������...
echo ========================================
echo ������������http://localhost:8000
echo �� Ctrl+C ֹͣ����
echo ���ڴ˴��ڰ�������ر�
echo ========================================

:: �������񲢱��ִ���
start "" /B "cmd.exe" /C "uvicorn app:app --reload && pause"

:: �ȴ��û������ر�
timeout /t 3 >nul
start "" "http://localhost:8000"
pause >nul

:: ���Ҳ�����uvicorn����
taskkill /F /IM uvicorn.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1

echo ������ֹͣ
timeout /t 3 >nul
