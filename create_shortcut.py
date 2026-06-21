"""
生成 CourseMind 桌面快捷方式（含图标）
"""
import os
import sys
import io

# Fix Windows encoding
if sys.platform == "win32":
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")
    except Exception:
        pass

from pathlib import Path

PROJECT_DIR = Path(__file__).parent
BACKEND_DIR = PROJECT_DIR / "backend"
FRONTEND_DIR = PROJECT_DIR / "frontend"
DESKTOP = Path.home() / "Desktop"

# ==========================================
# 1. 生成图标 (.ico)
# ==========================================
def create_icon():
    from PIL import Image, ImageDraw
    import math

    size = 256  # 用最大尺寸绘制，保存时自动生成各种尺寸
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = size * 0.08
    bg_color = (88, 86, 214)  # iOS purple
    radius = size * 0.22

    # 圆角矩形背景
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=radius,
        fill=bg_color
    )

    # 大脑图标
    cx, cy = size / 2, size / 2

    # 左半脑
    lx = cx - size * 0.18
    draw.ellipse(
        [lx - size*0.12, cy - size*0.2,
         lx + size*0.12, cy + size*0.2],
        fill=(255, 255, 255, 220),
        outline=(255, 255, 255, 255),
        width=max(1, size // 20)
    )
    # 右半脑
    rx = cx + size * 0.18
    draw.ellipse(
        [rx - size*0.12, cy - size*0.2,
         rx + size*0.12, cy + size*0.2],
        fill=(255, 255, 255, 220),
        outline=(255, 255, 255, 255),
        width=max(1, size // 20)
    )
    # 连接线
    draw.line(
        [lx + size*0.08, cy, rx - size*0.08, cy],
        fill=(255, 255, 255, 255),
        width=max(1, size // 16)
    )

    # 底部知识光点
    dot_r = max(2, size // 16)
    for angle in [225, 270, 315]:
        rad = math.radians(angle)
        dx = cx + (size * 0.28) * math.cos(rad)
        dy = cy + (size * 0.28) * math.sin(rad)
        draw.ellipse(
            [dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r],
            fill=(255, 255, 255, 200)
        )

    # 保存为 .ico（自动生成多种尺寸）
    ico_path = PROJECT_DIR / "coursemind.ico"
    icon_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(str(ico_path), format="ICO", sizes=icon_sizes)
    print(f"[OK] Icon created: {ico_path}")
    return ico_path


# ==========================================
# 2. 生成启动脚本 (.bat)
# ==========================================
def create_bat():
    bat_path = PROJECT_DIR / "start_coursemind.bat"
    venv_python = BACKEND_DIR.parent / "venv" / "Scripts" / "python.exe"

    bat_content = f'''@echo off
chcp 65001 >nul
title CourseMind 课件智析

echo.
echo   🧠 课件智析 CourseMind
echo   ========================
echo.

cd /d "{BACKEND_DIR}"

echo   🔧 正在启动后端服务...
start "" /B "{venv_python}" "{BACKEND_DIR / 'app.py'}"

echo   🌐 正在打开浏览器...
timeout /t 3 /nobreak >nul
start "" http://localhost:5000

echo.
echo   ✅ 服务已启动！按任意键关闭此窗口（不影响后端运行）
echo   📍 访问地址：http://localhost:5000
echo.
pause >nul
'''
    bat_path.write_text(bat_content, encoding="utf-8")
    print(f"[OK] Batch script: {bat_path}")
    return bat_path


# ==========================================
# 3. 创建桌面快捷方式 (.lnk)
# ==========================================
def create_lnk(target_path, icon_path):
    """使用 PowerShell 创建快捷方式"""
    lnk_path = DESKTOP / "CourseMind 课件智析.lnk"

    ps_script = f'''
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("{lnk_path}")
$Shortcut.TargetPath = "{target_path}"
$Shortcut.IconLocation = "{icon_path}"
$Shortcut.WorkingDirectory = "{PROJECT_DIR}"
$Shortcut.Description = "课件智析 CourseMind - AI课件学习助手"
$Shortcut.Save()
Write-Output "OK"
'''

    import subprocess
    result = subprocess.run(
        ["powershell", "-Command", ps_script],
        capture_output=True, text=True
    )
    if "OK" in result.stdout:
        print(f"[OK] Shortcut created on Desktop: {lnk_path}")
    else:
        print(f"[ERROR] {result.stderr}")
    return lnk_path


# ==========================================
# Main
# ==========================================
if __name__ == "__main__":
    print("[1/3] Creating icon...")
    ico = create_icon()

    print("[2/3] Creating startup script...")
    bat = create_bat()

    print("[3/3] Creating desktop shortcut...")
    create_lnk(bat, ico)

    print("\nDone! CourseMind shortcut is on your Desktop.")
