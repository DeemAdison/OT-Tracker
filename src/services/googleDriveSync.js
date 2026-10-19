/**
 * Google Drive Private Cloud Sync Service (Zero-Server Architecture)
 * 
 * Uses Google Identity Services (GIS) and Google Drive API v3 (appDataFolder).
 * All data is stored directly in the user's personal private Google Drive appDataFolder.
 * No third-party server or middleman is involved.
 */

import { createBackupData, restoreBackupData } from './db';
import { THAI_MONTHS } from './pdfParser';

export const DEFAULT_CLIENT_ID = '786851092864-sottu7l3vc3pg2pk9cf27gmkj5ik1b6s.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
const SYNC_FILENAME = 'ot_tracker_cloud_sync.json';

// Local Storage Keys
const KEY_CLIENT_ID = 'ot_gdrive_client_id';
const KEY_ACCESS_TOKEN = 'ot_gdrive_access_token';
const KEY_TOKEN_EXPIRES_AT = 'ot_gdrive_token_expires_at';
const KEY_USER = 'ot_gdrive_user';
const KEY_CONNECTED = 'ot_gdrive_connected';
const KEY_AUTO_SYNC = 'ot_gdrive_auto_sync';
const KEY_LAST_SYNC = 'ot_gdrive_last_sync';
const KEY_FILE_ID = 'ot_gdrive_file_id';

let tokenClientInstance = null;

/**
 * Get configured Google OAuth Client ID
 */
export function getClientId() {
  const custom = localStorage.getItem(KEY_CLIENT_ID);
  return custom && custom.trim() ? custom.trim() : DEFAULT_CLIENT_ID;
}

/**
 * Update Google OAuth Client ID
 */
export function setClientId(newId) {
  if (newId && newId.trim()) {
    localStorage.setItem(KEY_CLIENT_ID, newId.trim());
  } else {
    localStorage.removeItem(KEY_CLIENT_ID);
  }
  tokenClientInstance = null; // Reset instance so it re-inits with new ID
}

/**
 * Check if user is currently connected to Google Drive
 */
export function isGoogleConnected() {
  return localStorage.getItem(KEY_CONNECTED) === 'true';
}

/**
 * Get stored Google User Profile info
 */
export function getGoogleUser() {
  try {
    const raw = localStorage.getItem(KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Check if Auto-Sync is enabled
 */
export function isAutoSyncEnabled() {
  const raw = localStorage.getItem(KEY_AUTO_SYNC);
  return raw === null ? true : raw === 'true';
}

/**
 * Set Auto-Sync enabled/disabled
 */
export function setAutoSync(enabled) {
  localStorage.setItem(KEY_AUTO_SYNC, enabled ? 'true' : 'false');
}

/**
 * Get ISO string timestamp of last sync
 */
export function getLastSyncTime() {
  return localStorage.getItem(KEY_LAST_SYNC) || null;
}

/**
 * Wait for Google Identity Services (GIS) SDK script to load
 */
export function waitForGis(timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      return resolve(window.google.accounts.oauth2);
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(interval);
        return resolve(window.google.accounts.oauth2);
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error('ไม่สามารถโหลด Google Identity Services ได้ (กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต)'));
      }
    }, 100);
  });
}

/**
 * Request Access Token via Native Browser Loopback (Desktop) or GIS Token Client (Web/Tablet)
 * @param {Object} options - { prompt: '' | 'consent' | 'select_account' }
 */
