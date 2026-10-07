/**
 * Database Service for Personal OT Management
 * Supports both Native Tauri SQLite (sqlite:ot_data.db) and Web LocalStorage/IndexedDB fallback
 */

const DB_NAME = 'sqlite:ot_data.db';
const LOCAL_STORAGE_KEY_LOGS = 'ot_tracker_daily_logs';
const LOCAL_STORAGE_KEY_SETTINGS = 'ot_tracker_settings';
const LOCAL_STORAGE_KEY_PRESETS = 'ot_tracker_presets';
const LOCAL_STORAGE_KEY_ATTENDANCE = 'ot_tracker_attendance';
const LOCAL_STORAGE_KEY_CUSTOM_HOLIDAYS = 'ot_tracker_custom_holidays';

let tauriDb = null;
let isTauriEnv = false;

// Default initial settings (Generic for any user)
export const DEFAULT_SETTINGS = {
  isConfigured: false, // เช็คว่าเคยตั้งค่าครั้งแรกหรือยัง
  employeeName: '', // ให้ผู้ใช้งานแต่ละคนกรอกชื่อตนเอง
  position: '',     // ตำแหน่งของผู้ใช้งาน
  positionLevel: '',
  department: '',   // สังกัด/หน่วยงานของผู้ใช้งาน
  rateWeekday: 50,  // 50 บาท/ชม.
  rateHoliday: 60,  // 60 บาท/ชม.
  normalWorkStart: '08:30',
  normalWorkEnd: '16:30',
  pin: '1234',      // รหัสผ่าน PIN เริ่มต้นสำหรับยืนยันตัวตน
};

// Default initial presets
export const DEFAULT_PRESETS = [
  { id: '1', title: 'ปฏิบัติหน้าที่ตามมอบหมาย', description: 'ปฏิบัติหน้าที่ตามที่ได้รับมอบหมาย' },
  { id: '2', title: 'ตรวจสอบคำขอนิติบุคคล', description: 'ตรวจสอบคำขอจดทะเบียนนิติบุคคลและเอกสารแนบ' },
  { id: '3', title: 'บันทึกข้อมูลเข้าระบบ', description: 'บันทึกและปรับปรุงข้อมูลในระบบสารสนเทศ' },
  { id: '4', title: 'จัดทำรายงานและประสานงาน', description: 'จัดทำรายงานสรุปข้อมูลและประสานงานหน่วยงานที่เกี่ยวข้อง' },
];

