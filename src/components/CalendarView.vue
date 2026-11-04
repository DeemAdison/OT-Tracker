<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useOtStore } from '../stores/otStore';
import { useToast } from 'vue-toastification';
import { 
  Clock, 
  Coins, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  FileText,
  AlertCircle,
  Keyboard,
  Calendar as CalendarIcon,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  LayoutGrid,
  List,
  Zap,
  Edit3,
  Check,
  CalendarCheck
} from 'lucide-vue-next';

const emit = defineEmits(['select-day', 'open-reconcile']);
const store = useOtStore();
const toast = useToast();

const focusedDay = ref(1);
const currentView = ref('calendar'); // 'calendar' or 'list'
const filterStatus = ref('all'); // 'all', 'claimed', 'pending_scan', 'holidays'

// Weekday Column Headers (ขอบซ้าย = วันอาทิตย์, ขอบขวา = วันเสาร์)
const weekHeaders = [
  { short: 'อา.', full: 'วันอาทิตย์', isWeekendBorder: true, side: 'left' },
  { short: 'จ.', full: 'วันจันทร์', isWeekendBorder: false },
  { short: 'อ.', full: 'วันอังคาร', isWeekendBorder: false },
  { short: 'พ.', full: 'วันพุธ', isWeekendBorder: false },
  { short: 'พฤ.', full: 'วันพฤหัสบดี', isWeekendBorder: false },
  { short: 'ศ.', full: 'วันศุกร์', isWeekendBorder: false },
  { short: 'ส.', full: 'วันเสาร์', isWeekendBorder: true, side: 'right' }
];

// Days in current month (1..31)
const daysList = computed(() => {
  const y = store.currentYear - 543;
  const m = store.currentMonth;
  const numDays = new Date(y, m, 0).getDate(); // 28, 29, 30, or 31

  const list = [];
  const daysOfWeek = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

  for (let d = 1; d <= numDays; d++) {
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeekIndex = dateObj.getDay(); // 0 = Sunday (left border), 6 = Saturday (right border)
    const dayOfWeek = daysOfWeek[dayOfWeekIndex];
    const isSunday = dayOfWeekIndex === 0;
    const isSaturday = dayOfWeekIndex === 6;
    const isWeekend = isSunday || isSaturday;

    // Use smart resolver that includes custom overrides
    const holidayInfo = store.getDayHolidayInfo(d);

    const log = store.logsByDay[d] || null;
    const scan = store.scansByDay[d] || null;

    // Discrepancy status
    let status = 'none';
    if (log && scan) {
      if (scan.otHours > 0 && log.hours !== scan.otHours) {
        status = 'hours_mismatch';
      } else {
        status = 'matched';
      }
    } else if (log && !scan) {
      status = 'missing_scan';
    } else if (!log && scan && scan.otHours > 0) {
      status = 'unlogged_scan';
    }

    const isToday = store.isCurrentSystemMonth && d === store.systemToday.day;

    list.push({
      day: d,
      dayOfWeekIndex,
      dayOfWeek,
      isSunday,
      isSaturday,
      isWeekend,
      isToday,
      holidayInfo,
      log,
      scan,
      status
    });
  }

  return list;
});

// Calculate padding cells so that Sunday is always Column 1 (Left Border) and Saturday is Column 7 (Right Border)
const firstDayOfWeekIndex = computed(() => {
  const y = store.currentYear - 543;
  const m = store.currentMonth;
  return new Date(y, m - 1, 1).getDay(); // 0 = Sunday, ..., 6 = Saturday
});

// Leading padding days from previous month
const paddingBefore = computed(() => {
  const y = store.currentYear - 543;
  const m = store.currentMonth;
  const prevMonthTotalDays = new Date(y, m - 1, 0).getDate();
  const count = firstDayOfWeekIndex.value; // 0 to 6
  const list = [];
  for (let i = count - 1; i >= 0; i--) {
    list.push({
      isPadding: true,
      day: prevMonthTotalDays - i,
      position: 'before'
    });
  }
  return list;
});

// Trailing padding days for next month to complete the 7-column row
const paddingAfter = computed(() => {
  const total = paddingBefore.value.length + daysList.value.length;
  const remainder = total % 7;
  if (remainder === 0) return [];
  const count = 7 - remainder;
  const list = [];
  for (let i = 1; i <= count; i++) {
    list.push({
      isPadding: true,
      day: i,
      position: 'after'
    });
  }
  return list;
});

