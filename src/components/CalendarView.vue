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
  ToggleRight
} from 'lucide-vue-next';

const emit = defineEmits(['select-day', 'open-reconcile']);
const store = useOtStore();
const toast = useToast();

const focusedDay = ref(1);

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
  <div class="space-y-6">
    
    <!-- Top KPI Cards (Dark Mode Ready) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      
      <!-- Card 1: Total Hours -->
      <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between transition-colors">
        <div>
          <p class="text-xs font-medium text-secondary dark:text-slate-400 uppercase tracking-wider">ชั่วโมง OT รวม</p>
          <div class="mt-1 flex items-baseline space-x-1">
            <span class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ store.summary.totalHours }}</span>
            <span class="text-xs text-secondary dark:text-slate-400">ชม.</span>
          </div>
          <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            วันปกติ {{ store.summary.weekdayHours }} ชม. • วันหยุด {{ store.summary.holidayHours }} ชม.
          </p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-primary">
          <Clock class="w-6 h-6" />
        </div>
      </div>

      <!-- Card 2: Total Earnings -->
      <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between transition-colors">
        <div>
          <p class="text-xs font-medium text-secondary dark:text-slate-400 uppercase tracking-wider">ยอดเงินตอบแทนรวม</p>
          <div class="mt-1 flex items-baseline space-x-1">
            <span class="text-2xl font-bold text-primary">{{ store.summary.totalAmount.toLocaleString() }}</span>
            <span class="text-xs text-secondary dark:text-slate-400">บาท</span>
          </div>
          <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            คำนวณตามอัตรา 50/60 บาท/ชม.
          </p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600">
          <Coins class="w-6 h-6" />
        </div>
      </div>

      <!-- Card 3: Claimed Days -->
      <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between transition-colors">
        <div>
          <p class="text-xs font-medium text-secondary dark:text-slate-400 uppercase tracking-wider">วันที่ทำ OT</p>
          <div class="mt-1 flex items-baseline space-x-1">
            <span class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ store.summary.claimedCount }}</span>
            <span class="text-xs text-secondary dark:text-slate-400">วัน</span>
          </div>
          <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            ในเดือน {{ store.monthName }} {{ store.currentYear }}
          </p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600">
          <CheckCircle2 class="w-6 h-6" />
        </div>
      </div>

      <!-- Card 4: Reconciliation Status -->
      <div 
        @click="emit('open-reconcile')"
        class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 hover:shadow transition"
      >
        <div>
          <p class="text-xs font-medium text-secondary dark:text-slate-400 uppercase tracking-wider">สถานะกระทบยอด PDF</p>
          <div class="mt-1">
            <span 
              v-if="store.unresolvedCount > 0"
              class="text-sm font-semibold text-amber-600 flex items-center space-x-1"
            >
              <AlertTriangle class="w-4 h-4 text-amber-500" />
              <span>รอตรวจ {{ store.unresolvedCount }} รายการ</span>
            </span>
            <span 
              v-else-if="store.attendanceScans.length > 0"
              class="text-sm font-semibold text-emerald-600 flex items-center space-x-1"
            >
              <CheckCircle2 class="w-4 h-4 text-emerald-500" />
              <span>ตรงกับ PDF 100%</span>
            </span>
            <span v-else class="text-sm font-medium text-slate-500 dark:text-slate-400">
              ยังไม่ได้นำเข้า PDF
            </span>
          </div>
          <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">คลิกเพื่อเปิดระบบตรวจทาน</p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-secondary dark:text-slate-300">
          <FileText class="w-6 h-6" />
        </div>
      </div>

    </div>

    <!-- Calendar View Container -->
    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs p-5 sm:p-6 transition-colors">
      
      <!-- Calendar Header & Keyboard Shortcuts Bar -->
      <div class="flex flex-col sm:flex-row justify-between sm:items-center mb-5 gap-3">
        <div>
          <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
            <span>ปฏิทินบันทึกงานรายวัน ({{ store.monthName }} {{ store.currentYear }})</span>
          </h2>
          <p class="text-xs text-secondary dark:text-slate-400">
            คลิกที่ช่องวันที่ หรือใช้ปุ่มลูกศร ◀ ▶ เพื่อเลือกวัน และกด Enter เพื่อบันทึกงาน
          </p>
        </div>
        
        <!-- Legend / Indicators -->
        <div class="flex flex-wrap items-center gap-3 text-xs">
          <span class="inline-flex items-center space-x-1 text-slate-600 dark:text-slate-300">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>ตรงกับสแกน</span>
          </span>
          <span class="inline-flex items-center space-x-1 text-slate-600 dark:text-slate-300">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>ไม่พบสแกน</span>
          </span>
          <span class="inline-flex items-center space-x-1 text-slate-600 dark:text-slate-300">
            <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span>สแกนตกค้าง</span>
          </span>
          <span class="inline-flex items-center space-x-1 text-slate-600 dark:text-slate-300">
            <span class="w-2.5 h-2.5 rounded-full bg-primary"></span>
            <span>เวลาไม่ตรง</span>
          </span>
        </div>
      </div>

      <!-- 7-Column Day-of-Week Headers (ขอบซ้าย = วันอาทิตย์, ขอบขวา = วันเสาร์) -->
      <div class="hidden lg:grid grid-cols-7 gap-3 mb-2">
        <div 
          v-for="wh in weekHeaders" 
          :key="wh.short"
          :class="[
            'py-2 px-3 text-center rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1',
            wh.isWeekendBorder
              ? (wh.side === 'left' 
                  ? 'bg-rose-100/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 shadow-2xs' 
                  : 'bg-rose-100/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 shadow-2xs')
              : 'bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          ]"
        >
          <span v-if="wh.isWeekendBorder" class="w-2 h-2 rounded-full bg-rose-500 mr-1"></span>
          <span>{{ wh.full }}</span>
          <span class="text-[11px] font-normal opacity-75">({{ wh.short }})</span>
        </div>
      </div>

      <!-- 7 Columns Calendar Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        
        <!-- Leading Padding Days (Previous Month) -->
        <div 
          v-for="pad in paddingBefore" 
          :key="'pad-before-' + pad.day"
          class="hidden lg:flex border border-dashed border-slate-200/60 dark:border-slate-800/60 rounded-xl p-3 min-h-[135px] flex-col justify-between opacity-35 bg-slate-50/30 dark:bg-slate-900/20 select-none cursor-default"
        >
          <div class="flex items-center space-x-1">
            <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-slate-400 dark:text-slate-600">
              {{ pad.day }}
            </span>
          </div>
          <div class="text-[10px] text-center text-slate-300 dark:text-slate-600">เดือนก่อนหน้า</div>
        </div>

        <!-- Current Month Days (1..31) -->
        <div 
          v-for="item in daysList" 
          :key="item.day"
          @click="focusedDay = item.day; emit('select-day', item.day)"
          :class="[
            'border rounded-xl p-3 min-h-[135px] flex flex-col justify-between cursor-pointer transition hover:shadow-md relative overflow-hidden group',
            item.holidayInfo 
              ? (item.holidayInfo.isHoliday 
                  ? 'bg-rose-50/50 dark:bg-rose-950/25 border-rose-200 dark:border-rose-900/50' 
                  : 'bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-800/60')
              : (item.isWeekend 
                  ? 'bg-rose-50/20 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700' 
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'),
            (item.isSunday || item.isSaturday) ? 'ring-1 ring-rose-200/50 dark:ring-rose-900/30' : '',
            item.log ? 'border-primary/60 dark:border-primary/70 shadow-xs' : 'hover:border-slate-300 dark:hover:border-slate-600',
            focusedDay === item.day ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
          ]"
        >
          <!-- Day Header -->
          <div>
            <div class="flex justify-between items-start">
              <div class="flex items-center space-x-1.5">
                <span 
                  :class="[
                    'w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm transition',
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
                    'text-[11px] font-medium',
                    (item.isSunday || item.isSaturday) ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-500 dark:text-slate-400'
                  ]"
                >
                  {{ item.dayOfWeek }}
                </span>
              </div>

              <!-- Indicators & Quick Toggle Day Type Button -->
              <div class="flex items-center space-x-1">
                <!-- Quick Toggle Day Type Button on Hover -->
                <button
                  @click="handleToggleDayType(item.day, $event)"
                  type="button"
                  :title="item.holidayInfo?.isHoliday ? 'คลิกเพื่อสลับเป็นวันทำการปกติ' : 'คลิกเพื่อสลับเป็นวันหยุดราชการ'"
                  class="opacity-0 group-hover:opacity-100 transition p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <ToggleRight v-if="item.holidayInfo?.isHoliday" class="w-4 h-4 text-rose-500" />
                  <ToggleLeft v-else class="w-4 h-4 text-slate-400" />
                </button>

                <!-- Discrepancy Indicator Dot -->
                <span 
                  v-if="item.status === 'matched'" 
                  class="w-2.5 h-2.5 rounded-full bg-emerald-500" 
                  title="ข้อมูลตรงกับสแกนใน PDF สมบูรณ์"
                />
                <span 
                  v-else-if="item.status === 'missing_scan'" 
                  class="w-2.5 h-2.5 rounded-full bg-amber-500" 
                  title="บันทึกงานไว้ แต่ไม่พบเวลาสแกนใน PDF"
                />
                <span 
                  v-else-if="item.status === 'unlogged_scan'" 
                  class="w-2.5 h-2.5 rounded-full bg-blue-500" 
                  title="พบเวลาสแกนออกใน PDF แต่ยังไม่ได้ลงบันทึกงาน"
                />
                <span 
                  v-else-if="item.status === 'hours_mismatch'" 
                  class="w-2.5 h-2.5 rounded-full bg-primary" 
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
            <div class="flex items-center justify-between text-xs font-semibold">
              <span class="text-primary font-bold">{{ item.log.hours }} ชม.</span>
              <span class="text-slate-600 dark:text-slate-300">{{ item.log.amount }} บ.</span>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">
              {{ item.log.taskDesc || 'ปฏิบัติหน้าที่ตามที่ได้รับมอบหมาย' }}
            </p>
            <div class="text-[10px] text-slate-400 dark:text-slate-500">
              {{ item.log.startTime }} - {{ item.log.endTime }} น.
            </div>
          </div>

          <!-- Unlogged Scan Alert (Found in PDF but not logged) -->
          <div 
            v-else-if="item.scan && item.scan.otHours > 0" 
            class="mt-2 p-1.5 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-300"
          >
            <div class="flex items-center space-x-1 text-[11px] font-semibold">
              <AlertCircle class="w-3.5 h-3.5 text-blue-600" />
              <span>สแกนออก {{ item.scan.scanOut }} น.</span>
            </div>
            <p class="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">+ คลิกเพื่อลงงาน ({{ item.scan.otHours }} ชม.)</p>
          </div>

          <!-- Empty Day Placeholder -->
          <div v-else class="mt-2 text-center py-2 text-slate-300 dark:text-slate-600 group-hover:text-slate-400">
            <Plus class="w-4 h-4 mx-auto opacity-40 hover:opacity-100 transition" />
          </div>

          <!-- Scan Reference Tag at Bottom -->
          <div v-if="item.scan && item.log" class="mt-1 pt-1 border-t border-slate-100 dark:border-slate-700/60 text-[10px] text-slate-400 dark:text-slate-500 flex justify-between">
            <span>สแกนจริง:</span>
            <span>{{ item.scan.scanOut || 'ไม่พบ' }} น.</span>
          </div>

        </div>

        <!-- Trailing Padding Days (Next Month) -->
        <div 
          v-for="pad in paddingAfter" 
          :key="'pad-after-' + pad.day"
          class="hidden lg:flex border border-dashed border-slate-200/60 dark:border-slate-800/60 rounded-xl p-3 min-h-[135px] flex-col justify-between opacity-35 bg-slate-50/30 dark:bg-slate-900/20 select-none cursor-default"
        >
          <div class="flex items-center space-x-1">
            <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-slate-400 dark:text-slate-600">
              {{ pad.day }}
            </span>
          </div>
          <div class="text-[10px] text-center text-slate-300 dark:text-slate-600">เดือนถัดไป</div>
        </div>

      </div>

      <!-- Keyboard Shortcuts Help Badge -->
      <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
        <span class="flex items-center space-x-1.5">
          <Keyboard class="w-4 h-4 text-slate-400" />
          <span>คีย์ลัด: ใช้ปุ่มลูกศร ◀ ▶ เพื่อเลื่อนวัน และกด Enter เพื่อเปิดหน้าต่างบันทึกงาน</span>
        </span>
        <span class="hidden sm:inline">วันที่เลือก: วันที่ {{ focusedDay }}</span>
      </div>

    </div>

  </div>
</template>
