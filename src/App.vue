<script setup>
import { ref, onMounted } from 'vue';
import { useOtStore } from './stores/otStore';
import LoginView from './components/LoginView.vue';
import Navbar from './components/Navbar.vue';
import CalendarView from './components/CalendarView.vue';
import DailyLogModal from './components/DailyLogModal.vue';
import ReconciliationModal from './components/ReconciliationModal.vue';
import UploadPdfModal from './components/UploadPdfModal.vue';
import InitialSetupModal from './components/InitialSetupModal.vue';
import SettingsModal from './components/SettingsModal.vue';
import PrintPreviewModal from './components/PrintPreviewModal.vue';

const store = useOtStore();

// Modal States
const showDailyModal = ref(false);
const selectedDay = ref(1);
const showReconcileModal = ref(false);
const showUploadModal = ref(false);
const showSettingsModal = ref(false);
const showPrintPreviewModal = ref(false);

function handleSelectDay(day) {
  selectedDay.value = day;
  showDailyModal.value = true;
}

function handleEditFromReconcile(day) {
  showReconcileModal.value = false;
  selectedDay.value = day;
  showDailyModal.value = true;
}

function handlePdfUploaded() {
  showUploadModal.value = false;
  // Automatically open reconciliation modal after PDF upload
  showReconcileModal.value = true;
}

onMounted(async () => {
  await store.init();
});

</script>

<template>
  <!-- Login / Lock Screen -->
  <LoginView v-if="!store.isAuthenticated" />

  <!-- Main Authenticated App Dashboard -->
  <div v-else class="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-thai text-slate-800 dark:text-slate-100 transition-colors">
    
    <!-- Top Navigation -->
    <Navbar 
      @open-upload="showUploadModal = true"
      @open-reconcile="showReconcileModal = true"
      @open-export="showPrintPreviewModal = true"
      @open-settings="showSettingsModal = true"
      @open-preview="showPrintPreviewModal = true"
    />

    <!-- Main Content Area -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      <div v-if="store.isLoading && !store.initialized" class="text-center py-20">
        <p class="text-sm font-semibold text-slate-500 dark:text-slate-400">กำลังโหลดระบบฐานข้อมูล...</p>
      </div>

      <div v-else>
        <!-- Calendar View -->
        <CalendarView 
          @select-day="handleSelectDay"
          @open-reconcile="showReconcileModal = true"
        />
      </div>

    </main>

    <!-- Footer -->
    <footer class="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-secondary dark:text-slate-400">
      <p>ระบบบันทึกและคำนวณเงิน OT (Personal OT Tracker) • {{ store.settings.department || 'บันทึกเวลาทำงานล่วงเวลาส่วนบุคคล' }} • รองรับการทำงานแบบ Offline บน macOS & Windows</p>
    </footer>

    <!-- Modals -->
    <InitialSetupModal 
      :show="store.isAuthenticated && store.isFirstRun"
      @completed="store.loadCurrentMonthData()"
    />

    <DailyLogModal 
      :show="showDailyModal"
      :day="selectedDay"
      @close="showDailyModal = false"
      @next-day="(next) => { selectedDay = next; }"
    />

    <ReconciliationModal 
      :show="showReconcileModal"
      @close="showReconcileModal = false"
      @edit-day="handleEditFromReconcile"
    />

    <UploadPdfModal 
      :show="showUploadModal"
      @close="showUploadModal = false"
      @uploaded="handlePdfUploaded"
    />

    <!-- Unified Document Center (Preview, Print & Export) -->
    <PrintPreviewModal 
      :show="showPrintPreviewModal"
      @close="showPrintPreviewModal = false"
    />

    <SettingsModal 
      :show="showSettingsModal"
      @close="showSettingsModal = false"
    />

  </div>
</template>

