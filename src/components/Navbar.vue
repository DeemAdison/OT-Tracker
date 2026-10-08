<script setup>
import { computed } from 'vue';
import { useOtStore } from '../stores/otStore';
import { THAI_MONTHS } from '../services/pdfParser';
import { 
  FileUp, 
  Scale, 
  Download, 
  Settings as SettingsIcon,
  Calendar,
  AlertCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Printer,
  Sun,
  Moon
} from 'lucide-vue-next';

const emit = defineEmits(['open-upload', 'open-reconcile', 'open-export', 'open-preview', 'open-settings']);
const store = useOtStore();

// Dynamic Year list (Supports past years and auto-expands into the future without limits)
const thaiYears = computed(() => {
  const currentBYear = new Date().getFullYear() + 543;
  const activeYear = store.currentYear || currentBYear;
  const minYear = Math.min(2565, activeYear - 3);
  const maxYear = Math.max(currentBYear + 6, activeYear + 5, 2575);
  
  const years = [];
  for (let y = minYear; y <= maxYear; y++) {
    years.push(y);
  }
  return years;
});

const unresolvedBadge = computed(() => store.unresolvedCount);

// Short Thai months (ม.ค., ก.พ., ...)
const shortThaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
</script>

<template>
  <header class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs transition-colors duration-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      <!-- Top Row -->
      <div class="flex justify-between items-center h-16 gap-3">
        
        <!-- Logo & Title -->
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-md font-bold text-lg shrink-0">
            OT
          </div>
          <div>
            <div class="flex items-center space-x-2">
              <span class="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">ระบบบันทึกและคำนวณเงิน OT</span>
              <span class="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-secondary dark:text-slate-400 font-medium hidden sm:inline">
                ประจำบุคคล
              </span>
            </div>
            <p class="text-xs text-secondary dark:text-slate-400">
              <span v-if="store.settings.employeeName">
                {{ store.settings.department ? store.settings.department + ' • ' : '' }}{{ store.settings.employeeName }}
              </span>
              <span v-else class="text-primary hover:underline cursor-pointer font-medium" @click="emit('open-settings')">
                ⚙️ คลิกเพื่อตั้งค่าชื่อและสังกัดของคุณ
              </span>
            </p>
          </div>
        </div>

        <!-- Month & Year Quick Switcher (Buttons < Month Year >) -->
        <div class="flex items-center bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-2xs">
          <!-- Prev Month -->
          <button 
            @click="store.prevMonth()" 
            type="button" 
            title="เดือนก่อนหน้า"
            class="w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary hover:bg-white dark:hover:bg-slate-700 active:scale-90 rounded-lg transition touch-manipulation cursor-pointer"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>

          <!-- Month Selector Dropdown -->
          <select 
            :value="store.currentMonth" 
            @change="store.setMonth(Number($event.target.value))"
            class="bg-transparent text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer py-1.5 px-1.5 rounded touch-manipulation"
          >
            <option v-for="(m, idx) in THAI_MONTHS" :key="idx" :value="idx + 1" class="dark:bg-slate-800 text-slate-800 dark:text-slate-100">
              {{ m }}
            </option>
          </select>

          <!-- Year Selector Dropdown -->
          <select 
            :value="store.currentYear" 
            @change="store.setYear(Number($event.target.value))"
            class="bg-transparent text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer py-1.5 px-1 rounded border-l border-slate-200 dark:border-slate-700 touch-manipulation"
          >
            <option v-for="y in thaiYears" :key="y" :value="y" class="dark:bg-slate-800 text-slate-800 dark:text-slate-100">
              {{ y }}
            </option>
          </select>

          <!-- Next Month -->
          <button 
            @click="store.nextMonth()" 
            type="button" 
            title="เดือนถัดไป"
            class="w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary hover:bg-white dark:hover:bg-slate-700 active:scale-90 rounded-lg transition touch-manipulation cursor-pointer"
          >
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>

        <!-- Jump to Current Month Button (Shown when user is looking at another month) -->
        <button 
          v-if="!store.isCurrentSystemMonth"
          @click="store.goToCurrentMonth()"
          type="button"
          class="hidden md:inline-flex items-center space-x-1 min-h-[38px] px-2.5 py-1.5 text-xs font-bold rounded-xl text-primary bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 transition shadow-2xs active:scale-95 touch-manipulation cursor-pointer"
          title="สลับกลับมาที่เดือนและปีปัจจุบันตามนาฬิกาของเครื่อง"
        >
          <Calendar class="w-3.5 h-3.5" />
          <span>เดือนปัจจุบัน</span>
        </button>

        <!-- Action Buttons -->
        <div class="flex items-center space-x-1 sm:space-x-1.5">
          
          <!-- Upload PDF Button -->
          <button 
            @click="emit('open-upload')"
            class="inline-flex items-center space-x-1 min-h-[38px] px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-xl text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition shadow-2xs touch-manipulation cursor-pointer"
            title="นำเข้าไฟล์ PDF รายงานการลงเวลา"
          >
            <FileUp class="w-4 h-4 text-primary" />
            <span class="hidden md:inline">นำเข้า PDF</span>
          </button>

          <!-- Reconcile Button with Alert Badge -->
          <button 
            @click="emit('open-reconcile')"
            class="relative inline-flex items-center space-x-1 min-h-[38px] px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-xl text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition shadow-2xs touch-manipulation cursor-pointer"
            title="ตรวจสอบการกระทบยอดเวลา"
          >
            <Scale class="w-4 h-4 text-amber-600" />
            <span class="hidden md:inline">กระทบยอด</span>
            <span 
              v-if="unresolvedBadge > 0"
              class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shadow"
            >
              {{ unresolvedBadge }}
            </span>
          </button>

          <!-- Unified Export & Print Center Button -->
          <button 
            @click="emit('open-preview')"
            class="inline-flex items-center space-x-1.5 min-h-[38px] px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl text-white bg-primary hover:bg-primary-hover active:scale-95 transition shadow-sm touch-manipulation cursor-pointer"
            title="ดูตัวอย่าง ส่งออก Excel / Word และพิมพ์เอกสารราชการ"
          >
            <Printer class="w-4 h-4" />
            <span class="hidden sm:inline">ส่งออก / พิมพ์เอกสาร</span>
            <span class="sm:hidden">ส่งออก</span>
          </button>

          <!-- Dark Mode Toggle Button (ข้อ 5) -->
          <button 
            @click="store.toggleTheme()"
            class="w-9 sm:w-10 h-9 sm:h-10 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 rounded-xl transition touch-manipulation cursor-pointer"
            :title="store.isDark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืดถนอมสายตา'"
          >
            <Sun v-if="store.isDark" class="w-4 h-4 text-amber-400" />
            <Moon v-else class="w-4 h-4 text-slate-600" />
          </button>

          <!-- Settings Button -->
          <button 
            @click="emit('open-settings')"
            class="w-9 sm:w-10 h-9 sm:h-10 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 rounded-xl transition touch-manipulation cursor-pointer"
            title="ตั้งค่าส่วนบุคคล"
          >
            <SettingsIcon class="w-4 h-4" />
          </button>

          <!-- Logout / Lock Button -->
          <button 
            @click="store.logout()"
            class="w-9 sm:w-10 h-9 sm:h-10 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-90 rounded-xl transition touch-manipulation cursor-pointer"
            title="ล็อกหน้าจอ / ออกจากระบบ"
          >
            <LogOut class="w-4 h-4" />
          </button>

        </div>

      </div>

      <!-- Quick 12-Month Switcher Bar (ข้อ 2: เลือกเดือนได้ในคลิกเดียว) -->
      <div class="py-2 overflow-x-auto flex items-center space-x-1.5 border-t border-slate-100 dark:border-slate-800 scrollbar-none overscroll-x-contain">
        <span class="text-[11px] font-semibold text-slate-400 dark:text-slate-500 px-1 hidden sm:inline select-none">
          เลือกเดือน:
        </span>
        <button
          v-for="(shortM, idx) in shortThaiMonths"
          :key="idx"
          @click="store.setMonth(idx + 1)"
          type="button"
          :class="[
            'min-h-[34px] px-3 py-1 text-xs font-semibold rounded-xl transition whitespace-nowrap active:scale-95 touch-manipulation cursor-pointer select-none',
            store.currentMonth === (idx + 1)
              ? 'bg-primary text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
          ]"
        >
          {{ shortM }}
        </button>
      </div>

    </div>
  </header>
</template>