export async function requestGoogleAccessToken({ prompt = '' } = {}) {
  // If running inside macOS Standalone App: Use System Browser + Loopback Server
  if (typeof window !== 'undefined' && window.webkit?.messageHandlers?.nativeGoogleAuth) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.__onGoogleDriveAuthSuccess = null;
        reject(new Error('หมดเวลาการรอเข้าสู่ระบบจากเบราว์เซอร์ (โปรดลองใหม่อีกครั้ง)'));
      }, 120000); // 2 minutes

      window.__onGoogleDriveAuthSuccess = (token) => {
        clearTimeout(timeout);
        window.__onGoogleDriveAuthSuccess = null;
        if (!token) return reject(new Error('ไม่ได้รับ Access Token'));
        const expiresInSec = 3500;
        const expiresAt = Date.now() + (expiresInSec * 1000) - 60000;
        localStorage.setItem(KEY_ACCESS_TOKEN, token);
        localStorage.setItem(KEY_TOKEN_EXPIRES_AT, String(expiresAt));
        resolve(token);
      };

      try {
        window.webkit.messageHandlers.nativeGoogleAuth.postMessage({ clientId: getClientId() });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  // Web / Tablet Browser fallback using Google Identity Services (GIS)
  const oauth2 = await waitForGis();
  const clientId = getClientId();

  return new Promise((resolve, reject) => {
    let resolved = false;

    try {
      tokenClientInstance = oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: async (response) => {
          if (response.error) {
            resolved = true;
            return reject(new Error(response.error_description || response.error));
          }
          if (response.access_token) {
            const expiresInSec = Number(response.expires_in) || 3500;
            const expiresAt = Date.now() + (expiresInSec * 1000) - 60000; // 1-minute buffer
            localStorage.setItem(KEY_ACCESS_TOKEN, response.access_token);
            localStorage.setItem(KEY_TOKEN_EXPIRES_AT, String(expiresAt));
            resolved = true;
            resolve(response.access_token);
          } else {
            resolved = true;
            reject(new Error('ไม่ได้รับ Access Token จาก Google'));
          }
        },
        error_callback: (err) => {
          if (!resolved) {
            resolved = true;
            reject(new Error(err?.message || 'การเปิดหน้าต่างยืนยันตัวตน Google ไม่สำเร็จ'));
          }
        }
      });

      tokenClientInstance.requestAccessToken({ prompt });
    } catch (err) {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    }
  });
}

/**
 * Generate Direct Google OAuth Link (for manual authorization in browser)
 */
export function getDirectOAuthUrl() {
  const clientId = getClientId();
  const scope = encodeURIComponent(SCOPES);
  const redirectUri = 'http://127.0.0.1:42815';
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`;
}

/**
 * Manually save Access Token (for corporate proxy / manual fallback)
 */
export async function setManualAccessToken(token) {
  if (!token || !token.trim()) throw new Error('กรุณาระบุ Access Token');
  const cleanToken = token.trim();
  const expiresInSec = 3500;
  const expiresAt = Date.now() + (expiresInSec * 1000) - 60000;
  localStorage.setItem(KEY_ACCESS_TOKEN, cleanToken);
  localStorage.setItem(KEY_TOKEN_EXPIRES_AT, String(expiresAt));
  const profile = await fetchGoogleUserInfo(cleanToken);
  localStorage.setItem(KEY_CONNECTED, 'true');
  return { token: cleanToken, profile };
}

/**
 * Fetch Google User Info (Name, Email, Profile Picture)
 */
export async function fetchGoogleUserInfo(token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error('ไม่สามารถดึงข้อมูลโปรไฟล์ Google ได้');
  }
  const data = await res.json();
  const profile = {
    email: data.email || '',
    name: data.name || '',
    picture: data.picture || ''
  };
  localStorage.setItem(KEY_USER, JSON.stringify(profile));
  return profile;
}

/**
 * Connect / Sign in with Google Drive
 */
export async function loginGoogleDrive({ promptConsent = false } = {}) {
  const token = await requestGoogleAccessToken({ prompt: promptConsent ? 'consent' : '' });
  const profile = await fetchGoogleUserInfo(token);
  localStorage.setItem(KEY_CONNECTED, 'true');
  return { token, profile };
}

/**
 * Disconnect / Sign out from Google Drive
 */
export function disconnectGoogleDrive() {
  const token = localStorage.getItem(KEY_ACCESS_TOKEN);
  if (token && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(token, () => {});
    } catch (e) {}
  }
  localStorage.removeItem(KEY_ACCESS_TOKEN);
  localStorage.removeItem(KEY_TOKEN_EXPIRES_AT);
  localStorage.removeItem(KEY_USER);
  localStorage.setItem(KEY_CONNECTED, 'false');
  localStorage.removeItem(KEY_FILE_ID);
}

/**
 * Get currently valid access token or refresh if expired
 */
export async function getValidAccessToken({ allowPrompt = true } = {}) {
  const token = localStorage.getItem(KEY_ACCESS_TOKEN);
  const expiresAt = Number(localStorage.getItem(KEY_TOKEN_EXPIRES_AT) || 0);

  if (token && Date.now() < expiresAt) {
    return token;
  }

  // If expired or missing, try silent refresh or user prompt
  if (allowPrompt || isGoogleConnected()) {
    try {
      return await requestGoogleAccessToken({ prompt: '' });
    } catch (err) {
      if (allowPrompt) {
        return await requestGoogleAccessToken({ prompt: 'consent' });
      }
      throw err;
    }
  }

  throw new Error('ยังไม่ได้เชื่อมต่อกับ Google Drive');
}

/**
 * Search for existing backup file in Google Drive appDataFolder
 */
export async function findSyncFile(token) {
  const cachedFileId = localStorage.getItem(KEY_FILE_ID);
  if (cachedFileId) {
    // Verify cached file is still valid
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${cachedFileId}?fields=id,name,trashed,modifiedTime`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const file = await res.json();
        if (!file.trashed) return file;
      }
    } catch (e) {}
  }

  const query = encodeURIComponent(`name='${SYNC_FILENAME}' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime,size)&pageSize=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ค้นหาไฟล์ซิงค์บน Google Drive ไม่สำเร็จ (${res.status}): ${errText}`);
  }

  const result = await res.json();
  const file = result.files && result.files.length > 0 ? result.files[0] : null;
  if (file?.id) {
    localStorage.setItem(KEY_FILE_ID, file.id);
  } else {
    localStorage.removeItem(KEY_FILE_ID);
  }
  return file;
}

