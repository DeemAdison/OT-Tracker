#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( dirname "$DIR" )"
APP_NAME="OT Tracker"
APP_BUNDLE="$PROJECT_DIR/$APP_NAME.app"

echo "=========================================="
echo " Building Native macOS App: $APP_NAME.app"
echo "=========================================="

# 1. Build Vue 3 Frontend
echo "[1/4] Building Vue 3 Frontend..."
cd "$PROJECT_DIR"
npm run build

# 2. Compile Objective-C Cocoa / WebKit Launcher (Universal 2: Apple Silicon + Intel, minOS macOS 11.0+)
echo "[2/4] Compiling Universal 2 macOS Binary (arm64 + x86_64, macOS 11.0+)..."
clang -O2 -arch arm64 -arch x86_64 -mmacosx-version-min=11.0 -fno-modules -framework Cocoa -framework WebKit \
    "$DIR/main.m" -o "$DIR/OT_Tracker_bin"

# 3. Create .app Bundle Structure
echo "[3/4] Creating App Bundle Structure..."
rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# 4. Copy Assets and Executable
echo "[4/4] Assembling Assets..."
cp "$DIR/OT_Tracker_bin" "$APP_BUNDLE/Contents/MacOS/$APP_NAME"
chmod +x "$APP_BUNDLE/Contents/MacOS/$APP_NAME"
cp "$DIR/Info.plist" "$APP_BUNDLE/Contents/Info.plist"
cp "$DIR/AppIcon.icns" "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
cp -R "$PROJECT_DIR/dist" "$APP_BUNDLE/Contents/Resources/dist"
rm -f "$APP_BUNDLE/Contents/Resources/dist/"*.zip "$APP_BUNDLE/Contents/Resources/dist/"*.exe "$APP_BUNDLE/Contents/Resources/dist/"*.pkg 2>/dev/null || true

# 5. Ad-Hoc Code Sign for macOS Gatekeeper Integrity
echo "Code signing app bundle with ad-hoc signature..."
codesign --force --deep --sign - "$APP_BUNDLE"
xattr -cr "$APP_BUNDLE" 2>/dev/null || true

# Touch to refresh Finder icon cache
touch "$APP_BUNDLE"

# 6. Create Helper Unlock Script and Guide for Other Macs
UNLOCK_SCRIPT="$PROJECT_DIR/Unlock-Open-App.command"
cat << 'EOF' > "$UNLOCK_SCRIPT"
#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "======================================================"
echo " กำลังปลดล็อกระบบความปลอดภัย Gatekeeper สำหรับ OT Tracker"
echo "======================================================"
xattr -cr "$DIR/OT Tracker.app" 2>/dev/null || true
if [ -d "/Applications/OT Tracker.app" ]; then
    xattr -cr "/Applications/OT Tracker.app" 2>/dev/null || true
fi
echo ""
echo "✅ ปลดล็อกเรียบร้อยแล้ว!"
echo "กำลังเปิดโปรแกรม OT Tracker ให้คุณ..."
echo "======================================================"
sleep 1
open "$DIR/OT Tracker.app" 2>/dev/null || open "/Applications/OT Tracker.app" 2>/dev/null || true
EOF
chmod +x "$UNLOCK_SCRIPT"

README_MAC="$PROJECT_DIR/HOW_TO_OPEN_MAC.txt"
cat << 'EOF' > "$README_MAC"
วิธีแก้ไขกรณี macOS แจ้งเตือน "ไฟล์เสียหาย" (App is damaged) เมื่อนำไปเปิดบนเครื่องอื่น
========================================================================

สาเหตุที่เกิดขึ้น:
1. [แก้แล้ว] ตัวแอปเวอร์ชันก่อนหน้าถูกคอมไพล์ด้วยระบบ macOS รุ่นใหม่ ทำให้เครื่องที่รัน macOS Sonoma / Ventura / Monterey มองไม่เห็นคำสั่งและแจ้งเตือนว่า "ไฟล์เสียหาย" ตอนนี้เราได้คอมไพล์ใหม่ให้รองรับตั้งแต่ macOS 11.0 Big Sur ขึ้นไปเรียบร้อยแล้ว
2. [ระบบ Gatekeeper] เมื่อดาวน์โหลดไฟล์ผ่านอินเทอร์เน็ต, แชท (LINE), AirDrop หรือ Google Drive ระบบ macOS จะติดแท็กความปลอดภัยกักกันไว้ (Quarantine)

------------------------------------------------------------------------
วิธีแก้ปัญหาเพื่อให้เปิดใช้งานได้ (เลือกวิธีใดวิธีหนึ่ง):
------------------------------------------------------------------------

