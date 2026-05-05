/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ShiftType, Staff, MonthlySchedule, DaySchedule } from '../types';

export function generateSchedule(
  year: number,
  month: number,
  staffList: Staff[],
  preAssigned: Record<string, Record<string, ShiftType>> = {} // { date: { staffId: ShiftType } }
): MonthlySchedule {
  const numDays = new Date(year, month, 0).getDate();
  const schedule: DaySchedule[] = [];
  
  // Track shift counts to ensure fairness
  const counts: Record<string, Record<ShiftType, number>> = {};
  staffList.forEach(s => {
    counts[s.id] = {
      [ShiftType.MORNING]: 0,
      [ShiftType.LATE]: 0,
      [ShiftType.NIGHT]: 0,
      [ShiftType.OFF]: 0,
    };
  });

  // Track previous day assignments to prevent illegal transitions
  let prevShifts: Record<string, ShiftType> = {};

  for (let day = 1; day <= numDays; day++) {
    const dailyShifts: Record<string, ShiftType> = {};
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const preForToday = preAssigned[dateStr] || {};
    
    // Proportional requirement: 1 person per shift for every 5 staff members, minimum 2.
    // Excluding Head Nurse from the count for proportionality.
    const neededPerShift = Math.max(2, Math.floor((staffList.length - 1) / 5));

    // Everyone starts as OFF or Pre-assigned
    staffList.forEach((s, idx) => {
      // Rule: First person (Head Nurse) has fixed schedule
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (idx === 0) {
        dailyShifts[s.id] = isWeekend ? ShiftType.OFF : ShiftType.MORNING;
        counts[s.id][dailyShifts[s.id]]++;
        return;
      }

      if (preForToday[s.id]) {
        dailyShifts[s.id] = preForToday[s.id];
        if (preForToday[s.id] !== ShiftType.OFF) {
          counts[s.id][preForToday[s.id]]++;
        }
      } else {
        dailyShifts[s.id] = ShiftType.OFF;
      }
    });

    const assignedToday = new Set<string>(
      Object.entries(dailyShifts)
        .filter(([id, shift]) => {
          // Head nurse (index 0) doesn't take quota of the neededPerShift rule for the rest
          const staffIdx = staffList.findIndex(s => s.id === id);
          return shift !== ShiftType.OFF && staffIdx !== 0;
        })
        .map(([id, _]) => id)
    );

    // Function to calculate requirements needed (excluding Head Nurse who is extra support)
    const getNeeded = (type: ShiftType) => {
      const alreadySetExcludingHN = Object.entries(dailyShifts)
        .filter(([id, shift]) => {
          const staffIdx = staffList.findIndex(s => s.id === id);
          return shift === type && staffIdx !== 0;
        }).length;
      return Math.max(0, neededPerShift - alreadySetExcludingHN);
    };

    // Candidates are staff NOT Head Nurse and NOT already assigned a specific shift today
    const pool = staffList.slice(1).sort(() => Math.random() - 0.5);
    pool.sort((a, b) => {
      const workA = Object.values(counts[a.id]).reduce((acc, val, idx) => acc + (Object.keys(counts[a.id])[idx] !== ShiftType.OFF ? val : 0), 0);
      const workB = Object.values(counts[b.id]).reduce((acc, val, idx) => acc + (Object.keys(counts[b.id])[idx] !== ShiftType.OFF ? val : 0), 0);
      return workA - workB;
    });

    // 1. Assign Night
    let nightNeeded = getNeeded(ShiftType.NIGHT);
    for (const s of pool) {
      if (nightNeeded <= 0) break;
      if (preForToday[s.id]) continue; // Skip if user pre-set something (even OFF)

      dailyShifts[s.id] = ShiftType.NIGHT;
      assignedToday.add(s.id);
      counts[s.id][ShiftType.NIGHT]++;
      nightNeeded--;
    }

    // 2. Assign Late
    let lateNeeded = getNeeded(ShiftType.LATE);
    for (const s of pool) {
      if (lateNeeded <= 0) break;
      if (assignedToday.has(s.id) || preForToday[s.id]) continue;
      
      // Constraint: No Late after Night
      if (prevShifts[s.id] === ShiftType.NIGHT) continue;

      dailyShifts[s.id] = ShiftType.LATE;
      assignedToday.add(s.id);
      counts[s.id][ShiftType.LATE]++;
      lateNeeded--;
    }

    // 3. Assign Morning
    let morningNeeded = getNeeded(ShiftType.MORNING);
    for (const s of pool) {
      if (morningNeeded <= 0) break;
      if (assignedToday.has(s.id) || preForToday[s.id]) continue;

      // Special Constraint: No Morning after Night OR Late
      if (prevShifts[s.id] === ShiftType.NIGHT || prevShifts[s.id] === ShiftType.LATE) continue;

      dailyShifts[s.id] = ShiftType.MORNING;
      assignedToday.add(s.id);
      counts[s.id][ShiftType.MORNING]++;
      morningNeeded--;
    }

    // Update OFF counts for those who ended up as OFF
    staffList.forEach(s => {
      if (dailyShifts[s.id] === ShiftType.OFF) {
        counts[s.id][ShiftType.OFF]++;
      }
    });

    schedule.push({
      date: dateStr,
      shifts: dailyShifts
    });
    
    prevShifts = { ...dailyShifts };
  }

  return {
    year,
    month,
    days: schedule
  };
}

export function getStats(schedule: MonthlySchedule, staffList: Staff[]) {
  return staffList.map(s => {
    const stats = {
      staffId: s.id,
      staffName: s.name,
      counts: {
        [ShiftType.MORNING]: 0,
        [ShiftType.LATE]: 0,
        [ShiftType.NIGHT]: 0,
        [ShiftType.OFF]: 0,
      }
    };
    
    schedule.days.forEach(day => {
      const shift = day.shifts[s.id];
      if (shift) {
        stats.counts[shift]++;
      }
    });
    
    return stats;
  });
}