// Filtered days list based on selected tab filter
const filteredDaysList = computed(() => {
  if (filterStatus.value === 'claimed') {
    return daysList.value.filter(d => Boolean(d.log));
  }
  if (filterStatus.value === 'pending_scan') {
    return daysList.value.filter(d => d.status === 'unlogged_scan' || d.status === 'hours_mismatch');
  }
  if (filterStatus.value === 'holidays') {
    return daysList.value.filter(d => Boolean(d.holidayInfo?.isHoliday));
  }
  return daysList.value;
});

// Counts for each filter badge
const filterCounts = computed(() => {
  let claimed = 0;
  let pendingScan = 0;
  let holidays = 0;
  for (const d of daysList.value) {
    if (d.log) claimed++;
    if (d.status === 'unlogged_scan' || d.status === 'hours_mismatch') pendingScan++;
    if (d.holidayInfo?.isHoliday) holidays++;
  }
  return {
    all: daysList.value.length,
    claimed,
    pendingScan,
    holidays
  };
});

// Quick 1-click action to log today
function handleQuickLogToday() {
  const targetDay = store.isCurrentSystemMonth ? store.systemToday.day : 1;
  focusedDay.value = targetDay;
  emit('select-day', targetDay);
}

// Quick toggle day type (Weekday ⇄ Holiday)
async function handleToggleDayType(day, e) {
  e.stopPropagation();
  const willBeHoliday = await store.toggleDayType(day);
  toast.success(
    willBeHoliday 
      ? `วันที่ ${day} ปรับเป็นวันหยุดราชการเรียบร้อยแล้ว` 
      : `วันที่ ${day} ปรับเป็นวันทำการปกติเรียบร้อยแล้ว`,
    { timeout: 2000 }
  );
}

