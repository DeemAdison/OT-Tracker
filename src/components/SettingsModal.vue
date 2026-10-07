<script setup>
import { ref, watch, computed } from 'vue';
import { useOtStore } from '../stores/otStore';
import { useToast } from 'vue-toastification';
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  User, 
  Sliders, 
  MessageSquareQuote, 
  KeyRound, 
  Download, 
  Laptop, 
  Package, 
  Database, 
  Upload,
  Calendar as CalendarIcon,
  CalendarDays,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Shield,
  Tag,
  Smartphone
} from 'lucide-vue-next';

const props = defineProps({
  show: Boolean,
});

const emit = defineEmits(['close']);
const store = useOtStore();
const toast = useToast();

const activeTab = ref('profile'); // 'profile' | 'calendar' | 'presets' | 'system'
const profileForm = ref({ ...store.settings });
const newPresetTitle = ref('');
const newPresetDesc = ref('');

// State for custom holiday manager
const newHolidayDay = ref(1);
const newHolidayName = ref('');
const newHolidayType = ref('holiday'); // 'holiday' | 'weekday'

// Days in current month for selector
const daysInCurrentMonth = computed(() => {
  const y = store.currentYear - 543;
  const m = store.currentMonth;
  return new Date(y, m, 0).getDate();
});

// Holidays & Weekend list for current month
const currentMonthHolidayList = computed(() => {
  const list = [];
  const y = store.currentYear - 543;
  const m = store.currentMonth;
  const numDays = new Date(y, m, 0).getDate();
  const daysOfWeek = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

  for (let d = 1; d <= numDays; d++) {
    const dateObj = new Date(y, m - 1, d);
    const dow = daysOfWeek[dateObj.getDay()];
    const info = store.getDayHolidayInfo(d);
    const isWknd = dateObj.getDay() === 0 || dateObj.getDay() === 6;
    const custom = store.customHolidays.find(h => h.day === d) || null;

    if (info || isWknd || custom) {
      list.push({
        day: d,
        dayOfWeek: dow,
        isWeekend: isWknd,
        info: info || { isHoliday: true, name: 'วันหยุดสุดสัปดาห์' },
        custom
      });
    }
  }
  return list;
});

watch(
  () => props.show,
  (val) => {
    if (val) {
      profileForm.value = { ...store.settings };
    }
  }
);

async function handleSaveSettings() {
  await store.updateSettings(profileForm.value);
  toast.success('บันทึกการตั้งค่าเรียบร้อยแล้ว');
  emit('close');
}

async function handleAddCustomHoliday() {
  const isHoliday = newHolidayType.value === 'holiday';
  const fallbackName = isHoliday ? 'วันหยุดพิเศษ (กำหนดเอง)' : 'วันทำการปกติ (กำหนดเอง)';
  const name = newHolidayName.value.trim() || fallbackName;

  await store.addCustomHoliday({
    day: Number(newHolidayDay.value),
    name,
    isHoliday
  });
  toast.success(`ตั้งค่าวันที่ ${newHolidayDay.value} เป็น${isHoliday ? 'วันหยุดราชการ' : 'วันทำการปกติ'}เรียบร้อยแล้ว`);
  newHolidayName.value = '';
}

async function handleToggleFromList(day) {
  const willBeHoliday = await store.toggleDayType(day);
  toast.success(
    willBeHoliday 
      ? `วันที่ ${day} ปรับเป็นวันหยุดราชการเรียบร้อยแล้ว` 
      : `วันที่ ${day} ปรับเป็นวันทำการปกติเรียบร้อยแล้ว`,
    { timeout: 2000 }
  );
}

async function handleDeleteCustomHoliday(idOrDay) {
  await store.removeCustomHoliday(idOrDay);
  toast.info('คืนค่าตามระบบเรียบร้อยแล้ว');
}

async function handleAddPreset() {
  if (!newPresetTitle.value.trim() || !newPresetDesc.value.trim()) return;
  await store.addPreset({
    title: newPresetTitle.value.trim(),
    description: newPresetDesc.value.trim()
  });
  newPresetTitle.value = '';
  newPresetDesc.value = '';
}

async function handleDeletePreset(id) {
  await store.removePreset(id);
}

const restoreFileInput = ref(null);
const isBackingUp = ref(false);
const isRestoring = ref(false);

