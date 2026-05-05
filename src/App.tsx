/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, useRef, ChangeEvent, MouseEvent } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Printer, 
  Users, 
  PieChart,
  LayoutGrid,
  FileText,
  Info,
  Upload,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { ShiftType, Staff, MonthlySchedule } from './types';
import { DEFAULT_STAFF, SHIFT_COLORS, SHIFT_LABELS } from './constants';
import { generateSchedule, getStats } from './logic/scheduler';

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [staffList, setStaffList] = useState<Staff[]>(DEFAULT_STAFF);
  const [schedule, setSchedule] = useState<MonthlySchedule | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'stats'>('calendar');
  const [preAssigned, setPreAssigned] = useState<Record<string, Record<string, ShiftType>>>({});
  const [savedSchedules, setSavedSchedules] = useState<MonthlySchedule[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Initialize schedule and load history
  useEffect(() => {
    const history = localStorage.getItem('smartshift_history');
    if (history) {
      try {
        setSavedSchedules(JSON.parse(history));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
    
    if (!schedule) {
      handleGenerate();
    }
  }, []);

  const handleSaveSchedule = () => {
    if (!schedule) return;
    
    const newHistory = [...savedSchedules];
    const index = newHistory.findIndex(s => s.year === schedule.year && s.month === schedule.month);
    
    if (index !== -1) {
      newHistory[index] = schedule;
    } else {
      newHistory.push(schedule);
    }
    
    setSavedSchedules(newHistory);
    localStorage.setItem('smartshift_history', JSON.stringify(newHistory));
    alert(`${schedule.year}年${schedule.month}月班表已儲存至存檔`);
  };

  const handleLoadHistory = (saved: MonthlySchedule) => {
    setSchedule(saved);
    setCurrentDate(new Date(saved.year, saved.month - 1, 1));
    setViewMode('calendar');
  };

  const handleDeleteHistory = (e: MouseEvent, year: number, month: number) => {
    e.stopPropagation();
    const newHistory = savedSchedules.filter(s => !(s.year === year && s.month === month));
    setSavedSchedules(newHistory);
    localStorage.setItem('smartshift_history', JSON.stringify(newHistory));
  };

  const handleGenerate = () => {
    const newSchedule = generateSchedule(year, month, staffList, preAssigned);
    setSchedule(newSchedule);
  };

  const handlePrevMonth = () => {
    const nextDate = new Date(year, month - 2, 1);
    setCurrentDate(nextDate);
    const newSchedule = generateSchedule(nextDate.getFullYear(), nextDate.getMonth() + 1, staffList, preAssigned);
    setSchedule(newSchedule);
  };

  const handleNextMonth = () => {
    const nextDate = new Date(year, month, 1);
    setCurrentDate(nextDate);
    const newSchedule = generateSchedule(nextDate.getFullYear(), nextDate.getMonth() + 1, staffList, preAssigned);
    setSchedule(newSchedule);
  };

  const handleDownloadTemplate = () => {
    const days = new Date(year, month, 0).getDate();
    // Sample headers with 10 staff placeholders
    const data = [
      { '成員名稱': '人員1 (護理長)' },
      ...Array.from({ length: 9 }).map((_, i) => ({ '成員名稱': `人員${i + 2}` }))
    ];
    
    // Add columns for days
    data.forEach(row => {
      for (let i = 1; i <= days; i++) {
        (row as any)[`${i}日`] = '';
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "排班範本");
    
    // Add instruction worksheet
    const instrData = [
      ['規則說明'],
      ['1. 第一行人員將自動識別為「護理長」，固定週一至五白班，週六日休假。'],
      ['2. 若要預排休假，請在對應日期填寫「休」或「OFF」。'],
      ['3. 若要預排特定班表，請填寫「白」、「小」或「大」。'],
      ['4. 其餘留空，系統將根據公平性自動補齊班表。']
    ];
    const instrSheet = XLSX.utils.aoa_to_sheet(instrData);
    XLSX.utils.book_append_sheet(workbook, instrSheet, "使用說明");

    XLSX.writeFile(workbook, `SmartShift_排班範本_${year}_${month}.xlsx`);
  };

  const handleExportExcel = () => {
    if (!schedule) return;

    const data = staffList.map(staff => {
      const row: any = { '成員名稱': staff.name };
      schedule.days.forEach((day, i) => {
        const dateKey = `${i + 1}日`;
        row[dateKey] = day.shifts[staff.id];
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "班表");
    XLSX.writeFile(workbook, `SmartShift_${year}_${month}.xlsx`);
  };

  const handleImportExcel = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      // 1. Identify all unique names from Excel and update staff list
      const importedNames = Array.from(new Set(data.map(row => row['成員名稱']).filter(Boolean)));
      const newStaffList: Staff[] = importedNames.map((name, index) => ({
        id: `imported-${index}`,
        name: name as string,
        role: index === 0 ? '護理長' : '護理師'
      }));
      
      setStaffList(newStaffList);

      // 2. Map pre-assigned shifts
      const importedPre: Record<string, Record<string, ShiftType>> = {};

      data.forEach(row => {
        const staffName = row['成員名稱'];
        const staff = newStaffList.find(s => s.name === staffName);
        if (!staff) return;

        Object.keys(row).forEach(key => {
          if (key.includes('日')) {
            const dayNum = parseInt(key.replace('日', ''));
            if (isNaN(dayNum)) return;

            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const val = String(row[key] || '').trim().toUpperCase();
            
            let shift: ShiftType | undefined;
            if (['白', '白班', 'M', 'MORNING'].includes(val)) shift = ShiftType.MORNING;
            else if (['小', '小夜', 'L', 'LATE'].includes(val)) shift = ShiftType.LATE;
            else if (['大', '大夜', 'N', 'NIGHT'].includes(val)) shift = ShiftType.NIGHT;
            else if (['休', '休假', 'OFF', 'X'].includes(val)) shift = ShiftType.OFF;

            if (shift) {
              if (!importedPre[dateStr]) importedPre[dateStr] = {};
              importedPre[dateStr][staff.id] = shift;
            }
          }
        });
      });

      setPreAssigned(importedPre);
      
      // 3. Immediately generate new schedule with updated staff and pre-assignments
      const newSchedule = generateSchedule(year, month, newStaffList, importedPre);
      setSchedule(newSchedule);
      
      if (fileInputRef.current) fileInputRef.current.value = '';
      alert(`成功讀取 ${newStaffList.length} 位成員及其預班資料！`);
    };
    reader.readAsBinaryString(file);
  };

  const stats = useMemo(() => {
    if (!schedule) return [];
    return getStats(schedule, staffList);
  }, [schedule, staffList]);

  const daysInMonth = useMemo(() => {
    return new Date(year, month, 0).getDate();
  }, [year, month]);

  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

  const getDayOfWeek = (day: number) => {
    return new Date(year, month - 1, day).getDay();
  };

  return (
    <div id="app-container" className="min-h-screen bg-gradient-to-br from-[#1a1c2c] via-[#4a192c] to-[#124559] text-white font-sans selection:bg-white/20">
      {/* Header */}
      <header className="sticky top-0 z-50 px-8 py-4 flex flex-col xl:flex-row gap-4 justify-between items-center bg-[#1a1c2c]/90 backdrop-blur-2xl border-b border-white/10 shadow-2xl">
        <div className="flex flex-col items-center xl:items-start">
          <h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
           Automatic shift scheduling AI
          </h1>
          <p className="text-white/40 text-[9px] mt-0.5 uppercase tracking-[0.3em] font-mono leading-none">
            Nursing Unit Scheduler Pro
          </p>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 backdrop-blur-xl bg-white/5 border border-white/10 rounded-full px-4 py-1.5 opacity-60">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
            <span className="text-[10px] font-bold uppercase tracking-wider">AI Optimizer active</span>
          </div>
          
          <div className="flex items-center gap-1 backdrop-blur-xl bg-white/5 border border-white/10 rounded-full p-1">
            <button 
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              <LayoutGrid size={12} />
              <span>日曆</span>
            </button>
            <button 
              onClick={() => setViewMode('stats')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${viewMode === 'stats' ? 'bg-white text-slate-900 shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              <PieChart size={12} />
              <span>統計</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleDownloadTemplate}
              className="bg-white/5 text-white/60 border border-white/10 px-3 py-2 rounded-full font-bold text-[11px] hover:bg-white/10 transition-all flex items-center gap-2"
              title="下載空白 Excel 範本填寫"
            >
              <Download size={14} />
              <span className="hidden sm:inline">範本</span>
            </button>

            <div className="h-5 w-px bg-white/10 mx-1"></div>

            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-full font-bold text-[11px] shadow-[0_4px_15px_rgba(79,70,229,0.3)] hover:bg-indigo-500 active:scale-95 transition-all flex items-center gap-2"
            >
              <Upload size={14} />
              <span>匯入預班表</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportExcel} 
              accept=".xlsx,.xls" 
              className="hidden" 
            />
            
            <button 
              onClick={handleSaveSchedule}
              className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-4 py-2 rounded-full font-bold text-[11px] hover:bg-blue-600/30 transition-all flex items-center gap-2"
            >
              <FileText size={14} />
              <span className="hidden sm:inline">儲存存檔</span>
            </button>

            <button 
              onClick={handleExportExcel}
              className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-full font-bold text-[11px] hover:bg-emerald-600/20 transition-all flex items-center gap-2"
            >
              <Download size={14} />
              <span className="hidden sm:inline">匯出</span>
            </button>

            <button 
              onClick={handleGenerate}
              className="bg-white text-slate-900 px-5 py-2 rounded-full font-bold text-[11px] shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <RotateCcw size={14} />
              <span>隨機生成</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-8 py-4 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Sidebar Info */}
        <aside className="md:col-span-3 space-y-6">
          <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-6">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4">歷史班表存檔 (History)</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {savedSchedules.length === 0 && (
                <p className="text-xs text-white/20 italic">尚無儲存紀錄</p>
              )}
              {savedSchedules
                .sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month))
                .map((saved) => (
                <div 
                  key={`${saved.year}-${saved.month}`}
                  onClick={() => handleLoadHistory(saved)}
                  className={`group flex justify-between items-center p-3 rounded-2xl cursor-pointer transition-all border ${saved.year === year && saved.month === month ? 'bg-white/15 border-white/20' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                >
                  <div className="flex items-center gap-3">
                    <CalendarIcon size={14} className={saved.year === year && saved.month === month ? 'text-white' : 'text-white/40'} />
                    <span className="text-sm font-medium">{saved.year}年 {saved.month}月</span>
                  </div>
                  <button 
                    onClick={(e) => handleDeleteHistory(e, saved.year, saved.month)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-all"
                  >
                    <RotateCcw size={12} className="rotate-45" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-6">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4">排班規則設定</h3>
            <ul className="space-y-4">
              <li className="flex justify-between items-center">
                <span className="text-white/60 text-sm">人員總數</span>
                <span className="font-mono font-bold text-white">10 名</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-white/60 text-sm">三班配置</span>
                <span className="font-mono font-bold text-white">2人/班</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-white/60 text-sm">每日出勤</span>
                <span className="font-mono font-bold text-emerald-400">6 名</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-white/60 text-sm">每日輪休</span>
                <span className="font-mono font-bold text-rose-400">4 名</span>
              </li>
            </ul>
          </div>

          <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-6">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4">班別人力分布</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded bg-blue-400"></div>
                  <span className="text-sm text-white/70">白班 (Morning)</span>
                </div>
                <span className="text-xs font-mono">2 人</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded bg-orange-400"></div>
                  <span className="text-sm text-white/70">小夜 (Late)</span>
                </div>
                <span className="text-xs font-mono">2 人</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded bg-indigo-500"></div>
                  <span className="text-sm text-white/70">大夜 (Night)</span>
                </div>
                <span className="text-xs font-mono">2 人</span>
              </div>
            </div>
          </div>

          <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-6">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4">演算法約束 (Constraints)</h3>
            <ul className="space-y-4">
              <li className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                  <span className="text-sm font-bold text-white/90">護理長專屬規則</span>
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed pl-3.5">
                  清單第一人固定為護理長，安排週一至五白班，週六日休假。
                </p>
              </li>
              <li className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                  <span className="text-sm font-bold text-white/90">嚴禁花花班</span>
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed pl-3.5">
                  大夜不接小夜與白班；小夜不接白班。確保休息時數充足。
                </p>
              </li>
              <li className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                  <span className="text-sm font-bold text-white/90">工時公平性</span>
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed pl-3.5">
                  自動追蹤月累積班量，優先分配工時短者以達成勞務平衡。
                </p>
              </li>
            </ul>
          </div>

          <div className="p-6">
            <button 
              onClick={() => window.print()}
              className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white/70 py-3 rounded-2xl text-sm font-bold hover:bg-white/10 transition-colors"
            >
              <Printer size={16} />
              <span>列印月度報表</span>
            </button>
          </div>
        </aside>

        {/* Main Schedule Area */}
        <div className="md:col-span-9 flex flex-col gap-6">
          {/* Month Navigation Card */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h2 className="text-2xl font-bold tracking-tight italic">
                {year}年 {month}月 排班總表
              </h2>
              <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1">
                <button onClick={handlePrevMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <ChevronLeft size={18} />
                </button>
                <div className="px-4 text-sm font-mono opacity-50">MONTHLY</div>
                <button onClick={handleNextMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono tracking-widest uppercase">
              <Info size={14} className="text-emerald-400" />
              <span>自動優化演算法已啟用</span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {viewMode === 'calendar' ? (
              <motion.div 
                key="calendar"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="backdrop-blur-3xl bg-white/10 border border-white/20 rounded-[2.5rem] p-6 shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="overflow-x-auto">
                  <table id="schedule-table" className="w-full border-collapse">
                    <thead>
                      <tr className="text-white/30 text-[10px] uppercase tracking-widest">
                        <th className="sticky left-0 z-20 bg-[#1a1c2c]/40 backdrop-blur-md p-4 text-left border-b border-white/5 min-w-[140px] font-medium">
                          成員名稱
                        </th>
                        {Array.from({ length: daysInMonth }).map((_, i) => (
                          <th key={i} className={`pb-4 text-center border-b border-white/5 min-w-[50px] ${[0, 6].includes(getDayOfWeek(i + 1)) ? 'text-rose-400' : ''}`}>
                            <div className="text-[9px] mb-1 opacity-50">{dayNames[getDayOfWeek(i + 1)]}</div>
                            <div className="text-sm font-mono font-bold">{i + 1}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {staffList.map((staff, idx) => (
                        <tr key={staff.id} className={`${idx % 2 === 0 ? 'bg-white/[0.03]' : ''} hover:bg-white/5 transition-colors group`}>
                          <td className="sticky left-0 z-10 bg-inherit backdrop-blur-md p-4 border-r border-white/5">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold tracking-wide">{staff.name}</span>
                              <span className="text-[10px] text-white/30 uppercase tracking-tighter">{staff.role}</span>
                            </div>
                          </td>
                          {schedule?.days.map((day, i) => {
                            const shift = day.shifts[staff.id];
                            const dateStr = day.date;
                            const isPreAssigned = preAssigned[dateStr] && preAssigned[dateStr][staff.id];
                            
                            return (
                              <td key={i} className="p-1 border-white/5">
                                <div className={`
                                  relative w-full h-8 flex items-center justify-center rounded-lg text-[10px] font-bold transition-all border
                                  ${SHIFT_COLORS[shift]}
                                  ${shift === ShiftType.OFF ? 'opacity-40' : 'shadow-[0_0_15px_rgba(255,255,255,0.05)]'}
                                  ${isPreAssigned ? 'ring-2 ring-white/50 border-white shadow-[0_0_10px_rgba(255,255,255,0.3)]' : ''}
                                `}>
                                  {SHIFT_LABELS[shift]}
                                  {isPreAssigned && (
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full shadow-sm"></div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-6 flex justify-between items-center text-[10px] text-white/30 font-mono">
                  <p>最後優化時間: {new Date().toLocaleString()}</p>
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div> 白班: 2人/日</span>
                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div> 小夜: 2人/日</span>
                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> 大夜: 2人/日</span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="stats"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6"
              >
                {stats.map((stat) => (
                  <div key={stat.staffId} className="backdrop-blur-2xl bg-white/10 border border-white/20 p-6 rounded-[2rem] shadow-xl hover:translate-y-[-4px] transition-all group">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-white">{stat.staffName}</h3>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest">{staffList.find(s => s.id === stat.staffId)?.role}</p>
                      </div>
                      <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/30 group-hover:bg-white group-hover:text-slate-900 transition-all duration-500">
                        <FileText size={18} />
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between text-[9px] font-bold uppercase tracking-[0.2em] text-white/30 mb-3">
                          <span>班別權重分佈</span>
                          <span>工時穩定性指數: 98%</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex">
                          <div 
                            className="h-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]" 
                            style={{ width: `${(stat.counts[ShiftType.MORNING] / (daysInMonth - stat.counts[ShiftType.OFF])) * 100}%` }}
                          ></div>
                          <div 
                            className="h-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.5)]" 
                            style={{ width: `${(stat.counts[ShiftType.LATE] / (daysInMonth - stat.counts[ShiftType.OFF])) * 100}%` }}
                          ></div>
                          <div 
                            className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" 
                            style={{ width: `${(stat.counts[ShiftType.NIGHT] / (daysInMonth - stat.counts[ShiftType.OFF])) * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: '白班', count: stat.counts[ShiftType.MORNING], color: 'text-blue-300' },
                          { label: '小夜', count: stat.counts[ShiftType.LATE], color: 'text-orange-300' },
                          { label: '大夜', count: stat.counts[ShiftType.NIGHT], color: 'text-indigo-300' },
                          { label: '休假', count: stat.counts[ShiftType.OFF], color: 'text-white/40' }
                        ].map((item, i) => (
                          <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5">
                            <p className="text-[9px] font-bold uppercase text-white/20 mb-1">{item.label}</p>
                            <p className={`text-xl font-mono font-bold ${item.color}`}>{item.count}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="max-w-[1600px] mx-auto px-8 py-12 border-t border-white/10 flex justify-between items-center text-white/20">
         <div className="flex flex-col gap-1">
           <span className="text-[10px] font-mono tracking-widest uppercase">SmartShift Dynamic Protocol</span>
           <span className="text-[9px] font-mono opacity-50 tracking-[0.3em]">AI-CORE-OPTIMIZED V10.4.B</span>
         </div>
         <span className="text-[10px] font-mono tracking-widest uppercase">© 2024 Design by FrostedGlass UI</span>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          header, aside, .month-navigation, footer { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
          #app-container { background: white !important; color: black !important; }
          #schedule-table { zoom: 0.7 !important; }
          #schedule-table th, #schedule-table td { background: white !important; color: black !important; border-color: #eee !important; }
          .sticky { position: static !important; }
          .backdrop-blur-3xl { backdrop-filter: none !important; background: white !important; border: 1px solid #eee !important; }
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}} />
    </div>
  );
}

