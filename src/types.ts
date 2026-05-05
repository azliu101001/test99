/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ShiftType {
  MORNING = '白班',
  LATE = '小夜',
  NIGHT = '大夜',
  OFF = '休假',
}

export interface Staff {
  id: string;
  name: string;
  role: string;
}

export interface DaySchedule {
  date: string; // ISO string or just DD
  shifts: {
    [StaffId: string]: ShiftType;
  };
}

export interface MonthlySchedule {
  year: number;
  month: number;
  days: DaySchedule[];
}

export interface ScheduleStats {
  staffId: string;
  staffName: string;
  counts: {
    [key in ShiftType]: number;
  };
}
