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

  // If running inside Android Native App: Use System Browser + Loopback Server via window.Android
  if (typeof window !== 'undefined' && window.Android?.startGoogleAuth) {
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
        window.Android.startGoogleAuth(getClientId());
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
 * Check if Google Access Token is currently expired
 */
export function isTokenExpired() {
  const token = localStorage.getItem(KEY_ACCESS_TOKEN);
  const expiresAt = Number(localStorage.getItem(KEY_TOKEN_EXPIRES_AT) || 0);
  if (!token) return true;
  return Date.now() >= expiresAt;
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

  // When allowPrompt is FALSE (e.g. background sync or initial app launch):
  // DO NOT launch native Android/macOS system browser to avoid disruptive interruptions!
  if (!allowPrompt) {
    const isNativeApp = typeof window !== 'undefined' && (Boolean(window.Android?.startGoogleAuth) || Boolean(window.webkit?.messageHandlers?.nativeGoogleAuth));
    if (!isNativeApp) {
      try {
        return await requestGoogleAccessToken({ prompt: '' });
      } catch (e) {
        // Silent web refresh failed
      }
    }
    throw new Error('เซสชัน Google Drive หมดอายุ (คลิกที่ก้อนเมฆเพื่อต่ออายุการเชื่อมต่อ)');
  }

  // When allowPrompt is TRUE (user explicitly tapped Sync or Connect button):
  if (isGoogleConnected() || allowPrompt) {
    try {
      return await requestGoogleAccessToken({ prompt: '' });
    } catch (err) {
      return await requestGoogleAccessToken({ prompt: 'consent' });
    }
  }

  throw new Error('ยังไม่ได้เชื่อมต่อกับ Google Drive');
}

/**
 * List all files in Google Drive appDataFolder (for disaster recovery inspection)
 */
export async function listAllCloudFiles(token) {
  const query = encodeURIComponent(`trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime,size)&pageSize=50&orderBy=modifiedTime desc`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ดึงรายการไฟล์บน Google Drive ไม่สำเร็จ (${res.status}): ${errText}`);
  }
  const result = await res.json();
  return result.files || [];
}

/**
 * Search for existing backup file in Google Drive appDataFolder
 * Prioritizes newest non-empty file
 */
export async function findSyncFile(token) {
  const cachedFileId = localStorage.getItem(KEY_FILE_ID);
  if (cachedFileId) {
    // Verify cached file is still valid
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${cachedFileId}?fields=id,name,trashed,modifiedTime,size`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const file = await res.json();
        if (!file.trashed && Number(file.size) > 0) return file;
        if (!file.trashed) {
          // If cached file is empty (0 byte), do full query to check if better file exists
        }
      }
    } catch (e) {}
  }

  const query = encodeURIComponent(`name='${SYNC_FILENAME}' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime,size)&pageSize=20&orderBy=modifiedTime desc`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ค้นหาไฟล์ซิงค์บน Google Drive ไม่สำเร็จ (${res.status}): ${errText}`);
  }

  const result = await res.json();
  const files = result.files || [];

  if (files.length === 0) {
    localStorage.removeItem(KEY_FILE_ID);
    return null;
  }

  // Choose the best file: prefer file with size > 0, otherwise newest
  const nonEmptyFile = files.find(f => Number(f.size) > 0);
  const bestFile = nonEmptyFile || files[0];

  if (bestFile?.id) {
    localStorage.setItem(KEY_FILE_ID, bestFile.id);
  } else {
    localStorage.removeItem(KEY_FILE_ID);
  }
  return bestFile;
}

/**
 * Get revision history for sync file (Google Drive auto-stores up to 30 days of revisions)
 */
export async function getCloudRevisions(token, fileId) {
  let targetFileId = fileId;
  if (!targetFileId) {
    const file = await findSyncFile(token);
    targetFileId = file?.id;
  }
  if (!targetFileId) return [];

  const url = `https://www.googleapis.com/drive/v3/files/${targetFileId}/revisions?fields=revisions(id,modifiedTime,size,keepForever,originalFilename)`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ดึงประวัติเวอร์ชันบน Google Drive ไม่สำเร็จ (${res.status}): ${errText}`);
  }
  const result = await res.json();
  const revisions = result.revisions || [];
  return revisions.sort((a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0));
}

/**
 * Download specific cloud revision content
 */
export async function downloadCloudRevision(token, fileId, revisionId) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${revisionId}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`ดาวน์โหลดเวอร์ชันย้อนหลังไม่สำเร็จ (${res.status})`);
  }
  return await res.json();
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

