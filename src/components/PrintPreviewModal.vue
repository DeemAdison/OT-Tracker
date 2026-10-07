<script setup>
import { ref, computed } from 'vue';
import { useOtStore } from '../stores/otStore';
import { THAI_MONTHS } from '../services/pdfParser';
import { toThaiNumerals, thaiBahtText } from '../services/exportService';
import { getCivilServiceReportTimes } from '../services/thaiHolidays';
import { 
  generateExcelHtml, 
  generateWordHtml, 
  printHtmlViaIframe 
} from '../services/printEngine';
import { useToast } from 'vue-toastification';
import { 
  X, 
  Printer, 
  FileSpreadsheet, 
  FileText, 
  ZoomIn, 
  ZoomOut, 
  Download, 
  Loader2, 
  FileCheck2,
  Calendar,
  Clock,
  Coins,
  Sparkles
} from 'lucide-vue-next';

const props = defineProps({
  show: Boolean,
});

const emit = defineEmits(['close']);
const store = useOtStore();
const toast = useToast();

const activeTab = ref('excel'); // 'excel' or 'word'
const zoomLevel = ref(100);
const isSaving = ref(false);

const thaiYear = computed(() => toThaiNumerals(store.currentYear));
const monthName = computed(() => THAI_MONTHS[store.currentMonth - 1] || '');

// Compute 31 days data precisely mapping to columns D through AH
const excelDays = computed(() => {
  const y = store.currentYear - 543;
  const m = store.currentMonth;
  const numDaysInMonth = new Date(y, m, 0).getDate();

  const days = [];
  for (let d = 1; d <= 31; d++) {
    const isDayValid = d <= numDaysInMonth;
    const log = store.logsByDay[d];
    let repTimes = { startTime: '', endTime: '' };
    
    if (log && log.isClaimed && log.hours > 0) {
      repTimes = getCivilServiceReportTimes({
        dayType: log.dayType,
        startTime: log.startTime,
        endTime: log.endTime,
        hours: log.hours
      });
    }

    days.push({
      day: d,
      isValid: isDayValid,
      log: isDayValid ? log : null,
      hasOt: Boolean(isDayValid && log && log.isClaimed && log.hours > 0),
      weekdayHours: (log && log.isClaimed && log.dayType !== 'holiday' && log.hours > 0) ? log.hours : '',
      holidayHours: (log && log.isClaimed && log.dayType === 'holiday' && log.hours > 0) ? log.hours : '',
      startTime: repTimes.startTime || '',
      endTime: repTimes.endTime || '',
    });
  }
  return days;
});

// Summary calculations for Excel
const totalWeekdayHours = computed(() => {
  return excelDays.value.reduce((sum, d) => sum + (Number(d.weekdayHours) || 0), 0);
});

const totalHolidayHours = computed(() => {
  return excelDays.value.reduce((sum, d) => sum + (Number(d.holidayHours) || 0), 0);
});

const weekdayAmount = computed(() => {
  return totalWeekdayHours.value * (store.settings.rateWeekday || 50);
});

const holidayAmount = computed(() => {
  return totalHolidayHours.value * (store.settings.rateHoliday || 60);
});

const grandTotalAmount = computed(() => {
  return weekdayAmount.value + holidayAmount.value;
});

// Active claimed logs for Word report (Sorted chronologically)
const wordLogs = computed(() => {
  return store.dailyLogs
    .filter(l => l.isClaimed && l.hours > 0)
    .sort((a, b) => a.day - b.day)
    .map(l => ({
      ...l,
      thaiDay: toThaiNumerals(l.day),
      taskDesc: l.taskDesc?.trim() || 'ปฏิบัติหน้าที่ตามที่ได้รับมอบหมาย'
    }));
});

// Department with Nonthaburi province
const displayDepartment = computed(() => {
  const d = store.settings.department ? store.settings.department.trim() : 'กรมทรัพย์สินทางปัญญา';
  return d.includes('นนทบุรี') ? d : `${d} จังหวัดนนทบุรี`;
});

