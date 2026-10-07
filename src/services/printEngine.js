/**
 * Isolated Print & PDF Engine for Government OT Claims
 * Generates pure, self-contained HTML documents for 100% vector printing and PDF export,
 * completely free from UI chrome, modal overlays, and scale distortions.
 */

import { toThaiNumerals, thaiBahtText } from './exportService';

/**
 * Generate pure HTML for Excel 31-day OT claim table (Landscape A4)
 */
export function generateExcelHtml({
  employeeName,
  department = 'กรมทรัพย์สินทางปัญญา',
  position,
  positionLevel = '',
  monthName,
  currentYear,
  rateWeekday = 50,
  rateHoliday = 60,
  excelDays,
  totalWeekdayHours,
  totalHolidayHours,
  weekdayAmount,
  holidayAmount,
  grandTotalAmount
}) {
  const bahtText = thaiBahtText(grandTotalAmount);
  const rawDept = department ? department.trim() : 'กรมทรัพย์สินทางปัญญา';
  const fullDept = rawDept.includes('นนทบุรี') ? rawDept : `${rawDept} จังหวัดนนทบุรี`;

  // Generate 31 day headers
  const dayHeadersHtml = excelDays.map(d => `
    <th style="border: 1px solid #000; padding: 1px 0; font-weight: normal; font-size: 11pt; text-align: center; vertical-align: middle;">
      ${d.day}
    </th>
  `).join('');

  // Generate Row 7 (Weekday hours)
  const weekdayCellsHtml = excelDays.map(d => `
    <td style="border: 1px solid #000; text-align: center; vertical-align: middle; font-size: 11pt; padding: 0;">
      ${d.weekdayHours || ''}
    </td>
  `).join('');

  // Generate Row 8 (Holiday hours)
  const holidayCellsHtml = excelDays.map(d => `
    <td style="border: 1px solid #000; text-align: center; vertical-align: middle; font-size: 11pt; padding: 0; ${!d.hasOt ? 'background-color: #e0e0e0;' : ''}">
      ${d.holidayHours || ''}
    </td>
  `).join('');

  // Generate Row 9-11 (Return Times - Vertically Rotated 90 degrees)
  const returnCellsHtml = excelDays.map(d => `
    <td style="border: 1px solid #000; text-align: center; vertical-align: middle; padding: 0; height: 48px; ${!d.hasOt ? 'background-color: #e0e0e0;' : ''}">
      ${d.endTime ? `<div style="writing-mode: vertical-rl; transform: rotate(180deg); font-size: 10pt; line-height: 1; margin: 0 auto; letter-spacing: -0.5px;">${d.endTime}</div>` : ''}
    </td>
  `).join('');

  // Generate Row 13-15 (Signature Return - 42px height for real pen sign)
  const signReturnCellsHtml = excelDays.map(d => `
    <td style="border: 1px solid #000; text-align: center; vertical-align: middle; height: 42px; ${!d.hasOt ? 'background-color: #e0e0e0;' : ''}"></td>
  `).join('');

  // Generate Row 17-19 (Arrival Times - Vertically Rotated 90 degrees)
  const arrivalCellsHtml = excelDays.map(d => `
    <td style="border: 1px solid #000; text-align: center; vertical-align: middle; padding: 0; height: 48px; ${!d.hasOt ? 'background-color: #e0e0e0;' : ''}">
      ${d.startTime ? `<div style="writing-mode: vertical-rl; transform: rotate(180deg); font-size: 10pt; line-height: 1; margin: 0 auto; letter-spacing: -0.5px;">${d.startTime}</div>` : ''}
    </td>
  `).join('');

  // Generate Row 21-23 (Signature Arrival - 42px height for real pen sign)
  const signArrivalCellsHtml = excelDays.map(d => `
    <td style="border: 1px solid #000; text-align: center; vertical-align: middle; height: 42px; ${!d.hasOt ? 'background-color: #e0e0e0;' : ''}"></td>
  `).join('');

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <title>หลักฐานการจ่ายเงินตอบแทนการปฏิบัติงานนอกเวลาราชการ</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 landscape;
      margin: 6mm 4mm 6mm 4mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: 'TH Sarabun New', 'TH SarabunPSK', 'Sarabun', 'Cordia New', sans-serif;
      font-size: 13pt;
      line-height: 1.15;
    }
    .page-container {
      width: 100%;
      max-width: 287mm;
      margin: 0 auto;
      padding: 2mm 3mm;
    }
    .header-title {
      text-align: center;
      margin-bottom: 5px;
    }
    .header-title h1 {
      margin: 0;
      font-size: 16pt;
      font-weight: bold;
      line-height: 1.2;
    }
    .header-title h2 {
      margin: 2px 0 0 0;
      font-size: 14pt;
      font-weight: bold;
      line-height: 1.2;
    }
    table.excel-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
      table-layout: fixed;
    }
    table.excel-table th, table.excel-table td {
      border: 1px solid #000;
      padding: 2px 1px;
      font-size: 11.5pt;
    }
    .bg-header {
      background-color: #f8fafc;
    }
    .footer-block {
      margin-top: 8px;
      padding-left: 20px;
      padding-right: 15px;
      font-size: 13.5pt;
      line-height: 1.25;
    }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="header-title">
      <h1>หลักฐานการจ่ายเงินตอบแทนการปฏิบัติงานนอกเวลาราชการ</h1>
      <h2>${fullDept} &nbsp;&nbsp;&nbsp;&nbsp;ประจำเดือน ${monthName} ${currentYear}</h2>
    </div>

    <table class="excel-table">
      <colgroup>
        <col style="width: 3.5%;">
        <col style="width: 14%;">
        <col style="width: 6.5%;">
        ${Array(31).fill('<col style="width: 1.55%;">').join('')}
        <col style="width: 4.2%;">
        <col style="width: 4.2%;">
        <col style="width: 7%;">
        <col style="width: 4.2%;">
        <col style="width: 4.5%;">
        <col style="width: 4%;">
      </colgroup>
      <thead>
        <tr class="bg-header" style="height: 22px; font-weight: bold; font-size: 13pt;">
          <th rowspan="2" style="vertical-align: middle; text-align: center;">ลำดับที่</th>
          <th rowspan="2" style="vertical-align: middle; text-align: center; font-size: 14pt;">ชื่อ - สกุล</th>
          <th style="vertical-align: middle; text-align: center;">อัตราเงิน</th>
          <th colspan="31" style="vertical-align: middle; text-align: center; font-size: 13.5pt;">วันที่ปฏิบัติงานนอกเวลาราชการ</th>
          <th colspan="2" style="vertical-align: middle; text-align: center;">รวมเวลาปฏิบัติงาน</th>
          <th rowspan="2" style="vertical-align: middle; text-align: center;">จำนวนเงิน</th>
          <th style="vertical-align: middle; text-align: center; font-size: 11pt;">วัน เดือน ปี</th>
          <th style="vertical-align: middle; text-align: center; font-size: 12pt;">ลายมือชื่อ</th>
          <th rowspan="2" style="vertical-align: middle; text-align: center;">หมายเหตุ</th>
        </tr>
        <tr class="bg-header" style="height: 22px; font-weight: bold;">
          <th style="vertical-align: middle; text-align: center;">ตอบแทน</th>
          ${dayHeadersHtml}
          <th style="vertical-align: middle; text-align: center; font-size: 10.5pt; font-weight: normal; line-height: 1;">วันปกติ<br><span style="font-size: 9pt;">(ชั่วโมง)</span></th>
          <th style="vertical-align: middle; text-align: center; font-size: 10.5pt; font-weight: normal; line-height: 1;">วันหยุด<br><span style="font-size: 9pt;">(ชั่วโมง)</span></th>
          <th style="vertical-align: middle; text-align: center; font-size: 10.5pt; font-weight: normal;">ที่รับเงิน</th>
          <th style="vertical-align: middle; text-align: center; font-size: 10.5pt; font-weight: normal;">ผู้รับเงิน</th>
        </tr>
      </thead>
      <tbody>
        <!-- Row 7: Weekday hours -->
        <tr style="height: 26px;">
          <td rowspan="2" style="text-align: center; vertical-align: middle; font-weight: bold; font-size: 13.5pt;">1</td>
          <td rowspan="2" style="vertical-align: middle; text-align: left; padding-left: 6px; font-size: 13.5pt;">
            ${employeeName || ''}
          </td>
          <td style="text-align: center; vertical-align: middle; font-size: 12pt;">
            ${rateWeekday} / ช.ม.
          </td>
          ${weekdayCellsHtml}
          <td style="text-align: center; vertical-align: middle; font-weight: bold; font-size: 13pt;">
            ${totalWeekdayHours > 0 ? totalWeekdayHours : ''}
          </td>
          <td style="text-align: center; vertical-align: middle;"></td>
          <td style="text-align: center; vertical-align: middle; font-weight: bold; font-size: 12.5pt;">
            ${weekdayAmount > 0 ? weekdayAmount.toLocaleString() : ''}
          </td>
          <td rowspan="2" style="text-align: center; vertical-align: middle;"></td>
          <td rowspan="2" style="text-align: center; vertical-align: middle;"></td>
          <td rowspan="2" style="text-align: center; vertical-align: middle;"></td>
        </tr>

        <!-- Row 8: Holiday hours -->
        <tr style="height: 26px;">
          <td style="text-align: center; vertical-align: middle; font-size: 12pt;">
            ${rateHoliday} / ช.ม.
          </td>
          ${holidayCellsHtml}
          <td style="text-align: center; vertical-align: middle;"></td>
          <td style="text-align: center; vertical-align: middle; font-weight: bold; font-size: 13pt;">
            ${totalHolidayHours > 0 ? totalHolidayHours : ''}
          </td>
          <td style="text-align: center; vertical-align: middle; font-weight: bold; font-size: 12.5pt;">
            ${holidayAmount > 0 ? holidayAmount.toLocaleString() : '0'}
          </td>
        </tr>

        <!-- Row 9-11: เวลากลับ (Merged 3 rows) -->
        <tr style="height: 48px;">
          <td></td>
          <td></td>
          <td style="text-align: center; vertical-align: middle; font-weight: bold; font-size: 12.5pt;">เวลากลับ</td>
          ${returnCellsHtml}
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>

        <!-- Row 13-15: ลายมือชื่อตอนกลับ (Merged 3 rows) -->
        <tr style="height: 42px;">
          <td></td>
          <td></td>
          <td style="text-align: center; vertical-align: middle; font-weight: bold; font-size: 12.5pt;">ลายมือชื่อ</td>
          ${signReturnCellsHtml}
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>

        <!-- Row 17-19: เวลามา (Merged 3 rows) -->
        <tr style="height: 48px;">
          <td></td>
          <td></td>
          <td style="text-align: center; vertical-align: middle; font-weight: bold; font-size: 12.5pt;">เวลามา</td>
          ${arrivalCellsHtml}
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>

        <!-- Row 21-23: ลายมือชื่อตอนมา (Merged 3 rows) -->
        <tr style="height: 42px;">
          <td></td>
          <td></td>
          <td style="text-align: center; vertical-align: middle; font-weight: bold; font-size: 12.5pt;">ลายมือชื่อ</td>
          ${signArrivalCellsHtml}
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>

        <!-- Row 25-26: แถวรวม -->
        <tr style="height: 46px; font-weight: bold;">
          <td colspan="31"></td>
          <td colspan="3" style="text-align: center; vertical-align: middle; font-size: 13.5pt;">รวม</td>
          <td style="text-align: center; vertical-align: middle; font-size: 11.5pt; line-height: 1.25; padding: 2px 0;">
            ${totalWeekdayHours > 0 ? `<div>${totalWeekdayHours}X${rateWeekday} =</div><div>${totalWeekdayHours * rateWeekday}</div>` : ''}
          </td>
          <td style="text-align: center; vertical-align: middle; font-size: 11.5pt; line-height: 1.25; padding: 2px 0;">
            ${totalHolidayHours > 0 ? `<div>${totalHolidayHours}X${rateHoliday} =</div><div>${totalHolidayHours * rateHoliday}</div>` : ''}
          </td>
          <td style="text-align: center; vertical-align: middle; font-size: 14pt;">${grandTotalAmount.toLocaleString()}</td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      </tbody>
    </table>

    <!-- Footer & Signatures Block -->
    <div class="footer-block">
      <div style="font-weight: bold; font-size: 13.5pt; margin-bottom: 2px;">
        รวมเงินจ่ายทั้งสิ้น (${bahtText})
      </div>
      <div style="font-size: 13.5pt; margin-bottom: 4px;">
        ขอรับรองว่าผู้มีรายชื่อข้างต้นปฏิบัติงานนอกเวลาจริง
      </div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 6px;">
        <div style="width: 50%; padding-left: 20px;">
          <div>ลงชื่อ ................................................................ผู้รับรองการปฏิบัติงาน</div>
          <div style="padding-left: 40px; margin-top: 2px;">
            <div>( ${employeeName || ''} )</div>
            <div>ตำแหน่ง ${position || ''} ${positionLevel || ''}</div>
          </div>
        </div>
        <div style="width: 45%; text-align: right; padding-right: 25px;">
          <div>ลายมือชื่อ ................................................................ผู้จ่ายเงิน</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate pure HTML for Word memorandum report (Portrait A4)
 */
