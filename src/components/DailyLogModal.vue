<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { useOtStore } from '../stores/otStore';
import { THAI_MONTHS } from '../services/pdfParser';
import { getThaiHoliday, isWeekend, calculateCivilServiceOtHours, getCivilServiceReportTimes } from '../services/thaiHolidays';
import { X, Trash2, Clock, Check, Sparkles, AlertCircle, Calendar, ArrowRight, Keyboard, Plus, Minus, Edit3, List } from 'lucide-vue-next';

const props = defineProps({
  show: Boolean,
  day: Number,
});

const emit = defineEmits(['close', 'next-day']);
const store = useOtStore();

const form = ref({
  day: 1,
  dayType: 'weekday',
  startTime: '16:30',
  endTime: '17:30',
  hours: 1,
  taskDesc: 'ปฏิบัติหน้าที่ตามที่ได้รับมอบหมาย',
  jid: '',
  project: '',
  isClaimed: true,
});

// Holiday information for this day (respects custom holiday overrides)
const holidayInfo = computed(() => {
  if (!props.day) return null;
  return store.getDayHolidayInfo(props.day);
});

// Watch when day opens
watch(
  () => props.day,
  (newDay) => {
    if (!newDay) return;
    const existing = store.logsByDay[newDay];
    const scan = store.scansByDay[newDay];

    if (existing) {
      form.value = { ...existing };
      // Safety enforce cap on existing logs (holiday 7h, weekday 4h)
      const maxH = form.value.dayType === 'holiday' ? 7 : 4;
      if (form.value.hours > maxH) {
        form.value.hours = maxH;
      }
    } else {
      // Determine if day is a holiday from store (respects custom overrides)
      const dayInfo = store.getDayHolidayInfo(newDay);
      const isDayHoliday = Boolean(dayInfo?.isHoliday || scan?.dayType === 'holiday' || scan?.remark?.includes('วันหยุด'));

      let defaultStart = isDayHoliday ? '08:30' : '16:30';
      let defaultEnd = isDayHoliday ? '16:30' : '17:30';
      let defaultHours = isDayHoliday ? 7 : 1;
      let dayType = isDayHoliday ? 'holiday' : 'weekday';

      if (scan) {
        if (scan.otHours > 0) {
          defaultHours = isDayHoliday ? Math.min(7, scan.otHours) : Math.min(4, scan.otHours);
          defaultEnd = scan.otEndTime || defaultEnd;
          if (scan.otStartTime) defaultStart = scan.otStartTime;
        }
      }

      form.value = {
        day: newDay,
        dayType,
        startTime: defaultStart,
        endTime: defaultEnd,
        hours: defaultHours,
        taskDesc: store.presets[0]?.description || 'ปฏิบัติหน้าที่ตามที่ได้รับมอบหมาย',
        jid: '',
        project: '',
        isClaimed: true,
        scanIn: scan?.scanIn || '',
        scanOut: scan?.scanOut || '',
      };
    }
  },
  { immediate: true }
);

// Scan info for this day
const scanInfo = computed(() => store.scansByDay[props.day] || null);

// Handle manual Day Type Change
function handleDayTypeChange(type) {
  form.value.dayType = type;
  if (type === 'holiday') {
    if (form.value.startTime === '16:30') form.value.startTime = '08:30';
    if (form.value.endTime === '17:30' || form.value.endTime === '20:30') form.value.endTime = '16:30';
  } else {
    if (form.value.startTime === '08:30') form.value.startTime = '16:30';
    if (form.value.endTime === '16:30') form.value.endTime = '17:30';
  }
  calculateHours();
}

// Calculate hours automatically when start/end time changes (Free input, no overwriting)
function calculateHours() {
  if (!form.value.startTime || !form.value.endTime) return;
  const calculated = calculateCivilServiceOtHours({
    dayType: form.value.dayType,
    startTime: form.value.startTime,
    endTime: form.value.endTime
  });

  const maxH = form.value.dayType === 'holiday' ? 7 : 4;
  form.value.hours = Math.min(maxH, Math.max(0, calculated));
}

// Watch hours input to enforce 7-hour cap on holiday and 4-hour cap on weekday
function handleHoursInput() {
  let h = Number(form.value.hours) || 0;
  const maxH = form.value.dayType === 'holiday' ? 7 : 4;
  if (h > maxH) {
    form.value.hours = maxH;
  }
}

// Toggle between Dropdown Mode and Manual Text Input Mode
const isCustomTimeMode = ref(false);