export async function initDb() {
  try {
    if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
      const Database = (await import('@tauri-apps/plugin-sql')).default;
      tauriDb = await Database.load(DB_NAME);
      isTauriEnv = true;
      console.log('✅ Connected to Tauri SQLite database');

      // Create Tables
      await tauriDb.execute(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      await tauriDb.execute(`
        CREATE TABLE IF NOT EXISTS daily_logs (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          day INTEGER NOT NULL,
          day_type TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          hours REAL NOT NULL,
          rate REAL NOT NULL,
          amount REAL NOT NULL,
          task_desc TEXT NOT NULL,
          jid TEXT,
          project TEXT,
          is_claimed INTEGER DEFAULT 1,
          scan_in TEXT,
          scan_out TEXT,
          created_at TEXT NOT NULL
        );
      `);

      await tauriDb.execute(`
        CREATE TABLE IF NOT EXISTS task_presets (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL
        );
      `);

      await tauriDb.execute(`
        CREATE TABLE IF NOT EXISTS attendance_scans (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          day INTEGER NOT NULL,
          scan_in TEXT,
          scan_out TEXT,
          work_hours TEXT,
          remark TEXT
        );
      `);

      await tauriDb.execute(`
        CREATE TABLE IF NOT EXISTS custom_holidays (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL UNIQUE,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          day INTEGER NOT NULL,
          name TEXT NOT NULL,
          is_holiday INTEGER DEFAULT 1
        );
      `);

      return true;
    }
  } catch (err) {
    console.warn('Tauri SQL plugin not available, falling back to local storage engine:', err);
  }

  isTauriEnv = false;

  // Check if Native macOS App has already preloaded the database
  if (window.__INITIAL_NATIVE_DB__) {
    try {
      const parsed = typeof window.__INITIAL_NATIVE_DB__ === 'string' 
        ? JSON.parse(window.__INITIAL_NATIVE_DB__) 
        : window.__INITIAL_NATIVE_DB__;
      applyNativePayload(parsed);
    } catch (e) {
      console.warn('Failed to parse __INITIAL_NATIVE_DB__:', e);
    }
  }

  // Request database from native wrapper if available
  if (window.webkit?.messageHandlers?.nativeLoadDatabase) {
    try {
      window.webkit.messageHandlers.nativeLoadDatabase.postMessage({});
    } catch (e) {}
  }

  // Initialize Web Fallback data if empty
  if (!localStorage.getItem(LOCAL_STORAGE_KEY_SETTINGS)) {
    localStorage.setItem(LOCAL_STORAGE_KEY_SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
  }
  if (!localStorage.getItem(LOCAL_STORAGE_KEY_PRESETS)) {
    localStorage.setItem(LOCAL_STORAGE_KEY_PRESETS, JSON.stringify(DEFAULT_PRESETS));
  }
  if (!localStorage.getItem(LOCAL_STORAGE_KEY_LOGS)) {
    localStorage.setItem(LOCAL_STORAGE_KEY_LOGS, JSON.stringify([]));
  }
  if (!localStorage.getItem(LOCAL_STORAGE_KEY_ATTENDANCE)) {
    localStorage.setItem(LOCAL_STORAGE_KEY_ATTENDANCE, JSON.stringify([]));
  }
  if (!localStorage.getItem(LOCAL_STORAGE_KEY_CUSTOM_HOLIDAYS)) {
    localStorage.setItem(LOCAL_STORAGE_KEY_CUSTOM_HOLIDAYS, JSON.stringify([]));
  }
  return true;
}

// ---------------- Native Storage Sync Layer ----------------
export function syncToNativeStorage() {
  try {
    if (window.webkit?.messageHandlers?.nativeSaveDatabase) {
      const payload = {
        settings: JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_SETTINGS) || '{}'),
        presets: JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_PRESETS) || '[]'),
        dailyLogs: JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_LOGS) || '[]'),
        attendanceScans: JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_ATTENDANCE) || '[]'),
        customHolidays: JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_CUSTOM_HOLIDAYS) || '[]'),
        lastSaved: new Date().toISOString()
      };
      window.webkit.messageHandlers.nativeSaveDatabase.postMessage(payload);
    }
  } catch (err) {
    console.warn('Native storage sync error:', err);
  }
}

// Global hooks for native app lifecycle
if (typeof window !== 'undefined') {
  window.__syncDatabaseToNative = syncToNativeStorage;
  window.addEventListener('beforeunload', syncToNativeStorage);
  window.addEventListener('pagehide', syncToNativeStorage);

  window.__onNativeDatabaseLoaded = function(jsonStrOrObj) {
    try {
      const data = typeof jsonStrOrObj === 'string' ? JSON.parse(jsonStrOrObj) : jsonStrOrObj;
      applyNativePayload(data);
    } catch (e) {
      console.warn('Failed to parse native database callback:', e);
    }
  };
}

export function applyNativePayload(payload) {
  if (!payload || typeof payload !== 'object') return;
  if (payload.settings && typeof payload.settings === 'object') {
    localStorage.setItem(LOCAL_STORAGE_KEY_SETTINGS, JSON.stringify(payload.settings));
  }
  if (Array.isArray(payload.presets)) {
    localStorage.setItem(LOCAL_STORAGE_KEY_PRESETS, JSON.stringify(payload.presets));
  }
  if (Array.isArray(payload.dailyLogs)) {
    localStorage.setItem(LOCAL_STORAGE_KEY_LOGS, JSON.stringify(payload.dailyLogs));
  }
  if (Array.isArray(payload.attendanceScans)) {
    localStorage.setItem(LOCAL_STORAGE_KEY_ATTENDANCE, JSON.stringify(payload.attendanceScans));
  }
  if (Array.isArray(payload.customHolidays)) {
    localStorage.setItem(LOCAL_STORAGE_KEY_CUSTOM_HOLIDAYS, JSON.stringify(payload.customHolidays));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ot:database_synced'));
  }
}

