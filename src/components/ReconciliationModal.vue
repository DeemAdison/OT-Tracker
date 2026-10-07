<script setup>
import { computed } from 'vue';
import { useOtStore } from '../stores/otStore';
import { THAI_MONTHS } from '../services/pdfParser';
import { getCivilServiceReportTimes } from '../services/thaiHolidays';
import { 
  X, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  ArrowRight,
  Plus
} from 'lucide-vue-next';

const props = defineProps({
  show: Boolean,
});

const emit = defineEmits(['close', 'edit-day']);
const store = useOtStore();

const discrepancies = computed(() => store.discrepancies);

// Sync single day to scan
async function syncSingleDay(item) {
  if (item.scan && item.log) {
    const isHoliday = item.scan.dayType === 'holiday' || item.log.dayType === 'holiday';
    const hours = isHoliday ? Math.min(7, item.scan.otHours) : item.scan.otHours;
    const sTime = item.scan.scanIn || (isHoliday ? '08:30' : '16:30');
    const eTime = item.scan.scanOut || '16:30';

    await store.saveLog({
      ...item.log,
      dayType: isHoliday ? 'holiday' : 'weekday',
      hours,
      startTime: sTime,
      endTime: eTime,
      scanOut: item.scan.scanOut,
      scanIn: item.scan.scanIn,
    });
  }
}

// Add unlogged scan
async function addUnloggedScan(item) {
  if (item.scan) {
    const defaultDesc = store.presets[0]?.description || 'ปฏิบัติหน้าที่ตามที่ได้รับมอบหมาย';
    const isHoliday = item.scan.dayType === 'holiday';
    const hours = isHoliday ? Math.min(7, item.scan.otHours) : item.scan.otHours;
    const sTime = item.scan.scanIn || (isHoliday ? '08:30' : '16:30');
    const eTime = item.scan.scanOut || '16:30';

    await store.saveLog({
      day: item.scan.day,
      date: item.scan.date,
      dayType: isHoliday ? 'holiday' : 'weekday',
      startTime: sTime,
      endTime: eTime,
      hours,
      taskDesc: defaultDesc,
      scanIn: item.scan.scanIn,
      scanOut: item.scan.scanOut,
      isClaimed: true,
    });
  }
}

// Ignore/Unclaim missing scan
async function ignoreMissingScan(item) {
  if (item.log) {
    await store.saveLog({
      ...item.log,
      isClaimed: false,
    });
  }
}

