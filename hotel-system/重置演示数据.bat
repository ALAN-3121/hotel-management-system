@echo off
chcp 936 >nul
setlocal
title 重置演示数据
cd /d "%~dp0"

echo ==================================================
echo    重置演示数据
echo ==================================================
echo.
echo   会清空现有订单，恢复为初始的 14 条演示订单、
echo   20 间客房与 6 个测试账号。
echo.

set "NODE_EXE="
where node >nul 2>nul
if %errorlevel%==0 set "NODE_EXE=node"

if not defined NODE_EXE (
  for /d %%D in ("%USERPROFILE%\.workbuddy-ai\binaries\node\versions\*") do (
    if exist "%%D\node.exe" set "NODE_EXE=%%D\node.exe"
  )
)
if not defined NODE_EXE (
  for /d %%D in ("C:\Program Files\nodejs") do (
    if exist "%%D\node.exe" set "NODE_EXE=%%D\node.exe"
  )
)

if not defined NODE_EXE (
  echo.
  echo   [错误] 没有找到 Node.js 运行环境。
  echo.
  echo   这个项目需要 Node.js 才能运行，有两种解决办法：
  echo.
  echo     1. 安装 Node.js（推荐，一次装好永久可用）
  echo        下载地址  https://nodejs.org/zh-cn
  echo        安装时保持默认选项，装完重新双击本文件即可。
  echo.
  echo     2. 如果电脑里已经有 node.exe
  echo        把 node.exe 所在目录加入系统环境变量 PATH，再重新运行。
  echo.
  pause
  exit /b 1
)

for %%P in ("%NODE_EXE%") do set "NODE_DIR=%%~dpP"
set "PATH=%NODE_DIR%;%PATH%"

echo   正在重置数据库...
echo.

tasklist /fi "imagename eq node.exe" 2>nul | find /i "node.exe" >nul
if %errorlevel%==0 (
  echo   [提示] 检测到 node.exe 正在运行。
  echo          如果演示服务还开着，请先关闭那个窗口，
  echo          否则重置后的数据不会生效。
  echo.
  pause
)

"%NODE_EXE%" --experimental-sqlite db\init.js

echo.
echo   完成。双击「启动演示.bat」即可重新演示。
pause
