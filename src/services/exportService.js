/**
 * Export Service for Government OT Claims
 * Uses direct OpenXML manipulation on the exact original templates
 * to guarantee 100% format fidelity, zero corruption, and instant opening in Excel/Word.
 */

import JSZip from 'jszip';
import fileSaver from 'file-saver';
const saveAs = fileSaver?.saveAs || fileSaver;
import { THAI_MONTHS } from './pdfParser.js';
import { TEMPLATE_XLSX_BASE64, TEMPLATE_DOCX_BASE64 } from './templateAssets.js';
import { getCivilServiceReportTimes } from './thaiHolidays.js';
import { createBackupData, restoreBackupData } from './db.js';

const DAY_COLS = [
  'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
  'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH'
];

// Convert Arabic digits to Thai digits (e.g. 2569 -> ๒๕๖๙)
export function toThaiNumerals(val) {
  if (val === null || val === undefined) return '';
  const thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  return String(val).replace(/[0-9]/g, d => thaiDigits[parseInt(d, 10)]);
}

// Convert number to Thai Baht text (e.g. 1001 -> หนึ่งพันเอ็ดบาทถ้วน, 1220 -> หนึ่งพันสองร้อยยี่สิบบาทถ้วน)
export function thaiBahtText(amount) {
  if (!amount || Number(amount) === 0) return 'ศูนย์บาทถ้วน';
  const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
  const digits = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];

  const [intPart, decPart] = Number(amount).toFixed(2).split('.');

  function convertGroup(str, hasHigherGroups) {
    let res = '';
    const len = str.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(str[i], 10);
      const pos = len - i - 1;
      if (digit !== 0) {
        if (pos === 0 && digit === 1) {
          const hasPrecedingInGroup = str.slice(0, i).split('').some(c => c !== '0');
          if (hasPrecedingInGroup || (hasHigherGroups && pos === 0)) {
            res += 'เอ็ด';
          } else {
            res += 'หนึ่ง';
          }
        } else if (pos === 1 && digit === 2) {
          res += 'ยี่สิบ';
        } else if (pos === 1 && digit === 1) {
          res += 'สิบ';
        } else {
          res += digits[digit] + units[pos];
        }
      }
    }
    return res;
  }

  // Split intPart into 6-digit chunks from right
  let intText = '';
  let chunks = [];
  let remaining = intPart;
  while (remaining.length > 0) {
    chunks.unshift(remaining.slice(-6));
    remaining = remaining.slice(0, -6);
  }

  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    const hasHigher = c > 0 && chunks.slice(0, c).some(chk => parseInt(chk, 10) > 0);
    const chunkText = convertGroup(chunk, hasHigher);
    if (chunkText) {
      intText += chunkText;
      const millionCount = chunks.length - c - 1;
      if (millionCount > 0) {
        intText += 'ล้าน'.repeat(millionCount);
      }
    }
  }

  let text = intText ? intText + 'บาท' : '';

  if (!decPart || decPart === '00') {
    text += 'ถ้วน';
  } else {
    const d0 = parseInt(decPart[0], 10);
    const d1 = parseInt(decPart[1], 10);
    if (d0 === 1) text += 'สิบ';
    else if (d0 === 2) text += 'ยี่สิบ';
    else if (d0 > 2) text += digits[d0] + 'สิบ';

    if (d1 === 1 && d0 > 0) text += 'เอ็ด';
    else if (d1 > 0) text += digits[d1];
    text += 'สตางค์';
  }

  return text || 'ศูนย์บาทถ้วน';
}

// Helper: Escape XML special characters
export function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Helper: Base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper: Direct browser download trigger
function triggerDirectDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
}