⭐ วิธีที่ 1: ติดตั้งผ่านตัวติดตั้ง "OT_Tracker_Setup.pkg" (แนะนำที่สุด)
1. ดับเบิลคลิก (หรือคลิกขวาเลือก Open) ที่ไฟล์ "OT_Tracker_Setup.pkg"
2. กดปุ่ม Continue -> Install ตามขั้นตอนของ Mac
3. ตัวติดตั้งจะนำโปรแกรมไปติดตั้งที่โฟลเดอร์ Applications และปลดล็อกความปลอดภัยให้อัตโนมัติ
4. เปิดโปรแกรมจาก Launchpad หรือ Applications ได้ทันที

⭐ วิธีที่ 2: ใช้คำสั่งใน Terminal เพียง 1 บรรทัด (แก้ไฟล์ .app ได้ทันที 100%)
1. เปิดโปรแกรม "Terminal" (ค้นหาใน Spotlight ได้เลย)
2. คัดลอกคำสั่งด้านล่างนี้ไปวาง แล้วกด Enter:

xattr -cr ~/Downloads/*"OT Tracker"*.app ~/Desktop/*"OT Tracker"*.app "/Applications/OT Tracker.app" 2>/dev/null

หรือถ้าอยากทำแบบลากวาง:
- พิมพ์ใน Terminal ว่า: xattr -cr (แล้วเคาะวรรค 1 ครั้ง)
- ลากไอคอน "OT Tracker.app" จาก Finder มาปล่อยในหน้าต่าง Terminal
- กดปุ่ม Enter
3. ดับเบิลคลิกเปิดโปรแกรม OT Tracker ใช้งานได้ทันทีตลอดไปครับ!

⭐ วิธีที่ 3: ดับเบิลคลิกไฟล์ "Unlock-Open-App.command"
1. คลิกขวา (หรือกด Control ค้างไว้แล้วคลิก) ที่ไฟล์ "Unlock-Open-App.command"
2. เลือก "Open" (เปิด)
3. หากมีหน้าต่างเตือน ให้กด "Open" ยืนยัน
4. ระบบจะทำการปลดล็อก Gatekeeper และเปิดโปรแกรม OT Tracker ให้อัตโนมัติครับ
========================================================================
EOF
cp "$README_MAC" "$PROJECT_DIR/วิธีเปิดใช้งานบนเครื่องอื่น.txt"

# 7. Build macOS Installer Package (.pkg)
echo "[5/5] Creating macOS Installer Package (.pkg)..."
PKG_STAGE="$PROJECT_DIR/scratch/pkg-stage"
rm -rf "$PKG_STAGE"
mkdir -p "$PKG_STAGE/root/Applications"
mkdir -p "$PKG_STAGE/scripts"
cp -R "$APP_BUNDLE" "$PKG_STAGE/root/Applications/"

cat << 'EOF' > "$PKG_STAGE/scripts/postinstall"
#!/bin/bash
xattr -cr "/Applications/OT Tracker.app" 2>/dev/null || true
chmod -R 755 "/Applications/OT Tracker.app" 2>/dev/null || true
exit 0
EOF
chmod +x "$PKG_STAGE/scripts/postinstall"

pkgbuild --root "$PKG_STAGE/root" \
  --ownership recommended \
  --scripts "$PKG_STAGE/scripts" \
  --identifier "th.go.dip.ot-tracker" \
  --version "1.0.0" \
  --install-location "/" \
  "$PROJECT_DIR/OT_Tracker_Setup.pkg"

cp "$PROJECT_DIR/OT_Tracker_Setup.pkg" "$PROJECT_DIR/public/OT_Tracker_Setup.pkg"

# 8. Create clean zip for distribution containing .app and helpers
cd "$PROJECT_DIR"
rm -f "$PROJECT_DIR/OT_Tracker_macOS.zip"
zip -r -q "$PROJECT_DIR/OT_Tracker_macOS.zip" "$APP_NAME.app" "Unlock-Open-App.command" "HOW_TO_OPEN_MAC.txt" "OT_Tracker_Setup.pkg"
cp "$PROJECT_DIR/OT_Tracker_macOS.zip" "$PROJECT_DIR/public/OT_Tracker_macOS.zip"

echo "=========================================="
echo " SUCCESS! Application built at:"
echo " 1. Bundle:    $APP_BUNDLE"
echo " 2. Installer: $PROJECT_DIR/OT_Tracker_Setup.pkg"
echo " 3. Zip:       $PROJECT_DIR/OT_Tracker_macOS.zip"
echo "=========================================="
