# ระบบบันทึกและคำนวณเงินค่าตอบแทนการปฏิบัติงานนอกเวลาราชการ
### Personal Overtime (OT) Management & Tracker for Government Service

[![Vue.js 3](https://img.shields.io/badge/Vue.js-3.x-4FC08D?style=flat-square&logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![macOS Universal](https://img.shields.io/badge/macOS-Universal_2_(Apple_Silicon_+_Intel)-000000?style=flat-square&logo=apple&logoColor=white)](https://apple.com)
[![Windows](https://img.shields.io/badge/Windows-10_/_11-0078D6?style=flat-square&logo=windows&logoColor=white)](https://microsoft.com)
[![Android](https://img.shields.io/badge/Android-APK_/_PWA-3DDC84?style=flat-square&logo=android&logoColor=white)](https://android.com)
[![Offline 100%](https://img.shields.io/badge/Offline-100%25_Standalone-success?style=flat-square)](#)

---

## 📌 ข้อมูลภาพรวมโครงการ (Project Overview)
**OT Tracker** คือแอปพลิเคชันส่วนบุคคลสำหรับข้าราชการ พนักงานราชการ และบุคลากรภาครัฐ (อิงตามระเบียบและแบบฟอร์มมาตรฐานของกรมทรัพย์สินทางปัญญา กระทรวงพาณิชย์) ออกแบบมาเพื่อช่วยบันทึกเวลาทำงานนอกเวลาราชการ คำนวณชั่วโมงสะสม ยอดเงินค่าตอบแทน ตรวจสอบกระทบยอดกับรายงานเวลาสแกนนิ้วอัตโนมัติ และส่งออกเอกสารการเบิกจ่ายราชการ (Excel และ Word) ได้ในคลิกเดียว

ระบบสามารถทำงานได้แบบ **Offline 100%** บนเครื่องคอมพิวเตอร์และโทรศัพท์มือถือ โดยไม่ต้องเชื่อมต่ออินเทอร์เน็ตหรือติดตั้ง Database Server ภายนอก ข้อมูลทั้งหมดจะถูกเก็บรักษาอย่างปลอดภัยในอุปกรณ์ของผู้ใช้เท่านั้น

---

## ✨ คุณสมบัติเด่น (Key Features)

### 1. 📅 บันทึกเวลาทำงานล่วงหน้ารายวัน (Daily Progressive Logging)
* บันทึกรายการปฏิบัติงานได้ทุกวันระหว่างเดือน แม้ยังไม่มีรายงานสแกนเวลา
* บันทึกเวลาเข้า-ออก, รายละเอียดงาน (Task Description), เลขทะเบียนนิติบุคคล (JID) หรือชื่อโครงการ
* มีปุ่มด่วนเลือกจำนวนชั่วโมงและเวลาเลิกงานมาตรฐาน (1-4 ชม. สำหรับวันปกติ และ 3-7 ชม. สำหรับวันหยุด)
* ปรับตั้งค่าข้อความงานประจำ (Task Presets) เพื่อความสะดวกรวดเร็ว

### 2. ⚡ กระทบยอดอัจฉริยะกับไฟล์สแกนนิ้ว PDF (Smart Reconciliation)
* นำเข้าไฟล์รายงานเวลาปฏิบัติงานราชการ (`HR_RP_003_TimeToWork.pdf`) สิ้นเดือน
* ระบบสกัดเวลาสแกนเข้า-ออก และจับคู่ (Match) กับรายการที่บันทึกไว้ในปฏิทินอัตโนมัติ
* ระบบตรวจจับข้อแตกต่าง (Discrepancy Detection) แจ้งเตือนกรณีลืมลงบันทึกงาน หรือเวลาสแกนไม่ตรงกัน พร้อมปุ่ม **Auto-Sync to PDF** ในคลิกเดียว

### 3. ⚖️ คำนวณถูกต้องตามระเบียบราชการ 100% (Civil Service Compliance)
* **วันทำการปกติ (จันทร์ - ศุกร์):** ปฏิบัติงานหลัง 16:30 น. คำนวณอัตรา 50 บาท/ชม. (จำกัดเพดานสูงสุดไม่เกิน 4 ชั่วโมง/วัน = เลิกงานไม่เกิน 20:30 น.)
* **วันหยุดราชการ (เสาร์ - อาทิตย์ และวันหยุดนักขัตฤกษ์):** ปฏิบัติงานช่วง 08:30 - 16:30 น. คำนวณอัตรา 60 บาท/ชม. **หักเวลาพักเที่ยง 1 ชั่วโมง (12:00 - 13:00 น.) อัตโนมัติ** และจำกัดเพดานสูงสุดไม่เกิน 7 ชั่วโมง/วัน (สูงสุด 420 บาท/วัน)
* **การปรับเวลาออกรายงาน (Time Normalization):** ปรับเวลาเริ่ม-สิ้นสุดในรายงานให้ตรงกับจำนวนชั่วโมงเต็มพอดี เช่น ปฏิบัติงาน 13:00 - 16:30 น. (3 ชม.) ระบบจะระบุเวลาในรายงานเป็น `13:30 - 16:30 น.` พอดีกับ 3 ชม. เพื่อป้องกันการทักท้วงเรื่องเศษเวลาจากเจ้าหน้าที่การเงิน

### 4. 📄 ส่งออกเอกสารราชการฉบับจริง (100% Government Template Alignment)
* **ตาราง Excel 31 วัน (`หลักฐานการเบิกจ่ายฯ.xlsx`):** 
  - ใช้เทคโนโลยี **Direct OpenXML Injection** บนโครงสร้างไฟล์ต้นฉบับจริง
  - รักษาเซลล์ผสาน (Merged Cells) ทั้ง 219 จุด สไตล์ฟอนต์ Cordia New และเส้นขอบตาราง 100%
  - รองรับสูตรคำนวณ `SUM`, `CHAR(10)` สรุปยอด 2 บรรทัด (`[ชม.]X[อัตรา] = \n [ยอดเงิน]`), และคำอ่านเงินบาทถ้วนภาษาไทยตามหลักเกณฑ์ราชบัณฑิตยสภา
  - วันที่เกินขอบเขตของเดือน (เช่น วันที่ 31 ในเดือนเมษายน หรือวันที่ 29-31 ในเดือนกุมภาพันธ์) จะถูกตัดออกจากการคำนวณและถมแถบสีเทาต่อเนื่องอย่างถูกต้อง
* **รายงานผล Word (`รายงานผลการปฏิบัติงานฯ.docx`):**
  - จัดรูปแบบตามโครงสร้างราชการ TH SarabunPSK 16pt, การเยื้อง 720 dxa, และการแปลงวันที่เป็นเลขไทย (`๒๕๖๙`)
* **ระบบพรีวิวและพิมพ์เอกสาร (Vector Print Engine):**
  - ดูตัวอย่างเอกสารขนาดจริงแบบ A4 ในโปรแกรม และสั่งพิมพ์หรือบันทึกเป็น PDF ได้ทันที

### 5. 🔒 ปลอดภัยและเป็นส่วนตัว (Privacy & Security)
* รองรับการล็อกหน้าจอด้วยรหัส PIN (เริ่มต้น: `1234`)
* มีระบบสำรองข้อมูล (Backup Database) และกู้คืนข้อมูล (Restore) เป็นไฟล์ `.json`
* ข้อมูลทั้งหมดถูกเก็บในเครื่องของผู้ใช้ (Local Storage / Embedded DB) ไม่มีการส่งข้อมูลออกนอกเครื่อง

---

## 📥 การดาวน์โหลดและติดตั้งใช้งาน (Downloads & Installation)

### 🍎 1. สำหรับ macOS (Mac ชิป M1/M2/M3/M4 และชิป Intel)
มีให้เลือกติดตั้ง 2 รูปแบบ:
* **ตัวติดตั้งมาตรฐาน Apple Package (`.pkg`):**
  1. ดาวน์โหลดไฟล์ `OT_Tracker_Setup.pkg`
  2. ดับเบิลคลิกเพื่อติดตั้ง ระบบจะติดตั้งแอปพลิเคชันลงในโฟลเดอร์ Applications โดยตรง
  3. *หากขึ้นเตือนความปลอดภัย:* ให้เข้าไปที่ **System Settings > Privacy & Security** เลื่อนลงไปด้านล่างแล้วกด **"เปิดต่อไป" (Open Anyway)**
* **แบบไฟล์พกพา (`.zip`):**
  1. แตกไฟล์ `OT_Tracker_macOS.zip` จะได้ `OT Tracker.app`
  2. ลากแอปไปไว้ที่โฟลเดอร์ Applications หรือ Desktop
  3. หากเปิดแล้วขึ้นเตือนความปลอดภัย ให้ดับเบิลคลิกที่ไฟล์ `ปลดล็อก (เปิดโปรแกรม).command` เพื่อปลดล็อก Gatekeeper อัตโนมัติ

---

### 🪟 2. สำหรับ Windows (Windows 10 / 11)
* **ตัวติดตั้งแบบไฟล์เดี่ยว (`OT_Tracker_Setup.exe`):**
  - ดับเบิลคลิกไฟล์ติดตั้ง Wizard ภาษาไทย จะสร้างไอคอนทางลัดบน Desktop และเมนู Start อัตโนมัติ (ติดตั้งได้ทันทีโดยไม่ต้องใช้รหัสผ่าน Admin)
* **แบบพกพา (`OT_Tracker_Windows.zip`):**
  - แตกไฟล์ zip แล้วดับเบิลคลิกที่ไฟล์ `ติดตั้งโปรแกรม (Install).bat` เพื่อสร้าง Shortcut บนหน้าจอ

---

### 📱 3. สำหรับ Android (โทรศัพท์มือถือและแท็บเล็ต)
* **ติดตั้งไฟล์ APK (`.apk`):**
  - ดาวน์โหลดไฟล์ `app-debug.apk` (จากแท็บ GitHub Releases) และกดติดตั้งบนมือถือ Android
* **ติดตั้งผ่านเว็บเบราว์เซอร์ (Progressive Web App - PWA):**
  - เปิดหน้าเว็บผ่าน Google Chrome บนมือถือ แล้วกดเมนู 3 จุดเลือก **"ติดตั้งแอป" (Install App)** หรือ **"เพิ่มลงในหน้าจอหลัก" (Add to Home Screen)** ตัวแอปจะติดตั้งเป็นเสมือนแอปแท้ เปิดเต็มจอ และใช้งานออฟไลน์ได้ 100%

---

## 🛠️ การพัฒนาและติดตั้งจาก Source Code (Developer Guide)

### สิ่งที่ต้องมีในเครื่อง (Prerequisites)
* [Node.js](https://nodejs.org/) (เวอร์ชัน 18 ขึ้นไป)
* npm หรือ yarn

### ขั้นตอนการรันระบบ (Development Setup)
```bash
# 1. ติดตั้ง Dependencies
npm install

# 2. รัน Local Development Server (พร้อม Hot Reload)
npm run dev

# 3. บิลด์ Production Assets
npm run build
```

### การคอมไพล์โปรแกรมสำหรับแต่ละแพลตฟอร์ม
* **macOS App:** รันสคริปต์ `./macos-app/build-app.sh` (คอมไพล์ Universal 2 Binary และสร้าง `.pkg`)
* **Windows Installer:** รันสคริปต์ `./windows-app/build-installer.sh` (ต้องมี NSIS / `makensis`)
* **Android Assets:** รันสคริปต์ `./android-app/build-apk.sh`

---

## 📂 โครงสร้างไดเรกทอรีโครงการ (Project Structure)

```text
├── .github/workflows/          # CI/CD Automations (Android APK & Windows Installer)
├── android-app/                # โปรเจกต์ Android Studio Native Wrapper (Java + WebView)
├── macos-app/                  # ซอร์สโค้ด Native macOS Launcher (Objective-C Cocoa/WebKit)
├── windows-app/                # สคริปต์ตัวติดตั้ง NSIS และโหมดพกพาของ Windows
├── src/
│   ├── components/             # คอมโพเนนต์ UI (CalendarView, DailyLogModal, PrintPreview, etc.)
│   ├── services/
│   │   ├── db.js               # ระบบจัดการฐานข้อมูลและการสำรองข้อมูล (Local Storage / SQLite)
│   │   ├── exportService.js    # Direct OpenXML Engine ส่งออก Excel 31 วัน และ Word รายงานผล
│   │   ├── pdfParser.js        # ตัวอ่านและสกัดเวลาจากไฟล์ PDF สแกนนิ้วราชการ
│   │   ├── printEngine.js      # Vector Print & PDF Renderer แบบคมชัด
│   │   ├── templateAssets.js   # ไฟล์ต้นฉบับ Excel และ Word ในรูปแบบ Base64
│   │   └── thaiHolidays.js     # ฐานข้อมูลวันหยุดราชการไทยและกฎการคำนวณ OT
│   ├── stores/
│   │   └── otStore.js          # ระบบ State Management (Pinia) และ Smart Reconciliation
│   ├── App.vue                 # คอมโพเนนต์หลัก
│   └── main.js                 # จุดเริ่มต้นของแอปพลิเคชัน
├── public/                     # ไฟล์สถิตและไฟล์ติดตั้งสำเร็จรูปสำหรับดาวน์โหลดในแอป
├── gemini.md                   # คู่มือระบบและประวัติบันทึกการทำงาน (System Changelog)
├── package.json                # ข้อมูลโปรเจกต์และรายการ Library
└── vite.config.js              # การตั้งค่า Vite Build
```

---

## 📄 ลิขสิทธิ์และการใช้งาน (License & Disclaimer)
โครงการนี้พัฒนาขึ้นเพื่ออำนวยความสะดวกในการจัดทำเอกสารเบิกจ่ายค่าตอบแทนการปฏิบัติงานนอกเวลาราชการส่วนบุคคล รูปแบบตารางและเอกสารอ้างอิงตามแบบฟอร์มของกรมทรัพย์สินทางปัญญา สามารถนำไปปรับใช้กับหน่วยงานภาครัฐอื่น ๆ ได้ตามความเหมาะสม
