/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Staff, ShiftType } from './types';

export const DEFAULT_STAFF: Staff[] = [
  { id: '1', name: '陳大文', role: '護理師' },
  { id: '2', name: '林小玲', role: '護理師' },
  { id: '3', name: '王志明', role: '護理師' },
  { id: '4', name: '張雅婷', role: '護理師' },
  { id: '5', name: '李美君', role: '護理師' },
  { id: '6', name: '趙子龍', role: '護理師' },
  { id: '7', name: '孫悟空', role: '護理師' },
  { id: '8', name: '周杰倫', role: '護理師' },
  { id: '9', name: '蔡依林', role: '護理師' },
  { id: '10', name: '郭台銘', role: '護理師' },
];

export const SHIFT_COLORS: Record<ShiftType, string> = {
  [ShiftType.MORNING]: 'bg-blue-400/20 text-blue-300 border-blue-400/30',
  [ShiftType.LATE]: 'bg-orange-400/20 text-orange-300 border-orange-400/30',
  [ShiftType.NIGHT]: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  [ShiftType.OFF]: 'bg-rose-950 text-rose-200 border-rose-800 shadow-[inset_0_0_10px_rgba(255,0,0,0.2)]',
};

export const SHIFT_LABELS: Record<ShiftType, string> = {
  [ShiftType.MORNING]: '白',
  [ShiftType.LATE]: '小',
  [ShiftType.NIGHT]: '大',
  [ShiftType.OFF]: '休',
};
