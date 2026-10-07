<script setup>
import { ref } from 'vue';
import { useOtStore } from '../stores/otStore';
import { useToast } from 'vue-toastification';
import { Lock, KeyRound, ArrowRight, ShieldCheck } from 'lucide-vue-next';

const store = useOtStore();
const toast = useToast();

const pin = ref('');
const errorMessage = ref('');
const isShaking = ref(false);

function appendDigit(digit) {
  if (pin.value.length < 6) {
    pin.value += String(digit);
    errorMessage.value = '';
  }
}

function deleteDigit() {
  pin.value = pin.value.slice(0, -1);
  errorMessage.value = '';
}

function handleLogin() {
  if (!pin.value) {
    errorMessage.value = 'กรุณากรอกรหัสผ่าน / PIN';
    return;
  }

  const success = store.login(pin.value);
  if (success) {
    toast.success('ยินดีต้อนรับเข้าสู่ระบบ');
  } else {
    errorMessage.value = 'รหัสผ่าน / PIN ไม่ถูกต้อง (รหัสเริ่มต้น: 1234)';
    isShaking.value = true;
    setTimeout(() => {
      isShaking.value = false;
      pin.value = '';
    }, 500);
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 font-thai text-slate-800 dark:text-slate-100 transition-colors">
    <div 
      :class="[
        'bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center transition transform',
        isShaking ? 'animate-bounce' : ''
      ]"
    >
      
      <!-- Logo & App Icon -->
      <div class="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center mx-auto shadow-lg shadow-red-200 dark:shadow-red-950/40 mb-4">
        <Lock class="w-8 h-8" />
      </div>

      <h1 class="text-xl font-bold text-slate-800 dark:text-white">ระบบบันทึกและคำนวณเงิน OT</h1>
      <p class="text-xs text-secondary dark:text-slate-400 mt-1">กรุณายืนยันตัวตนเพื่อเข้าใช้งาน</p>

      <!-- Profile Tag -->
      <div v-if="store.settings.employeeName" class="mt-4 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 flex items-center justify-center space-x-2">
        <ShieldCheck class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <span class="font-semibold">{{ store.settings.employeeName }}</span>
      </div>
      <div v-else class="mt-4 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center space-x-2">
        <ShieldCheck class="w-4 h-4 text-primary" />
        <span>ระบบบันทึกเวลาทำงานล่วงเวลาส่วนบุคคล</span>
      </div>


      <!-- PIN Input -->
      <div class="mt-6 space-y-4">
        <form @submit.prevent="handleLogin">
          <div class="relative">
            <input 
              v-model="pin"
              type="password"
              maxlength="6"
              autofocus
              placeholder="กรอกรหัส PIN"
              class="w-full text-center text-2xl tracking-[0.5em] font-bold p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
            />
          </div>

          <p v-if="errorMessage" class="text-xs text-red-600 dark:text-red-400 font-semibold mt-2">
            {{ errorMessage }}
          </p>
          <p v-else class="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
            รหัสผ่านเริ่มต้น: <span class="font-bold text-slate-600 dark:text-slate-300">1234</span> (เปลี่ยนได้ในการตั้งค่า)
          </p>

          <button 
            type="submit" 
            class="w-full mt-4 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>เข้าสู่ระบบ</span>
            <ArrowRight class="w-4 h-4" />
          </button>
        </form>

        <!-- Number Pad for Touch/Click -->
        <div class="grid grid-cols-3 gap-2 pt-2">
          <button 
            v-for="n in [1, 2, 3, 4, 5, 6, 7, 8, 9]" 
            :key="n"
            @click="appendDigit(n)"
            type="button"
            class="py-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-base font-bold text-slate-800 dark:text-white transition active:scale-95 cursor-pointer"
          >
            {{ n }}
          </button>
          <button 
            @click="pin = ''" 
            type="button"
            class="py-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 transition cursor-pointer"
          >
            ล้าง
          </button>
          <button 
            @click="appendDigit(0)"
            type="button"
            class="py-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-base font-bold text-slate-800 dark:text-white transition active:scale-95 cursor-pointer"
          >
            0
          </button>
          <button 
            @click="deleteDigit"
            type="button"
            class="py-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 transition cursor-pointer"
          >
            ⌫
          </button>
        </div>

      </div>

    </div>
  </div>
</template>