// Generate Pure HTML for the currently active tab
function getCurrentDocumentHtml() {
  if (activeTab.value === 'excel') {
    return generateExcelHtml({
      employeeName: store.settings.employeeName,
      department: displayDepartment.value,
      position: store.settings.position,
      positionLevel: store.settings.positionLevel,
      monthName: monthName.value,
      currentYear: store.currentYear,
      rateWeekday: store.settings.rateWeekday || 50,
      rateHoliday: store.settings.rateHoliday || 60,
      excelDays: excelDays.value,
      totalWeekdayHours: totalWeekdayHours.value,
      totalHolidayHours: totalHolidayHours.value,
      weekdayAmount: weekdayAmount.value,
      holidayAmount: holidayAmount.value,
      grandTotalAmount: grandTotalAmount.value
    });
  } else {
    return generateWordHtml({
      employeeName: store.settings.employeeName,
      department: displayDepartment.value,
      position: store.settings.position,
      positionLevel: store.settings.positionLevel,
      monthName: monthName.value,
      thaiYear: thaiYear.value,
      wordLogs: wordLogs.value
    });
  }
}

// 1. Save Excel file (.xlsx)
async function handleSaveExcel() {
  isSaving.value = true;
  try {
    const filename = await store.downloadExcel();
    if (filename) {
      toast.success(`บันทึกไฟล์ Excel สำเร็จ: ${filename}`);
    }
  } catch (err) {
    console.error('Save Excel error:', err);
    toast.error('เกิดข้อผิดพลาดในการบันทึก Excel: ' + err.message);
  } finally {
    isSaving.value = false;
  }
}

// 2. Save Word file (.docx)
async function handleSaveWord() {
  isSaving.value = true;
  try {
    const filename = await store.downloadWord();
    if (filename) {
      toast.success(`บันทึกไฟล์ Word สำเร็จ: ${filename}`);
    }
  } catch (err) {
    console.error('Save Word error:', err);
    toast.error('เกิดข้อผิดพลาดในการบันทึก Word: ' + err.message);
  } finally {
    isSaving.value = false;
  }
}

// 3. Save as PDF (.pdf) - Clean vector PDF without UI clutter
async function handleSavePdf() {
  const html = getCurrentDocumentHtml();
  const orientation = activeTab.value === 'excel' ? 'landscape' : 'portrait';
  const suggestedFilename = activeTab.value === 'excel'
    ? `หลักฐานการเบิกจ่าย_OT_${store.settings.employeeName || ''}_${monthName.value}_${store.currentYear}.pdf`
    : `รายงานผลการปฏิบัติงาน_OT_${store.settings.employeeName || ''}_${monthName.value}_${store.currentYear}.pdf`;

  if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeSavePDF) {
    window.__macPdfCallback = (res) => {
      if (res && res.success) {
        toast.success(`บันทึกไฟล์ PDF เรียบร้อย: ${res.filename}`);
      } else if (res && res.error) {
        toast.error('บันทึก PDF ไม่สำเร็จ: ' + res.error);
      }
    };

    window.webkit.messageHandlers.nativeSavePDF.postMessage({
      filename: suggestedFilename,
      orientation,
      html
    });
  } else {
    toast.info('โปรดเลือกเครื่องพิมพ์เป็น "Save as PDF" ในหน้าต่างพิมพ์');
    printHtmlViaIframe(html);
  }
}

