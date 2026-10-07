Unicode True

!define PRODUCT_NAME "ระบบบันทึกและคำนวณเงิน OT"
!define PRODUCT_NAME_EN "OT Tracker"
!define PRODUCT_VERSION "1.0.0"
!define PRODUCT_PUBLISHER "DIP"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME_EN}"
!define PRODUCT_UNINST_ROOT_KEY "HKCU"

; Modern UI 2
!include "MUI2.nsh"

; General Configuration
Name "${PRODUCT_NAME}"
OutFile "../OT_Tracker_Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\OT_Tracker"
InstallDirRegKey HKCU "Software\${PRODUCT_NAME_EN}" ""
RequestExecutionLevel user
SetCompressor /SOLID lzma

; Visual Style & Icons
!define MUI_ABORTWARNING
!define MUI_ICON "app.ico"
!define MUI_UNICON "app.ico"
!define MUI_HEADERIMAGE
!define MUI_BGCOLOR "FFFFFF"

; Installer Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

; Finish Page configuration
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION "LaunchApp"
!define MUI_FINISHPAGE_RUN_TEXT "เปิดใช้งานโปรแกรมทันที (Launch OT Tracker)"
!insertmacro MUI_PAGE_FINISH

Function LaunchApp
  ExecShell "" "$INSTDIR\OT-Tracker.vbs"
FunctionEnd

; Uninstaller Pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Languages
!insertmacro MUI_LANGUAGE "Thai"
!insertmacro MUI_LANGUAGE "English"

Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  SetOverwrite on

  ; Core Launchers and Scripts
  File "OT-Tracker.bat"
  File "OT-Tracker.vbs"
  File "server.ps1"
  File "app.ico"
  File "README_WINDOWS.txt"

  ; Web Application Assets
  SetOutPath "$INSTDIR\dist"
  File /r "dist\*.*"

  ; Shortcuts
  SetOutPath "$INSTDIR"
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "wscript.exe" '"$INSTDIR\OT-Tracker.vbs"' "$INSTDIR\app.ico" 0 SW_SHOWNORMAL "" "${PRODUCT_NAME}"
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\ถอนการติดตั้ง ${PRODUCT_NAME}.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0
  CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "wscript.exe" '"$INSTDIR\OT-Tracker.vbs"' "$INSTDIR\app.ico" 0 SW_SHOWNORMAL "" "${PRODUCT_NAME}"

  ; Create Uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Register in Windows Add/Remove Programs (Control Panel)
  WriteRegStr HKCU "Software\${PRODUCT_NAME_EN}" "InstallPath" $INSTDIR
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME} (${PRODUCT_NAME_EN})"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\app.ico"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  ; Remove directories and files
  RMDir /r "$INSTDIR\dist"
  Delete "$INSTDIR\OT-Tracker.bat"
  Delete "$INSTDIR\OT-Tracker.vbs"
  Delete "$INSTDIR\server.ps1"
  Delete "$INSTDIR\app.ico"
  Delete "$INSTDIR\README_WINDOWS.txt"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"

  ; Remove shortcuts
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\ถอนการติดตั้ง ${PRODUCT_NAME}.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"

  ; Remove registry keys
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKCU "Software\${PRODUCT_NAME_EN}"
SectionEnd
