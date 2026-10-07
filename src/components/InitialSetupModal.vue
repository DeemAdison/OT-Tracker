<script setup>
import { ref } from 'vue';
import { useOtStore } from '../stores/otStore';
import { useToast } from 'vue-toastification';
import { parseAttendancePdf } from '../services/pdfParser';
import { 
  Sparkles, 
  UploadCloud, 
  User, 
  Building2, 
  Briefcase, 
  Sliders, 
  KeyRound, 
  ArrowRight,
  CheckCircle2,
  Loader2
} from 'lucide-vue-next';

const props = defineProps({
  show: Boolean,
});

const emit = defineEmits(['completed']);
const store = useOtStore();
const toast = useToast();

const form = ref({
  employeeName: '',
  department: '',
  position: '',
  positionLevel: '',
  rateWeekday: 50,
  rateHoliday: 60,
  pin: '1234',
  isConfigured: true,
});

const isProcessingPdf = ref(false);
const autoDetectedSuccess = ref(false);
const errorMsg = ref('');

// Handle Auto-detect from PDF
async function handlePdfUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  isProcessingPdf.value = true;
  errorMsg.value = '';
  autoDetectedSuccess.value = false;

  try {
    const parsed = await parseAttendancePdf(file);
    if (parsed.employeeName) form.value.employeeName = parsed.employeeName;
    if (parsed.department) form.value.department = parsed.department;
    if (parsed.position) form.value.position = parsed.position;

    autoDetectedSuccess.value = true;
    toast.success('ดึงข้อมูลจาก PDF สำเร็จแล้ว กรุณาตรวจสอบความถูกต้อง');
  } catch (err) {
    errorMsg.value = 'ไม่สามารถอ่านข้อมูลจาก PDF ได้: ' + (err.message || 'โปรดตรวจสอบไฟล์');
  } finally {
    isProcessingPdf.value = false;
  }
}

