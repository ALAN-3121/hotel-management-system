@echo off
chcp 936 >nul
setlocal
title 云栖酒店客房管理系统 - 本地演示
cd /d "%~dp0"

echo ==================================================
echo    云栖酒店客房管理系统   本地演示
echo ==================================================
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

echo   [1/3] Node.js  %NODE_EXE%

if not exist "node_modules\express" (
  echo   [2/3] 首次运行，正在安装依赖，请稍候...
  call npm install --omit=dev
  if errorlevel 1 (
    echo.
    echo   [错误] 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
) else (
  echo   [2/3] 依赖已就绪
)

if not exist "data\hotel.db" (
  echo         首次运行，正在初始化演示数据...
  "%NODE_EXE%" --experimental-sqlite db\init.js
)

echo   [3/3] 正在启动服务，3 秒后自动打开浏览器
echo.
echo   访问地址   http://localhost:3000
echo   管理员     admin     / 123456
echo   普通用户   chenjing  / 123456   ^(金卡会员^)
echo   普通用户   zhangxy   / 123456
echo.
echo   关闭本窗口即可停止服务。
echo   ------------------------------------------------
echo.

start "" /min cmd /c "timeout /t 3 >nul & start http://localhost:3000"

"%NODE_EXE%" --experimental-sqlite server.js

echo.
echo   服务已停止。
pause