// Fast Keyboard Navigation
function handleKeyDown(e) {
  // If typing in input or textarea, or modal is open, don't hijack keyboard
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

  const totalDays = daysList.value.length;
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    focusedDay.value = focusedDay.value < totalDays ? focusedDay.value + 1 : 1;
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    focusedDay.value = focusedDay.value > 1 ? focusedDay.value - 1 : totalDays;
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (focusedDay.value + 7 <= totalDays) focusedDay.value += 7;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (focusedDay.value - 7 >= 1) focusedDay.value -= 7;
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    emit('select-day', focusedDay.value);
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    
    <!-- Top KPI Cards (Compact & Responsive 2x2 on Mobile, 4 Cols on Desktop) -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
      
      <!-- Card 1: Total Hours -->
      <div class="bg-white dark:bg-slate-800 p-3.5 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between transition-colors">
        <div class="min-w-0">
          <p class="text-[10px] sm:text-xs font-semibold text-secondary dark:text-slate-400 uppercase tracking-wider truncate">ชั่วโมง OT รวม</p>
          <div class="mt-0.5 sm:mt-1 flex items-baseline space-x-1">
            <span class="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">{{ store.summary.totalHours }}</span>
            <span class="text-[11px] sm:text-xs text-secondary dark:text-slate-400">ชม.</span>
          </div>
          <p class="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate hidden sm:block">
            ปกติ {{ store.summary.weekdayHours }} • หยุด {{ store.summary.holidayHours }} ชม.
          </p>
        </div>
        <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-primary shrink-0 shadow-2xs">
          <Clock class="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      </div>

      <!-- Card 2: Total Earnings -->
      <div class="bg-white dark:bg-slate-800 p-3.5 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between transition-colors">
        <div class="min-w-0">
          <p class="text-[10px] sm:text-xs font-semibold text-secondary dark:text-slate-400 uppercase tracking-wider truncate">ยอดเงินตอบแทนรวม</p>
          <div class="mt-0.5 sm:mt-1 flex items-baseline space-x-1">
            <span class="text-xl sm:text-2xl font-bold text-primary">{{ store.summary.totalAmount.toLocaleString() }}</span>
            <span class="text-[11px] sm:text-xs text-secondary dark:text-slate-400">บาท</span>
          </div>
          <p class="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate hidden sm:block">
            อัตรา 50 / 60 บ./ชม.
          </p>
        </div>
        <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 shrink-0 shadow-2xs">
          <Coins class="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      </div>

      <!-- Card 3: Claimed Days -->
      <div class="bg-white dark:bg-slate-800 p-3.5 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between transition-colors">
        <div class="min-w-0">
          <p class="text-[10px] sm:text-xs font-semibold text-secondary dark:text-slate-400 uppercase tracking-wider truncate">วันที่ทำ OT</p>
          <div class="mt-0.5 sm:mt-1 flex items-baseline space-x-1">
            <span class="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">{{ store.summary.claimedCount }}</span>
            <span class="text-[11px] sm:text-xs text-secondary dark:text-slate-400">วัน</span>
          </div>
          <p class="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate hidden sm:block">
            {{ store.monthName }} {{ store.currentYear }}
          </p>
        </div>
        <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 shrink-0 shadow-2xs">
          <CheckCircle2 class="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      </div>

      <!-- Card 4: Reconciliation Status -->
      <div 
        @click="emit('open-reconcile')"
        class="bg-white dark:bg-slate-800 p-3.5 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 hover:shadow transition active:scale-[0.98]"
      >
        <div class="min-w-0">
          <p class="text-[10px] sm:text-xs font-semibold text-secondary dark:text-slate-400 uppercase tracking-wider truncate">กระทบยอด PDF</p>
          <div class="mt-0.5 sm:mt-1">
            <span 
              v-if="store.unresolvedCount > 0"
              class="text-xs sm:text-sm font-bold text-amber-600 flex items-center space-x-1"
            >
              <AlertTriangle class="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>รอตรวจ {{ store.unresolvedCount }} รายการ</span>
            </span>
            <span 
              v-else-if="store.attendanceScans.length > 0"
              class="text-xs sm:text-sm font-bold text-emerald-600 flex items-center space-x-1"
            >
              <CheckCircle2 class="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>ตรงกับ PDF 100%</span>
            </span>
            <span v-else class="text-xs sm:text-sm font-medium text-slate-400 dark:text-slate-500">
              ยังไม่ได้นำเข้า PDF
            </span>
          </div>
          <p class="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 hidden sm:block">คลิกตรวจทาน</p>
        </div>
        <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-secondary dark:text-slate-300 shrink-0 shadow-2xs">
          <FileText class="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      </div>

    </div>

    <!-- Quick Action & View Control Bar -->
    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors">
      
      <!-- Left: Quick Log Today & View Switcher -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- 1-Click Fast Log Today Button -->
        <button
          @click="handleQuickLogToday"
          type="button"
          class="min-h-[40px] px-3.5 sm:px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs sm:text-sm shadow-sm inline-flex items-center space-x-1.5 transition touch-manipulation cursor-pointer"
          :title="'บันทึกข้อมูลวันที่ ' + (store.isCurrentSystemMonth ? store.systemToday.day : 1)"
        >
          <Zap class="w-4 h-4 text-amber-300" />
          <span>บันทึก OT วันนี้ (วันที่ {{ store.isCurrentSystemMonth ? store.systemToday.day : 1 }})</span>
        </button>

        <!-- View Switcher (Grid Calendar ⇄ List View) -->
        <div class="flex items-center bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <button
            @click="currentView = 'calendar'"
            type="button"
            :class="[
              'px-2.5 sm:px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition cursor-pointer touch-manipulation',
              currentView === 'calendar'
                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            ]"
          >
            <LayoutGrid class="w-3.5 h-3.5" />
            <span>ปฏิทิน</span>
          </button>
          <button
            @click="currentView = 'list'"
            type="button"
            :class="[
              'px-2.5 sm:px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition cursor-pointer touch-manipulation',
              currentView === 'list'
                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            ]"
          >
            <List class="w-3.5 h-3.5" />
            <span>รายการ</span>
          </button>
        </div>
      </div>

      <!-- Right: Filter Pills -->
      <div class="flex items-center overflow-x-auto pb-1 md:pb-0 gap-1.5 scrollbar-none text-xs">
        <span class="text-[11px] font-semibold text-slate-400 dark:text-slate-500 hidden lg:inline mr-1">
          ตัวกรอง:
        </span>
        <button
          @click="filterStatus = 'all'"
          type="button"
          :class="[
            'px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer touch-manipulation',
            filterStatus === 'all'
              ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 font-bold shadow-2xs'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          ]"
        >
          ทั้งหมด ({{ filterCounts.all }})
        </button>
        <button
          @click="filterStatus = 'claimed'"
          type="button"
          :class="[
            'px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer touch-manipulation flex items-center space-x-1',
            filterStatus === 'claimed'
              ? 'bg-primary text-white font-bold shadow-2xs'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          ]"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>ทำ OT แล้ว ({{ filterCounts.claimed }})</span>
        </button>
        <button
          v-if="filterCounts.pendingScan > 0"
          @click="filterStatus = 'pending_scan'"
          type="button"
          :class="[
            'px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer touch-manipulation flex items-center space-x-1',
            filterStatus === 'pending_scan'
              ? 'bg-amber-600 text-white font-bold shadow-2xs'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
          ]"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          <span>รอตรวจสแกน ({{ filterCounts.pendingScan }})</span>
        </button>
        <button
          @click="filterStatus = 'holidays'"
          type="button"
          :class="[
            'px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer touch-manipulation',
            filterStatus === 'holidays'
              ? 'bg-rose-600 text-white font-bold shadow-2xs'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          ]"
        >
          วันหยุด ({{ filterCounts.holidays }})
        </button>
      </div>

    </div>

    <!-- Calendar View Container -->
    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs p-3 sm:p-4 md:p-5 lg:p-6 transition-colors">
      
      <!-- Calendar Header & Keyboard Shortcuts Bar -->
      <div class="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
        <div>
          <h2 class="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
            <span>ตารางปฏิบัติงานประจำเดือน {{ store.monthName }} {{ store.currentYear }}</span>
          </h2>
          <p class="text-xs text-secondary dark:text-slate-400">
            แตะที่ช่องวันที่เพื่อบันทึกหรือแก้ไขงาน OT
          </p>
        </div>
        
        <!-- Legend / Indicators -->
        <div class="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
          <span class="inline-flex items-center space-x-1">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>ตรงกับสแกน</span>
          </span>
          <span class="inline-flex items-center space-x-1">
            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>สแกนตกค้าง</span>
          </span>
          <span class="inline-flex items-center space-x-1">
            <span class="w-2 h-2 rounded-full bg-primary"></span>
            <span>เวลาไม่ตรง</span>
          </span>
        </div>
      </div>

      <!-- ======================================================== -->
      <!-- 1. GRID CALENDAR VIEW (มุมมองปฏิทินตาราง 7 วัน)           -->
      <!-- ======================================================== -->
      <div v-if="currentView === 'calendar'">
        <!-- 7-Column Day-of-Week Headers (ขอบซ้าย = วันอาทิตย์, ขอบขวา = วันเสาร์) -->
        <div class="hidden md:grid grid-cols-7 gap-1.5 md:gap-2 lg:gap-3 mb-2">
          <div 
            v-for="wh in weekHeaders" 
            :key="wh.short"
            :class="[
              'py-1.5 md:py-2 px-1 md:px-2 text-center rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 select-none',
              wh.isWeekendBorder
                ? 'bg-rose-100/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 shadow-2xs' 
                : 'bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            ]"
          >
            <span v-if="wh.isWeekendBorder" class="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-rose-500 mr-0.5 md:mr-1"></span>
            <span>{{ wh.full }}</span>
            <span class="text-[10px] md:text-[11px] font-normal opacity-75 hidden xl:inline">({{ wh.short }})</span>
          </div>
        </div>

        <!-- 7 Columns Calendar Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-1.5 md:gap-2 lg:gap-3">
          
          <!-- Leading Padding Days (Previous Month) -->
          <div 
            v-for="pad in paddingBefore" 
            :key="'pad-before-' + pad.day"
            class="hidden md:flex border border-dashed border-slate-200/60 dark:border-slate-800/60 rounded-xl p-2 md:p-2.5 lg:p-3 min-h-[100px] md:min-h-[115px] lg:min-h-[135px] flex-col justify-between opacity-35 bg-slate-50/30 dark:bg-slate-900/20 select-none cursor-default"
          >
            <div class="flex items-center space-x-1">
              <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-slate-400 dark:text-slate-600">
                {{ pad.day }}
              </span>
            </div>
            <div class="text-[9px] md:text-[10px] text-center text-slate-300 dark:text-slate-600">เดือนก่อน</div>
          </div>

          <!-- Current Month Days (1..31) -->
          <div 
            v-for="item in daysList" 
            :key="item.day"
            @click="focusedDay = item.day; emit('select-day', item.day)"
            :class="[
              'border rounded-xl p-2 sm:p-2.5 lg:p-3 min-h-[100px] md:min-h-[115px] lg:min-h-[135px] flex flex-col justify-between cursor-pointer transition hover:shadow-md active:scale-[0.98] relative overflow-hidden group select-none touch-manipulation',
              item.holidayInfo 
                ? (item.holidayInfo.isHoliday 
                    ? 'bg-rose-50/50 dark:bg-rose-950/25 border-rose-200 dark:border-rose-900/50' 
                    : 'bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-800/60')
                : (item.isWeekend 
                    ? 'bg-rose-50/20 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700' 
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'),
              (item.isSunday || item.isSaturday) ? 'ring-1 ring-rose-200/50 dark:ring-rose-900/30' : '',
              item.log ? 'border-primary/60 dark:border-primary/70 shadow-xs' : 'hover:border-slate-300 dark:hover:border-slate-600',
              item.isToday ? 'ring-2 ring-blue-500 dark:ring-blue-400 shadow-sm' : '',
              focusedDay === item.day ? 'ring-2 ring-primary/80' : '',
              // Dimmed if doesn't match active filter
              (filterStatus === 'claimed' && !item.log) ||
              (filterStatus === 'pending_scan' && !(item.status === 'unlogged_scan' || item.status === 'hours_mismatch')) ||
              (filterStatus === 'holidays' && !item.holidayInfo?.isHoliday)
                ? 'opacity-35 grayscale-[50%]' : ''
            ]"
          >
            <!-- Day Header -->
            <div>
              <div class="flex justify-between items-start">
                <div class="flex items-center space-x-1 sm:space-x-1.5 min-w-0">
                  <span 
                    :class="[
                      'w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center font-bold text-xs md:text-sm transition shrink-0',
                      item.log 
                        ? 'bg-primary text-white shadow-xs' 
                        : (item.holidayInfo?.isHoliday 
                            ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 font-extrabold' 
                            : (item.isWeekend 
                                ? 'bg-rose-100/60 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-semibold' 
                                : 'text-slate-800 dark:text-slate-100'))
                    ]"
                  >
                    {{ item.day }}
                  </span>
                  <span 
                    v-if="item.isToday"
                    class="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-600 text-white shadow-2xs tracking-tight animate-pulse"
                  >
                    วันนี้
                  </span>
                  <span 
                    :class="[
                      'text-[10px] sm:text-[11px] font-medium truncate',
                      (item.isSunday || item.isSaturday) ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-500 dark:text-slate-400'
                    ]"
                  >
                    <span class="md:hidden lg:inline">{{ item.dayOfWeek }}</span>
                    <span class="hidden md:inline lg:hidden">{{ item.dayOfWeek.slice(0, 3) }}</span>
                  </span>
                </div>

                <!-- Indicators & Quick Toggle Day Type Button -->
                <div class="flex items-center space-x-1 shrink-0">
                  <!-- Quick Toggle Day Type Button on Touch & Hover -->
                  <button
                    @click="handleToggleDayType(item.day, $event)"
                    type="button"
                    :title="item.holidayInfo?.isHoliday ? 'คลิกเพื่อสลับเป็นวันทำการปกติ' : 'คลิกเพื่อสลับเป็นวันหยุดราชการ'"
                    class="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 touch-manipulation cursor-pointer transition active:scale-90"
                  >
                    <ToggleRight v-if="item.holidayInfo?.isHoliday" class="w-4 h-4 text-rose-500" />
                    <ToggleLeft v-else class="w-4 h-4 text-slate-400" />
                  </button>

                  <!-- Discrepancy Indicator Dot -->
                  <span 
                    v-if="item.status === 'matched'" 
                    class="w-2 h-2 rounded-full bg-emerald-500" 
                    title="ข้อมูลตรงกับสแกนใน PDF สมบูรณ์"
                  />
                  <span 
                    v-else-if="item.status === 'missing_scan'" 
                    class="w-2 h-2 rounded-full bg-amber-500" 
                    title="บันทึกงานไว้ แต่ไม่พบเวลาสแกนใน PDF"
                  />
                  <span 
                    v-else-if="item.status === 'unlogged_scan'" 
                    class="w-2 h-2 rounded-full bg-blue-500" 
                    title="พบเวลาสแกนออกใน PDF แต่ยังไม่ได้ลงบันทึกงาน"
                  />
                  <span 
                    v-else-if="item.status === 'hours_mismatch'" 
                    class="w-2 h-2 rounded-full bg-primary" 
                    title="เวลาออกงานไม่ตรงกับสแกนจริง"
                  />
                </div>
              </div>

              <!-- Public Holiday / Custom Tag -->
              <div 
                v-if="item.holidayInfo && item.holidayInfo.isHoliday" 
                class="mt-1 px-1.5 py-0.5 rounded bg-rose-100/90 dark:bg-rose-900/50 text-[10px] text-rose-800 dark:text-rose-200 font-medium truncate flex items-center space-x-1" 
                :title="item.holidayInfo.name"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                <span class="truncate">{{ item.holidayInfo.name }}</span>
                <span v-if="item.holidayInfo.isCustom" class="text-[9px] opacity-75 font-semibold">(กำหนดเอง)</span>
              </div>
              <div 
                v-else-if="item.holidayInfo && !item.holidayInfo.isHoliday && item.holidayInfo.isCustom" 
                class="mt-1 px-1.5 py-0.5 rounded bg-emerald-100/90 dark:bg-emerald-900/50 text-[10px] text-emerald-800 dark:text-emerald-200 font-medium truncate flex items-center space-x-1" 
                title="วันทำการปกติ (ยกเว้นวันหยุดตามที่ตั้งค่า)"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                <span class="truncate">วันทำการปกติ (กำหนดเอง)</span>
              </div>
            </div>

            <!-- Day Content (Logged OT) -->
            <div v-if="item.log" class="mt-2 space-y-1">
              <div class="flex items-center justify-between text-xs font-bold">
                <span class="px-1.5 py-0.5 rounded-md bg-primary-light dark:bg-primary/20 text-primary">
                  {{ item.log.hours }} ชม.
                </span>
                <span class="text-slate-700 dark:text-slate-200 font-extrabold">{{ item.log.amount }} บ.</span>
              </div>
              <p class="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-tight">
                {{ item.log.taskDesc || 'ปฏิบัติหน้าที่ตามที่ได้รับมอบหมาย' }}
              </p>
              <div class="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                {{ item.log.startTime }} - {{ item.log.endTime }} น.
              </div>
            </div>

            <!-- Unlogged Scan Alert (Found in PDF but not logged) -->
            <div 
              v-else-if="item.scan && item.scan.otHours > 0" 
              class="mt-2 p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition"
            >
              <div class="flex items-center space-x-1 text-[11px] font-bold">
                <Sparkles class="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>สแกน {{ item.scan.scanOut }} น.</span>
              </div>
              <p class="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 font-semibold">+ ลงงาน ({{ item.scan.otHours }} ชม.)</p>
            </div>

            <!-- Empty Day Placeholder -->
            <div v-else class="mt-2 text-center py-2 text-slate-300 dark:text-slate-600 group-hover:text-primary transition">
              <Plus class="w-4 h-4 mx-auto opacity-30 group-hover:opacity-100 transition" />
            </div>

            <!-- Scan Reference Tag at Bottom -->
            <div v-if="item.scan && item.log" class="mt-1 pt-1 border-t border-slate-100 dark:border-slate-700/60 text-[10px] text-slate-400 dark:text-slate-500 flex justify-between">
              <span>สแกนจริง:</span>
              <span class="font-mono">{{ item.scan.scanOut || 'ไม่พบ' }} น.</span>
            </div>

          </div>

          <!-- Trailing Padding Days (Next Month) -->
          <div 
            v-for="pad in paddingAfter" 
            :key="'pad-after-' + pad.day"
            class="hidden md:flex border border-dashed border-slate-200/60 dark:border-slate-800/60 rounded-xl p-2 md:p-2.5 lg:p-3 min-h-[100px] md:min-h-[115px] lg:min-h-[135px] flex-col justify-between opacity-35 bg-slate-50/30 dark:bg-slate-900/20 select-none cursor-default"
          >
            <div class="flex items-center space-x-1">
              <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-slate-400 dark:text-slate-600">
                {{ pad.day }}
              </span>
            </div>
            <div class="text-[9px] md:text-[10px] text-center text-slate-300 dark:text-slate-600">เดือนถัดไป</div>
          </div>

        </div>
      </div>

      <!-- ======================================================== -->
      <!-- 2. COMPACT LIST VIEW (มุมมองรายการสรุป สะดวกบนมือถือ)     -->
      <!-- ======================================================== -->
      <div v-else class="space-y-2">
        <div 
          v-for="item in filteredDaysList" 
          :key="'list-' + item.day"
          @click="focusedDay = item.day; emit('select-day', item.day)"
          :class="[
            'p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer touch-manipulation active:scale-[0.99]',
            item.log
              ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary shadow-2xs'
              : (item.scan && item.scan.otHours > 0
                  ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 hover:border-blue-400'
                  : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700/60 hover:bg-slate-100/60 dark:hover:bg-slate-800'),
            item.isToday ? 'ring-2 ring-blue-500' : ''
          ]"
        >
          <!-- Left: Date & Status -->
          <div class="flex items-center space-x-3 min-w-0">
            <span 
              :class="[
                'w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs',
                item.log 
                  ? 'bg-primary text-white' 
                  : (item.holidayInfo?.isHoliday 
                      ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200' 
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300')
              ]"
            >
              {{ item.day }}
            </span>
            <div class="min-w-0">
              <div class="flex items-center space-x-1.5">
                <span class="text-xs font-bold text-slate-800 dark:text-slate-100">
                  วัน{{ item.dayOfWeek }}ที่ {{ item.day }}
                </span>
                <span 
                  v-if="item.isToday"
                  class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-600 text-white"
                >
                  วันนี้
                </span>
                <span 
                  v-if="item.holidayInfo?.isHoliday"
                  class="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.2 rounded"
                >
                  {{ item.holidayInfo.name }}
                </span>
              </div>
              <p v-if="item.log" class="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5">
                {{ item.log.taskDesc || 'ปฏิบัติหน้าที่ตามที่ได้รับมอบหมาย' }}
              </p>
              <p v-else-if="item.scan && item.scan.otHours > 0" class="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                พบสแกนออก {{ item.scan.scanOut }} น. (+ แตะเพื่อบันทึกงาน {{ item.scan.otHours }} ชม.)
              </p>
              <p v-else class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                ยังไม่มีการบันทึก OT (แตะเพื่อลงเวลา)
              </p>
            </div>
          </div>

          <!-- Right: Hours, Amount & Action -->
          <div class="flex items-center justify-between sm:justify-end space-x-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700/60">
            <div v-if="item.log" class="text-right">
              <div class="text-xs font-bold text-primary">
                {{ item.log.hours }} ชม. • {{ item.log.amount.toLocaleString() }} บ.
              </div>
              <div class="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                {{ item.log.startTime }} - {{ item.log.endTime }} น.
              </div>
            </div>

            <!-- Quick Edit Icon Button -->
            <button
              @click.stop="focusedDay = item.day; emit('select-day', item.day)"
              type="button"
              class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-primary hover:text-white dark:hover:bg-primary text-slate-600 dark:text-slate-300 text-xs font-semibold transition active:scale-95 touch-manipulation cursor-pointer flex items-center space-x-1"
            >
              <Edit3 class="w-3.5 h-3.5" />
              <span>{{ item.log ? 'แก้ไข' : 'ลงเวลา' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Keyboard Shortcuts Help Badge -->
      <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
        <span class="flex items-center space-x-1.5">
          <Keyboard class="w-4 h-4 text-slate-400" />
          <span class="hidden sm:inline">คีย์ลัด: ใช้ปุ่มลูกศร ◀ ▶ เพื่อเลือกวัน และกด Enter เพื่อเปิดหน้าต่างบันทึกงาน</span>
          <span class="sm:hidden">แตะที่ช่องวันที่เพื่อบันทึกงาน</span>
        </span>
        <span class="font-medium text-slate-600 dark:text-slate-400">วันที่เลือก: วันที่ {{ focusedDay }}</span>
      </div>

    </div>

  </div>
</template>
