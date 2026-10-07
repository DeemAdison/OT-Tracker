#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( dirname "$DIR" )"

echo "=========================================="
echo " Building Windows Installer: OT_Tracker_Setup.exe"
echo "=========================================="

# 1. Build Vue 3 Frontend
echo "[1/3] Building Vue 3 Frontend..."
cd "$PROJECT_DIR"
npm run build

# 2. Sync to windows-app/dist
echo "[2/3] Updating Windows Assets..."
rm -rf "$DIR/dist"
cp -R "$PROJECT_DIR/dist" "$DIR/dist"
rm -f "$DIR/dist/"*.zip "$DIR/dist/"*.exe 2>/dev/null || true

# 3. Compile NSIS Installer .exe
echo "[3/3] Compiling with NSIS (makensis)..."
cd "$DIR"
makensis installer.nsi

cp "$PROJECT_DIR/OT_Tracker_Setup.exe" "$PROJECT_DIR/public/OT_Tracker_Setup.exe"

echo "=========================================="
echo " SUCCESS! Windows Installer built at:"
echo " $PROJECT_DIR/OT_Tracker_Setup.exe"
echo "=========================================="
