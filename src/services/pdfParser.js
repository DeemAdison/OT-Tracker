/**
 * PDF Parser for Government Attendance Form (HR_RP_003_TimeToWork.pdf)
 * Extracts daily scan-in, scan-out, and calculates overtime candidates
 */

import * as pdfjsLib from 'pdfjs-dist';
import { getThaiHoliday, isWeekend, calculateCivilServiceOtHours, getCivilServiceReportTimes } from './thaiHolidays.js';

// Configure pdfjs worker if available or disable worker in client-side bundle
if (pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export async function parseAttendancePdf(fileOrBuffer) {
  let arrayBuffer;
  if (fileOrBuffer instanceof ArrayBuffer) {
    arrayBuffer = fileOrBuffer;
  } else if (fileOrBuffer instanceof File || fileOrBuffer instanceof Blob) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    throw new Error('Invalid file format. Expected File or ArrayBuffer.');
  }

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  let allLines = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Group text items by roughly the same Y coordinate (line)
    const items = textContent.items;
    const linesMap = new Map();

    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      // Round Y coordinate to group characters on same horizontal line
      const y = Math.round(item.transform[5]);
      if (!linesMap.has(y)) {
        linesMap.set(y, []);
      }
      linesMap.get(y).push({
        x: item.transform[4],
        text: item.str.trim()
      });
    }

    // Sort lines by Y descending (top to bottom)
    const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
    for (const y of sortedY) {
      const lineItems = linesMap.get(y).sort((a, b) => a.x - b.x);
      const lineText = lineItems.map(i => i.text).join(' ');
      if (lineText) allLines.push(lineText);
    }
  }

  return analyzeParsedLines(allLines);
}

function analyzeParsedLines(lines) {
  let month = 9; // default September
  let year = 2569;
  let employeeName = '';
  let position = '';
  let department = '';
  const dailyRecords = [];

  // 1. Search Header Information
  for (const line of lines) {
    // Example: "วันที่ 1 กันยายน 2569 - 30 กันยายน 2569"
    for (let m = 0; m < THAI_MONTHS.length; m++) {
      if (line.includes(THAI_MONTHS[m])) {
        month = m + 1;
        const yearMatch = line.match(/25\d{2}/);
        if (yearMatch) {
          year = parseInt(yearMatch[0], 10);
        }
        break;
      }
    }

    // Example: "นายอดิศร ละลี นักวิชาการพาณิชย์ ระดับไม่มีระดับตำแหน่ง กรมทรัพย์สินทางปัญญา"
    if (line.includes('นาย') || line.includes('นาง') || line.includes('นางสาว')) {
      const nameMatch = line.match(/(นาย|นาง|นางสาว)\s*([^\s]+)\s+([^\s]+)/);
      if (nameMatch) {
        employeeName = `${nameMatch[1]}${nameMatch[2]} ${nameMatch[3]}`;
      }
      if (line.includes('กรม')) {
        const deptMatch = line.match(/กรม[^\s]+/);
        if (deptMatch) department = deptMatch[0];
      }
      if (line.includes('นักวิชาการ') || line.includes('เจ้าพนักงาน') || line.includes('ผู้อำนวยการ')) {
        const posMatch = line.match(/(นักวิชาการ[^\s]+|เจ้าพนักงาน[^\s]+|[^\s]+พาณิชย์)/);
        if (posMatch) position = posMatch[0];
      }
    }
  }

  // 2. Search Daily Attendance Rows
  // Pattern: "1 กันยายน 2569 08:30 น. 17:05 น. 08:35 ชม. ปกติ"
  // Or: "5 กันยายน 2569 วันหยุดราชการ"
  // Or: "21 กันยายน 2569 ลาป่วย (ลาเต็มวัน)"
  for (let day = 1; day <= 31; day++) {
    const dayRegex = new RegExp(`^${day}\\s+([ก-๙]+)\\s+(25\\d{2})?(.*)`);
    
    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(dayRegex);
      if (match) {
        const rest = match[3] || '';
        
        let scanIn = '';
        let scanOut = '';
        let workHours = '';
        let remark = '';
        let dayType = 'weekday';

        // Extract Times (e.g. 08:30 น.  17:05 น.)
        const timeMatches = rest.match(/(\d{1,2}:\d{2})\s*(น\.)?/g);
        if (timeMatches && timeMatches.length >= 2) {
          scanIn = timeMatches[0].replace('น.', '').trim();
          scanOut = timeMatches[1].replace('น.', '').trim();
        } else if (timeMatches && timeMatches.length === 1) {
          scanIn = timeMatches[0].replace('น.', '').trim();
        }

        // Check official holiday (Weekend or Thai Public Holiday)
        const thaiHoliday = getThaiHoliday(year, month, day);
        const weekend = isWeekend(year, month, day);

        // Extract remarks
        if (rest.includes('วันหยุดราชการ') || rest.includes('วันหยุดชดเชย') || weekend || thaiHoliday) {
          remark = thaiHoliday ? thaiHoliday.name : (rest.includes('วันหยุด') ? 'วันหยุดราชการ' : (weekend ? 'วันหยุดสุดสัปดาห์' : 'วันหยุดราชการ'));
          dayType = 'holiday';
        } else if (rest.includes('ลาป่วย')) {
          remark = 'ลาป่วย (ลาเต็มวัน)';
        } else if (rest.includes('ลากิจ')) {
          remark = 'ลากิจ';
        } else if (rest.includes('ลาพักผ่อน')) {
          remark = 'ลาพักผ่อน';
        } else if (rest.includes('ปกติ')) {
          remark = 'ปกติ';
        }

        // Calculate OT hours according to civil service regulations:
        // - Holiday: 08:30-11:30 and 13:30-16:30, capped at 6 hours max, excludes 2-hr break (11:30 - 13:30)
        // - Weekday: Starts after 16:30
        let otHours = 0;
        let otStartTime = '';
        let otEndTime = '';

        if (dayType === 'holiday') {
          if (scanIn && scanOut) {
            otHours = calculateCivilServiceOtHours({
              dayType: 'holiday',
              startTime: scanIn,
              endTime: scanOut
            });
            otStartTime = scanIn;
            otEndTime = scanOut;
          }
        } else {
          // Weekday
          if (scanOut) {
            otHours = calculateCivilServiceOtHours({
              dayType: 'weekday',
              startTime: '16:30',
              endTime: scanOut
            });
            if (otHours > 0) {
              otStartTime = '16:30';
              otEndTime = `${String(16 + otHours).padStart(2, '0')}:30`;
            }
          }
        }

        dailyRecords.push({
          day,
          date: `${day} ${THAI_MONTHS[month - 1]} ${year}`,
          year,
          month,
          scanIn,
          scanOut,
          remark,
          dayType,
          otHours,
          otStartTime,
          otEndTime
        });

        break;
      }
    }
  }

  return {
    month,
    year,
    employeeName,
    position,
    department,
    records: dailyRecords
  };
}