const standardTimeSlots = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
  '22:00', '22:30', '23:00', '23:30', '00:00'
];

// Computed list for Start Time dropdown
const availableStartTimes = computed(() => {
  const set = new Set(standardTimeSlots);
  if (form.value.startTime) set.add(form.value.startTime);
  if (scanInfo.value?.scanIn) set.add(scanInfo.value.scanIn);
  return Array.from(set).sort();
});

// Computed list for End Time dropdown
const availableEndTimes = computed(() => {
  const set = new Set(standardTimeSlots);
  if (form.value.endTime) set.add(form.value.endTime);
  if (scanInfo.value?.scanOut) set.add(scanInfo.value.scanOut);
  return Array.from(set).sort();
});

function formatStartTimeLabel(t) {
  if (t === '16:30') return `${t} น. (เริ่ม OT วันปกติ)`;
  if (t === '08:30') return `${t} น. (เริ่มงานราชการ)`;
  if (t === '13:00' || t === '13:30') return `${t} น. (เริ่มช่วงบ่าย)`;
  return `${t} น.`;
}

function formatEndTimeLabel(t) {
  if (form.value.dayType === 'weekday' && form.value.startTime === '16:30') {
    const [h, m] = t.split(':').map(Number);
    if (m === 30 && h >= 17) {
      return `${t} น. (${h - 16} ชม.)`;
    }
  } else if (form.value.dayType === 'holiday') {
    if (t === '16:30' && form.value.startTime === '08:30') return `${t} น. (7 ชม. เต็มวัน)`;
    if (t === '11:30' && form.value.startTime === '08:30') return `${t} น. (3 ชม. เช้า)`;
    if (t === '16:30' && form.value.startTime === '13:30') return `${t} น. (3 ชม. บ่าย)`;
  }
  return `${t} น.`;
}

// Quick apply weekday hours (max 4 hrs)
function applyQuickWeekdayHours(h) {
  form.value.dayType = 'weekday';
  form.value.startTime = '16:30';
  const targetH = Math.min(4, Math.max(1, h));
  form.value.hours = targetH;
  const endH = 16 + targetH;
  form.value.endTime = `${String(endH).padStart(2, '0')}:30`;
}

// Quick apply holiday shifts
function applyHolidayShift(type) {
  form.value.dayType = 'holiday';
  if (type === 'full') {
    form.value.startTime = '08:30';
    form.value.endTime = '16:30';
    form.value.hours = 7;
  } else if (type === 'morning') {
    form.value.startTime = '08:30';
    form.value.endTime = '11:30';
    form.value.hours = 3;
  } else if (type === 'afternoon') {
    form.value.startTime = '13:30';
    form.value.endTime = '16:30';
    form.value.hours = 3;
  } else if (typeof type === 'number') {
    applyQuickHolidayHours(type);
  }
}

function applyQuickHolidayHours(h) {
  form.value.dayType = 'holiday';
  const targetH = Math.min(7, Math.max(1, h));
  form.value.hours = targetH;
  if (targetH === 7) {
    form.value.startTime = '08:30';
    form.value.endTime = '16:30';
  } else if (targetH <= 3) {
    form.value.startTime = '08:30';
    form.value.endTime = `${String(8 + targetH).padStart(2, '0')}:30`;
  } else {
    // 4-6 hours with lunch bridge
    form.value.startTime = '08:30';
    const endH = 8 + targetH + 1; // +1 hr for lunch break
    form.value.endTime = `${String(endH).padStart(2, '0')}:30`;
  }
}

// Stepper adjustments
function incrementHours() {
  const current = Number(form.value.hours) || 0;
  if (form.value.dayType === 'holiday') {
    if (current < 7) applyQuickHolidayHours(current + 1);
  } else {
    if (current < 4) applyQuickWeekdayHours(current + 1);
  }
}

function decrementHours() {
  const current = Number(form.value.hours) || 0;
  if (current > 1) {
    if (form.value.dayType === 'holiday') {
      applyQuickHolidayHours(current - 1);
    } else {
      applyQuickWeekdayHours(current - 1);
    }
  }
}

// Current rate and total amount
const currentRate = computed(() => {
  return form.value.dayType === 'holiday'
    ? (store.settings.rateHoliday || 60)
    : (store.settings.rateWeekday || 50);
});

const calculatedAmount = computed(() => {
  return (Number(form.value.hours) || 0) * currentRate.value;
});