// ---------------- Settings ----------------
export async function getSettings() {
  if (isTauriEnv && tauriDb) {
    const rows = await tauriDb.select('SELECT key, value FROM settings');
    const result = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        result[row.key] = row.value;
      }
    }
    return result;
  }
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_SETTINGS);
  return raw ? JSON.parse(raw) : { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings) {
  if (isTauriEnv && tauriDb) {
    for (const [k, v] of Object.entries(settings)) {
      const valStr = JSON.stringify(v);
      await tauriDb.execute(
        'INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)',
        [k, valStr]
      );
    }
    return settings;
  }
  localStorage.setItem(LOCAL_STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  syncToNativeStorage();
  return settings;
}

// ---------------- Daily Logs ----------------
export async function getDailyLogs(year, month) {
  if (isTauriEnv && tauriDb) {
    const rows = await tauriDb.select(
      'SELECT * FROM daily_logs WHERE year = $1 AND month = $2 ORDER BY day ASC',
      [year, month]
    );
    return rows.map(r => ({
      id: r.id,
      date: r.date,
      year: r.year,
      month: r.month,
      day: r.day,
      dayType: r.day_type,
      startTime: r.start_time,
      endTime: r.end_time,
      hours: r.hours,
      rate: r.rate,
      amount: r.amount,
      taskDesc: r.task_desc,
      jid: r.jid,
      project: r.project,
      isClaimed: Boolean(r.is_claimed),
      scanIn: r.scan_in,
      scanOut: r.scan_out,
      createdAt: r.created_at
    }));
  }
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_LOGS);
  const allLogs = raw ? JSON.parse(raw) : [];
  return allLogs.filter(l => l.year === year && l.month === month).sort((a, b) => a.day - b.day);
}

export async function saveDailyLog(log) {
  const item = {
    ...log,
    id: log.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: log.createdAt || new Date().toISOString()
  };

  if (isTauriEnv && tauriDb) {
    await tauriDb.execute(`
      INSERT OR REPLACE INTO daily_logs (
        id, date, year, month, day, day_type, start_time, end_time,
        hours, rate, amount, task_desc, jid, project, is_claimed, scan_in, scan_out, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    `, [
      item.id, item.date, item.year, item.month, item.day, item.dayType, item.startTime, item.endTime,
      item.hours, item.rate, item.amount, item.taskDesc, item.jid || '', item.project || '',
      item.isClaimed ? 1 : 0, item.scanIn || '', item.scanOut || '', item.createdAt
    ]);
    syncToNativeStorage();
    return item;
  }

  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_LOGS);
  const allLogs = raw ? JSON.parse(raw) : [];
  const idx = allLogs.findIndex(l => l.id === item.id || (l.year === item.year && l.month === item.month && l.day === item.day));
  if (idx >= 0) {
    allLogs[idx] = item;
  } else {
    allLogs.push(item);
  }
  localStorage.setItem(LOCAL_STORAGE_KEY_LOGS, JSON.stringify(allLogs));
  syncToNativeStorage();
  return item;
}

export async function deleteDailyLog(id) {
  if (isTauriEnv && tauriDb) {
    await tauriDb.execute('DELETE FROM daily_logs WHERE id = $1', [id]);
    syncToNativeStorage();
    return true;
  }
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_LOGS);
  const allLogs = raw ? JSON.parse(raw) : [];
  const filtered = allLogs.filter(l => l.id !== id);
  localStorage.setItem(LOCAL_STORAGE_KEY_LOGS, JSON.stringify(filtered));
  syncToNativeStorage();
  return true;
}

// ---------------- Task Presets ----------------
export async function getPresets() {
  if (isTauriEnv && tauriDb) {
    const rows = await tauriDb.select('SELECT * FROM task_presets ORDER BY rowid ASC');
    if (rows.length === 0) {
      for (const p of DEFAULT_PRESETS) {
        await tauriDb.execute('INSERT INTO task_presets (id, title, description) VALUES ($1, $2, $3)', [p.id, p.title, p.description]);
      }
      return DEFAULT_PRESETS;
    }
    return rows;
  }
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PRESETS);
  return raw ? JSON.parse(raw) : DEFAULT_PRESETS;
}