// 4. Print directly (Clean Isolated Print without Modal UI)
function handlePrint() {
  const html = getCurrentDocumentHtml();
  const orientation = activeTab.value === 'excel' ? 'landscape' : 'portrait';

  if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativePrint) {
    window.webkit.messageHandlers.nativePrint.postMessage({
      orientation,
      html
    });
  } else {
    printHtmlViaIframe(html);
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
    <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-[99vw] xl:max-w-[1440px] w-full shadow-2xl border border-slate-300 dark:border-slate-800 overflow-hidden transform transition-all flex flex-col max-h-[96vh]">
      
      <!-- Top Action Bar -->
      <div class="px-5 py-3.5 bg-slate-100/90 dark:bg-slate-800/95 border-b border-slate-300 dark:border-slate-700 flex flex-wrap gap-3 justify-between items-center">
        
        <!-- Left: Document Identity -->
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
            <Printer class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <span>ศูนย์ส่งออกและพิมพ์เอกสารเบิกจ่าย OT</span>
              <span class="text-xs px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/70 text-primary dark:text-red-300 font-bold">
                {{ monthName }} {{ store.currentYear }}
              </span>
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              ตรวจสอบตัวอย่างเอกสารฉบับจริง สั่งพิมพ์ หรือดาวน์โหลดไฟล์ Excel / Word / PDF ได้ทันที
            </p>
          </div>
        </div>

        <!-- Center: Tab Switcher (Excel vs Word) -->
        <div class="flex bg-slate-200/90 dark:bg-slate-700/80 p-1 rounded-xl text-xs font-semibold">
          <button
            @click="activeTab = 'excel'"
            :class="[
              'px-4 py-2 rounded-lg transition flex items-center space-x-2 cursor-pointer',
              activeTab === 'excel' 
                ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm font-bold' 
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            ]"
          >
            <FileSpreadsheet class="w-4 h-4 text-emerald-600" />
            <span>1. หลักฐานการเบิกจ่ายฯ (Excel 31 วัน)</span>
          </button>

          <button
            @click="activeTab = 'word'"
            :class="[
              'px-4 py-2 rounded-lg transition flex items-center space-x-2 cursor-pointer',
              activeTab === 'word' 
                ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm font-bold' 
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            ]"
          >
            <FileText class="w-4 h-4 text-blue-600" />
            <span>2. รายงานผลการปฏิบัติงานฯ (Word)</span>
          </button>
        </div>

        <!-- Right: Actions & Close -->
        <div class="flex items-center space-x-2">
          
          <!-- Zoom Controls -->
          <div class="hidden lg:flex items-center space-x-1 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs shadow-2xs">
            <button @click="zoomLevel = Math.max(60, zoomLevel - 10)" class="p-1 hover:text-primary transition cursor-pointer" title="ย่อขนาด">
              <ZoomOut class="w-3.5 h-3.5" />
            </button>
            <span class="px-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 w-10 text-center">{{ zoomLevel }}%</span>
            <button @click="zoomLevel = Math.min(140, zoomLevel + 10)" class="p-1 hover:text-primary transition cursor-pointer" title="ขยายขนาด">
              <ZoomIn class="w-3.5 h-3.5" />
            </button>
            <button @click="zoomLevel = 100" class="p-1 hover:text-primary transition cursor-pointer text-[10px]" title="รีเซ็ต 100%">
              100%
            </button>
          </div>

          <!-- Close Modal -->
          <button 
            @click="emit('close')" 
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer ml-1"
            title="ปิดหน้าต่าง"
          >
            <X class="w-5 h-5" />
          </button>

        </div>

      </div>

      <!-- KPI Summary Ribbon (Unifies ExportModal Summary) -->
      <div class="px-5 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between text-xs">
        <div class="flex flex-wrap items-center gap-4 sm:gap-6">
          <div class="flex items-center space-x-1.5">
            <Calendar class="w-4 h-4 text-primary" />
            <span class="text-slate-600 dark:text-slate-400">ขอเบิก:</span>
            <span class="font-bold text-slate-800 dark:text-white">{{ store.summary.claimedCount }} วัน</span>
          </div>

          <div class="flex items-center space-x-1.5">
            <Clock class="w-4 h-4 text-emerald-600" />
            <span class="text-slate-600 dark:text-slate-400">วันปกติ ({{ store.settings.rateWeekday }} บ.):</span>
            <span class="font-bold text-slate-800 dark:text-white">{{ store.summary.weekdayHours }} ชม. ({{ store.summary.weekdayAmount.toLocaleString() }} บาท)</span>
          </div>

          <div class="flex items-center space-x-1.5">
            <Clock class="w-4 h-4 text-amber-600" />
            <span class="text-slate-600 dark:text-slate-400">วันหยุด ({{ store.settings.rateHoliday }} บ.):</span>
            <span class="font-bold text-slate-800 dark:text-white">{{ store.summary.holidayHours }} ชม. ({{ store.summary.holidayAmount.toLocaleString() }} บาท)</span>
          </div>

          <div class="flex items-center space-x-1.5">
            <Coins class="w-4 h-4 text-blue-600" />
            <span class="text-slate-600 dark:text-slate-400">ยอดเงินรวมทั้งสิ้น:</span>
            <span class="font-bold text-sm text-primary">{{ store.summary.totalAmount.toLocaleString() }} บาท</span>
            <span class="text-[11px] text-slate-400 dark:text-slate-500 italic">({{ thaiBahtText(store.summary.totalAmount) }})</span>
          </div>
        </div>

        <!-- Quick Action Buttons in Ribbon -->
        <div class="flex items-center space-x-2">
          <!-- Download Excel -->
          <button
            @click="handleSaveExcel"
            :disabled="isSaving"
            type="button"
            class="px-3 py-1.5 text-xs font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs inline-flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
            title="ดาวน์โหลดไฟล์ Excel (.xlsx) ตามแบบฟอร์มกรมทรัพย์สินทางปัญญา"
          >
            <Download class="w-3.5 h-3.5" />
            <span>Excel (.xlsx)</span>
          </button>

          <!-- Download Word -->
          <button
            @click="handleSaveWord"
            :disabled="isSaving"
            type="button"
            class="px-3 py-1.5 text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-xs inline-flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
            title="ดาวน์โหลดรายงานผลการปฏิบัติงาน Word (.docx)"
          >
            <Download class="w-3.5 h-3.5" />
            <span>Word (.docx)</span>
          </button>

          <!-- Save PDF -->
          <button
            @click="handleSavePdf"
            type="button"
            class="px-3 py-1.5 text-xs font-bold rounded-xl text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-900 shadow-xs inline-flex items-center space-x-1.5 transition cursor-pointer"
            title="ส่งออกเอกสารฉบับนี้เป็นไฟล์ PDF คุณภาพสูง"
          >
            <Download class="w-3.5 h-3.5" />
            <span>บันทึก PDF</span>
          </button>

          <!-- Direct Print -->
          <button
            @click="handlePrint"
            type="button"
            class="px-3.5 py-1.5 text-xs font-bold rounded-xl text-white bg-primary hover:bg-primary-hover shadow-sm inline-flex items-center space-x-1.5 transition cursor-pointer"
            title="สั่งพิมพ์ออกเครื่องพิมพ์โดยตรง"
          >
            <Printer class="w-3.5 h-3.5" />
            <span>พิมพ์เอกสาร</span>
          </button>
        </div>
      </div>

      <!-- Preview Canvas Area (Floating A4 Paper with Crisp Presentation) -->
      <div class="p-6 sm:p-10 overflow-auto flex-1 bg-slate-200/90 dark:bg-slate-950 flex justify-center items-start">
        
        <!-- ============================================================= -->
        <!-- 1. EXCEL FORM PREVIEW: หลักฐานการจ่ายเงินตอบแทนฯ (ตรงตามต้นฉบับเป๊ะ) -->
        <!-- ============================================================= -->
        <div 
          v-if="activeTab === 'excel'" 
          :style="{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }"
          class="excel-sheet-paper bg-white text-black p-8 sm:p-10 shadow-2xl rounded-sm border border-slate-300 mx-auto w-[1240px] font-sarabun text-[14pt] leading-tight select-text"
        >
          
          <!-- Document Header Titles (Row 1 & 2 in Excel: A1, A2) -->
          <div class="text-center font-bold mb-4 space-y-1">
            <h1 class="text-[17pt] text-black font-bold tracking-normal leading-tight">
              หลักฐานการจ่ายเงินตอบแทนการปฏิบัติงานนอกเวลาราชการ
            </h1>
            <h2 class="text-[14.5pt] text-black font-bold leading-tight">
              {{ displayDepartment }} &nbsp;&nbsp;&nbsp;&nbsp;ประจำเดือน {{ monthName }} {{ store.currentYear }}
            </h2>
          </div>

          <!-- Official 40-Column Table Grid (Exact OpenXML Layout) -->
          <div class="w-full">
            <table class="w-full border-collapse border-[1.5px] border-black text-center text-[11pt] font-sarabun table-fixed">
              
              <!-- Column Width Allocations -->
              <colgroup>
                <col style="width: 3.5%;" />
                <col style="width: 14%;" />
                <col style="width: 6.5%;" />
                <col v-for="n in 31" :key="'col-'+n" style="width: 1.55%;" />
                <col style="width: 4.2%;" />
                <col style="width: 4.2%;" />
                <col style="width: 7%;" />
                <col style="width: 4.2%;" />
                <col style="width: 4.5%;" />
                <col style="width: 4%;" />
              </colgroup>

              <!-- Table Headers (Rows 4 - 6) -->
              <thead>
                <!-- Header Row 1 (R04) -->
                <tr class="font-bold bg-slate-50 text-black text-[13.5pt] h-[24px]">
                  <th rowspan="2" class="border border-black px-0.5 py-0.5 align-middle font-bold text-[13pt]">ลำดับที่</th>
                  <th rowspan="2" class="border border-black px-1 py-0.5 align-middle font-bold text-[14pt]">ชื่อ - สกุล</th>
                  <th class="border border-black px-0.5 py-0.5 font-bold text-[13pt]">อัตราเงิน</th>
                  <th colspan="31" class="border border-black py-0.5 font-bold text-[14pt]">วันที่ปฏิบัติงานนอกเวลาราชการ</th>
                  <th colspan="2" class="border border-black px-0.5 py-0.5 font-bold text-[13pt]">รวมเวลาปฏิบัติงาน</th>
                  <th rowspan="2" class="border border-black px-0.5 py-0.5 align-middle font-bold text-[13pt]">จำนวนเงิน</th>
                  <th class="border border-black px-0.5 py-0.5 font-bold text-[11pt]">วัน เดือน ปี</th>
                  <th class="border border-black px-0.5 py-0.5 font-bold text-[12pt]">ลายมือชื่อ</th>
                  <th rowspan="2" class="border border-black px-0.5 py-0.5 align-middle font-bold text-[13pt]">หมายเหตุ</th>
                </tr>

                <!-- Header Row 2 (R05 & R06) -->
                <tr class="font-bold bg-slate-50 text-black text-[13pt] h-[24px]">
                  <th class="border border-black px-0.5 py-0.5 font-bold text-[13pt]">ตอบแทน</th>
                  
                  <!-- 31 Days columns (D to AH) -->
                  <th 
                    v-for="d in excelDays" 
                    :key="'head-'+d.day" 
                    class="border border-black p-0 font-normal text-[11.5pt] align-middle"
                  >
                    {{ d.day }}
                  </th>

                  <!-- Totals Header (AI, AJ) -->
                  <th class="border border-black p-0 font-normal text-[10.5pt] leading-none">วันปกติ<br><span class="text-[9pt] font-normal">(ชั่วโมง)</span></th>
                  <th class="border border-black p-0 font-normal text-[10.5pt] leading-none">วันหยุด<br><span class="text-[9pt] font-normal">(ชั่วโมง)</span></th>
                  
                  <th class="border border-black p-0 font-normal text-[10.5pt] align-middle">ที่รับเงิน</th>
                  <th class="border border-black p-0 font-normal text-[10.5pt] align-middle">ผู้รับเงิน</th>
                </tr>
              </thead>

              <!-- Table Body (Rows 7 - 26) -->
              <tbody>
                
                <!-- ROW 7: Weekday Rate & Hours -->
                <tr class="h-[26px]">
                  <td rowspan="2" class="border border-black align-middle font-bold text-[14pt]">1</td>
                  <td rowspan="2" class="border border-black align-middle text-left px-2 font-normal text-[14pt] leading-tight">
                    {{ store.settings.employeeName }}
                  </td>
                  <td class="border border-black align-middle font-normal text-[12.5pt]">
                    {{ store.settings.rateWeekday }} / ช.ม.
                  </td>
                  
                  <!-- 31 Days Weekday Hours (D7 - AH7) -->
                  <td 
                    v-for="d in excelDays" 
                    :key="'w-'+d.day" 
                    class="border border-black align-middle font-normal text-[11pt] p-0"
                  >
                    {{ d.weekdayHours || '' }}
                  </td>

                  <!-- Total Weekday Hours (AI7) -->
                  <td class="border border-black align-middle font-bold text-[13.5pt]">
                    {{ totalWeekdayHours > 0 ? totalWeekdayHours : '' }}
                  </td>
                  <!-- Total Holiday blank on row 7 -->
                  <td class="border border-black align-middle"></td>
                  <!-- Weekday Amount (AK7) -->
                  <td class="border border-black align-middle font-bold text-center text-[13pt]">
                    {{ weekdayAmount > 0 ? weekdayAmount.toLocaleString() : '' }}
                  </td>
                  <!-- Signatures & Notes (AL7, AM7, AN7) merged 2 rows -->
                  <td rowspan="2" class="border border-black align-middle"></td>
                  <td rowspan="2" class="border border-black align-middle"></td>
                  <td rowspan="2" class="border border-black align-middle"></td>
                </tr>

                <!-- ROW 8: Holiday Rate & Hours -->
                <tr class="h-[26px]">
                  <td class="border border-black align-middle font-normal text-[12.5pt]">
                    {{ store.settings.rateHoliday }} / ช.ม.
                  </td>
                  
                  <!-- 31 Days Holiday Hours (D8 - AH8) -->
                  <td 
                    v-for="d in excelDays" 
                    :key="'h-'+d.day" 
                    class="border border-black align-middle font-normal text-[11pt] p-0"
                    :class="!d.hasOt ? 'bg-slate-200/90' : ''"
                  >
                    {{ d.holidayHours || '' }}
                  </td>

                  <!-- Total Weekday blank on row 8 -->
                  <td class="border border-black align-middle"></td>
                  <!-- Total Holiday Hours (AJ8) -->
                  <td class="border border-black align-middle font-bold text-[13.5pt]">
                    {{ totalHolidayHours > 0 ? totalHolidayHours : '' }}
                  </td>
                  <!-- Holiday Amount (AK8) -->
                  <td class="border border-black align-middle font-bold text-center text-[13pt]">
                    {{ holidayAmount > 0 ? holidayAmount.toLocaleString() : '0' }}
                  </td>
                </tr>

                <!-- ROW 9-11: เวลากลับ (Return Time: Vertically Rotated 90 degrees like authentic Excel) -->
                <tr class="h-[48px]">
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black font-bold align-middle text-[13pt]">เวลากลับ</td>
                  <td 
                    v-for="d in excelDays" 
                    :key="'ret-'+d.day" 
                    class="border border-black align-middle p-0"
                    :class="!d.hasOt ? 'bg-slate-200/90' : ''"
                  >
                    <div v-if="d.endTime" class="vertical-time-text">
                      {{ d.endTime }}
                    </div>
                  </td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                </tr>

                <!-- ROW 13-15: ลายมือชื่อตอนกลับ (Sign Return: Merged 3 Rows for Authentic Signature Space) -->
                <tr class="h-[42px]">
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black font-bold align-middle text-[13pt]">ลายมือชื่อ</td>
                  <td 
                    v-for="d in excelDays" 
                    :key="'sign-ret-'+d.day" 
                    class="border border-black align-middle"
                    :class="!d.hasOt ? 'bg-slate-200/90' : ''"
                  ></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                </tr>

                <!-- ROW 17-19: เวลามา (Start Time: Vertically Rotated 90 degrees) -->
                <tr class="h-[48px]">
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black font-bold align-middle text-[13pt]">เวลามา</td>
                  <td 
                    v-for="d in excelDays" 
                    :key="'arr-'+d.day" 
                    class="border border-black align-middle p-0"
                    :class="!d.hasOt ? 'bg-slate-200/90' : ''"
                  >
                    <div v-if="d.startTime" class="vertical-time-text">
                      {{ d.startTime }}
                    </div>
                  </td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                </tr>

                <!-- ROW 21-23: ลายมือชื่อตอนมา (Sign Arrival: Merged 3 Rows) -->
                <tr class="h-[42px]">
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black font-bold align-middle text-[13pt]">ลายมือชื่อ</td>
                  <td 
                    v-for="d in excelDays" 
                    :key="'sign-arr-'+d.day" 
                    class="border border-black align-middle"
                    :class="!d.hasOt ? 'bg-slate-200/90' : ''"
                  ></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                </tr>

                <!-- ROW 25-26: แถวรวม (Summary Row) -->
                <tr class="h-[46px] font-bold">
                  <td colspan="31" class="border border-black"></td>
                  <td colspan="3" class="border border-black align-middle font-bold text-center text-[14pt]">รวม</td>
                  <td class="border border-black align-middle font-bold text-center text-[11.5pt] leading-[1.25] p-0.5">
                    <template v-if="totalWeekdayHours > 0">
                      <div>{{ totalWeekdayHours }}X{{ store.settings.rateWeekday || 50 }} =</div>
                      <div>{{ (totalWeekdayHours * (store.settings.rateWeekday || 50)) }}</div>
                    </template>
                  </td>
                  <td class="border border-black align-middle font-bold text-center text-[11.5pt] leading-[1.25] p-0.5">
                    <template v-if="totalHolidayHours > 0">
                      <div>{{ totalHolidayHours }}X{{ store.settings.rateHoliday || 60 }} =</div>
                      <div>{{ (totalHolidayHours * (store.settings.rateHoliday || 60)) }}</div>
                    </template>
                  </td>
                  <td class="border border-black align-middle font-bold text-center text-[14pt]">
                    {{ grandTotalAmount.toLocaleString() }}
                  </td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                  <td class="border border-black"></td>
                </tr>

              </tbody>
            </table>
          </div>

          <!-- Document Footer & Signatures Block (Rows 28 - 32 in Excel) -->
          <div class="mt-3 space-y-1 font-sarabun text-[14pt] leading-tight text-black pl-8 pr-4">
            
            <p class="font-bold text-[14pt]">
              รวมเงินจ่ายทั้งสิ้น ({{ thaiBahtText(grandTotalAmount) }})
            </p>

            <p class="font-normal text-[14pt]">
              ขอรับรองว่าผู้มีรายชื่อข้างต้นปฏิบัติงานนอกเวลาจริง
            </p>

            <div class="pt-2 grid grid-cols-2 gap-4 text-[14pt]">
              
              <!-- Left Column: ผู้รับรองการปฏิบัติงาน -->
              <div class="space-y-0.5 text-left pl-4">
                <p>ลงชื่อ ................................................................ผู้รับรองการปฏิบัติงาน</p>
                <div class="pl-10 space-y-0.5">
                  <p class="font-normal">( {{ store.settings.employeeName }} )</p>
                  <p class="font-normal">
                    ตำแหน่ง {{ store.settings.position }} {{ store.settings.positionLevel || '' }}
                  </p>
                </div>
              </div>

              <!-- Right Column: ผู้จ่ายเงิน -->
              <div class="space-y-0.5 text-right pr-6">
                <p>ลายมือชื่อ ................................................................ผู้จ่ายเงิน</p>
              </div>

            </div>

          </div>

        </div>


        <!-- ============================================================= -->
        <!-- 2. WORD REPORT PREVIEW: รายงานผลการปฏิบัติงานฯ (ตรงตามต้นฉบับเป๊ะ) -->
        <!-- ============================================================= -->
        <div 
          v-else 
          :style="{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }"
          class="word-sheet-paper bg-white text-black shadow-2xl rounded-sm border border-slate-300 mx-auto w-[794px] min-h-[1123px] font-sarabun text-[16pt] leading-[1.6] select-text"
          style="padding-top: 25mm; padding-bottom: 25mm; padding-right: 25mm; padding-left: 35mm;"
        >
          
          <!-- Document Header Titles (Center Aligned 16pt Bold) -->
          <div class="text-center font-bold mb-8 space-y-0 text-[16pt]">
            <h1 class="font-bold text-[16pt] leading-tight">รายงานผลการปฏิบัติงานนอกเวลาราชการ</h1>
            <p class="font-bold text-[16pt] leading-tight">ประจำเดือน {{ monthName }} {{ thaiYear }}</p>
            <p class="font-bold text-[16pt] leading-tight">{{ store.settings.employeeName }}</p>
          </div>

          <!-- Empty State -->
          <div v-if="wordLogs.length === 0" class="text-center py-20 text-slate-400 text-[16pt]">
            (ยังไม่มีรายการบันทึกงานที่ขอเบิกเงินในเดือนนี้)
          </div>

          <!-- Daily Task Items (Exact Word formatting: วันที่ ... (Bold) ต่อด้วย - งานที่ทำ) -->
          <div v-else class="space-y-3 mb-16 text-[16pt]">
            <div 
              v-for="item in wordLogs" 
              :key="item.day" 
              class="space-y-0 text-[16pt]"
            >
              <p class="font-bold text-black text-[16pt] leading-snug">
                วันที่ {{ item.thaiDay }} {{ monthName }} {{ thaiYear }}
              </p>
              <p class="text-black text-[16pt] leading-snug pl-[1.5cm]">
                - {{ item.taskDesc }}
              </p>
            </div>
          </div>

          <!-- Bottom Signature Block (Right Aligned with Sarabun 16pt) -->
          <div class="flex justify-end mt-16 pr-4 text-[16pt]">
            <div class="text-center space-y-0.5 min-w-[280px] text-[16pt] leading-snug">
              <p class="text-[16pt]">ลงชื่อ......................................................</p>
              <p class="font-normal text-[16pt]">( {{ store.settings.employeeName }} )</p>
              <p class="text-[16pt] text-black">
                ตำแหน่ง {{ store.settings.position }} {{ store.settings.positionLevel || '' }}
              </p>
            </div>
          </div>

        </div>

      </div>

      <!-- Modal Footer Bar -->
      <div class="px-6 py-3.5 bg-slate-100 dark:bg-slate-800/95 border-t border-slate-300 dark:border-slate-700 flex flex-wrap gap-3 justify-between items-center text-xs text-slate-600 dark:text-slate-400">
        <div class="flex items-center space-x-2">
          <FileCheck2 class="w-4 h-4 text-emerald-600 shrink-0" />
          <span>เอกสารถอดแบบตามโครงสร้างแบบฟอร์มราชการกรมทรัพย์สินทางปัญญา 100%</span>
        </div>
        
        <div class="flex items-center space-x-2">
          <button
            @click="handleSaveExcel"
            :disabled="isSaving"
            type="button"
            class="px-4 py-2 text-xs font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs inline-flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <Download class="w-3.5 h-3.5" />
            <span>บันทึก Excel (.xlsx)</span>
          </button>

          <button
            @click="handleSaveWord"
            :disabled="isSaving"
            type="button"
            class="px-4 py-2 text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-xs inline-flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <Download class="w-3.5 h-3.5" />
            <span>บันทึก Word (.docx)</span>
          </button>

          <button
            @click="handleSavePdf"
            type="button"
            class="px-4 py-2 text-xs font-bold rounded-xl text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-900 shadow-xs inline-flex items-center space-x-1.5 transition cursor-pointer"
          >
            <Download class="w-3.5 h-3.5" />
            <span>บันทึก PDF</span>
          </button>

          <button
            @click="handlePrint"
            type="button"
            class="px-4 py-2 text-xs font-bold rounded-xl text-white bg-primary hover:bg-primary-hover shadow-sm inline-flex items-center space-x-1.5 transition cursor-pointer"
          >
            <Printer class="w-3.5 h-3.5" />
            <span>พิมพ์เอกสาร (Print)</span>
          </button>

          <button 
            @click="emit('close')"
            type="button" 
            class="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer ml-1"
          >
            ปิด
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.font-sarabun {
  font-family: 'TH Sarabun New', 'TH SarabunPSK', 'Sarabun', 'Cordia New', 'IBM Plex Sans Thai', sans-serif;
}

/* Vertical rotated text for arrival and return times (90 degrees rotation) */
.vertical-time-text {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 9.5pt;
  line-height: 1;
  text-align: center;
  margin: 0 auto;
  letter-spacing: -0.5px;
  white-space: nowrap;
}
</style>
