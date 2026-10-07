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
