@echo off
chcp 65001 >nul
title CourseMind 课件智析

echo.
echo   🧠 课件智析 CourseMind
echo   ========================
echo.

cd /d "C:\Users\Administrator\Desktop\course-mind\backend"

echo   🔧 正在启动后端服务...
start "" /B "C:\Users\Administrator\Desktop\course-mind\venv\Scripts\python.exe" "C:\Users\Administrator\Desktop\course-mind\backend\app.py"

echo   🌐 正在打开浏览器...
timeout /t 3 /nobreak >nul
start "" http://localhost:5000

echo.
echo   ✅ 服务已启动！按任意键关闭此窗口（不影响后端运行）
echo   📍 访问地址：http://localhost:5000
echo.
pause >nul
