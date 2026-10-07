@echo off
chcp 65001 >nul
cd /d "%~dp0"
cls
echo ================================================================
echo    ระบบบันทึกและคำนวณเงิน OT (Personal OT Tracker)
echo    ตัวติดตั้งทางลัดโปรแกรมสำหรับ Windows
echo ================================================================
echo.

set "TARGET_VBS=%~dp0OT-Tracker.vbs"
set "ICON_FILE=%~dp0app.ico"
set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "SHORTCUT_PATH=%DESKTOP_DIR%\ระบบบันทึก OT.lnk"
set "STARTMENU_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\ระบบบันทึก OT.lnk"

echo กำลังสร้างทางลัดบน Desktop...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); ^
   $s.TargetPath = 'wscript.exe'; ^
   $s.Arguments = '\"%TARGET_VBS%\"'; ^
   $s.WorkingDirectory = '%~dp0'; ^
   $s.IconLocation = '%ICON_FILE%,0'; ^
   $s.Description = 'ระบบบันทึกและคำนวณเงิน OT (Personal OT Tracker)'; ^
   $s.Save()"

echo กำลังสร้างทางลัดใน Start Menu...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $s = $ws.CreateShortcut('%STARTMENU_PATH%'); ^
   $s.TargetPath = 'wscript.exe'; ^
   $s.Arguments = '\"%TARGET_VBS%\"'; ^
   $s.WorkingDirectory = '%~dp0'; ^
   $s.IconLocation = '%ICON_FILE%,0'; ^
   $s.Description = 'ระบบบันทึกและคำนวณเงิน OT (Personal OT Tracker)'; ^
   $s.Save()"

echo.
echo [✓] ติดตั้งสำเร็จเรียบร้อย!
echo     - ไอคอนบนหน้าจอ Desktop: "ระบบบันทึก OT"
echo     - เมนู Start Menu: "ระบบบันทึก OT"
echo.
echo คุณสามารถดับเบิลคลิกไอคอนบนหน้าจอเพื่อเริ่มใช้งานได้ทันทีครับ
echo ================================================================
echo.
pause
