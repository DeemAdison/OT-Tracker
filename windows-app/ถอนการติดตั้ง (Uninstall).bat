@echo off
chcp 65001 >nul
cls
echo ================================================================
echo    ระบบบันทึกและคำนวณเงิน OT (Personal OT Tracker)
echo    ถอนการติดตั้งทางลัดโปรแกรม
echo ================================================================
echo.

del "%USERPROFILE%\Desktop\ระบบบันทึก OT.lnk" 2>nul
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\ระบบบันทึก OT.lnk" 2>nul

echo [✓] ลบทางลัดบน Desktop และ Start Menu เรียบร้อยแล้ว
echo.
pause