async function handleBackup() {
  isBackingUp.value = true;
  try {
    const savedName = await store.backupData();
    if (savedName) {
      toast.success(`สำรองข้อมูลสำเร็จ: ${savedName}`);
    }
  } catch (err) {
    console.error('Backup error:', err);
    toast.error('เกิดข้อผิดพลาดในการสำรองข้อมูล');
  } finally {
    isBackingUp.value = false;
  }
}

function triggerRestorePicker() {
  if (restoreFileInput.value) {
    restoreFileInput.value.click();
  }
}

async function handleRestoreFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!confirm(`คุณต้องการกู้คืนข้อมูลจากไฟล์ "${file.name}" ใช่หรือไม่?\nข้อมูลที่มีอยู่เดิมจะถูกแทนที่ด้วยข้อมูลจากไฟล์สำรอง`)) {
    event.target.value = '';
    return;
  }

  isRestoring.value = true;
  try {
    const result = await store.restoreData(file);
    toast.success(`กู้คืนข้อมูลสำเร็จ (${result.logsCount} รายการบันทึก OT)`);
    profileForm.value = { ...store.settings };
    emit('close');
  } catch (err) {
    console.error('Restore error:', err);
    toast.error('ไฟล์สำรองไม่ถูกต้องหรือไม่สามารถกู้คืนได้');
  } finally {
    isRestoring.value = false;
    event.target.value = '';
  }
}

async function handleClearDatabase() {
  if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลบันทึก OT และข้อมูลสแกนเวลาทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
    await store.clearDatabase();
    toast.info('ล้างข้อมูลในระบบเรียบร้อยแล้ว');
    emit('close');
  }
}
</script>


