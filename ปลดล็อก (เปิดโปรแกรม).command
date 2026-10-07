#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "======================================================"
echo " ปลดล็อกระบบความปลอดภัย macOS สำหรับ OT Tracker"
echo "======================================================"

# ปลดล็อกแอปในตำแหน่งต่างๆ
xattr -cr "$DIR/OT Tracker.app" 2>/dev/null || true
xattr -cr "/Applications/OT Tracker.app" 2>/dev/null || true
xattr -cr "$HOME/Downloads/OT Tracker.app" 2>/dev/null || true
xattr -cr "$HOME/Desktop/OT Tracker.app" 2>/dev/null || true

# ปลดล็อกแอปที่อาจอยู่ในโฟลเดอร์ที่แตกซิป
find "$HOME/Downloads" -maxdepth 3 -name "OT Tracker.app" -exec xattr -cr {} + 2>/dev/null || true
find "$HOME/Desktop" -maxdepth 3 -name "OT Tracker.app" -exec xattr -cr {} + 2>/dev/null || true

echo "✅ ปลดล็อกระบบ Gatekeeper เรียบร้อยแล้ว!"
echo "กำลังเปิดโปรแกรม OT Tracker..."
echo "======================================================"

if [ -d "/Applications/OT Tracker.app" ]; then
    open "/Applications/OT Tracker.app"
elif [ -d "$DIR/OT Tracker.app" ]; then
    open "$DIR/OT Tracker.app"
elif [ -d "$HOME/Downloads/OT Tracker.app" ]; then
    open "$HOME/Downloads/OT Tracker.app"
elif [ -d "$HOME/Desktop/OT Tracker.app" ]; then
    open "$HOME/Desktop/OT Tracker.app"
fi
