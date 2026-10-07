/**
 * Thai Public & Official Holidays Service
 * Implements civil service regulations for Overtime (OT):
 * 1. Holidays (weekends & public holidays) have a 7-hour maximum cap.
 * 2. 1-hour lunch break (12:00 - 13:00) is excluded from OT calculation.
 * 3. Standard and compensatory public holidays are tracked.
 */

// Fixed date holidays (month is 1-indexed: 1 = Jan, 12 = Dec)
const FIXED_HOLIDAYS = [
  { month: 1, day: 1, name: 'วันขึ้นปีใหม่' },
  { month: 4, day: 6, name: 'วันจักรี' },
  { month: 4, day: 13, name: 'วันสงกรานต์' },
  { month: 4, day: 14, name: 'วันสงกรานต์' },
  { month: 4, day: 15, name: 'วันสงกรานต์' },
  { month: 5, day: 1, name: 'วันแรงงานแห่งชาติ' },
  { month: 5, day: 4, name: 'วันฉัตรมงคล' },
  { month: 6, day: 3, name: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี' },
  { month: 7, day: 28, name: 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว (ร.10)' },
  { month: 8, day: 12, name: 'วันแม่แห่งชาติ / วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชชนนีพันปีหลวง' },
  { month: 10, day: 13, name: 'วันนวมินทรมหาราช (วันคล้ายวันสวรรคต ร.9)' },
  { month: 10, day: 23, name: 'วันปิยมหาราช' },
  { month: 12, day: 5, name: 'วันชาติ / วันพ่อแห่งชาติ (วันคล้ายวันพระบรมราชสมภพ ร.9)' },
  { month: 12, day: 10, name: 'วันรัฐธรรมนูญ' },
  { month: 12, day: 31, name: 'วันสิ้นปี' }
];

// Moveable Lunar & Special Royal Holidays by Buddhist Year (พ.ศ.)
const SPECIAL_HOLIDAYS = {
  2567: [
    { month: 2, day: 24, name: 'วันมาฆบูชา' },
    { month: 2, day: 26, name: 'วันหยุดชดเชยวันมาฆบูชา' },
    { month: 4, day: 8, name: 'วันหยุดชดเชยวันจักรี' },
    { month: 4, day: 16, name: 'วันหยุดชดเชยวันสงกรานต์' },
    { month: 5, day: 10, name: 'วันพืชมงคล' },
    { month: 5, day: 22, name: 'วันวิสาขบูชา' },
    { month: 7, day: 20, name: 'วันอาสาฬหบูชา' },
    { month: 7, day: 22, name: 'วันหยุดชดเชยวันอาสาฬหบูชา' },
    { month: 7, day: 29, name: 'วันหยุดชดเชยวันเฉลิมพระชนมพรรษา ร.10' },
    { month: 10, day: 14, name: 'วันหยุดชดเชยวันนวมินทรมหาราช' }
  ],
  2568: [
    { month: 2, day: 12, name: 'วันมาฆบูชา' },
    { month: 4, day: 7, name: 'วันหยุดชดเชยวันจักรี' },
    { month: 4, day: 16, name: 'วันหยุดชดเชยวันสงกรานต์' },
    { month: 5, day: 5, name: 'วันหยุดชดเชยวันฉัตรมงคล' },
    { month: 5, day: 9, name: 'วันพืชมงคล' },
    { month: 5, day: 11, name: 'วันวิสาขบูชา' },
    { month: 5, day: 12, name: 'วันหยุดชดเชยวันวิสาขบูชา' },
    { month: 7, day: 10, name: 'วันอาสาฬหบูชา' },
    { month: 7, day: 11, name: 'วันเข้าพรรษา' },
  ],
  2569: [
    { month: 3, day: 3, name: 'วันมาฆบูชา' },
    { month: 4, day: 6, name: 'วันจักรี' },
    { month: 5, day: 13, name: 'วันพืชมงคล' },
    { month: 5, day: 31, name: 'วันวิสาขบูชา' },
    { month: 6, day: 1, name: 'วันหยุดชดเชยวันวิสาขบูชา' },
    { month: 7, day: 29, name: 'วันอาสาฬหบูชา' },
    { month: 7, day: 30, name: 'วันเข้าพรรษา' },
  ],
  2570: [
    { month: 2, day: 21, name: 'วันมาฆบูชา' },
    { month: 2, day: 22, name: 'วันหยุดชดเชยวันมาฆบูชา' },
    { month: 5, day: 20, name: 'วันวิสาขบูชา' },
    { month: 7, day: 18, name: 'วันอาสาฬหบูชา' },
    { month: 7, day: 19, name: 'วันเข้าพรรษา' },
  ],
  2571: [
    { month: 2, day: 10, name: 'วันมาฆบูชา' },
    { month: 5, day: 9, name: 'วันวิสาขบูชา' },
    { month: 7, day: 7, name: 'วันอาสาฬหบูชา' },
    { month: 7, day: 8, name: 'วันเข้าพรรษา' },
  ],
  2572: [
    { month: 2, day: 28, name: 'วันมาฆบูชา' },
    { month: 5, day: 27, name: 'วันวิสาขบูชา' },
    { month: 5, day: 28, name: 'วันหยุดชดเชยวันวิสาขบูชา' },
    { month: 7, day: 26, name: 'วันอาสาฬหบูชา' },
    { month: 7, day: 27, name: 'วันเข้าพรรษา' },
  ],
  2573: [
    { month: 2, day: 17, name: 'วันมาฆบูชา' },
    { month: 2, day: 18, name: 'วันหยุดชดเชยวันมาฆบูชา' },
    { month: 5, day: 17, name: 'วันวิสาขบูชา' },
    { month: 7, day: 15, name: 'วันอาสาฬหบูชา' },
    { month: 7, day: 16, name: 'วันเข้าพรรษา' },
  ],
  2574: [
    { month: 2, day: 7, name: 'วันมาฆบูชา' },
    { month: 5, day: 6, name: 'วันวิสาขบูชา' },
    { month: 7, day: 4, name: 'วันอาสาฬหบูชา' },
    { month: 7, day: 5, name: 'วันเข้าพรรษา' },
  ],
  2575: [
    { month: 2, day: 25, name: 'วันมาฆบูชา' },
    { month: 5, day: 23, name: 'วันวิสาขบูชา' },
    { month: 5, day: 24, name: 'วันหยุดชดเชยวันวิสาขบูชา' },
    { month: 7, day: 22, name: 'วันอาสาฬหบูชา' },
    { month: 7, day: 23, name: 'วันเข้าพรรษา' },
  ]
};

/**
 * Get holiday details for a specific day, month, and year (พ.ศ.)
 */
export function getThaiHoliday(year, month, day) {
  const bYear = year > 2400 ? year : year + 543;
  const cYear = year > 2400 ? year - 543 : year;

  // 1. Check Special / Lunar / Compensatory holidays for this year
  const specialList = SPECIAL_HOLIDAYS[bYear];
  if (specialList) {
    const foundSpecial = specialList.find(h => h.month === month && h.day === day);
    if (foundSpecial) return { isHoliday: true, name: foundSpecial.name };
  }

  // 2. Check Fixed-date holidays
  const fixed = FIXED_HOLIDAYS.find(h => h.month === month && h.day === day);
  if (fixed) {
    return { isHoliday: true, name: fixed.name };
  }

  // 3. Check automatic compensatory holiday for fixed holidays falling on Sat/Sun
  // If today is Monday, check if yesterday (Sun) or 2 days ago (Sat) was a fixed holiday
  const dateObj = new Date(cYear, month - 1, day);
  if (dateObj.getDay() === 1) { // Monday
    // Check Sunday
    const sunDate = new Date(cYear, month - 1, day - 1);
    const sunFixed = FIXED_HOLIDAYS.find(h => h.month === (sunDate.getMonth() + 1) && h.day === sunDate.getDate());
    if (sunFixed) {
      return { isHoliday: true, name: `วันหยุดชดเชย${sunFixed.name}` };
    }

    // Check Saturday
    const satDate = new Date(cYear, month - 1, day - 2);
    const satFixed = FIXED_HOLIDAYS.find(h => h.month === (satDate.getMonth() + 1) && h.day === satDate.getDate());
    if (satFixed) {
      return { isHoliday: true, name: `วันหยุดชดเชย${satFixed.name}` };
    }
  }

  return null;
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export function isWeekend(year, month, day) {
  const cYear = year > 2400 ? year - 543 : year;
  const dateObj = new Date(cYear, month - 1, day);
  const dow = dateObj.getDay();
  return dow === 0 || dow === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Check if a day is an official holiday (Weekend OR Public Holiday)
 */
export function isOfficialHoliday(year, month, day) {
  if (isWeekend(year, month, day)) return true;
  return getThaiHoliday(year, month, day) !== null;
}

/**
 * Calculate Overtime (OT) hours based on civil service rules:
 * - Weekday: Starts after 16:30.
 * - Holiday:
 *    1. Morning session: 08:30 - 11:30 (Max 3 hours)
 *    2. Afternoon session: 13:30 - 16:30 (Max 3 hours)
 *    3. Connector intervals: 11:30 - 12:00 (30 min) AND 13:00 - 13:30 (30 min)
 *       If working through BOTH of these intervals, count 1 full hour (lunch 12:00 - 13:00 excluded).
 *    Total maximum cap on holidays is 7 hours per day (420 THB).
 */
export function calculateCivilServiceOtHours({
  dayType = 'weekday',
  startTime = '16:30',
  endTime = '17:30',
  isHoliday = false
}) {
  if (!startTime || !endTime) return 0;

  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  const startMin = sH * 60 + (sM || 0);
  const endMin = eH * 60 + (eM || 0);

  if (endMin <= startMin) return 0;

  const isDayHoliday = dayType === 'holiday' || isHoliday;

  if (isDayHoliday) {
    // 1. Morning session: 08:30 - 11:30 (510 to 690 min) -> max 180 min (3 hrs)
    const mStart = 8 * 60 + 30; // 510
    const mEnd = 11 * 60 + 30;  // 690
    const morningOverlap = Math.max(0, Math.min(endMin, mEnd) - Math.max(startMin, mStart));
    const morningHours = Math.floor(morningOverlap / 60);

    // 2. Afternoon session: 13:30 - 16:30 (810 to 990 min) -> max 180 min (3 hrs)
    const aStart = 13 * 60 + 30; // 810
    const aEnd = 16 * 60 + 30;   // 990
    const afternoonOverlap = Math.max(0, Math.min(endMin, aEnd) - Math.max(startMin, aStart));
    const afternoonHours = Math.floor(afternoonOverlap / 60);

    // 3. Connector check:
    // Interval A: 11:30 - 12:00 (690 - 720 min, 30 min)
    // Interval B: 13:00 - 13:30 (780 - 810 min, 30 min)
    // Lunch break: 12:00 - 13:00 is unpaid/excluded.
    // If worker worked through BOTH interval A and interval B -> count 1 full hour (60 min).
    const workedA = startMin <= 690 && endMin >= 720;
    const workedB = startMin <= 780 && endMin >= 810;
    const connectorMinutes = (workedA && workedB) ? 60 : 0;

    const totalMinutes = morningOverlap + connectorMinutes + afternoonOverlap;
    const totalHours = Math.floor(totalMinutes / 60);
    return Math.min(7, Math.max(0, totalHours));
  } else {
    // Weekday: counts overtime after normal workday (16:30)
    // Civil service rule: Maximum 4 hours per day (16:30 - 20:30)
    const normalEndMin = 16 * 60 + 30;
    const effectiveStartMin = Math.max(startMin, normalEndMin);

    if (endMin <= effectiveStartMin) return 0;

    const diffMin = endMin - effectiveStartMin;
    const hours = Math.floor(diffMin / 60);
    return Math.min(4, Math.max(0, hours));
  }
}

/**
 * Format / Normalize official report times to align with claimable full hours:
 * - Holiday:
 *    - 7 hours (Full Day): 08:30 - 16:30 (1-hour lunch break 12:00 - 13:00 excluded)
 *    - Connector session (worked morning & afternoon/connector bridge):
 *        - Report startTime = 11:30 - morningHours (e.g. morning 2h = 09:30, morning 3h = 08:30)
 *        - Report endTime = 13:30 + afternoonHours (e.g. afternoon 0h = 13:30, afternoon 3h = 16:30)
 *        - E.g. in 09:00 out 14:00 (4h) -> 09:30 - 13:30
 *        - E.g. in 08:30 out 13:30 (4h) -> 08:30 - 13:30
 *        - E.g. in 09:00 out 17:00 (6h) -> 09:30 - 16:30
 *    - Morning only:
 *        - E.g. in 09:00 out 12:00 (2h) -> 09:30 - 11:30
 *        - E.g. in 08:30 out 11:30 (3h) -> 08:30 - 11:30
 *    - Afternoon only:
 *        - E.g. in 13:00 out 16:30 (3h) -> 13:30 - 16:30
 * - Weekday:
 *    - Always 16:30 - (16:30 + hours) (e.g. 4 hrs = 16:30 - 20:30)
 */
export function getCivilServiceReportTimes({
  dayType = 'weekday',
  startTime = '16:30',
  endTime = '17:30',
  hours = 0
}) {
  const h = Number(hours) || 0;
  if (h <= 0) return { startTime: startTime || '16:30', endTime: endTime || '17:30' };

  if (dayType === 'holiday') {
    if (h >= 7) {
      return { startTime: '08:30', endTime: '16:30' };
    }

    const [sH, sM] = (startTime || '08:30').split(':').map(Number);
    const [eH, eM] = (endTime || '16:30').split(':').map(Number);
    const startMin = (sH || 0) * 60 + (sM || 0);
    const endMin = (eH || 0) * 60 + (eM || 0);

    // Calculate session breakdown
    const mStart = 8 * 60 + 30; // 510
    const mEnd = 11 * 60 + 30;  // 690
    const morningOverlap = Math.max(0, Math.min(endMin, mEnd) - Math.max(startMin, mStart));
    const morningHours = Math.min(3, Math.floor(morningOverlap / 60));

    const aStart = 13 * 60 + 30; // 810
    const aEnd = 16 * 60 + 30;   // 990
    const afternoonOverlap = Math.max(0, Math.min(endMin, aEnd) - Math.max(startMin, aStart));
    const afternoonHours = Math.min(3, Math.floor(afternoonOverlap / 60));

    const workedA = startMin <= 690 && endMin >= 720;
    const workedB = startMin <= 780 && endMin >= 810;
    const connectorHour = (workedA && workedB) ? 1 : 0;

    // Case 1: Works across connector (both morning & afternoon/lunch bridge)
    if (connectorHour === 1) {
      // Calculate report start time based on morning hours
      // morningHours = 3 -> 08:30, 2 -> 09:30, 1 -> 10:30, 0 -> 11:30
      const startMinutes = 690 - morningHours * 60;
      const repStartH = Math.floor(startMinutes / 60);
      const repStartM = startMinutes % 60;
      const repStartTime = `${String(repStartH).padStart(2, '0')}:${String(repStartM).padStart(2, '0')}`;

      // Calculate report end time based on afternoon hours
      // afternoonHours = 3 -> 16:30, 2 -> 15:30, 1 -> 14:30, 0 -> 13:30
      const endMinutes = 810 + afternoonHours * 60;
      const repEndH = Math.floor(endMinutes / 60);
      const repEndM = endMinutes % 60;
      const repEndTime = `${String(repEndH).padStart(2, '0')}:${String(repEndM).padStart(2, '0')}`;

      return { startTime: repStartTime, endTime: repEndTime };
    }

    // Case 2: Works morning only (no connector, or ended by lunch)
    if (morningHours > 0 && afternoonHours === 0) {
      const startMinutes = 690 - morningHours * 60;
      const repStartH = Math.floor(startMinutes / 60);
      const repStartM = startMinutes % 60;
      return {
        startTime: `${String(repStartH).padStart(2, '0')}:${String(repStartM).padStart(2, '0')}`,
        endTime: '11:30'
      };
    }

    // Case 3: Works afternoon only
    if (afternoonHours > 0 && morningHours === 0) {
      const endMinutes = 810 + afternoonHours * 60;
      const repEndH = Math.floor(endMinutes / 60);
      const repEndM = endMinutes % 60;
      return {
        startTime: '13:30',
        endTime: `${String(repEndH).padStart(2, '0')}:${String(repEndM).padStart(2, '0')}`
      };
    }

    // Fallback if manual hours provided without matching breakdown
    if (startMin >= 13 * 60) {
      const endMinutes = 810 + Math.min(3, h) * 60;
      return {
        startTime: '13:30',
        endTime: `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
      };
    } else {
      if (h <= 3) {
        const startMinutes = 690 - h * 60;
        return {
          startTime: `${String(Math.floor(startMinutes / 60)).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}`,
          endTime: '11:30'
        };
      } else {
        const afternoonPart = Math.min(3, h - 4);
        const endMinutes = 810 + afternoonPart * 60;
        return {
          startTime: '08:30',
          endTime: `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
        };
      }
    }
  } else {
    // Weekday: standard starting time is 16:30, maximum 4 hours (up to 20:30)
    const effectiveH = Math.min(4, Math.max(0, h));
    const targetEndHour = 16 + effectiveH;
    return {
      startTime: '16:30',
      endTime: `${String(targetEndHour).padStart(2, '0')}:30`
    };
  }
}