/**
 * Download sync file content from Google Drive
 */
export async function downloadSyncFile(token, fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`ดาวน์โหลดไฟล์ซิงค์ไม่สำเร็จ (${res.status})`);
  }
  return await res.json();
}

/**
 * Create a new sync file in Google Drive appDataFolder (Multipart Upload)
 */
export async function createSyncFile(token, payload) {
  const metadata = {
    name: SYNC_FILENAME,
    parents: ['appDataFolder'],
    mimeType: 'application/json'
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(payload) +
    closeDelimiter;

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`สร้างไฟล์สำรองบน Google Drive ไม่สำเร็จ (${res.status}): ${errText}`);
  }

  const file = await res.json();
  if (file?.id) {
    localStorage.setItem(KEY_FILE_ID, file.id);
  }
  return file;
}

/**
 * Update existing sync file on Google Drive (Media Upload)
 */
export async function updateSyncFile(token, fileId, payload) {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`อัปเดตไฟล์ซิงค์บน Google Drive ไม่สำเร็จ (${res.status}): ${errText}`);
  }

  return await res.json();
}

export function getLogKey(l) {
  if (!l) return '';
  if (l.year && l.month && l.day) {
    return `${l.year}-${String(l.month).padStart(2, '0')}-${String(l.day).padStart(2, '0')}`;
  }
  if (typeof l.date === 'string') {
    const isoMatch = l.date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${String(isoMatch[2]).padStart(2, '0')}-${String(isoMatch[3]).padStart(2, '0')}`;
    }
  }
  return l.date || l.id || '';
}

function getTombstoneTimeForLog(log, tombstones) {
  if (!log || !tombstones) return 0;
  const keysToCheck = [];
  if (log.year && log.month && log.day) {
    const y = Number(log.year);
    const m = String(log.month).padStart(2, '0');
    const d = String(log.day).padStart(2, '0');
    keysToCheck.push(`${y}-${m}-${d}`);
    const altY = y > 2400 ? y - 543 : y + 543;
    keysToCheck.push(`${altY}-${m}-${d}`);
    if (log.month >= 1 && log.month <= 12) {
      keysToCheck.push(`${Number(log.day)} ${THAI_MONTHS[log.month - 1]} ${y}`);
      keysToCheck.push(`${Number(log.day)} ${THAI_MONTHS[log.month - 1]} ${altY}`);
    }
  }
  if (log.date) keysToCheck.push(log.date);
  if (log.id) keysToCheck.push(log.id);

  const timestamps = keysToCheck.map(k => tombstones[k]).filter(Boolean);
  if (timestamps.length === 0) return 0;
  return Math.max(...timestamps.map(t => new Date(t).getTime()));
}

function removeTombstonesForLog(log, tombstones) {
  if (!log || !tombstones) return;
  const keysToRemove = [];
  if (log.year && log.month && log.day) {
    const y = Number(log.year);
    const m = String(log.month).padStart(2, '0');
    const d = String(log.day).padStart(2, '0');
    keysToRemove.push(`${y}-${m}-${d}`);
    const altY = y > 2400 ? y - 543 : y + 543;
    keysToRemove.push(`${altY}-${m}-${d}`);
    if (log.month >= 1 && log.month <= 12) {
      keysToRemove.push(`${Number(log.day)} ${THAI_MONTHS[log.month - 1]} ${y}`);
      keysToRemove.push(`${Number(log.day)} ${THAI_MONTHS[log.month - 1]} ${altY}`);
    }
  }
  if (log.date) keysToRemove.push(log.date);
  if (log.id) keysToRemove.push(log.id);

  for (const k of keysToRemove) {
    if (tombstones[k]) {
      delete tombstones[k];
    }
  }
}

/**
 * Smart Conflict Resolution & Merge Algorithm
 * Combines local data and cloud data without losing any records
 */
export function mergeDatasets(local, cloud) {
  if (!cloud || typeof cloud !== 'object') {
    return { merged: local, hasChanges: false };
  }

  const merged = {
    version: '1.0',
    app: 'OT_Tracker',
    exportedAt: new Date().toISOString(),
    settings: { ...local.settings },
    presets: [...(local.presets || [])],
    dailyLogs: [...(local.dailyLogs || [])],
    attendanceScans: [...(local.attendanceScans || [])],
    customHolidays: [...(local.customHolidays || [])],
  };

  let hasChanges = false;

  // 1. Merge Settings
  const localSettings = local.settings || {};
  const cloudSettings = cloud.settings || {};
  const localSetTime = new Date(localSettings.updatedAt || '1970-01-01').getTime();
  const cloudSetTime = new Date(cloudSettings.updatedAt || '1970-01-01').getTime();

  if (cloudSetTime > localSetTime || (!localSettings.employeeName && cloudSettings.employeeName)) {
    merged.settings = { ...localSettings, ...cloudSettings };
    hasChanges = true;
  } else {
    merged.settings = { ...cloudSettings, ...localSettings };
  }

  // 2. Merge Daily Logs (Keyed by unique date string YYYY-MM-DD or log.date)
  const logMap = new Map();

  // Merge tombstones from local and cloud (track deleted records)
  const localTombstones = local.tombstones || {};
  const cloudTombstones = cloud.tombstones || {};
  const mergedTombstones = { ...cloudTombstones, ...localTombstones };
  for (const [key, ts] of Object.entries(cloudTombstones)) {
    if (mergedTombstones[key]) {
      const cTime = new Date(ts).getTime();
      const mTime = new Date(mergedTombstones[key]).getTime();
      if (cTime > mTime) {
        mergedTombstones[key] = ts;
      }
    }
  }

  // Populate local logs, filtering out any deleted records
  for (const log of (local.dailyLogs || [])) {
    const tombstoneTime = getTombstoneTimeForLog(log, mergedTombstones);
    const logTime = new Date(log.updatedAt || log.createdAt || '1970-01-01').getTime();
    if (tombstoneTime > logTime) {
      // Record was deleted by tombstone
      hasChanges = true;
      continue;
    }
    const key = getLogKey(log);
    logMap.set(key, log);

    // If local log is alive and newer than tombstone, purge the obsolete tombstone!
    if (tombstoneTime > 0 && logTime >= tombstoneTime) {
      removeTombstonesForLog(log, mergedTombstones);
      hasChanges = true;
    }
  }

  // Merge cloud logs
  for (const cLog of (cloud.dailyLogs || [])) {
    const tombstoneTime = getTombstoneTimeForLog(cLog, mergedTombstones);
    const cTime = new Date(cLog.updatedAt || cLog.createdAt || '1970-01-01').getTime();

    if (tombstoneTime > cTime) {
      // Cloud log was deleted by tombstone -> DO NOT RESURRECT!
      hasChanges = true;
      continue;
    }

    const key = getLogKey(cLog);
    if (!logMap.has(key)) {
      // Record only exists in cloud -> Add to local
      logMap.set(key, cLog);
      hasChanges = true;
    } else {
      // Record exists in both -> compare updatedAt / createdAt
      const lLog = logMap.get(key);
      const lTime = new Date(lLog.updatedAt || lLog.createdAt || '1970-01-01').getTime();

      if (cTime > lTime) {
        logMap.set(key, cLog);
        hasChanges = true;
      } else if (lTime === cTime && JSON.stringify(lLog) !== JSON.stringify(cLog)) {
        // Merge attributes if same timestamp
        const combined = { ...cLog, ...lLog };
        logMap.set(key, combined);
      }
    }
  }
  merged.dailyLogs = Array.from(logMap.values());
  merged.tombstones = mergedTombstones;

  // 3. Merge Attendance Scans (Keyed by date YYYY-MM-DD)
  const scanMap = new Map();
  const getScanKey = (s) => s.date || `${s.year}-${String(s.month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`;

  for (const scan of (local.attendanceScans || [])) {
    scanMap.set(getScanKey(scan), scan);
  }
  for (const cScan of (cloud.attendanceScans || [])) {
    const key = getScanKey(cScan);
    if (!scanMap.has(key)) {
      scanMap.set(key, cScan);
      hasChanges = true;
    }
  }
  merged.attendanceScans = Array.from(scanMap.values());

  // 4. Merge Custom Holidays (Keyed by date YYYY-MM-DD)
  const holidayMap = new Map();
  const getHolKey = (h) => h.date || `${h.year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`;

  for (const hol of (local.customHolidays || [])) {
    holidayMap.set(getHolKey(hol), hol);
  }
  for (const cHol of (cloud.customHolidays || [])) {
    const key = getHolKey(cHol);
    if (!holidayMap.has(key)) {
      holidayMap.set(key, cHol);
      hasChanges = true;
    }
  }
  merged.customHolidays = Array.from(holidayMap.values());

  // 5. Merge Presets (Keyed by Title)
  const presetTitles = new Set((local.presets || []).map(p => p.title));
  for (const cPreset of (cloud.presets || [])) {
    if (!presetTitles.has(cPreset.title)) {
      merged.presets.push(cPreset);
      presetTitles.add(cPreset.title);
      hasChanges = true;
    }
  }

  return { merged, hasChanges };
}

/**
 * Execute Full Synchronize Cycle with Google Drive
 * 1. Checks access token
 * 2. Gets current local backup data
 * 3. Finds sync file on Google Drive
 * 4. Downloads & merges if exists, or uploads fresh if none
 * 5. Saves merged data to local DB and Google Drive
 */
export async function syncWithGoogleDrive({ allowPrompt = false } = {}) {
  const token = await getValidAccessToken({ allowPrompt });
  const localBackup = await createBackupData();

  // Find existing file on Google Drive
  const existingFile = await findSyncFile(token);

  if (!existingFile) {
    // Initial Upload: No remote file yet -> upload local dataset
    const created = await createSyncFile(token, localBackup);
    const nowIso = new Date().toISOString();
    localStorage.setItem(KEY_LAST_SYNC, nowIso);
    localStorage.setItem(KEY_FILE_ID, created.id);

    return {
      status: 'uploaded',
      lastSync: nowIso,
      recordsSynced: localBackup.dailyLogs?.length || 0,
      message: 'อัปโหลดข้อมูลขึ้น Google Drive สำเร็จ'
    };
  }

  // Remote file exists -> Download and Merge
  const cloudBackup = await downloadSyncFile(token, existingFile.id);
  const { merged, hasChanges } = mergeDatasets(localBackup, cloudBackup);

  // Apply merged state to local storage and SQLite
  await restoreBackupData(merged);

  // Upload merged state back to Google Drive
  await updateSyncFile(token, existingFile.id, merged);

  const nowIso = new Date().toISOString();
  localStorage.setItem(KEY_LAST_SYNC, nowIso);

  return {
    status: 'synced',
    lastSync: nowIso,
    hasChanges,
    recordsSynced: merged.dailyLogs?.length || 0,
    message: hasChanges ? 'ซิงค์และผสานข้อมูลล่าสุดเรียบร้อยแล้ว' : 'ข้อมูลบนคลาวด์และเครื่องตรงกันแล้ว'
  };
}
