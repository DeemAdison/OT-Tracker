<script setup>
import { ref } from 'vue';
import { useOtStore } from '../stores/otStore';
import { thaiBahtText } from '../services/exportService';
import { useToast } from 'vue-toastification';
import { X, FileSpreadsheet, FileText, Download, CheckCircle, Loader2 } from 'lucide-vue-next';

const props = defineProps({
  show: Boolean,
});

const emit = defineEmits(['close']);
const store = useOtStore();
const toast = useToast();

const isExportingExcel = ref(false);
const isExportingWord = ref(false);
const exportedExcelName = ref('');
const exportedWordName = ref('');

async function handleExportExcel() {
  isExportingExcel.value = true;
  try {
    const filename = await store.downloadExcel();
    if (filename) {
      exportedExcelName.value = filename;
      toast.success(`บันทึกไฟล์ Excel สำเร็จ: ${filename}`);
    }
  } catch (err) {
    toast.error('เกิดข้อผิดพลาดในการสร้างไฟล์ Excel: ' + err.message);
  } finally {
    isExportingExcel.value = false;
  }
}

async function handleExportWord() {
  isExportingWord.value = true;
  try {
    const filename = await store.downloadWord();
    if (filename) {
      exportedWordName.value = filename;
      toast.success(`บันทึกไฟล์ Word สำเร็จ: ${filename}`);
    }
  } catch (err) {
    toast.error('เกิดข้อผิดพลาดในการสร้างไฟล์ Word: ' + err.message);
  } finally {
    isExportingWord.value = false;
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all text-slate-800 dark:text-slate-100">
      
      <!-- Header -->
      <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <div>
          <h3 class="text-base font-bold text-slate-800 dark:text-white">
            ส่งออกเอกสารเบิกจ่าย OT ประจำเดือน
          </h3>
          <p class="text-xs text-secondary dark:text-slate-400">
            ประจำเดือน {{ store.monthName }} {{ store.currentYear }}
            <span v-if="store.settings.employeeName"> • {{ store.settings.employeeName }}</span>
          </p>

        </div>
        <button @click="emit('close')" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 space-y-6">
        
        <!-- Summary Box -->
        <div class="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2 text-xs">
          <div class="flex justify-between items-center text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700 pb-2">
            <span>สรุปรายการที่ขอเบิกเงิน:</span>
            <span class="text-primary font-bold">{{ store.summary.claimedCount }} วัน</span>
          </div>

          <div class="flex justify-between text-slate-600 dark:text-slate-300">
            <span>ชั่วโมงวันทำการปกติ ({{ store.settings.rateWeekday }} บ./ชม.):</span>
            <span>{{ store.summary.weekdayHours }} ชม. = {{ store.summary.weekdayAmount.toLocaleString() }} บาท</span>
          </div>

          <div class="flex justify-between text-slate-600 dark:text-slate-300">
            <span>ชั่วโมงวันหยุดราชการ ({{ store.settings.rateHoliday }} บ./ชม.):</span>
            <span>{{ store.summary.holidayHours }} ชม. = {{ store.summary.holidayAmount.toLocaleString() }} บาท</span>
          </div>

          <div class="flex justify-between items-baseline pt-2 border-t border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-800 dark:text-white">
            <span>รวมเป็นเงินทั้งสิ้น:</span>
            <span class="text-lg text-primary">{{ store.summary.totalAmount.toLocaleString() }} บาท</span>
          </div>
          <p class="text-right text-[11px] text-slate-500 dark:text-slate-400 italic">
            ({{ thaiBahtText(store.summary.totalAmount) }})
          </p>
        </div>

        <!-- Export Action Cards -->
        <div class="space-y-3">
          
          <!-- Card 1: Excel -->
          <div class="border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40 transition">
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                <FileSpreadsheet class="w-6 h-6" />
              </div>
              <div>
                <h4 class="text-sm font-bold text-slate-800 dark:text-white">
                  หลักฐานการจ่ายเงินตอบแทนฯ (.xlsx)
                </h4>
                <p class="text-xs text-secondary dark:text-slate-400 mt-0.5">
                  ตาราง 31 วันตามแบบฟอร์มกรมทรัพย์สินทางปัญญา พร้อมสูตรคำนวณและช่องเซ็นชื่อ
                </p>
                <span v-if="exportedExcelName" class="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center space-x-1 mt-1">
                  <CheckCircle class="w-3.5 h-3.5" />
                  <span>ดาวน์โหลดสำเร็จแล้ว</span>
                </span>
              </div>
            </div>

            <button 
              @click="handleExportExcel"
              :disabled="isExportingExcel"
              class="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm inline-flex items-center space-x-1.5 transition disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Loader2 v-if="isExportingExcel" class="w-4 h-4 animate-spin" />
              <Download v-else class="w-4 h-4" />
              <span>ดาวน์โหลด Excel</span>
            </button>
          </div>

          <!-- Card 2: Word -->
          <div class="border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40 transition">
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-700 dark:text-blue-400">
                <FileText class="w-6 h-6" />
              </div>
              <div>
                <h4 class="text-sm font-bold text-slate-800 dark:text-white">
                  รายงานผลการปฏิบัติงานนอกเวลาราชการ (.docx)
                </h4>
                <p class="text-xs text-secondary dark:text-slate-400 mt-0.5">
                  เอกสาร Word จัดรูปแบบราชการ สรุปงานรายวันและแปลงเลขปี/วันเป็นเลขไทย
                </p>
                <span v-if="exportedWordName" class="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center space-x-1 mt-1">
                  <CheckCircle class="w-3.5 h-3.5" />
                  <span>ดาวน์โหลดสำเร็จแล้ว</span>
                </span>
              </div>
            </div>

            <button 
              @click="handleExportWord"
              :disabled="isExportingWord"
              class="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm inline-flex items-center space-x-1.5 transition disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Loader2 v-if="isExportingWord" class="w-4 h-4 animate-spin" />
              <Download v-else class="w-4 h-4" />
              <span>ดาวน์โหลด Word</span>
            </button>
          </div>

        </div>

      </div>

      <!-- Footer -->
      <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end">
        <button 
          @click="emit('close')"
          type="button" 
          class="px-5 py-2 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
        >
          ปิด
        </button>
      </div>

    </div>
  </div>
</template>