// Helper: Save file allowing user to choose directory / folder
async function saveFileWithPicker(blob, defaultFilename, fileType) {
  // 1. Try Native Tauri save dialog if running in desktop app
  try {
    if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
      const dialogPkg = '@tauri-apps/plugin-dialog';
      const fsPkg = '@tauri-apps/plugin-fs';
      const { save } = await import(/* @vite-ignore */ dialogPkg);
      const { writeFile } = await import(/* @vite-ignore */ fsPkg);
      const filters = fileType === 'xlsx' 
        ? [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
        : [{ name: 'Word Document', extensions: ['docx'] }];
        
      const filePath = await save({
        defaultPath: defaultFilename,
        filters
      });
      
      if (filePath) {
        const arrayBuffer = await blob.arrayBuffer();
        await writeFile(filePath, new Uint8Array(arrayBuffer));
        return filePath;
      }
      return null; // User cancelled
    }
  } catch (tauriErr) {
    // Fallthrough to web API
  }

  // 1.5 Try Native macOS WKWebView save panel if running in desktop Cocoa app
  try {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeSaveFile) {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result;
          resolve(res.split(',')[1] || res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const res = await Promise.race([
        new Promise((resolve) => {
          window.__macSaveCallback = resolve;
          window.webkit.messageHandlers.nativeSaveFile.postMessage({
            filename: defaultFilename,
            base64: base64
          });
        }),
        new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 25000))
      ]);

      if (res && res.path) return res.path;
      if (res && res.filename) return res.filename;
      if (res && res.cancelled) return null;
    }
  } catch (macErr) {
    console.warn('Native mac save error:', macErr);
  }

  // 1.8 Try Native Android WebView Bridge
  try {
    if (window.Android && window.Android.saveBase64File) {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result;
          resolve(res.split(',')[1] || res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      window.Android.saveBase64File(defaultFilename, base64, blob.type || 'application/octet-stream');
      return defaultFilename;
    }
  } catch (androidErr) {
    console.warn('Native Android save error:', androidErr);
  }

  // 2. Try Web File System Access API (showSaveFilePicker) for native Finder folder selection
  try {
    if ('showSaveFilePicker' in window) {
      let acceptMap = {};
      let typeDesc = 'ไฟล์เอกสาร';
      if (fileType === 'xlsx') {
        acceptMap = { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] };
        typeDesc = 'ไฟล์ตาราง Excel (.xlsx)';
      } else if (fileType === 'docx') {
        acceptMap = { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] };
        typeDesc = 'ไฟล์เอกสาร Word (.docx)';
      } else if (fileType === 'json') {
        acceptMap = { 'application/json': ['.json'] };
        typeDesc = 'ไฟล์สำรองข้อมูล JSON (.json)';
      }

      const handle = await window.showSaveFilePicker({
        suggestedName: defaultFilename,
        types: [{
          description: typeDesc,
          accept: acceptMap
        }]
      });
      
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return handle.name;
    }
  } catch (pickerErr) {
    if (pickerErr.name === 'AbortError') {
      return null; // User cancelled folder selection
    }
    console.warn('showSaveFilePicker fallback:', pickerErr);
  }

  // 3. Bulletproof Fallback: Direct Anchor Download
  try {
    triggerDirectDownload(blob, defaultFilename);
  } catch (e) {
    saveAs(blob, defaultFilename);
  }
  return defaultFilename;
}


/**
 * 1. Export Excel: Uses direct OpenXML injection on the original Excel template
 * Guarantees 100% preservation of all 219 merged cells, print setup, and Cordia New styling.
 */