// Normalized times that will be printed in official reports
const reportTimesPreview = computed(() => {
  return getCivilServiceReportTimes({
    dayType: form.value.dayType,
    startTime: form.value.startTime,
    endTime: form.value.endTime,
    hours: form.value.hours
  });
});

// Apply quick preset text
function applyPreset(text) {
  form.value.taskDesc = text;
}

// Sync times to PDF scan (use actual scanned times)
function syncToScan() {
  if (scanInfo.value) {
    if (form.value.dayType === 'holiday') {
      const otH = Math.min(7, scanInfo.value.otHours || 7);
      form.value.startTime = scanInfo.value.scanIn || '08:30';
      form.value.endTime = scanInfo.value.scanOut || '16:30';
      form.value.hours = otH;
    } else {
      const otH = Math.min(4, scanInfo.value.otHours || 0);
      form.value.startTime = '16:30';
      form.value.endTime = scanInfo.value.otEndTime || `${16 + otH}:30`;
      form.value.hours = otH;
    }
  }
}

async function handleSave() {
  await store.saveLog({
    ...form.value,
    date: `${props.day} ${THAI_MONTHS[store.currentMonth - 1]} ${store.currentYear}`,
  });
  emit('close');
}

// Fast continuous logging: Save & open Next Day
async function handleSaveAndNext() {
  await store.saveLog({
    ...form.value,
    date: `${props.day} ${THAI_MONTHS[store.currentMonth - 1]} ${store.currentYear}`,
  });

  const y = store.currentYear - 543;
  const m = store.currentMonth;
  const numDays = new Date(y, m, 0).getDate();
  if (props.day < numDays) {
    emit('next-day', props.day + 1);
  } else {
    emit('close');
  }
}

async function handleDelete() {
  const existing = store.logsByDay[props.day];
  if (existing && existing.id) {
    await store.deleteLog(existing.id);
  }
  emit('close');
}