export function generateWordHtml({
  employeeName,
  department = 'กรมทรัพย์สินทางปัญญา',
  position,
  positionLevel = '',
  monthName,
  thaiYear,
  wordLogs
}) {
  const taskItemsHtml = wordLogs.length > 0 
    ? wordLogs.map(item => `
      <div style="margin-bottom: 8px;">
        <div style="font-weight: bold; font-size: 16pt;">
          วันที่ ${item.thaiDay} ${monthName} ${thaiYear}
        </div>
        <div style="font-size: 16pt; padding-left: 1.5cm; text-indent: -0.5cm;">
          - ${item.taskDesc}
        </div>
      </div>
    `).join('')
    : '<div style="text-align: center; padding: 40px 0; color: #888; font-size: 16pt;">(ยังไม่มีรายการบันทึกงานที่ขอเบิกเงินในเดือนนี้)</div>';

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <title>รายงานผลการปฏิบัติงานนอกเวลาราชการ</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 25mm 25mm 25mm 35mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: 'TH Sarabun New', 'TH SarabunPSK', 'Sarabun', 'Cordia New', sans-serif;
      font-size: 16pt;
      line-height: 1.5;
    }
    .word-container {
      width: 100%;
      max-width: 210mm;
      margin: 0 auto;
      padding: 25mm 25mm 25mm 35mm;
    }
    @media print {
      .word-container {
        padding: 0 !important;
      }
    }
    .text-center {
      text-align: center;
    }
    .font-bold {
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="word-container">
    <div class="text-center font-bold" style="margin-bottom: 24px;">
      <div style="font-size: 16pt; line-height: 1.3;">รายงานผลการปฏิบัติงานนอกเวลาราชการ</div>
      <div style="font-size: 16pt; line-height: 1.3;">ประจำเดือน ${monthName} ${thaiYear}</div>
      <div style="font-size: 16pt; line-height: 1.3;">${employeeName || ''}</div>
    </div>

    <div style="margin-bottom: 40px;">
      ${taskItemsHtml}
    </div>

    <div style="display: flex; justify-content: flex-end; margin-top: 50px; padding-right: 15px;">
      <div style="text-align: center; min-width: 280px; font-size: 16pt; line-height: 1.3;">
        <div>ลงชื่อ......................................................</div>
        <div style="margin-top: 4px;">( ${employeeName || ''} )</div>
        <div style="margin-top: 2px;">ตำแหน่ง ${position || ''} ${positionLevel || ''}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Clean isolated print trigger using hidden iframe
 */
export function printHtmlViaIframe(htmlContent) {
  let iframe = document.getElementById('clean-print-iframe');
  if (iframe) {
    iframe.remove();
  }
  iframe = document.createElement('iframe');
  iframe.id = 'clean-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '1200px';
  iframe.style.height = '900px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(htmlContent);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, 350);
}