export async function exportToExcel({ settings, year, month, logs }) {
  const monthName = THAI_MONTHS[month - 1];
  const templateBuffer = base64ToArrayBuffer(TEMPLATE_XLSX_BASE64);
  const zip = await JSZip.loadAsync(templateBuffer);

  let sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string');
  let wbXml = await zip.file('xl/workbook.xml').async('string');

  let rawDept = settings.department ? settings.department.trim() : 'กรมทรัพย์สินทางปัญญา';
  const fullDept = rawDept.includes('นนทบุรี') ? rawDept : `${rawDept} จังหวัดนนทบุรี`;
  const employeeName = escapeXml(settings.employeeName);
  const position = escapeXml(settings.position);
  const rateWeekday = settings.rateWeekday || 50;
  const rateHoliday = settings.rateHoliday || 60;

  const numDaysInMonth = new Date(year - 543, month, 0).getDate();
  const logsMap = {};
  let totalW = 0;
  let totalH = 0;

  for (const log of logs) {
    if (!log.isClaimed || !log.hours || log.day > numDaysInMonth) continue;
    logsMap[log.day] = log;
    if (log.dayType === 'holiday') {
      totalH += log.hours;
    } else {
      totalW += log.hours;
    }
  }

  const grandTotal = totalW * rateWeekday + totalH * rateHoliday;

  const cellReplacements = {};
  cellReplacements['A2'] = `<c r="A2" s="45" t="inlineStr"><is><t>${escapeXml(fullDept)}   ประจำเดือน ${escapeXml(monthName)} ${year}</t></is></c>`;
  cellReplacements['B7'] = `<c r="B7" s="36" t="inlineStr"><is><t>${employeeName}</t></is></c>`;
  cellReplacements['C7'] = `<c r="C7" s="39" t="inlineStr"><is><t>${rateWeekday} / ช.ม.</t></is></c>`;
  cellReplacements['C8'] = `<c r="C8" s="28" t="inlineStr"><is><t>${rateHoliday} / ช.ม.</t></is></c>`;

  for (let d = 1; d <= 31; d++) {
    const col = DAY_COLS[d - 1];
    const log = logsMap[d];
    const hasOt = Boolean(d <= numDaysInMonth && log && log.isClaimed && log.hours > 0);

    if (hasOt) {
      const repTimes = getCivilServiceReportTimes({
        dayType: log.dayType,
        startTime: log.startTime,
        endTime: log.endTime,
        hours: log.hours
      });

      // Row 7 (weekday hours or empty)
      if (log.dayType !== 'holiday') {
        cellReplacements[col + '7'] = `<c r="${col}7" s="8" t="n"><v>${log.hours}</v></c>`;
      } else {
        cellReplacements[col + '7'] = `<c r="${col}7" s="8" t="n"/>`;
      }

      // Row 8 (holiday hours or empty)
      if (log.dayType === 'holiday') {
        cellReplacements[col + '8'] = `<c r="${col}8" s="31" t="n"><v>${log.hours}</v></c>`;
      } else {
        cellReplacements[col + '8'] = `<c r="${col}8" s="31" t="n"/>`;
      }

      // Row 9 (return time)
      cellReplacements[col + '9'] = `<c r="${col}9" s="34" t="inlineStr"><is><t>${escapeXml(repTimes.endTime)}</t></is></c>`;

      // Rows 10-12 (return time span blank, white background)
      cellReplacements[col + '10'] = `<c r="${col}10" s="29" t="n"/>`;
      cellReplacements[col + '11'] = `<c r="${col}11" s="29" t="n"/>`;
      cellReplacements[col + '12'] = `<c r="${col}12" s="29" t="n"/>`;

      // Rows 13-16 (signature return space, white background)
      cellReplacements[col + '13'] = `<c r="${col}13" s="31" t="n"/>`;
      cellReplacements[col + '14'] = `<c r="${col}14" s="29" t="n"/>`;
      cellReplacements[col + '15'] = `<c r="${col}15" s="29" t="n"/>`;
      cellReplacements[col + '16'] = `<c r="${col}16" s="29" t="n"/>`;

      // Row 17 (start time)
      cellReplacements[col + '17'] = `<c r="${col}17" s="34" t="inlineStr"><is><t>${escapeXml(repTimes.startTime)}</t></is></c>`;

      // Rows 18-20 (start time span blank, white background)
      cellReplacements[col + '18'] = `<c r="${col}18" s="29" t="n"/>`;
      cellReplacements[col + '19'] = `<c r="${col}19" s="29" t="n"/>`;
      cellReplacements[col + '20'] = `<c r="${col}20" s="29" t="n"/>`;

      // Rows 21-23 (signature arrival space, white background)
      cellReplacements[col + '21'] = `<c r="${col}21" s="31" t="n"/>`;
      cellReplacements[col + '22'] = `<c r="${col}22" s="29" t="n"/>`;
      cellReplacements[col + '23'] = `<c r="${col}23" s="29" t="n"/>`;

      // Row 24 (bottom blank, white background)
      cellReplacements[col + '24'] = `<c r="${col}24" s="4" t="n"/>`;
    } else {
      // Days WITHOUT OT: Continuous gray band from Row 8 to Row 24
      cellReplacements[col + '7'] = `<c r="${col}7" s="48" t="n"/>`;
      cellReplacements[col + '8'] = `<c r="${col}8" s="49" t="n"/>`;
      cellReplacements[col + '9'] = `<c r="${col}9" s="50" t="n"/>`;
      cellReplacements[col + '10'] = `<c r="${col}10" s="51" t="n"/>`;
      cellReplacements[col + '11'] = `<c r="${col}11" s="51" t="n"/>`;
      cellReplacements[col + '12'] = `<c r="${col}12" s="51" t="n"/>`;
      cellReplacements[col + '13'] = `<c r="${col}13" s="49" t="n"/>`;
      cellReplacements[col + '14'] = `<c r="${col}14" s="51" t="n"/>`;
      cellReplacements[col + '15'] = `<c r="${col}15" s="51" t="n"/>`;
      cellReplacements[col + '16'] = `<c r="${col}16" s="51" t="n"/>`;
      cellReplacements[col + '17'] = `<c r="${col}17" s="50" t="n"/>`;
      cellReplacements[col + '18'] = `<c r="${col}18" s="51" t="n"/>`;
      cellReplacements[col + '19'] = `<c r="${col}19" s="51" t="n"/>`;
      cellReplacements[col + '20'] = `<c r="${col}20" s="51" t="n"/>`;
      cellReplacements[col + '21'] = `<c r="${col}21" s="49" t="n"/>`;
      cellReplacements[col + '22'] = `<c r="${col}22" s="51" t="n"/>`;
      cellReplacements[col + '23'] = `<c r="${col}23" s="51" t="n"/>`;
      cellReplacements[col + '24'] = `<c r="${col}24" s="52" t="n"/>`;
    }
  }

  // Totals & Official Formulas
  cellReplacements['AI7'] = `<c r="AI7" s="43"><f>SUM(D7:AH7)</f><v>${totalW}</v></c>`;
  cellReplacements['AJ8'] = `<c r="AJ8" s="14"><f>SUM(D8:AH8)</f><v>${totalH}</v></c>`;

  cellReplacements['AK7'] = `<c r="AK7" s="9"><f>AI7*${rateWeekday}</f><v>${totalW * rateWeekday}</v></c>`;
  cellReplacements['AK8'] = `<c r="AK8" s="15"><f>AJ8*${rateHoliday}</f><v>${totalH * rateHoliday}</v></c>`;

  // Row 25 Summary row (รวมชั่วโมงวันปกติ, วันหยุด, และยอดเงินรวม แสดงตามแบบฟอร์ม [ชม.]X[อัตรา] = [ยอดเงิน])
  const textW = totalW > 0 ? `${totalW}X${rateWeekday} =&#10;${totalW * rateWeekday}` : '';
  const textH = totalH > 0 ? `${totalH}X${rateHoliday} =&#10;${totalH * rateHoliday}` : '';

  // Use style 33 which has applyAlignment="1" and wrapText="1" for 100% authentic multiline rendering in Excel
  cellReplacements['AI25'] = `<c r="AI25" s="33" t="str"><f>IF(AI7&gt;0,AI7&amp;&quot;X&quot;&amp;${rateWeekday}&amp;&quot; =&quot;&amp;CHAR(10)&amp;AK7,&quot;&quot;)</f><v>${textW}</v></c>`;
  cellReplacements['AJ25'] = `<c r="AJ25" s="33" t="str"><f>IF(AJ8&gt;0,AJ8&amp;&quot;X&quot;&amp;${rateHoliday}&amp;&quot; =&quot;&amp;CHAR(10)&amp;AK8,&quot;&quot;)</f><v>${textH}</v></c>`;
  cellReplacements['AK25'] = `<c r="AK25" s="41"><f>AK7+AK8</f><v>${grandTotal}</v></c>`;

  // Adjust merged row heights for row 25 & 26 (20pt + 20pt = 40pt) so 2 lines fit comfortably without clipping
  sheetXml = sheetXml.replace('<row r="25" ht="17" customHeight="1" s="20">', '<row r="25" ht="20" customHeight="1" s="20">');
  sheetXml = sheetXml.replace('<row r="26" ht="17" customHeight="1" s="20">', '<row r="26" ht="20" customHeight="1" s="20">');

  cellReplacements['F28'] = `<c r="F28" s="58" t="inlineStr"><is><t>รวมเงินจ่ายทั้งสิ้น (${escapeXml(thaiBahtText(grandTotal))})</t></is></c>`;
  cellReplacements['H31'] = `<c r="H31" s="59" t="inlineStr"><is><t>(${employeeName})</t></is></c>`;
  cellReplacements['G32'] = `<c r="G32" s="59" t="inlineStr"><is><t>ตำแหน่ง ${position}</t></is></c>`;

  // Replace each cell in sheetXml
  for (const [coord, newXml] of Object.entries(cellReplacements)) {
    const regex = new RegExp(`<c r="${coord}"[^>]*>(.*?<\\/c>|\\s*\\/?>)`, 's');
    sheetXml = sheetXml.replace(regex, newXml);
  }

  // Update sheet name in workbook.xml
  wbXml = wbXml.replace(/name="[^"]+"/, `name="${monthName}"`);

  zip.file('xl/worksheets/sheet1.xml', sheetXml);
  zip.file('xl/workbook.xml', wbXml);

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const namePart = settings.employeeName ? `_${settings.employeeName}` : '';
  const filename = `หลักฐานการเบิกจ่าย_OT${namePart}_${monthName}_${year}.xlsx`;
  return await saveFileWithPicker(blob, filename, 'xlsx');
}

