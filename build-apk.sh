#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$DIR")"

echo "=== เตรียม Assets สำหรับ Android App ==="
cd "$PROJECT_ROOT"
npm run build

echo "=== คัดลอก Assets ลงใน android-app/app/src/main/assets ==="
mkdir -p "$DIR/app/src/main/assets"
rm -rf "$DIR/app/src/main/assets/*"
cp -r dist/* "$DIR/app/src/main/assets/"
rm -f "$DIR"/app/src/main/assets/*.exe "$DIR"/app/src/main/assets/*.pkg "$DIR"/app/src/main/assets/*.zip

echo "=== ตรวจสอบเครื่องมือ Android ==="
cd "$DIR"
if command -v ./gradlew &> /dev/null; then
    ./gradlew assembleDebug
elif command -v gradle &> /dev/null; then
    gradle assembleDebug
else
    echo "⚠️ ไม่พบ Gradle หรือ Java ในเครื่อง Mac นี้"
    echo "💡 คุณสามารถ:"
    echo "  1. เปิดโฟลเดอร์ android-app ใน Android Studio แล้วกด Build > Build APK"
    echo "  2. หรือ Push ขึ้น GitHub เพื่อให้ GitHub Actions บิลด์ไฟล์ .apk ให้อัตโนมัติ"
    echo "  3. หรือติดตั้งแบบ PWA ผ่านเบราว์เซอร์ Chrome บนมือถือ Android ได้ทันที"
fi
