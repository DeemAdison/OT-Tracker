<script setup>
import { ref } from 'vue';
import { useOtStore } from '../stores/otStore';
import { X, UploadCloud, CheckCircle, FileText, Loader2 } from 'lucide-vue-next';

const props = defineProps({
  show: Boolean,
});

const emit = defineEmits(['close', 'uploaded']);
const store = useOtStore();

const isDragging = ref(false);
const isProcessing = ref(false);
const errorMsg = ref('');
const resultSummary = ref(null);

async function handleFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    errorMsg.value = 'กรุณาเลือกไฟล์ PDF (เช่น HR_RP_003_TimeToWork.pdf)';
    return;
  }

  errorMsg.value = '';
  isProcessing.value = true;
  resultSummary.value = null;

  try {
    const res = await store.importPdf(file);
    resultSummary.value = res;
    emit('uploaded');
  } catch (err) {
    errorMsg.value = 'เกิดข้อผิดพลาดในการอ่านไฟล์ PDF: ' + (err.message || 'โปรดตรวจสอบรูปแบบไฟล์');
  } finally {
    isProcessing.value = false;
  }
}

function onFileSelect(e) {
  const file = e.target.files[0];
  handleFile(file);
}

function onDrop(e) {
  isDragging.value = false;
  const file = e.dataTransfer.files[0];
  handleFile(file);
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all text-slate-800 dark:text-slate-100">
      
      <!-- Header -->
      <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <div>
          <h3 class="text-base font-bold text-slate-800 dark:text-white">
            นำเข้าไฟล์รายงานการลงเวลา (PDF)
          </h3>
          <p class="text-xs text-secondary dark:text-slate-400">
            เช่น ไฟล์ HR_RP_003_TimeToWork.pdf จากระบบสแกนนิ้ว/ลงเวลา
          </p>
        </div>
        <button @click="emit('close')" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 space-y-4">
        
        <!-- Drag & Drop Zone -->
        <div 
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
          :class="[
            'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition',
            isDragging ? 'border-primary bg-primary-light dark:bg-primary/10' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/40'
          ]"
          @click="$refs.fileInput.click()"
        >
          <input 
            ref="fileInput" 
            type="file" 
            accept="application/pdf" 
            class="hidden" 
            @change="onFileSelect" 
          />

          <div v-if="isProcessing" class="py-4 space-y-2">
            <Loader2 class="w-10 h-10 text-primary mx-auto animate-spin" />
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">กำลังสกัดข้อมูลจาก PDF...</p>
          </div>

          <div v-else class="space-y-3">
            <div class="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-primary mx-auto shadow-inner">
              <UploadCloud class="w-7 h-7" />
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-800 dark:text-white">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์ PDF มาวางที่นี่</p>
              <p class="text-xs text-secondary dark:text-slate-400 mt-0.5">รองรับไฟล์สแกนเวลาของราชการและหน่วยงาน</p>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMsg" class="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 font-medium">
          {{ errorMsg }}
        </div>

        <!-- Success Result -->
        <div v-if="resultSummary" class="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
          <div class="flex items-center space-x-2 font-bold text-emerald-800 dark:text-emerald-300 text-sm">
            <CheckCircle class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>นำเข้าข้อมูลเวลาสำเร็จ!</span>
          </div>
          <p>
            ระบบอ่านข้อมูลได้ {{ resultSummary.count }} วัน ประจำเดือน {{ store.monthName }} {{ store.currentYear }}
          </p>
          <p class="text-[11px] text-emerald-700 dark:text-emerald-400">
            ระบบได้ตรวจจับเวลาออกงานหลัง 16:30 น. และนำมาเทียบกับบันทึกงานให้เรียบร้อยแล้ว
          </p>
        </div>

      </div>

      <!-- Footer -->
      <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
        <button 
          @click="emit('close')"
          type="button" 
          class="px-4 py-2 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
        >
          ปิด
        </button>
      </div>

    </div>
  </div>
</template>