function getTombstoneTimeForHoliday(hol, tombstones) {
  if (!hol || !tombstones) return 0;
  const keysToCheck = [];
  if (hol.year && hol.month && hol.day) {
    const y = Number(hol.year);
    const m = String(hol.month).padStart(2, '0');
    const d = String(hol.day).padStart(2, '0');
    keysToCheck.push(`holiday_${y}-${m}-${d}`);
    const altY = y > 2400 ? y - 543 : y + 543;
    keysToCheck.push(`holiday_${altY}-${m}-${d}`);
  }
  if (hol.date) keysToCheck.push(`holiday_${hol.date}`);
  if (hol.id) keysToCheck.push(`holiday_${hol.id}`);

  const timestamps = keysToCheck.map(k => tombstones[k]).filter(Boolean);
  if (timestamps.length === 0) return 0;
  return Math.max(...timestamps.map(t => new Date(t).getTime()));
}

function removeTombstonesForHoliday(hol, tombstones) {
  if (!hol || !tombstones) return;
  const keysToRemove = [];
  if (hol.year && hol.month && hol.day) {
    const y = Number(hol.year);
    const m = String(hol.month).padStart(2, '0');
    const d = String(hol.day).padStart(2, '0');
    keysToRemove.push(`holiday_${y}-${m}-${d}`);
    const altY = y > 2400 ? y - 543 : y + 543;
    keysToRemove.push(`holiday_${altY}-${m}-${d}`);
  }
  if (hol.date) keysToRemove.push(`holiday_${hol.date}`);
  if (hol.id) keysToRemove.push(`holiday_${hol.id}`);

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

  // Support array of logs directly or wrapped data
  let normCloud = cloud;
  if (Array.isArray(cloud)) {
    normCloud = { dailyLogs: cloud };
  } else if (cloud.data && typeof cloud.data === 'object' && !Array.isArray(cloud.data)) {
    normCloud = { ...cloud.data, ...cloud };
  }

  const rawCloudLogs = normCloud.dailyLogs || normCloud.daily_logs || normCloud.logs || normCloud.ot_tracker_daily_logs || [];
  const localLogs = local.dailyLogs || [];

  // Normalize cloud logs
  const cloudLogs = Array.isArray(rawCloudLogs) ? rawCloudLogs : [];
  const cloudScans = normCloud.attendanceScans || normCloud.attendance_scans || normCloud.scans || [];
  const cloudHolidays = normCloud.customHolidays || normCloud.custom_holidays || normCloud.holidays || [];
  const cloudPresets = normCloud.presets || normCloud.task_presets || [];

  // New Machine Onboarding Guard:
  // If local machine is brand new (0 daily logs) and cloud has existing logs,
  // DO NOT allow empty local machine to erase or ignore cloud data!
  const isNewMachine = localLogs.length === 0 && cloudLogs.length > 0;

  const merged = {
    version: '1.0',
    app: 'OT_Tracker',
    exportedAt: new Date().toISOString(),
    settings: { ...(local.settings || {}) },
    presets: [...(local.presets || [])],
    dailyLogs: [...localLogs],
    attendanceScans: [...(local.attendanceScans || [])],
    customHolidays: [...(local.customHolidays || [])],
  };

  let hasChanges = false;

  // 1. Merge Settings
  const localSettings = local.settings || {};
  const cloudSettings = normCloud.settings || normCloud.ot_tracker_settings || {};
  const localSetTime = new Date(localSettings.updatedAt || '1970-01-01').getTime();
  const cloudSetTime = new Date(cloudSettings.updatedAt || '1970-01-01').getTime();

  // If new machine or local has unconfigured settings, adopt cloud settings
  if (isNewMachine || !localSettings.employeeName || (cloudSetTime > localSetTime && cloudSettings.employeeName)) {
    merged.settings = { ...localSettings, ...cloudSettings };
    hasChanges = true;
  } else {
    merged.settings = { ...cloudSettings, ...localSettings };
  }

  // 2. Merge Daily Logs (Keyed by unique date string YYYY-MM-DD or log.date)
  const logMap = new Map();

  // Merge tombstones from local and cloud (track deleted records)
  // If new machine, ignore local tombstones so clean machine never deletes cloud logs
  const localTombstones = isNewMachine ? {} : (local.tombstones || {});
  const cloudTombstones = normCloud.tombstones || normCloud.ot_tracker_tombstones || {};
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
  for (const log of localLogs) {
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
  for (const cLog of cloudLogs) {
    // If it's a new machine, never let obsolete tombstones suppress cloud logs!
    const tombstoneTime = isNewMachine ? 0 : getTombstoneTimeForLog(cLog, mergedTombstones);
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

  // Catastrophic Wipe Fail-Safe:
  // If cloud had logs (> 0), but merged resulted in 0 logs:
  // Fallback to cloud logs to guarantee NO DATA LOSS!
  if (cloudLogs.length > 0 && logMap.size === 0) {
    console.warn('Safety Guard Triggered: Merged dailyLogs was 0 while cloud had', cloudLogs.length, 'records. Falling back to cloud records!');
    for (const cLog of cloudLogs) {
      logMap.set(getLogKey(cLog), cLog);
    }
    hasChanges = true;
  }

  merged.dailyLogs = Array.from(logMap.values());
  merged.tombstones = mergedTombstones;

  // 3. Merge Attendance Scans (Keyed by date YYYY-MM-DD)
  const scanMap = new Map();
  const getScanKey = (s) => s.date || `${s.year}-${String(s.month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`;

  for (const scan of (local.attendanceScans || [])) {
    scanMap.set(getScanKey(scan), scan);
  }
  for (const cScan of cloudScans) {
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
    const tombstoneTime = getTombstoneTimeForHoliday(hol, mergedTombstones);
    const holTime = new Date(hol.updatedAt || hol.createdAt || '1970-01-01').getTime();
    if (tombstoneTime > holTime) {
      // Record was deleted by tombstone
      hasChanges = true;
      continue;
    }
    holidayMap.set(getHolKey(hol), hol);

    // If local holiday is alive and newer than tombstone, purge obsolete tombstone!
    if (tombstoneTime > 0 && holTime >= tombstoneTime) {
      removeTombstonesForHoliday(hol, mergedTombstones);
      hasChanges = true;
    }
  }

  for (const cHol of cloudHolidays) {
    const tombstoneTime = isNewMachine ? 0 : getTombstoneTimeForHoliday(cHol, mergedTombstones);
    const cTime = new Date(cHol.updatedAt || cHol.createdAt || '1970-01-01').getTime();

    if (tombstoneTime > cTime) {
      // Cloud holiday was deleted by tombstone -> DO NOT RESURRECT!
      hasChanges = true;
      continue;
    }

    const key = getHolKey(cHol);
    if (!holidayMap.has(key)) {
      holidayMap.set(key, cHol);
      hasChanges = true;
    } else {
      const lHol = holidayMap.get(key);
      const lTime = new Date(lHol.updatedAt || lHol.createdAt || '1970-01-01').getTime();
      if (cTime > lTime) {
        holidayMap.set(key, cHol);
        hasChanges = true;
      }
    }
  }
  merged.customHolidays = Array.from(holidayMap.values());

  // 5. Merge Presets (Keyed by Title)
  const presetTitles = new Set((local.presets || []).map(p => p.title));
  for (const cPreset of cloudPresets) {
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
export async function syncWithGoogleDrive({ allowPrompt = false, forceUpload = false } = {}) {
  const token = await getValidAccessToken({ allowPrompt });
  const localBackup = await createBackupData();

  // Find existing file on Google Drive
  let existingFile = await findSyncFile(token);

  // If no file found via quick check, but local has 0 records:
  // Exhaustively search all files before blindly creating an empty file!
  if (!existingFile && (localBackup.dailyLogs?.length || 0) === 0) {
    try {
      const allFiles = await listAllCloudFiles(token);
      const matched = allFiles.find(f => f.name === SYNC_FILENAME);
      if (matched) {
        existingFile = matched;
        localStorage.setItem(KEY_FILE_ID, matched.id);
      }
    } catch (e) {
      console.warn('Exhaustive cloud file search failed:', e);
    }
  }

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

  // Safety Verification before overwrite:
  const rawCloudLogs = cloudBackup.dailyLogs || cloudBackup.daily_logs || cloudBackup.logs || (cloudBackup.data && cloudBackup.data.dailyLogs) || [];
  const cloudLogsCount = Array.isArray(rawCloudLogs) ? rawCloudLogs.length : 0;
  const mergedLogsCount = (merged.dailyLogs || []).length;

  if (cloudLogsCount > 0 && mergedLogsCount === 0 && !forceUpload) {
    throw new Error(`ระบบตรวจพบความผิดปกติ: Google Drive มีข้อมูลบันทึก OT เดิม ${cloudLogsCount} รายการ แต่ข้อมูลที่จะส่งขึ้นไปว่างเปล่า ระบบจึงระงับการบันทึกทับเพื่อป้องกันข้อมูลสูญหาย (กรุณาใช้เมนูกู้คืนข้อมูลประวัติย้อนหลัง)`);
  }

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
    recordsSynced: mergedLogsCount,
    message: hasChanges ? 'ซิงค์และผสานข้อมูลล่าสุดเรียบร้อยแล้ว' : 'ข้อมูลบนคลาวด์และเครื่องตรงกันแล้ว'
  };
}