export async function savePreset(preset) {
  const item = {
    ...preset,
    id: preset.id || `preset_${Date.now()}`
  };
  if (isTauriEnv && tauriDb) {
    await tauriDb.execute('INSERT OR REPLACE INTO task_presets (id, title, description) VALUES ($1, $2, $3)', [item.id, item.title, item.description]);
    syncToNativeStorage();
    return item;
  }
  const presets = await getPresets();
  const idx = presets.findIndex(p => p.id === item.id);
  if (idx >= 0) presets[idx] = item;
  else presets.push(item);
  localStorage.setItem(LOCAL_STORAGE_KEY_PRESETS, JSON.stringify(presets));
  syncToNativeStorage();
  return item;
}

export async function deletePreset(id) {
  if (isTauriEnv && tauriDb) {
    await tauriDb.execute('DELETE FROM task_presets WHERE id = $1', [id]);
    syncToNativeStorage();
    return true;
  }
  const presets = await getPresets();
  const filtered = presets.filter(p => p.id !== id);
  localStorage.setItem(LOCAL_STORAGE_KEY_PRESETS, JSON.stringify(filtered));
  syncToNativeStorage();
  return true;
}

// ---------------- Attendance Scans from PDF ----------------
export async function saveAttendanceScans(year, month, scans) {
  if (isTauriEnv && tauriDb) {
    await tauriDb.execute('DELETE FROM attendance_scans WHERE year = $1 AND month = $2', [year, month]);
    for (const s of scans) {
      await tauriDb.execute(`
        INSERT INTO attendance_scans (id, date, year, month, day, scan_in, scan_out, work_hours, remark)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        s.id || `scan_${year}_${month}_${s.day}`,
        s.date, year, month, s.day,
        s.scanIn || '', s.scanOut || '', s.workHours || '', s.remark || ''
      ]);
    }
    syncToNativeStorage();
    return scans;
  }
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_ATTENDANCE);
  let all = raw ? JSON.parse(raw) : [];
  all = all.filter(s => !(s.year === year && s.month === month));
  all.push(...scans);
  localStorage.setItem(LOCAL_STORAGE_KEY_ATTENDANCE, JSON.stringify(all));
  syncToNativeStorage();
  return scans;
}

export async function getAttendanceScans(year, month) {
  if (isTauriEnv && tauriDb) {
    const rows = await tauriDb.select('SELECT * FROM attendance_scans WHERE year = $1 AND month = $2 ORDER BY day ASC', [year, month]);
    return rows.map(r => ({
      id: r.id,
      date: r.date,
      year: r.year,
      month: r.month,
      day: r.day,
      scanIn: r.scan_in,
      scanOut: r.scan_out,
      workHours: r.work_hours,
      remark: r.remark
    }));
  }
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_ATTENDANCE);
  const all = raw ? JSON.parse(raw) : [];
  return all.filter(s => s.year === year && s.month === month).sort((a, b) => a.day - b.day);
}

// ---------------- Custom Holidays & Day Overrides ----------------
export async function getCustomHolidays(year, month) {
  if (isTauriEnv && tauriDb) {
    let query = 'SELECT * FROM custom_holidays';
    const params = [];
    if (year && month) {
      query += ' WHERE year = $1 AND month = $2';
      params.push(year, month);
    }
    query += ' ORDER BY year ASC, month ASC, day ASC';
    const rows = await tauriDb.select(query, params);
    return rows.map(r => ({
      id: r.id,
      date: r.date,
      year: Number(r.year),
      month: Number(r.month),
      day: Number(r.day),
      name: r.name,
      isHoliday: r.is_holiday === 1
    }));
  }
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_CUSTOM_HOLIDAYS);
  const all = raw ? JSON.parse(raw) : [];
  if (year && month) {
    return all.filter(h => Number(h.year) === Number(year) && Number(h.month) === Number(month))
      .map(h => ({ ...h, year: Number(h.year), month: Number(h.month), day: Number(h.day) }))
      .sort((a, b) => a.day - b.day);
  }
  return all.map(h => ({ ...h, year: Number(h.year), month: Number(h.month), day: Number(h.day) }))
    .sort((a, b) => (a.year - b.year) || (a.month - b.month) || (a.day - b.day));
}

export async function saveCustomHoliday(holiday) {
  const item = {
    id: holiday.id || `ch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    date: holiday.date || `${holiday.year}-${String(holiday.month).padStart(2, '0')}-${String(holiday.day).padStart(2, '0')}`,
    year: Number(holiday.year),
    month: Number(holiday.month),
    day: Number(holiday.day),
    name: holiday.name || (holiday.isHoliday ? 'วันหยุดพิเศษ (กำหนดเอง)' : 'วันทำการปกติ (กำหนดเอง)'),
    isHoliday: holiday.isHoliday !== undefined ? Boolean(holiday.isHoliday) : true
  };

  if (isTauriEnv && tauriDb) {
    await tauriDb.execute(`
      INSERT OR REPLACE INTO custom_holidays (id, date, year, month, day, name, is_holiday)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [item.id, item.date, item.year, item.month, item.day, item.name, item.isHoliday ? 1 : 0]);
    syncToNativeStorage();
    return item;
  }

  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_CUSTOM_HOLIDAYS);
  let list = raw ? JSON.parse(raw) : [];
  // replace if same date or same id exists (using Number to avoid type mismatch)
  list = list.filter(h => h.id !== item.id && !(Number(h.year) === item.year && Number(h.month) === item.month && Number(h.day) === item.day));
  list.push(item);
  localStorage.setItem(LOCAL_STORAGE_KEY_CUSTOM_HOLIDAYS, JSON.stringify(list));
  syncToNativeStorage();
  return item;
}

export async function deleteCustomHoliday(idOrDay, year, month) {
  if (isTauriEnv && tauriDb) {
    if (typeof idOrDay === 'string' && idOrDay.startsWith('ch_')) {
      await tauriDb.execute('DELETE FROM custom_holidays WHERE id = $1', [idOrDay]);
    } else if (year && month) {
      await tauriDb.execute('DELETE FROM custom_holidays WHERE day = $1 AND year = $2 AND month = $3', [Number(idOrDay), Number(year), Number(month)]);
    } else {
      await tauriDb.execute('DELETE FROM custom_holidays WHERE id = $1', [idOrDay]);
    }
    syncToNativeStorage();
    return true;
  }
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_CUSTOM_HOLIDAYS);
  let list = raw ? JSON.parse(raw) : [];
  list = list.filter(h => {
    // If id matches, remove
    if (h.id === idOrDay) return false;
    // If day, year, and month match, remove
    if (year && month && Number(h.year) === Number(year) && Number(h.month) === Number(month) && Number(h.day) === Number(idOrDay)) {
      return false;
    }
    // If no year/month provided and day matches, remove
    if (!year && !month && Number(h.day) === Number(idOrDay)) {
      return false;
    }
    return true;
  });
  localStorage.setItem(LOCAL_STORAGE_KEY_CUSTOM_HOLIDAYS, JSON.stringify(list));
  syncToNativeStorage();
  return true;
}

// ---------------- Clear / Reset Database ----------------
export async function clearAllData() {
  if (isTauriEnv && tauriDb) {
    await tauriDb.execute('DELETE FROM daily_logs');
    await tauriDb.execute('DELETE FROM attendance_scans');
    await tauriDb.execute('DELETE FROM custom_holidays');
    syncToNativeStorage();
    return true;
  }
  localStorage.setItem(LOCAL_STORAGE_KEY_LOGS, JSON.stringify([]));
  localStorage.setItem(LOCAL_STORAGE_KEY_ATTENDANCE, JSON.stringify([]));
  localStorage.setItem(LOCAL_STORAGE_KEY_CUSTOM_HOLIDAYS, JSON.stringify([]));
  syncToNativeStorage();
  return true;
}

// ---------------- Full Database Backup & Restore ----------------

export async function getAllDailyLogs() {
  if (isTauriEnv && tauriDb) {
    const rows = await tauriDb.select('SELECT * FROM daily_logs ORDER BY year DESC, month DESC, day ASC');
    return rows.map(r => ({
      id: r.id,
      date: r.date,
      year: r.year,
      month: r.month,
      day: r.day,
      dayType: r.day_type,
      startTime: r.start_time,
      endTime: r.end_time,
      hours: r.hours,
      rate: r.rate,
      amount: r.amount,
      taskDesc: r.task_desc,
      jid: r.jid,
      project: r.project,
      isClaimed: r.is_claimed === 1,
      scanIn: r.scan_in,
      scanOut: r.scan_out,
      createdAt: r.created_at,
    }));
  }
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_LOGS);
  return raw ? JSON.parse(raw) : [];
}

export async function getAllAttendanceScans() {
  if (isTauriEnv && tauriDb) {
    const rows = await tauriDb.select('SELECT * FROM attendance_scans ORDER BY year DESC, month DESC, day ASC');
    return rows.map(r => ({
      id: r.id,
      date: r.date,
      year: r.year,
      month: r.month,
      day: r.day,
      scanIn: r.scan_in,
      scanOut: r.scan_out,
      workHours: r.work_hours,
      remark: r.remark
    }));
  }
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_ATTENDANCE);
  return raw ? JSON.parse(raw) : [];
}

export async function createBackupData() {
  const settings = await getSettings();
  const presets = await getPresets();
  const dailyLogs = await getAllDailyLogs();
  const attendanceScans = await getAllAttendanceScans();
  const customHolidays = await getCustomHolidays();

  return {
    version: '1.0',
    app: 'OT_Tracker',
    exportedAt: new Date().toISOString(),
    settings,
    presets,
    dailyLogs,
    attendanceScans,
    customHolidays,
  };
}

export async function restoreBackupData(backup) {
  if (!backup || typeof backup !== 'object') {
    throw new Error('รูปแบบไฟล์สำรองข้อมูลไม่ถูกต้อง');
  }

  // Restore Settings
  if (backup.settings && typeof backup.settings === 'object') {
    await saveSettings(backup.settings);
  }

  // Restore Presets
  if (Array.isArray(backup.presets)) {
    if (isTauriEnv && tauriDb) {
      await tauriDb.execute('DELETE FROM task_presets');
      for (const p of backup.presets) {
        await tauriDb.execute('INSERT OR REPLACE INTO task_presets (id, title, description) VALUES ($1, $2, $3)', [p.id, p.title, p.description]);
      }
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEY_PRESETS, JSON.stringify(backup.presets));
    }
  }

  // Restore Daily Logs
  if (Array.isArray(backup.dailyLogs)) {
    if (isTauriEnv && tauriDb) {
      await tauriDb.execute('DELETE FROM daily_logs');
      for (const l of backup.dailyLogs) {
        await tauriDb.execute(`
          INSERT OR REPLACE INTO daily_logs 
          (id, date, year, month, day, day_type, start_time, end_time, hours, rate, amount, task_desc, jid, project, is_claimed, scan_in, scan_out, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        `, [
          l.id, l.date, l.year, l.month, l.day, l.dayType,
          l.startTime, l.endTime, l.hours, l.rate, l.amount,
          l.taskDesc, l.jid || '', l.project || '',
          l.isClaimed ? 1 : 0, l.scanIn || '', l.scanOut || '', l.createdAt || new Date().toISOString()
        ]);
      }
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEY_LOGS, JSON.stringify(backup.dailyLogs));
    }
  }

  // Restore Attendance Scans
  if (Array.isArray(backup.attendanceScans)) {
    if (isTauriEnv && tauriDb) {
      await tauriDb.execute('DELETE FROM attendance_scans');
      for (const s of backup.attendanceScans) {
        await tauriDb.execute(`
          INSERT OR REPLACE INTO attendance_scans (id, date, year, month, day, scan_in, scan_out, work_hours, remark)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          s.id, s.date, s.year, s.month, s.day,
          s.scanIn || '', s.scanOut || '', s.workHours || '', s.remark || ''
        ]);
      }
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEY_ATTENDANCE, JSON.stringify(backup.attendanceScans));
    }
  }

  // Restore Custom Holidays
  if (Array.isArray(backup.customHolidays)) {
    if (isTauriEnv && tauriDb) {
      await tauriDb.execute('DELETE FROM custom_holidays');
      for (const h of backup.customHolidays) {
        await tauriDb.execute(`
          INSERT OR REPLACE INTO custom_holidays (id, date, year, month, day, name, is_holiday)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [h.id, h.date, h.year, h.month, h.day, h.name, h.isHoliday ? 1 : 0]);
      }
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEY_CUSTOM_HOLIDAYS, JSON.stringify(backup.customHolidays));
    }
  }

  syncToNativeStorage();
  return {
    success: true,
    logsCount: backup.dailyLogs ? backup.dailyLogs.length : 0,
    scansCount: backup.attendanceScans ? backup.attendanceScans.length : 0,
    holidaysCount: backup.customHolidays ? backup.customHolidays.length : 0
  };
}