/**
 * 2. Export Word: Uses direct OpenXML injection on the original Word document template
 * Generates identical XML with TH SarabunPSK 16pt, exact margins, indents, and Thai numerals.
 */
export async function exportToWord({ settings, year, month, logs }) {
  const monthName = THAI_MONTHS[month - 1];
  const thaiYear = toThaiNumerals(year);
  const numDaysInMonth = new Date(year - 543, month, 0).getDate();
  const activeLogs = logs
    .filter(l => l.isClaimed && l.hours > 0 && l.day <= numDaysInMonth)
    .sort((a, b) => a.day - b.day);

  // Load the original docx as a zip package
  const templateBuffer = base64ToArrayBuffer(TEMPLATE_DOCX_BASE64);
  const zip = await JSZip.loadAsync(templateBuffer);

  // Build daily XML list
  let dailyXml = '';
  for (const l of activeLogs) {
    const thaiDay = toThaiNumerals(l.day);
    const taskText = escapeXml(l.taskDesc || 'ปฏิบัติหน้าที่ตามที่ได้รับมอบหมาย');
    dailyXml += `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>วันที่ ${thaiDay} ${monthName} ${thaiYear}</w:t></w:r></w:p>`;
    dailyXml += `<w:p><w:pPr><w:ind w:left="720"/></w:pPr><w:r><w:t>- ${taskText}</w:t></w:r></w:p>`;
  }

  const employeeName = escapeXml(settings.employeeName);
  const position = escapeXml(settings.position);
  const positionLevel = settings.positionLevel ? ' ' + escapeXml(settings.positionLevel) : '';

  // Exact WordprocessingML identical to the template
  const docXml = `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mo="http://schemas.microsoft.com/office/mac/office/2008/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:mv="urn:schemas-microsoft-com:mac:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14"><w:body><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>รายงานผลการปฏิบัติงานนอกเวลาราชการ</w:t></w:r></w:p><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>ประจำเดือน ${monthName} ${thaiYear}</w:t></w:r></w:p><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>${employeeName}</w:t></w:r></w:p><w:p/>${dailyXml}<w:p/><w:p/><w:p><w:pPr><w:ind w:right="720"/><w:jc w:val="right"/></w:pPr><w:r><w:t>ลงชื่อ......................................................</w:t><w:br/></w:r><w:r><w:t>( ${employeeName} )</w:t><w:br/></w:r><w:r><w:t>ตำแหน่ง ${position}${positionLevel}</w:t></w:r></w:p><w:sectPr w:rsidR="00FC693F" w:rsidRPr="0006063C" w:rsidSect="00034616"><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1800" w:header="720" w:footer="720" w:gutter="0"/><w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`;

  zip.file('word/document.xml', docXml);
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
  const namePart = settings.employeeName ? `_${settings.employeeName}` : '';
  const filename = `รายงานผลการปฏิบัติงาน_OT${namePart}_${monthName}_${year}.docx`;
  return await saveFileWithPicker(blob, filename, 'docx');
}

/**
 * 3. Export Database Backup: Exports all settings, presets, daily logs, and scans into a JSON file
 */
export async function exportDatabaseBackup() {
  const data = await createBackupData();
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const dateStr = new Date().toISOString().slice(0, 10);
  const defaultFilename = `OT_Tracker_Backup_${dateStr}.json`;
  return await saveFileWithPicker(blob, defaultFilename, 'json');
}

/**
 * 4. Import Database Backup: Reads and validates a JSON backup file and restores all data
 */
export async function importDatabaseBackup(file) {
  if (!file) throw new Error('กรุณาเลือกไฟล์สำรองข้อมูล');
  const text = await file.text();
  const parsed = JSON.parse(text);
  return await restoreBackupData(parsed);
}