// Auto Resolve All
async function handleAutoResolveAll() {
  await store.autoResolveAll();
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all flex flex-col max-h-[90vh] text-slate-800 dark:text-slate-100">
      
      <!-- Modal Header -->
      <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <div>
          <div class="flex items-center space-x-2">
            <h3 class="text-base font-bold text-slate-800 dark:text-white">
              ระบบตรวจสอบและกระทบยอดเวลา (Reconciliation)
            </h3>
            <span class="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
              {{ store.monthName }} {{ store.currentYear }}
            </span>
          </div>
          <p class="text-xs text-secondary dark:text-slate-400 mt-0.5">
            เปรียบเทียบข้อมูลที่บันทึกงานไว้กับเวลาสแกนจริงในรายงาน PDF
          </p>
        </div>
        <button @click="emit('close')" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Top Action Banner -->
      <div class="px-6 py-3 bg-amber-50/70 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div class="flex items-center space-x-2 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle class="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span>
            พบรายการที่ต้องตรวจทาน <strong>{{ store.unresolvedCount }} รายการ</strong> (เวลาไม่ตรง / ยังไม่ได้ลงงาน / ไม่พบสแกน)
          </span>
        </div>
        <button 
          @click="handleAutoResolveAll"
          type="button" 
          class="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 shadow transition whitespace-nowrap cursor-pointer"
        >
          <Sparkles class="w-3.5 h-3.5" />
          <span>⚡ ซิงค์เวลาตาม PDF ทั้งหมด (Auto-Resolve)</span>
        </button>
      </div>

      <!-- Diff / Reconciliation List Table -->
      <div class="p-6 overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800">
        
        <div 
          v-for="item in discrepancies" 
          :key="item.day"
          :class="[
            'py-3.5 px-3 rounded-xl transition mb-2',
            item.type === 'hours_mismatch' ? 'bg-red-50/40 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60' :
            item.type === 'unlogged_scan' ? 'bg-blue-50/40 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60' :
            item.type === 'missing_scan' ? 'bg-amber-50/40 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60' :
            'bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800'
          ]"
        >
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            <!-- Left: Day & Status Tag -->
            <div class="flex items-start space-x-3 min-w-[200px]">
              <div 
                :class="[
                  'w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0',
                  item.type === 'hours_mismatch' ? 'bg-primary text-white' :
                  item.type === 'unlogged_scan' ? 'bg-blue-600 text-white' :
                  item.type === 'missing_scan' ? 'bg-amber-500 text-white' :
                  'bg-emerald-600 text-white'
                ]"
              >
                {{ item.day }}
              </div>
              <div>
                <span class="text-xs font-bold text-slate-800 dark:text-white">
                  วันที่ {{ item.day }} {{ store.monthName }}
                </span>
                <div class="text-[11px] font-semibold mt-0.5 flex items-center space-x-1">
                  <span 
                    v-if="item.type === 'matched'" 
                    class="text-emerald-700 dark:text-emerald-400 flex items-center space-x-1"
                  >
                    <CheckCircle2 class="w-3.5 h-3.5" />
                    <span>ข้อมูลตรงกันสมบูรณ์</span>
                  </span>
                  <span 
                    v-else-if="item.type === 'hours_mismatch'" 
                    class="text-red-700 dark:text-red-400 flex items-center space-x-1"
                  >
                    <AlertCircle class="w-3.5 h-3.5" />
                    <span>เวลาออกงานไม่ตรงกัน</span>
                  </span>
                  <span 
                    v-else-if="item.type === 'unlogged_scan'" 
                    class="text-blue-700 dark:text-blue-400 flex items-center space-x-1"
                  >
                    <AlertCircle class="w-3.5 h-3.5" />
                    <span>มีสแกน OT แต่ยังไม่ลงงาน</span>
                  </span>
                  <span 
                    v-else-if="item.type === 'missing_scan'" 
                    class="text-amber-700 dark:text-amber-400 flex items-center space-x-1"
                  >
                    <AlertTriangle class="w-3.5 h-3.5" />
                    <span>ไม่พบเวลาสแกนใน PDF</span>
                  </span>
                </div>
              </div>
            </div>

            <!-- Middle: Data Comparison -->
            <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              
              <!-- Logged column -->
              <div class="bg-white dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-0.5">ข้อมูลที่บันทึกไว้:</span>
                <div v-if="item.log">
                  <div class="font-semibold text-slate-800 dark:text-white">
                    {{ item.log.hours }} ชม. ({{ item.log.startTime }} - {{ item.log.endTime }} น.)
                  </div>
                  <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">{{ item.log.taskDesc }}</div>
                </div>
                <div v-else class="text-slate-400 dark:text-slate-500 italic">
                  (ยังไม่ได้ลงบันทึกงาน)
                </div>
              </div>

              <!-- PDF Scan column -->
              <div class="bg-white dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-0.5">ข้อมูลในรายงาน PDF:</span>
                <div v-if="item.scan">
                  <div class="font-semibold text-slate-800 dark:text-white">
                    เข้า {{ item.scan.scanIn || '-' }} • ออก <strong>{{ item.scan.scanOut || '-' }} น.</strong>
                  </div>
                  <div class="text-[11px] text-slate-500 dark:text-slate-400">
                    คำนวณ OT ได้: <strong>{{ item.scan.otHours }} ชม.</strong>
                    <span v-if="item.scan.remark">({{ item.scan.remark }})</span>
                  </div>
                </div>
                <div v-else class="text-slate-400 dark:text-slate-500 italic">
                  (ไม่พบข้อมูลสแกนในวันดังกล่าว)
                </div>
              </div>

            </div>

            <!-- Right: Actions -->
            <div class="flex items-center space-x-1.5 justify-end">
              
              <!-- If Hours mismatch -->
              <template v-if="item.type === 'hours_mismatch'">
                <button 
                  @click="syncSingleDay(item)"
                  type="button" 
                  class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-sm transition cursor-pointer"
                >
                  ปรับเป็น {{ item.scan.otHours }} ชม.
                </button>
              </template>

              <!-- If Unlogged scan -->
              <template v-if="item.type === 'unlogged_scan'">
                <button 
                  @click="addUnloggedScan(item)"
                  type="button" 
                  class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm inline-flex items-center space-x-1 transition cursor-pointer"
                >
                  <Plus class="w-3.5 h-3.5" />
                  <span>เพิ่มงาน ({{ item.scan.otHours }} ชม.)</span>
                </button>
              </template>

              <!-- If Missing scan -->
              <template v-if="item.type === 'missing_scan'">
                <button 
                  @click="ignoreMissingScan(item)"
                  type="button" 
                  class="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
                  title="ไม่นำไปรวมในตารางเบิกเงิน"
                >
                  ไม่เบิกวันนี้
                </button>
              </template>

              <!-- Edit button opens modal -->
              <button 
                @click="emit('edit-day', item.day)"
                type="button" 
                class="px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
              >
                แก้ไข
              </button>

            </div>

          </div>
        </div>

      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end">
        <button 
          @click="emit('close')"
          type="button" 
          class="px-5 py-2 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
        >
          ปิดหน้าต่าง
        </button>
      </div>

    </div>
  </div>
</template>