async function handleSave() {
  if (!form.value.employeeName.trim()) {
    errorMsg.value = 'กรุณาระบุชื่อ - สกุล ของผู้ปฏิบัติงาน';
    return;
  }
  if (!form.value.department.trim()) {
    errorMsg.value = 'กรุณาระบุหน่วยงาน / สังกัด';
    return;
  }

  await store.updateSettings({
    ...form.value,
    isConfigured: true,
  });

  toast.success(`ยินดีต้อนรับคุณ ${form.value.employeeName} เข้าสู่ระบบ!`);
  emit('completed');
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all flex flex-col max-h-[90vh] text-slate-800 dark:text-slate-100">
      
      <!-- Header Banner -->
      <div class="px-8 pt-8 pb-6 bg-gradient-to-r from-red-50 via-white to-red-50 dark:from-red-950/30 dark:via-slate-900 dark:to-red-950/30 border-b border-slate-200 dark:border-slate-800 text-center relative">
        <div class="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center mx-auto shadow-md shadow-red-200 dark:shadow-red-950/40 mb-3">
          <Sparkles class="w-7 h-7" />
        </div>
        <h2 class="text-xl font-bold text-slate-800 dark:text-white">
          ยินดีต้อนรับสู่ระบบบันทึกและคำนวณเงิน OT
        </h2>
        <p class="text-xs text-secondary dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
          กรุณาระบุข้อมูลเริ่มต้นของคุณสำหรับใช้จัดทำเอกสารเบิกจ่าย (ทำเพียงครั้งแรกครั้งเดียว)
        </p>
      </div>

      <!-- Form Body -->
      <div class="p-8 space-y-6 overflow-y-auto flex-1">
        
        <!-- Quick Option: Upload PDF to Auto-fill -->
        <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-dashed border-slate-300 dark:border-slate-700 hover:border-primary transition text-center">
          <input 
            ref="pdfInput" 
            type="file" 
            accept="application/pdf" 
            class="hidden" 
            @change="handlePdfUpload" 
          />
          
          <div v-if="isProcessingPdf" class="py-2 flex items-center justify-center space-x-2 text-xs font-semibold text-primary">
            <Loader2 class="w-4 h-4 animate-spin" />
            <span>กำลังดึงข้อมูลจากไฟล์ PDF...</span>
          </div>

          <div v-else-if="autoDetectedSuccess" class="py-1 flex items-center justify-center space-x-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>ดึงข้อมูลชื่อ-สังกัด-ตำแหน่ง เรียบร้อยแล้ว (สามารถแก้ไขเพิ่มเติมได้ด้านล่าง)</span>
          </div>

          <div v-else class="space-y-1">
            <button 
              type="button" 
              @click="$refs.pdfInput.click()"
              class="inline-flex items-center space-x-1.5 text-xs font-bold text-primary hover:text-primary-hover transition cursor-pointer"
            >
              <UploadCloud class="w-4 h-4" />
              <span>⚡ คลิกเลือกไฟล์ PDF สแกนเวลา (เพื่อดึงข้อมูลชื่อและสังกัดอัตโนมัติ)</span>
            </button>
            <p class="text-[11px] text-slate-400 dark:text-slate-500">หรือกรอกข้อมูลด้วยตนเองในช่องด้านล่าง</p>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMsg" class="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 font-semibold">
          {{ errorMsg }}
        </div>

        <!-- Input Fields -->
        <div class="space-y-4">
          
          <!-- Name -->
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center space-x-1">
              <User class="w-3.5 h-3.5 text-primary" />
              <span>ชื่อ - สกุล <span class="text-red-500">*</span></span>
            </label>
            <input 
              v-model="form.employeeName" 
              type="text" 
              placeholder="เช่น นายสมชาย ใจดี" 
              class="w-full text-sm p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
            />
          </div>

          <!-- Department & Position Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center space-x-1">
                <Building2 class="w-3.5 h-3.5 text-secondary dark:text-slate-400" />
                <span>หน่วยงาน / สังกัด <span class="text-red-500">*</span></span>
              </label>
              <input 
                v-model="form.department" 
                type="text" 
                placeholder="เช่น กรมทรัพย์สินทางปัญญา" 
                class="w-full text-sm p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary transition"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center space-x-1">
                <Briefcase class="w-3.5 h-3.5 text-secondary dark:text-slate-400" />
                <span>ตำแหน่ง</span>
              </label>
              <input 
                v-model="form.position" 
                type="text" 
                placeholder="เช่น นักวิชาการพาณิชย์" 
                class="w-full text-sm p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary transition"
              />
            </div>
          </div>

          <!-- Position Level -->
          <div>
            <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              ระดับตำแหน่ง (ถ้ามี)
            </label>
            <input 
              v-model="form.positionLevel" 
              type="text" 
              placeholder="เช่น ชำนาญการ, ปฏิบัติการ หรือระดับไม่มีระดับตำแหน่ง" 
              class="w-full text-sm p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary transition"
            />
          </div>

          <!-- Hourly Rates -->
          <div class="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                วันปกติ (บาท/ชม.)
              </label>
              <input 
                v-model.number="form.rateWeekday" 
                type="number" 
                class="w-full text-sm p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary font-bold text-center"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                วันหยุด (บาท/ชม.)
              </label>
              <input 
                v-model.number="form.rateHoliday" 
                type="number" 
                class="w-full text-sm p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary font-bold text-center"
              />
            </div>
          </div>

          <!-- PIN -->
          <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center space-x-1">
              <KeyRound class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>ตั้งรหัส PIN เข้าใช้งาน (4-6 หลัก)</span>
            </label>
            <input 
              v-model="form.pin" 
              type="password" 
              maxlength="6" 
              placeholder="1234" 
              class="w-full text-sm p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary font-bold tracking-widest text-center"
            />
            <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-1">รหัสเริ่มต้นคือ 1234 (สามารถเปลี่ยนได้ตามต้องการ)</p>
          </div>

        </div>

      </div>

      <!-- Footer Button -->
      <div class="px-8 py-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800">
        <button 
          @click="handleSave"
          type="button" 
          class="w-full py-3.5 rounded-2xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-lg shadow-red-200 dark:shadow-red-950/40 transition flex items-center justify-center space-x-2 cursor-pointer"
        >
          <span>บันทึกข้อมูลและเริ่มใช้งาน</span>
          <ArrowRight class="w-4 h-4" />
        </button>
      </div>

    </div>
  </div>
</template>