<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
      
      <!-- Modal Header -->
      <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <div>
          <h3 class="text-base font-bold text-slate-800 dark:text-white flex items-center space-x-2">
            <span>ตั้งค่าระบบและปฏิทิน</span>
          </h3>
          <p class="text-xs text-secondary dark:text-slate-400">
            ปรับแต่งข้อมูลส่วนตัว ปฏิทินวันหยุด ข้อความงาน และความปลอดภัย
          </p>
        </div>
        <button @click="emit('close')" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 px-6 gap-2 overflow-x-auto">
        <button
          @click="activeTab = 'profile'"
          type="button"
          :class="[
            'py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-2 whitespace-nowrap cursor-pointer',
            activeTab === 'profile'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          ]"
        >
          <User class="w-4 h-4" />
          <span>ข้อมูลส่วนตัว & อัตราเงิน</span>
        </button>

        <button
          @click="activeTab = 'calendar'"
          type="button"
          :class="[
            'py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-2 whitespace-nowrap cursor-pointer',
            activeTab === 'calendar'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          ]"
        >
          <CalendarDays class="w-4 h-4" />
          <span>ตั้งค่าปฏิทิน & วันหยุด</span>
          <span v-if="store.customHolidays.length > 0" class="w-2 h-2 rounded-full bg-rose-500"></span>
        </button>

        <button
          @click="activeTab = 'presets'"
          type="button"
          :class="[
            'py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-2 whitespace-nowrap cursor-pointer',
            activeTab === 'presets'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          ]"
        >
          <MessageSquareQuote class="w-4 h-4" />
          <span>ข้อความงานด่วน</span>
        </button>

        <button
          @click="activeTab = 'system'"
          type="button"
          :class="[
            'py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-2 whitespace-nowrap cursor-pointer',
            activeTab === 'system'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          ]"
        >
          <Shield class="w-4 h-4" />
          <span>ระบบ & สำรองข้อมูล</span>
        </button>
      </div>

      <!-- Tab Content Area -->
      <div class="p-6 overflow-y-auto flex-1 text-slate-800 dark:text-slate-100">
        
        <!-- ================= TAB 1: PROFILE & RATES ================= -->
        <div v-if="activeTab === 'profile'" class="space-y-5">
          <div class="space-y-3">
            <div class="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <User class="w-4 h-4 text-primary" />
              <span>ข้อมูลผู้ปฏิบัติงาน (นำไปใช้ออกรายงานราชการ)</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">ชื่อ - สกุล</label>
                <input 
                  v-model="profileForm.employeeName" 
                  type="text" 
                  placeholder="เช่น นายทดสอบ ปฏิบัติงาน"
                  class="w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">หน่วยงาน / สังกัด</label>
                <input 
                  v-model="profileForm.department" 
                  type="text" 
                  placeholder="เช่น กองบริการสารสนเทศ"
                  class="w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">ตำแหน่ง</label>
                <input 
                  v-model="profileForm.position" 
                  type="text" 
                  placeholder="เช่น นักวิชาการคอมพิวเตอร์"
                  class="w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">ระดับตำแหน่ง</label>
                <input 
                  v-model="profileForm.positionLevel" 
                  type="text" 
                  placeholder="เช่น ปฏิบัติการ, ชำนาญการ" 
                  class="w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <!-- Hourly Rates -->
          <div class="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div class="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <Sliders class="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>อัตราค่าตอบแทนต่อชั่วโมง</span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">วันทำการปกติ (บาท/ชม.)</label>
                <input 
                  v-model.number="profileForm.rateWeekday" 
                  type="number" 
                  class="w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                />
                <span class="text-[10px] text-slate-400">ค่ามาตรฐานราชการ: 50 บาท</span>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">วันหยุดราชการ (บาท/ชม.)</label>
                <input 
                  v-model.number="profileForm.rateHoliday" 
                  type="number" 
                  class="w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                />
                <span class="text-[10px] text-slate-400">ค่ามาตรฐานราชการ: 60 บาท</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ================= TAB 2: CALENDAR & HOLIDAYS ================= -->
        <div v-else-if="activeTab === 'calendar'" class="space-y-5">
          <div>
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                <CalendarDays class="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>จัดการวันหยุดประจำเดือน ({{ store.monthName }} {{ store.currentYear }})</span>
              </div>
              <span class="text-xs text-slate-500">
                เสาร์-อาทิตย์ & วันหยุด = 60 บ./ชม.
              </span>
            </div>
            <p class="text-xs text-secondary dark:text-slate-400 mt-1">
              ระบบตรวจสอบวันหยุดราชการไทยอัตโนมัติ และคุณสามารถเพิ่มวันหยุดพิเศษ (เช่น มติ ครม. หรือวันสถาปนา) หรือปรับสลับวันทำการได้ตามต้องการ
            </p>
          </div>

          <!-- Add / Override Holiday Form -->
          <div class="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
            <span class="text-xs font-bold text-slate-800 dark:text-white block">
              + เพิ่มวันหยุดพิเศษ / ปรับสถานะวันในเดือน {{ store.monthName }}
            </span>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div>
                <label class="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">วันที่</label>
                <select 
                  v-model.number="newHolidayDay"
                  class="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option v-for="d in daysInCurrentMonth" :key="d" :value="d">
                    วันที่ {{ d }} {{ store.monthName }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">ประเภทวัน</label>
                <select 
                  v-model="newHolidayType"
                  class="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="holiday">วันหยุด (60 บ./ชม.)</option>
                  <option value="weekday">วันทำการปกติ (50 บ./ชม.)</option>
                </select>
              </div>

              <div class="sm:col-span-2">
                <label class="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">ชื่อวันหยุด / หมายเหตุ</label>
                <div class="flex space-x-2">
                  <input 
                    v-model="newHolidayName" 
                    type="text" 
                    placeholder="เช่น วันหยุดพิเศษตามมติ ครม."
                    class="flex-1 text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button 
                    @click="handleAddCustomHoliday"
                    type="button" 
                    class="px-3 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-hover text-white transition inline-flex items-center space-x-1 shrink-0 cursor-pointer shadow-xs"
                  >
                    <Plus class="w-3.5 h-3.5" />
                    <span>บันทึก</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Current Month Holiday & Weekend List Table -->
          <div class="space-y-2">
            <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              รายการวันหยุดและวันหยุดสุดสัปดาห์ในเดือนนี้ ({{ currentMonthHolidayList.length }} วัน):
            </span>

            <div class="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              <div 
                v-for="item in currentMonthHolidayList" 
                :key="item.day"
                class="p-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
              >
                <div class="flex items-center space-x-2.5">
                  <span 
                    :class="[
                      'w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs',
                      item.info.isHoliday 
                        ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300' 
                        : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                    ]"
                  >
                    {{ item.day }}
                  </span>
                  <div>
                    <div class="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                      <span>{{ item.dayOfWeek }}ที่ {{ item.day }} {{ store.monthName }}</span>
                      <span 
                        v-if="item.custom" 
                        class="px-1.5 py-0.2 rounded text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-medium"
                      >
                        กำหนดเอง
                      </span>
                    </div>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400">
                      {{ item.info.name }}
                    </p>
                  </div>
                </div>

                <div class="flex items-center space-x-2">
                  <span 
                    :class="[
                      'px-2 py-0.5 rounded text-[10px] font-bold',
                      item.info.isHoliday 
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' 
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    ]"
                  >
                    {{ item.info.isHoliday ? '60 บ./ชม.' : '50 บ./ชม.' }}
                  </span>

                  <!-- Quick Toggle Button -->
                  <button 
                    @click="handleToggleFromList(item.day)"
                    type="button" 
                    :title="item.info.isHoliday ? 'คลิกเพื่อสลับเป็นวันทำการปกติ (50 บ.)' : 'คลิกเพื่อสลับเป็นวันหยุดราชการ (60 บ.)'"
                    class="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                  >
                    <ToggleRight v-if="item.info.isHoliday" class="w-4 h-4 text-rose-500" />
                    <ToggleLeft v-else class="w-4 h-4 text-slate-400" />
                  </button>

                  <!-- Remove Custom Override Button if custom -->
                  <button 
                    v-if="item.custom"
                    @click="handleDeleteCustomHoliday(item.custom.id)"
                    type="button" 
                    class="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                    title="ล้างการตั้งค่ากำหนดเอง (คืนค่าเริ่มต้นตามระบบ)"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                  <span v-else class="text-[10px] text-slate-400">ตามระบบ</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Civil Service Overtime Calculation Guide Box -->
          <div class="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs space-y-1 text-amber-900 dark:text-amber-200">
            <div class="font-bold flex items-center space-x-1.5">
              <span>📌 ระเบียบการคำนวณ OT วันหยุดราชการ:</span>
            </div>
            <ul class="list-disc list-inside space-y-0.5 text-[11px] opacity-90">
              <li>ช่วงเช้า: <strong>08:30 - 11:30 น.</strong> (สูงสุด 3 ชั่วโมง)</li>
              <li>ช่วงบ่าย: <strong>13:30 - 16:30 น.</strong> (สูงสุด 3 ชั่วโมง)</li>
              <li>ทำงานผ่านช่วง <strong>11:30 - 12:00</strong> และ <strong>13:00 - 13:30</strong> ให้นับเพิ่ม <strong>1 ชั่วโมง</strong> (ไม่รวมเวลาพักเที่ยง 12:00 - 13:00)</li>
              <li>ทำงานเต็มวัน 08:30 - 16:30 น. นับได้ <strong>7 ชั่วโมงเต็ม</strong> (อัตรา 60 บาท = สูงสุด 420 บาท/วัน)</li>
            </ul>
          </div>
        </div>

        <!-- ================= TAB 3: TASK PRESETS ================= -->
        <div v-else-if="activeTab === 'presets'" class="space-y-4">
          <div>
            <div class="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <MessageSquareQuote class="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>จัดการข้อความงานที่ใช้บ่อย (Presets)</span>
            </div>
            <p class="text-xs text-secondary dark:text-slate-400 mt-1">
              สร้างปุ่มลัดข้อความงานเพื่อความสะดวกรวดเร็วในการบันทึกงานรายวัน
            </p>
          </div>

          <div class="space-y-2">
            <div 
              v-for="preset in store.presets" 
              :key="preset.id"
              class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            >
              <div>
                <span class="font-bold text-slate-800 dark:text-white">{{ preset.title }}</span>
                <p class="text-slate-500 dark:text-slate-400 mt-0.5">{{ preset.description }}</p>
              </div>
              <button 
                @click="handleDeletePreset(preset.id)"
                type="button" 
                class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1.5"
                title="ลบ"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Add Preset Form -->
          <div class="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
            <span class="text-xs font-bold text-slate-800 dark:text-white block">+ เพิ่มข้อความงานใหม่</span>
            <input 
              v-model="newPresetTitle" 
              type="text" 
              placeholder="ชื่อย่อสำหรับแสดงบนปุ่ม (เช่น ตรวจสอบคำขอ JID)"
              class="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <textarea 
              v-model="newPresetDesc" 
              rows="2"
              placeholder="ข้อความเต็มที่จะใส่ลงในเอกสารรายงานผล..."
              class="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
            ></textarea>
            <button 
              @click="handleAddPreset"
              type="button" 
              class="w-full py-2 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white transition inline-flex items-center justify-center space-x-1 cursor-pointer"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>เพิ่มเข้าในรายการข้อความด่วน</span>
            </button>
          </div>
        </div>

        <!-- ================= TAB 4: SYSTEM & SECURITY ================= -->
        <div v-else-if="activeTab === 'system'" class="space-y-5">
          <!-- Security PIN -->
          <div class="space-y-3">
            <div class="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <KeyRound class="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>ความปลอดภัยและรหัสผ่านเข้าใช้งาน (PIN)</span>
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">รหัส PIN ยืนยันตัวตน (4-6 หลัก)</label>
              <input 
                v-model="profileForm.pin" 
                type="password" 
                maxlength="6"
                placeholder="1234"
                class="w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary font-bold"
              />
              <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-1">ใช้สำหรับปลดล็อกหน้าจอก่อนเข้าใช้งานโปรแกรม</p>
            </div>
          </div>

          <!-- App Distribution Packages -->
          <div class="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div class="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <Package class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>ดาวน์โหลดชุดโปรแกรมไปใช้งาน / ส่งต่อให้เพื่อนร่วมงาน</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <a 
                href="/OT_Tracker_Setup.pkg" 
                download="OT_Tracker_Setup.pkg"
                class="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 hover:border-rose-300 dark:hover:border-rose-800 bg-rose-50/40 dark:bg-rose-950/30 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition flex items-center justify-between group cursor-pointer shadow-sm"
              >
                <div class="flex items-center space-x-2">
                  <div class="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center shadow-sm shrink-0">
                    <Laptop class="w-3.5 h-3.5" />
                  </div>
                  <div class="text-left">
                    <span class="text-xs font-bold text-slate-800 dark:text-white block">macOS (.pkg)</span>
                    <span class="text-[10px] text-rose-700 dark:text-rose-300 font-medium">1.1 MB • ติดตั้งง่าย</span>
                  </div>
                </div>
                <Download class="w-3.5 h-3.5 text-primary group-hover:text-red-700 transition shrink-0" />
              </a>

              <a 
                href="/OT_Tracker_macOS.zip" 
                download="OT_Tracker_macOS.zip"
                class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition flex items-center justify-between group cursor-pointer"
              >
                <div class="flex items-center space-x-2">
                  <div class="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                    <Laptop class="w-3.5 h-3.5" />
                  </div>
                  <div class="text-left">
                    <span class="text-xs font-bold text-slate-800 dark:text-white block">macOS (.zip)</span>
                    <span class="text-[10px] text-slate-500 dark:text-slate-400">1.1 MB • มีสคริปต์</span>
                  </div>
                </div>
                <Download class="w-3.5 h-3.5 text-slate-400 group-hover:text-primary transition shrink-0" />
              </a>

              <a 
                href="/OT_Tracker_Setup.exe" 
                download="OT_Tracker_Setup.exe"
                class="p-2.5 rounded-xl border border-blue-200 dark:border-blue-900/60 hover:border-blue-300 dark:hover:border-blue-800 bg-blue-50/40 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition flex items-center justify-between group cursor-pointer shadow-sm"
              >
                <div class="flex items-center space-x-2">
                  <div class="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
                    <Laptop class="w-3.5 h-3.5" />
                  </div>
                  <div class="text-left">
                    <span class="text-xs font-bold text-slate-800 dark:text-white block">Windows (.exe)</span>
                    <span class="text-[10px] text-blue-700 dark:text-blue-300 font-medium">1.8 MB • ตัวติดตั้ง</span>
                  </div>
                </div>
                <Download class="w-3.5 h-3.5 text-blue-500 group-hover:text-blue-700 transition shrink-0" />
              </a>

              <div 
                class="p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/30 flex items-center justify-between shadow-sm"
              >
                <div class="flex items-center space-x-2">
                  <div class="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
                    <Smartphone class="w-3.5 h-3.5" />
                  </div>
                  <div class="text-left">
                    <span class="text-xs font-bold text-slate-800 dark:text-white block">Android (PWA/APK)</span>
                    <span class="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">ติดตั้งผ่าน Chrome</span>
                  </div>
                </div>
                <span class="text-[10px] font-bold text-emerald-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 shrink-0">WebAPK</span>
              </div>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
              📱 <strong>วิธีใช้งานบน Android:</strong> เปิดเว็บผ่าน Google Chrome บนมือถือ แล้วกดเมนู <strong>(⋮) > เลือก "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก"</strong> เพื่อสร้างเป็นแอป Android (WebAPK) ใช้งานออฟไลน์ได้ 100% หรือเปิดโฟลเดอร์ <code>android-app</code> ใน Android Studio เพื่อบิลด์เป็นไฟล์ <code>.apk</code>
            </p>
          </div>

          <!-- Backup & Restore Data -->
          <div class="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div class="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <Database class="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>สำรองและกู้คืนข้อมูล (Backup & Restore)</span>
            </div>

            <p class="text-xs text-slate-500 dark:text-slate-400">
              สำรองข้อมูลการตั้งค่า บันทึก OT รายวัน วันหยุดพิเศษ และข้อมูลเวลาสแกนทั้งหมดเก็บไว้เป็นไฟล์ JSON เพื่อความปลอดภัย หรือย้ายไปใช้งานบนเครื่องอื่น
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                @click="handleBackup"
                :disabled="isBackingUp"
                type="button"
                class="p-3 rounded-xl border border-blue-200 dark:border-blue-900/60 hover:border-blue-300 dark:hover:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition flex items-center justify-between text-left group cursor-pointer shadow-xs"
              >
                <div class="flex items-center space-x-2.5">
                  <div class="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Download class="w-4 h-4" />
                  </div>
                  <div>
                    <span class="text-xs font-bold text-slate-800 dark:text-white block">สำรองข้อมูล (Export Backup)</span>
                    <span class="text-[10px] text-blue-600 dark:text-blue-400">บันทึกเป็นไฟล์ .json ลงเครื่อง</span>
                  </div>
                </div>
                <span v-if="isBackingUp" class="text-xs text-blue-600 dark:text-blue-400 font-medium">กำลังสำรอง...</span>
              </button>

              <button
                @click="triggerRestorePicker"
                :disabled="isRestoring"
                type="button"
                class="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 hover:border-amber-300 dark:hover:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition flex items-center justify-between text-left group cursor-pointer shadow-xs"
              >
                <div class="flex items-center space-x-2.5">
                  <div class="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Upload class="w-4 h-4" />
                  </div>
                  <div>
                    <span class="text-xs font-bold text-slate-800 dark:text-white block">กู้คืนข้อมูล (Restore Backup)</span>
                    <span class="text-[10px] text-amber-700 dark:text-amber-300">นำเข้าไฟล์ .json กลับเข้าระบบ</span>
                  </div>
                </div>
                <span v-if="isRestoring" class="text-xs text-amber-600 dark:text-amber-400 font-medium">กำลังกู้คืน...</span>
              </button>

              <input 
                ref="restoreFileInput"
                @change="handleRestoreFile"
                type="file" 
                accept=".json,application/json" 
                class="hidden" 
              />
            </div>
          </div>

          <!-- Danger Zone (Clear Data) -->
          <div class="p-4 rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 space-y-2">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-xs font-bold text-red-800 dark:text-red-300 block">ล้างข้อมูลทั้งหมดในฐานข้อมูล</span>
                <span class="text-[11px] text-red-600 dark:text-red-400">ลบรายการบันทึก OT, วันหยุดพิเศษ และข้อมูลสแกนเวลาทั้งหมด</span>
              </div>
              <button 
                @click="handleClearDatabase"
                type="button" 
                class="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition inline-flex items-center space-x-1 cursor-pointer"
              >
                <Trash2 class="w-3.5 h-3.5" />
                <span>ล้างข้อมูล</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <div class="text-[11px] text-slate-400">
          * ข้อมูลจะถูกบันทึกไว้ในเครื่องแบบ Offline
        </div>
        <div class="flex space-x-2">
          <button 
            @click="emit('close')"
            type="button" 
            class="px-4 py-2 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
          <button 
            @click="handleSaveSettings"
            type="button" 
            class="px-5 py-2 text-xs font-semibold rounded-lg text-white bg-primary hover:bg-primary-hover shadow-sm inline-flex items-center space-x-1 transition cursor-pointer"
          >
            <Save class="w-4 h-4" />
            <span>บันทึกการตั้งค่า</span>
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
