import { defineStore } from 'pinia';
import {
  initDb,
  getSettings,
  saveSettings as dbSaveSettings,
  getDailyLogs,
  saveDailyLog,
  deleteDailyLog,
  getPresets,
  savePreset as dbSavePreset,
  deletePreset as dbDeletePreset,
  saveAttendanceScans,
  getAttendanceScans,
  clearAllData,
  getCustomHolidays,
  saveCustomHoliday as dbSaveCustomHoliday,
  deleteCustomHoliday as dbDeleteCustomHoliday,
  DEFAULT_SETTINGS
} from '../services/db';
import { parseAttendancePdf, THAI_MONTHS } from '../services/pdfParser';
import { exportToExcel, exportToWord, exportDatabaseBackup, importDatabaseBackup } from '../services/exportService';
import { getCivilServiceReportTimes, getThaiHoliday, isWeekend } from '../services/thaiHolidays';

export const useOtStore = defineStore('ot', {
  state: () => {
    // Read actual real-time date from user's device
    const now = new Date();
    const systemYear = now.getFullYear() + 543;
    const systemMonth = now.getMonth() + 1;

    let initialYear = systemYear;
    let initialMonth = systemMonth;
    try {
      const y = localStorage.getItem('ot_last_year');
      const m = localStorage.getItem('ot_last_month');
      if (y) initialYear = parseInt(y, 10);
      if (m) initialMonth = parseInt(m, 10);
    } catch (e) {}

    return {
      initialized: false,
      isAuthenticated: false, // สถานะยืนยันตัวตน
      currentYear: initialYear, // อิงตามปี พ.ศ. ของเอกสารราชการ
      currentMonth: initialMonth,   // เดือนที่เลือกล่าสุด
      settings: { ...DEFAULT_SETTINGS },
      dailyLogs: [],
      attendanceScans: [],
      customHolidays: [],
      presets: [],
      isLoading: false,
      isDark: false,
    };
  },


  getters: {
    monthName: (state) => THAI_MONTHS[state.currentMonth - 1] || '',
    
    // ตรวจสอบว่าเดือน/ปีที่กำลังดูอยู่ เป็นเดือนและปีปัจจุบันของเครื่องผู้ใช้หรือไม่
    isCurrentSystemMonth: (state) => {
      const now = new Date();
      return state.currentYear === (now.getFullYear() + 543) && state.currentMonth === (now.getMonth() + 1);
    },

    // วันที่และเดือนปัจจุบันของเครื่องผู้ใช้
    systemToday: () => {
      const now = new Date();
      return {
        year: now.getFullYear() + 543,
        month: now.getMonth() + 1,
        day: now.getDate()
      };
    },

    // ตรวจสอบว่าเป็นการเข้าใช้งานครั้งแรกหรือไม่ (ยังไม่เคยระบุชื่อ)
    isFirstRun: (state) => !state.settings.isConfigured || !state.settings.employeeName,

    // Logs keyed by day number 1-31

    logsByDay: (state) => {
      const map = {};
      for (const log of state.dailyLogs) {
        map[log.day] = log;
      }
      return map;
    },

    // Scans keyed by day number 1-31
    scansByDay: (state) => {
      const map = {};
      for (const scan of state.attendanceScans) {
        map[scan.day] = scan;
      }
      return map;
    },

    // Custom holidays keyed by day number 1-31
    customHolidaysByDay: (state) => {
      const map = {};
      for (const h of state.customHolidays) {
        map[h.day] = h;
      }
      return map;
    },

    // Resolve holiday info considering custom overrides
    getDayHolidayInfo: (state) => (day) => {
      // 1. Check if user explicitly overridden this day
      const custom = state.customHolidays.find(h => Number(h.day) === Number(day));
      if (custom) {
        return custom.isHoliday 
          ? { isHoliday: true, name: custom.name || 'วันหยุดพิเศษ (กำหนดเอง)', isCustom: true, overrideId: custom.id }
          : { isHoliday: false, name: custom.name || 'วันทำการปกติ (กำหนดเอง)', isCustom: true, overrideId: custom.id };
      }

      // 2. Check official Thai Public Holiday
      const thHoliday = getThaiHoliday(state.currentYear, state.currentMonth, day);
      if (thHoliday) {
        return { isHoliday: true, name: thHoliday.name, isOfficial: true };
      }

      // 3. Check weekend (Sat / Sun)
      if (isWeekend(state.currentYear, state.currentMonth, day)) {
        return { isHoliday: true, name: 'วันหยุดสุดสัปดาห์', isWeekend: true };
      }

      return null;
    },

    // Summary totals for current month
    summary: (state) => {
      let weekdayHours = 0;
      let holidayHours = 0;
      let claimedCount = 0;

      for (const log of state.dailyLogs) {
        if (!log.isClaimed || !log.hours) continue;
        claimedCount++;
        if (log.dayType === 'holiday') {
          holidayHours += log.hours;
        } else {
          weekdayHours += log.hours;
        }
      }

      const rateWeekday = state.settings.rateWeekday || 50;
      const rateHoliday = state.settings.rateHoliday || 60;
      const weekdayAmount = weekdayHours * rateWeekday;
      const holidayAmount = holidayHours * rateHoliday;
      const totalAmount = weekdayAmount + holidayAmount;
      const totalHours = weekdayHours + holidayHours;

      return {
        weekdayHours,
        holidayHours,
        totalHours,
        weekdayAmount,
        holidayAmount,
        totalAmount,
        claimedCount,
      };
    },

    // Smart Discrepancy Analysis (Comparing Daily Logs vs PDF Scans)
    discrepancies: (state) => {
      const results = [];
      const logsMap = {};
      const scansMap = {};

      for (const log of state.dailyLogs) logsMap[log.day] = log;
      for (const scan of state.attendanceScans) scansMap[scan.day] = scan;

      // Scan all 31 days
      for (let day = 1; day <= 31; day++) {
        const log = logsMap[day];
        const scan = scansMap[day];

        // Case A: Have both log and scan
        if (log && scan) {
          const isHoliday = scan.dayType === 'holiday' || log.dayType === 'holiday' || scan.remark === 'วันหยุดราชการ';
          const expectedHours = isHoliday ? Math.min(7, scan.otHours) : Math.min(4, scan.otHours);

          if ((scan.remark === 'วันหยุดราชการ' || scan.dayType === 'holiday') && log.dayType !== 'holiday') {
            results.push({
              day,
              type: 'type_conflict',
              severity: 'warning',
              title: 'ประเภทวันไม่ตรงกัน',
              message: `ใน PDF ระบุเป็นวันหยุดราชการ แต่บันทึกไว้เป็นวันทำการปกติ`,
              log,
              scan,
            });
          } else if (expectedHours > 0 && log.hours !== expectedHours) {
            results.push({
              day,
              type: 'hours_mismatch',
              severity: 'danger',
              title: 'จำนวนชั่วโมงไม่ตรงกับเวลาสแกนจริง',
              message: isHoliday 
                ? `บันทึกไว้ ${log.hours} ชม. แต่สแกนออกจริง ${scan.scanOut} น. (วันหยุดคำนวณหักพักเที่ยงได้สูงสุด ${expectedHours} ชม.)`
                : `บันทึกไว้ ${log.hours} ชม. (${log.startTime}-${log.endTime}) แต่สแกนออกจริง ${scan.scanOut} น. (วันปกติคิดได้สูงสุด ${expectedHours} ชม.)`,
              log,
              scan,
            });
          } else {
            results.push({
              day,
              type: 'matched',
              severity: 'success',
              title: 'ข้อมูลตรงกันสมบูรณ์',
              message: `บันทึกตรงกับเวลาสแกนจริง (${log.hours} ชม.)`,
              log,
              scan,
            });
          }
        }
        // Case B: Logged, but NO scan found in PDF (ลืมสแกนนิ้ว / เครื่องไม่ติด)
        else if (log && !scan) {
          results.push({
            day,
            type: 'missing_scan',
            severity: 'warning',
            title: 'ไม่พบเวลาสแกนใน PDF',
            message: `ลงบันทึกงานไว้ ${log.hours} ชม. แต่ในรายงาน PDF ไม่พบเวลาสแกน`,
            log,
            scan: null,
          });
        }
        // Case C: Scan has OT (>16:30), but NOT logged yet (ตกหล่นยังไม่ได้บันทึกงาน)
        else if (!log && scan && scan.otHours > 0) {
          results.push({
            day,
            type: 'unlogged_scan',
            severity: 'info',
            title: 'พบเวลาสแกน OT ตกค้าง ยังไม่ได้ลงบันทึกงาน',
            message: `สแกนออก ${scan.scanOut} น. (มีสิทธิ์เบิก ${scan.otHours} ชม.) แต่ยังไม่ได้ลงบันทึกงาน`,
            log: null,
            scan,
          });
        }
      }

      return results;
    },

    // Total unresolved issues count
    unresolvedCount: (state) => {
      // @ts-ignore
      const disc = state.discrepancies || [];
      return disc.filter(d => d.type === 'hours_mismatch' || d.type === 'unlogged_scan' || d.type === 'missing_scan').length;
    }
  },

  actions: {
    initTheme() {
      const saved = localStorage.getItem('ot_theme');
      if (saved === 'dark' || (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        this.isDark = true;
        document.documentElement.classList.add('dark');
      } else {
        this.isDark = false;
        document.documentElement.classList.remove('dark');
      }
    },

    toggleTheme() {
      this.isDark = !this.isDark;
      if (this.isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('ot_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('ot_theme', 'light');
      }
    },

    async prevMonth() {
      let y = this.currentYear;
      let m = this.currentMonth - 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      await this.setMonthAndYear(y, m);
    },

    async nextMonth() {
      let y = this.currentYear;
      let m = this.currentMonth + 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      await this.setMonthAndYear(y, m);
    },

    async setMonth(m) {
      await this.setMonthAndYear(this.currentYear, m);
    },

    async setYear(y) {
      await this.setMonthAndYear(y, this.currentMonth);
    },

    async init() {
      if (this.initialized) return;
      this.initTheme();
      this.isLoading = true;
      try {
        await initDb();
        this.settings = await getSettings();
        this.presets = await getPresets();
        await this.loadCurrentMonthData();
        this.initialized = true;

        if (typeof window !== 'undefined' && !window.__otDatabaseSyncBound) {
          window.__otDatabaseSyncBound = true;
          window.addEventListener('ot:database_synced', async () => {
            this.settings = await getSettings();
            this.presets = await getPresets();
            await this.loadCurrentMonthData();
          });
        }
      } catch (err) {
        console.error('Failed to init OT store:', err);
      } finally {
        this.isLoading = false;
      }
    },

    async setMonthAndYear(year, month) {
      this.currentYear = year;
      this.currentMonth = month;
      try {
        localStorage.setItem('ot_last_year', String(year));
        localStorage.setItem('ot_last_month', String(month));
      } catch (e) {}
      await this.loadCurrentMonthData();
    },

    // สลับกลับมาที่เดือนและปีปัจจุบันตามนาฬิกาเครื่องทันที
    async goToCurrentMonth() {
      const now = new Date();
      const sysYear = now.getFullYear() + 543;
      const sysMonth = now.getMonth() + 1;
      await this.setMonthAndYear(sysYear, sysMonth);
    },

    async loadCurrentMonthData() {
      this.isLoading = true;
      try {
        this.dailyLogs = await getDailyLogs(this.currentYear, this.currentMonth);
        this.attendanceScans = await getAttendanceScans(this.currentYear, this.currentMonth);
        this.customHolidays = await getCustomHolidays(this.currentYear, this.currentMonth);
      } catch (err) {
        console.error('Failed to load month data:', err);
      } finally {
        this.isLoading = false;
      }
    },

    async addCustomHoliday(holiday) {
      const targetDay = Number(holiday.day);
      const targetYear = Number(holiday.year || this.currentYear);
      const targetMonth = Number(holiday.month || this.currentMonth);
      const saved = await dbSaveCustomHoliday({
        ...holiday,
        day: targetDay,
        year: targetYear,
        month: targetMonth,
        isHoliday: Boolean(holiday.isHoliday)
      });

      // Replace if exists in current state
      const idx = this.customHolidays.findIndex(h => h.id === saved.id || (Number(h.year) === targetYear && Number(h.month) === targetMonth && Number(h.day) === targetDay));
      if (idx >= 0) {
        this.customHolidays[idx] = saved;
      } else {
        this.customHolidays.push(saved);
      }
      this.customHolidays.sort((a, b) => a.day - b.day);
      return saved;
    },

    async removeCustomHoliday(idOrDay) {
      await dbDeleteCustomHoliday(idOrDay, this.currentYear, this.currentMonth);
      this.customHolidays = this.customHolidays.filter(h => h.id !== idOrDay && Number(h.day) !== Number(idOrDay));
    },

    // Quick Toggle Day Type (Weekday ⇄ Holiday)
    async toggleDayType(day) {
      const targetDay = Number(day);
      const existingCustom = this.customHolidays.find(h => Number(h.day) === targetDay);
      let willBeHoliday = false;

      if (existingCustom) {
        // If already overridden, remove the override to revert to system default
        await this.removeCustomHoliday(existingCustom.id);
        // Check what it reverts back to
        const info = this.getDayHolidayInfo(targetDay);
        willBeHoliday = info?.isHoliday || false;
      } else {
        // If not yet overridden, check current default status and flip it
        const currentInfo = this.getDayHolidayInfo(targetDay);
        const wasHoliday = currentInfo?.isHoliday || false;
        willBeHoliday = !wasHoliday;

        await this.addCustomHoliday({
          day: targetDay,
          year: this.currentYear,
          month: this.currentMonth,
          name: willBeHoliday ? 'วันหยุดพิเศษ (กำหนดเอง)' : 'วันทำการปกติ (กำหนดเอง)',
          isHoliday: willBeHoliday
        });
      }

      // If there is an existing log on this day, update its dayType and recalculate amount
      const log = this.logsByDay[targetDay];
      if (log) {
        const newDayType = willBeHoliday ? 'holiday' : 'weekday';
        await this.saveLog({
          ...log,
          dayType: newDayType,
        });
      }

      return willBeHoliday;
    },

    async saveLog(logData) {
      const rate = logData.dayType === 'holiday' 
        ? (this.settings.rateHoliday || 60)
        : (this.settings.rateWeekday || 50);

      const maxH = logData.dayType === 'holiday' ? 7 : 4;
      const rawHours = Number(logData.hours) || 0;
      const hours = Math.min(maxH, Math.max(0, rawHours));
      const amount = hours * rate;
      const targetDay = Number(logData.day);

      const item = {
        ...logData,
        day: targetDay,
        year: this.currentYear,
        month: this.currentMonth,
        rate,
        amount,
        isClaimed: logData.isClaimed !== undefined ? logData.isClaimed : true
      };

      const saved = await saveDailyLog(item);
      const idx = this.dailyLogs.findIndex(l => l.id === saved.id || Number(l.day) === targetDay);
      if (idx >= 0) {
        this.dailyLogs[idx] = saved;
      } else {
        this.dailyLogs.push(saved);
      }
      this.dailyLogs.sort((a, b) => a.day - b.day);

      // Auto-sync custom holiday override if user explicitly set dayType in modal
      const isDefaultHoliday = Boolean(getThaiHoliday(this.currentYear, this.currentMonth, targetDay) || isWeekend(this.currentYear, this.currentMonth, targetDay));
      const logIsHoliday = saved.dayType === 'holiday';
      if (logIsHoliday !== isDefaultHoliday) {
        await this.addCustomHoliday({
          day: targetDay,
          year: this.currentYear,
          month: this.currentMonth,
          name: logIsHoliday ? 'วันหยุดพิเศษ (กำหนดเอง)' : 'วันทำการปกติ (กำหนดเอง)',
          isHoliday: logIsHoliday
        });
      } else {
        // If changed back to match default, remove any redundant custom override
        const existing = this.customHolidays.find(h => Number(h.day) === targetDay);
        if (existing) {
          await this.removeCustomHoliday(existing.id);
        }
      }

      return saved;
    },

    async deleteLog(id) {
      await deleteDailyLog(id);
      this.dailyLogs = this.dailyLogs.filter(l => l.id !== id);
    },

    async updateSettings(newSettings) {
      this.settings = await dbSaveSettings({ ...this.settings, ...newSettings });
    },

    async addPreset(preset) {
      const saved = await dbSavePreset(preset);
      this.presets.push(saved);
      return saved;
    },

    async removePreset(id) {
      await dbDeletePreset(id);
      this.presets = this.presets.filter(p => p.id !== id);
    },

    // Import and parse PDF
    async importPdf(file) {
      this.isLoading = true;
      try {
        const parsed = await parseAttendancePdf(file);
        
        // Auto-update year and month if found in PDF
        if (parsed.year) this.currentYear = parsed.year;
        if (parsed.month) this.currentMonth = parsed.month;
        
        // Auto-detect and populate user profile if empty
        const updates = {};
        if (parsed.employeeName && !this.settings.employeeName) updates.employeeName = parsed.employeeName;
        if (parsed.position && !this.settings.position) updates.position = parsed.position;
        if (parsed.department && !this.settings.department) updates.department = parsed.department;
        if (Object.keys(updates).length > 0) {
          await this.updateSettings(updates);
        }

        // Save Scans to DB
        this.attendanceScans = await saveAttendanceScans(this.currentYear, this.currentMonth, parsed.records);

        return { success: true, count: parsed.records.length };
      } catch (err) {
        console.error('Failed to parse PDF:', err);
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    // Auto resolve all discrepancies by syncing hours & times to PDF scans
    async autoResolveAll() {
      const scansMap = {};
      for (const scan of this.attendanceScans) scansMap[scan.day] = scan;

      for (const log of this.dailyLogs) {
        const scan = scansMap[log.day];
        if (scan && scan.otHours > 0) {
          const isHoliday = scan.dayType === 'holiday' || log.dayType === 'holiday';
          const hours = isHoliday ? Math.min(7, scan.otHours) : Math.min(4, scan.otHours);
          const sTime = scan.scanIn || (isHoliday ? '08:30' : '16:30');
          const eTime = scan.scanOut || '16:30';

          // Adjust log hours and times to actual scan
          await this.saveLog({
            ...log,
            dayType: isHoliday ? 'holiday' : 'weekday',
            hours,
            startTime: sTime,
            endTime: eTime,
            scanOut: scan.scanOut,
            scanIn: scan.scanIn,
          });
        }
      }

      // Add unlogged scans as new entries with default preset
      const defaultDesc = this.presets[0]?.description || 'ปฏิบัติหน้าที่ตามที่ได้รับมอบหมาย';
      for (const scan of this.attendanceScans) {
        if (scan.otHours > 0) {
          const exists = this.dailyLogs.some(l => l.day === scan.day);
          if (!exists) {
            const isHoliday = scan.dayType === 'holiday';
            const hours = isHoliday ? Math.min(7, scan.otHours) : Math.min(4, scan.otHours);
            const sTime = scan.scanIn || (isHoliday ? '08:30' : '16:30');
            const eTime = scan.scanOut || '16:30';

            await this.saveLog({
              day: scan.day,
              date: scan.date,
              dayType: isHoliday ? 'holiday' : 'weekday',
              startTime: sTime,
              endTime: eTime,
              hours,
              taskDesc: defaultDesc,
              scanIn: scan.scanIn,
              scanOut: scan.scanOut,
              isClaimed: true
            });
          }
        }
      }
    },

    // Export Excel
    async downloadExcel() {
      return await exportToExcel({
        settings: this.settings,
        year: this.currentYear,
        month: this.currentMonth,
        logs: this.dailyLogs
      });
    },

    // Export Word
    async downloadWord() {
      return await exportToWord({
        settings: this.settings,
        year: this.currentYear,
        month: this.currentMonth,
        logs: this.dailyLogs
      });
    },

    // Backup & Restore Actions
    async backupData() {
      return await exportDatabaseBackup();
    },

    async restoreData(file) {
      this.isLoading = true;
      try {
        const result = await importDatabaseBackup(file);
        this.settings = await getSettings();
        this.presets = await getPresets();
        await this.loadCurrentMonthData();
        return result;
      } finally {
        this.isLoading = false;
      }
    },

    // Authentication Actions
    login(pin) {
      const validPin = this.settings.pin || '1234';
      if (String(pin).trim() === String(validPin).trim()) {
        this.isAuthenticated = true;
        return true;
      }
      return false;
    },

    logout() {
      this.isAuthenticated = false;
    },

    async updatePin(newPin) {
      await this.updateSettings({ pin: newPin });
    },

    // Clear / Reset Database Data
    async clearDatabase() {
      await clearAllData();
      this.dailyLogs = [];
      this.attendanceScans = [];
    }
  }
});