// Keyboard shortcuts inside modal
function handleModalKey(e) {
  if (!props.show) return;
  // Cmd/Ctrl + Enter -> Save
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) {
      handleSaveAndNext();
    } else {
      handleSave();
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    emit('close');
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleModalKey);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleModalKey);
});
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all">
      
      <!-- Modal Header -->
      <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <div>
          <h3 class="text-base font-bold text-slate-800 dark:text-slate-100">
            บันทึกการทำงาน OT วันที่ {{ day }} {{ THAI_MONTHS[store.currentMonth - 1] }} {{ store.currentYear }}
          </h3>
          <p class="text-xs text-secondary dark:text-slate-400">กรอกข้อมูลเวลาและเนื้องานที่ปฏิบัติ</p>
        </div>
        <button @click="emit('close')" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-slate-800 dark:text-slate-200">
        
        <!-- Scan Reference Banner if available -->
        <div v-if="scanInfo" class="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs space-y-1.5">
          <div class="flex justify-between items-center">
            <span class="font-bold text-blue-900 dark:text-blue-200 flex items-center space-x-1.5">
              <Clock class="w-3.5 h-3.5 text-blue-600" />
              <span>ข้อมูลจากรายงานสแกนเวลา (PDF):</span>
            </span>
            <button 
              v-if="scanInfo.otHours > 0 || scanInfo.scanOut"
              @click="syncToScan"
              type="button" 
              class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold inline-flex items-center space-x-1 shadow-xs transition cursor-pointer"
            >
              <Sparkles class="w-3.5 h-3.5" />
              <span>ใช้เวลาตามสแกน ({{ scanInfo.otHours }} ชม.)</span>
            </button>
          </div>
          <div class="text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
            <span>เข้า: <strong class="text-slate-800 dark:text-slate-200">{{ scanInfo.scanIn || '-' }} น.</strong></span>
            <span>ออก: <strong class="text-slate-800 dark:text-slate-200">{{ scanInfo.scanOut || '-' }} น.</strong></span>
            <span v-if="scanInfo.otHours > 0" class="text-emerald-700 dark:text-emerald-400 font-bold">
              (เกินเวลาปกติ {{ scanInfo.otHours }} ชม.)
            </span>
            <span v-if="scanInfo.remark" class="text-amber-700 dark:text-amber-400">({{ scanInfo.remark }})</span>
          </div>
        </div>

        <!-- Holiday Info Banner if applicable -->
        <div v-if="holidayInfo?.isHoliday" class="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs flex items-center space-x-2.5 text-rose-800 dark:text-rose-300">
          <Calendar class="w-4 h-4 text-primary shrink-0" />
          <div class="flex-1">
            <span class="font-bold">{{ holidayInfo.name }}</span>
            <span class="text-rose-600 dark:text-rose-400 block text-[11px]">วันหยุดราชการ: คำนวณช่วง 08:30 - 11:30 (3 ชม.) และ 13:30 - 16:30 (3 ชม.) (สูงสุด 7 ชม./วัน)</span>
          </div>
        </div>
        <div v-else-if="holidayInfo && !holidayInfo.isHoliday && holidayInfo.isCustom" class="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs flex items-center space-x-2.5 text-emerald-800 dark:text-emerald-300">
          <Calendar class="w-4 h-4 text-emerald-600 shrink-0" />
          <div class="flex-1">
            <span class="font-bold">{{ holidayInfo.name }}</span>
            <span class="text-emerald-600 dark:text-emerald-400 block text-[11px]">วันทำการปกติ (ยกเว้นวันหยุด): คำนวณช่วงหลัง 16:30 น. (อัตรา {{ store.settings.rateWeekday }} บ./ชม.)</span>
          </div>
        </div>

        <!-- Day Type -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">ประเภทวันปฏิบัติงาน</label>
          <div class="grid grid-cols-2 gap-3">
            <button 
              type="button"
              @click="handleDayTypeChange('weekday')"
              :class="[
                'p-2.5 rounded-xl border text-xs font-medium text-center transition cursor-pointer',
                form.dayType === 'weekday' 
                  ? 'border-primary bg-primary-light dark:bg-primary/20 text-primary font-bold shadow-xs' 
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
              ]"
            >
              วันทำการปกติ ({{ store.settings.rateWeekday }} บ./ชม.)
            </button>
            <button 
              type="button"
              @click="handleDayTypeChange('holiday')"
              :class="[
                'p-2.5 rounded-xl border text-xs font-medium text-center transition cursor-pointer',
                form.dayType === 'holiday' 
                  ? 'border-primary bg-primary-light dark:bg-primary/20 text-primary font-bold shadow-xs' 
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
              ]"
            >
              วันหยุดราชการ ({{ store.settings.rateHoliday }} บ./ชม.)
            </button>
          </div>
        </div>

        <!-- Time & Hours Calculation Section -->
        <div class="space-y-3">
          
          <!-- 1. Quick Hours / Shift Presets -->
          <div class="space-y-1.5 bg-slate-50/80 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <Clock class="w-3.5 h-3.5 text-primary" />
                <span>เลือกชั่วโมงด่วน (คลิกเดียวตั้งเวลาให้ทันที):</span>
              </span>
              <button
                type="button"
                @click="isCustomTimeMode = !isCustomTimeMode"
                class="text-[11px] font-medium text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-primary flex items-center space-x-1 transition cursor-pointer"
              >
                <component :is="isCustomTimeMode ? List : Edit3" class="w-3 h-3" />
                <span>{{ isCustomTimeMode ? 'เลือกจากรายการ' : 'พิมพ์เวลาเอง' }}</span>
              </button>
            </div>

            <!-- Weekday Quick Presets (Max 4 hrs) -->
            <div v-if="form.dayType === 'weekday'" class="grid grid-cols-4 gap-2">
              <button
                v-for="h in [1, 2, 3, 4]"
                :key="h"
                type="button"
                @click="applyQuickWeekdayHours(h)"
                :class="[
                  'py-2.5 px-2 rounded-xl text-xs font-semibold border transition text-center flex flex-col items-center justify-center cursor-pointer',
                  form.hours === h && form.startTime === '16:30'
                    ? 'bg-primary text-white border-primary shadow-xs font-bold'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-700'
                ]"
              >
                <span class="text-sm">{{ h }} ชม.</span>
                <span class="text-[10px] opacity-80 font-normal">เลิก {{ 16 + h }}:30</span>
              </button>
            </div>

            <!-- Holiday Quick Presets -->
            <div v-else class="space-y-1.5">
              <div class="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  @click="applyHolidayShift('full')"
                  :class="[
                    'py-2 px-1 rounded-xl text-xs font-semibold border transition text-center cursor-pointer',
                    form.hours === 7 && form.startTime === '08:30' && form.endTime === '16:30'
                      ? 'bg-primary text-white border-primary shadow-xs font-bold'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-primary/50'
                  ]"
                >
                  <span class="block font-bold">เต็มวัน 7 ชม.</span>
                  <span class="text-[10px] opacity-80 block">08:30 - 16:30</span>
                </button>
                <button
                  type="button"
                  @click="applyHolidayShift('morning')"
                  :class="[
                    'py-2 px-1 rounded-xl text-xs font-semibold border transition text-center cursor-pointer',
                    form.hours === 3 && form.startTime === '08:30' && form.endTime === '11:30'
                      ? 'bg-primary text-white border-primary shadow-xs font-bold'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-primary/50'
                  ]"
                >
                  <span class="block font-bold">ช่วงเช้า 3 ชม.</span>
                  <span class="text-[10px] opacity-80 block">08:30 - 11:30</span>
                </button>
                <button
                  type="button"
                  @click="applyHolidayShift('afternoon')"
                  :class="[
                    'py-2 px-1 rounded-xl text-xs font-semibold border transition text-center cursor-pointer',
                    form.hours === 3 && form.startTime === '13:30' && form.endTime === '16:30'
                      ? 'bg-primary text-white border-primary shadow-xs font-bold'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-primary/50'
                  ]"
                >
                  <span class="block font-bold">ช่วงบ่าย 3 ชม.</span>
                  <span class="text-[10px] opacity-80 block">13:30 - 16:30</span>
                </button>
              </div>

              <!-- Other Hours for holiday -->
              <div class="grid grid-cols-4 gap-1.5">
                <button
                  v-for="h in [2, 4, 5, 6]"
                  :key="h"
                  type="button"
                  @click="applyQuickHolidayHours(h)"
                  :class="[
                    'py-1.5 px-1 rounded-lg text-xs font-medium border transition text-center cursor-pointer',
                    form.hours === h
                      ? 'bg-primary text-white border-primary font-bold shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/50'
                  ]"
                >
                  <span>{{ h }} ชม.</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 2. Time Pickers & Stepper -->
          <div class="grid grid-cols-12 gap-2.5 items-end">
            <!-- Start Time (4 cols) -->
            <div class="col-span-4">
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                เวลาเริ่ม (มา)
              </label>
              <div v-if="!isCustomTimeMode">
                <select 
                  v-model="form.startTime" 
                  @change="calculateHours"
                  class="w-full text-xs p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
                >
                  <option v-for="t in availableStartTimes" :key="t" :value="t">
                    {{ formatStartTimeLabel(t) }}
                  </option>
                </select>
              </div>
              <div v-else>
                <input 
                  v-model="form.startTime" 
                  @change="calculateHours"
                  type="text" 
                  placeholder="เช่น 16:30"
                  class="w-full text-sm p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary text-center font-medium"
                />
              </div>
            </div>

            <!-- End Time (4 cols) -->
            <div class="col-span-4">
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                เวลาสิ้นสุด (กลับ)
              </label>
              <div v-if="!isCustomTimeMode">
                <select 
                  v-model="form.endTime" 
                  @change="calculateHours"
                  class="w-full text-xs p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
                >
                  <option v-for="t in availableEndTimes" :key="t" :value="t">
                    {{ formatEndTimeLabel(t) }}
                  </option>
                </select>
              </div>
              <div v-else>
                <input 
                  v-model="form.endTime" 
                  @change="calculateHours"
                  type="text" 
                  placeholder="เช่น 19:30"
                  class="w-full text-sm p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary text-center font-medium"
                />
              </div>
            </div>

            <!-- Hours Stepper (4 cols) -->
            <div class="col-span-4">
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                จำนวนชั่วโมง
              </label>
              <div class="flex items-center space-x-1">
                <button 
                  type="button" 
                  @click="decrementHours" 
                  class="w-8 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-base transition cursor-pointer shrink-0 border border-slate-200 dark:border-slate-700"
                  title="ลด 1 ชม."
                >
                  <Minus class="w-3.5 h-3.5" />
                </button>
                <input 
                  v-model.number="form.hours" 
                  @input="handleHoursInput"
                  type="number" 
                  min="0" 
                  :max="form.dayType === 'holiday' ? 7 : 4" 
                  class="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-center font-bold text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button 
                  type="button" 
                  @click="incrementHours" 
                  class="w-8 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-base transition cursor-pointer shrink-0 border border-slate-200 dark:border-slate-700"
                  title="เพิ่ม 1 ชม."
                >
                  <Plus class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Report Time Alignment Preview -->
          <div v-if="form.hours > 0" class="flex items-center justify-between text-[11px] px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <span class="flex items-center space-x-1">
              <Clock class="w-3.5 h-3.5 text-slate-500" />
              <span>เวลาที่จะระบุในรายงาน (Excel):</span>
            </span>
            <span class="font-bold text-slate-800 dark:text-slate-100">{{ reportTimesPreview.startTime }} - {{ reportTimesPreview.endTime }} น. ({{ form.hours }} ชม.)</span>
          </div>

          <p v-if="form.dayType === 'holiday'" class="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200 dark:border-amber-900/40 flex items-center space-x-1.5">
            <AlertCircle class="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span>วันหยุดราชการ: คำนวณช่วง 08:30 - 16:30 น. (หักพักเที่ยง 12:00 - 13:00 น. สูงสุด 7 ชม./วัน)</span>
          </p>
          <p v-else class="text-[11px] text-blue-700 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/30 p-2 rounded-xl border border-blue-200 dark:border-blue-900/40 flex items-center space-x-1.5">
            <AlertCircle class="w-3.5 h-3.5 shrink-0 text-blue-600" />
            <span>วันทำการปกติ: ปฏิบัติงานช่วงหลัง 16:30 น. (สูงสุดไม่เกิน 4 ชม./วัน = เลิกงานไม่เกิน 20:30 น.)</span>
          </p>
        </div>

        <!-- Amount Preview Card -->
        <div class="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3 rounded-xl flex justify-between items-center text-xs">
          <span class="text-amber-800 dark:text-amber-300 font-medium">ยอดเงินตอบแทนที่จะได้รับ:</span>
          <span class="text-base font-bold text-primary">
            {{ calculatedAmount }} บาท ({{ form.hours }} ชม. × {{ currentRate }} บ.)
          </span>
        </div>

        <!-- Task Description -->
        <div>
          <div class="flex justify-between items-center mb-1">
            <label class="text-xs font-semibold text-slate-700 dark:text-slate-300">รายละเอียดงานที่ปฏิบัติ</label>
            <span class="text-[11px] text-slate-400">จะนำไปแสดงในเอกสาร Word รายงานผล</span>
          </div>
          <textarea 
            v-model="form.taskDesc" 
            rows="2"
            placeholder="เช่น ปฏิบัติหน้าที่ตามที่ได้รับมอบหมาย..."
            class="w-full text-sm p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
          ></textarea>
        </div>

        <!-- Quick Presets -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
            ข้อความงานที่ใช้บ่อย (คลิกเลือกได้ทันที):
          </label>
          <div class="flex flex-wrap gap-1.5">
            <button 
              v-for="preset in store.presets" 
              :key="preset.id"
              @click="applyPreset(preset.description)"
              type="button"
              class="text-xs px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
            >
              {{ preset.title }}
            </button>
          </div>
        </div>

        <!-- Claim toggle -->
        <div class="flex items-center space-x-2 pt-1">
          <input 
            id="claimCheck" 
            v-model="form.isClaimed" 
            type="checkbox" 
            class="w-4 h-4 text-primary rounded border-slate-300 dark:border-slate-700 focus:ring-primary"
          />
          <label for="claimCheck" class="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
            นำรายการนี้ไปรวมในหลักฐานเบิกจ่ายเงิน OT ประจำเดือน
          </label>
        </div>

      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <div>
          <button 
            v-if="store.logsByDay[day]"
            @click="handleDelete"
            type="button" 
            class="inline-flex items-center space-x-1 text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1.5 rounded transition"
          >
            <Trash2 class="w-4 h-4" />
            <span>ลบรายการ</span>
          </button>
        </div>

        <div class="flex items-center space-x-2">
          <!-- Cancel Button -->
          <button 
            @click="emit('close')"
            type="button" 
            class="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            ยกเลิก (Esc)
          </button>

          <!-- Save and Next Button (ข้อ 4) -->
          <button 
            @click="handleSaveAndNext"
            type="button" 
            class="px-4 py-2 text-xs font-semibold rounded-xl text-slate-800 dark:text-slate-100 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition inline-flex items-center space-x-1.5 cursor-pointer shadow-xs"
            title="บันทึกวันปัจจุบันแล้วเปิดวันถัดไปทันที (Ctrl+Shift+Enter)"
          >
            <span>บันทึก & วันถัดไป</span>
            <ArrowRight class="w-3.5 h-3.5" />
          </button>

          <!-- Main Save Button -->
          <button 
            @click="handleSave"
            type="button" 
            class="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-primary hover:bg-primary-hover transition shadow-sm inline-flex items-center space-x-1.5"
            title="บันทึกข้อมูล (Ctrl+Enter)"
          >
            <Check class="w-4 h-4" />
            <span>บันทึก</span>
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
