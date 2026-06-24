import React, { useState, useEffect } from 'react';
import { useOS } from '../context/OSContext';
import { DB } from '../utils/db';
import { CharacterProfile } from '../types';
import Modal from '../components/os/Modal';

// ─── Types ────────────────────────────────────────────────────────
interface TodoItem {
  id: string;
  content: string;
  charIds: string[];
  frequency: 'once' | 'daily' | 'weekly';
  completed: boolean;
  createdAt: number;
  isStudyReminder?: boolean;
  lastRemindedAt?: number;
}

const STORAGE_KEY = 'lulu_todo_items';
const STUDY_REMINDER_KEY = 'lulu_study_reminder';

// ─── Main Component ───────────────────────────────────────────────
const TodoApp: React.FC = () => {
  const { closeApp, characters, addToast } = useOS();

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStudyReminderModal, setShowStudyReminderModal] = useState(false);

  // Form state
  const [todoContent, setTodoContent] = useState('');
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [selectedFreq, setSelectedFreq] = useState<'once' | 'daily' | 'weekly'>('once');

  // Study reminder state
  const [studyReminderEnabled, setStudyReminderEnabled] = useState(false);
  const [studyReminderChars, setStudyReminderChars] = useState<string[]>([]);
  const [studyReminderThreshold, setStudyReminderThreshold] = useState(120); // minutes

  // ── Load/Save ──
  useEffect(() => {
    loadTodos();
    loadStudyReminder();
  }, []);

  const loadTodos = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setTodos(JSON.parse(stored));
    } catch { /* ignore */ }
  };

  const saveTodos = (items: TodoItem[]) => {
    setTodos(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  };

  const loadStudyReminder = () => {
    try {
      const stored = localStorage.getItem(STUDY_REMINDER_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        setStudyReminderEnabled(data.enabled || false);
        setStudyReminderChars(data.charIds || []);
        setStudyReminderThreshold(data.threshold || 120);
      }
    } catch { /* ignore */ }
  };

  const saveStudyReminder = (data: { enabled: boolean; charIds: string[]; threshold: number }) => {
    localStorage.setItem(STUDY_REMINDER_KEY, JSON.stringify(data));
  };

  // ── CRUD ──
  const addTodo = () => {
    if (!todoContent.trim()) { addToast('请输入待办内容', 'error'); return; }

    const newTodo: TodoItem = {
      id: `todo-${Date.now()}`,
      content: todoContent.trim(),
      charIds: [...selectedCharIds],
      frequency: selectedFreq,
      completed: false,
      createdAt: Date.now(),
    };
    saveTodos([newTodo, ...todos]);

    // Reset form
    setTodoContent('');
    setSelectedCharIds([]);
    setSelectedFreq('once');
    setShowAddModal(false);
    addToast('待办已添加', 'success');
  };

  const toggleTodo = (id: string) => {
    const updated = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveTodos(updated);
  };

  const deleteTodo = (id: string) => {
    const updated = todos.filter(t => t.id !== id);
    saveTodos(updated);
  };

  const toggleStudyReminder = () => {
    const newState = !studyReminderEnabled;
    setStudyReminderEnabled(newState);
    saveStudyReminder({ enabled: newState, charIds: studyReminderChars, threshold: studyReminderThreshold });
    if (newState) {
      addToast('督促学习已开启', 'success');
      setShowStudyReminderModal(false);
    } else {
      addToast('督促学习已关闭', 'info');
    }
  };

  const updateStudyReminder = () => {
    saveStudyReminder({ enabled: studyReminderEnabled, charIds: studyReminderChars, threshold: studyReminderThreshold });
    setShowStudyReminderModal(false);
    addToast('督促学习设置已保存', 'success');
  };

  // ── Helpers ──
  const getCharNames = (charIds: string[]) => {
    return charIds.map(id => characters.find(c => c.id === id)?.name || '?').join('、');
  };

  const freqLabel = (freq: string) => {
    switch (freq) {
      case 'daily': return '每天';
      case 'weekly': return '每周';
      default: return '一次性';
    }
  };

  // ── Render ──
  return (
    <div className="h-full w-full bg-[#fdfbf7] flex flex-col font-sans relative">
      {/* Top Bar */}
      <div className="sully-safe-topbar h-20 bg-[#fdfbf7]/90 backdrop-blur-md flex items-end pb-3 px-6 border-b border-[#e5e5e5] shrink-0 sticky top-0 z-20">
        <div className="flex justify-between items-center w-full">
          <button onClick={closeApp} className="p-2 -ml-2 rounded-full hover:bg-black/5 active:scale-90 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-600"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
          </button>
          <span className="font-bold text-slate-800 text-lg tracking-wide">待办清单</span>
          <div className="flex gap-2 items-center">
            {/* Study reminder toggle */}
            <button
              onClick={() => setShowStudyReminderModal(true)}
              className={`p-2 rounded-full transition-transform active:scale-90 ${studyReminderEnabled ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:bg-black/5'}`}
              title="督促学习"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 1 15.482 0M12 3v18" />
              </svg>
            </button>
            <button 
              onClick={() => setShowAddModal(true)} 
              className="p-2 rounded-full hover:bg-black/5 active:scale-90 transition-transform text-slate-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-4">
        {/* Study Reminder Banner */}
        {studyReminderEnabled && (
          <div className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-amber-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-700">督促学习中</p>
              <p className="text-[10px] text-slate-400">
                {studyReminderChars.length > 0
                  ? `${getCharNames(studyReminderChars)} 会督促你学习`
                  : '请选择督促角色'}
                ，{studyReminderThreshold}分钟未学习将收到提醒
              </p>
            </div>
          </div>
        )}

        {/* Todo List */}
        {todos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-10 h-10 text-slate-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <p className="text-sm text-slate-400 mb-1">还没有待办事项</p>
            <p className="text-[11px] text-slate-300">点击右上角 + 添加第一个待办</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todos.map(todo => (
              <div
                key={todo.id}
                className={`bg-white rounded-2xl border p-4 shadow-sm transition-all ${todo.completed ? 'border-slate-100 opacity-60' : 'border-slate-200'}`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleTodo(todo.id)}
                    className={`w-6 h-6 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                      todo.completed
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 hover:border-amber-400'
                    }`}
                  >
                    {todo.completed && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${todo.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {todo.content}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                        {freqLabel(todo.frequency)}
                      </span>
                      {todo.charIds.length > 0 && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                          {getCharNames(todo.charIds)} 督促
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="p-1.5 rounded-full hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add Todo Modal ── */}
      <Modal title="添加待办" isOpen={showAddModal} onClose={() => setShowAddModal(false)} footer={null}>
        <div className="space-y-4">
          {/* Content Input */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">待办内容</label>
            <input
              type="text"
              value={todoContent}
              onChange={e => setTodoContent(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTodo(); }}
              placeholder="例如：背单词、写论文..."
              className="w-full bg-slate-100 rounded-xl p-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-400/50"
              autoFocus
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">频率</label>
            <div className="grid grid-cols-3 gap-2">
              {(['once', 'daily', 'weekly'] as const).map((value) => {
                const labels = { once: '一次性', daily: '每天', weekly: '每周' };
                return (
                  <button
                    key={value}
                    onClick={() => setSelectedFreq(value)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                      selectedFreq === value
                        ? 'bg-gradient-to-br from-amber-400 to-orange-400 text-white shadow-md'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {labels[value]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Character Selection (optional) */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
              督促角色 <span className="text-slate-300 font-normal">(可选)</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {characters.map(char => (
                <button
                  key={char.id}
                  onClick={() => {
                    setSelectedCharIds(prev =>
                      prev.includes(char.id) ? prev.filter(id => id !== char.id) : [...prev, char.id]
                    );
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                    selectedCharIds.includes(char.id)
                      ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <img src={char.avatar} alt="" className="w-4 h-4 rounded-full" />
                  {char.name}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={addTodo}
            disabled={!todoContent.trim()}
            className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold text-sm rounded-2xl shadow-lg shadow-orange-200 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            添加待办
          </button>
        </div>
      </Modal>

      {/* ── Study Reminder Modal ── */}
      <Modal title="督促学习" isOpen={showStudyReminderModal} onClose={() => setShowStudyReminderModal(false)} footer={null}>
        <div className="space-y-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4">
            <div>
              <p className="text-sm font-bold text-slate-800">开启督促学习</p>
              <p className="text-[11px] text-slate-400 mt-0.5">长时间未学习时，角色会主动提醒你</p>
            </div>
            <button
              onClick={toggleStudyReminder}
              className={`w-12 h-7 rounded-full transition-all relative ${studyReminderEnabled ? 'bg-amber-400' : 'bg-slate-200'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-1 transition-all ${studyReminderEnabled ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          {studyReminderEnabled && (
            <>
              {/* Threshold */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                  未学习提醒阈值（分钟）
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="30"
                    max="300"
                    step="10"
                    value={studyReminderThreshold}
                    onChange={e => setStudyReminderThreshold(parseInt(e.target.value))}
                    className="flex-1 accent-amber-400"
                  />
                  <span className="text-sm font-bold text-amber-600 w-12 text-right">{studyReminderThreshold}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {studyReminderThreshold < 60 ? '比较严格' : studyReminderThreshold < 120 ? '适中' : '比较宽松'}
                </p>
              </div>

              {/* Character Selection */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">督促角色</label>
                <div className="flex gap-2 flex-wrap">
                  {characters.map(char => (
                    <button
                      key={char.id}
                      onClick={() => {
                        setStudyReminderChars(prev =>
                          prev.includes(char.id) ? prev.filter(id => id !== char.id) : [...prev, char.id]
                        );
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                        studyReminderChars.includes(char.id)
                          ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      <img src={char.avatar} alt="" className="w-4 h-4 rounded-full" />
                      {char.name}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={updateStudyReminder}
                className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold text-sm rounded-2xl shadow-lg shadow-orange-200 active:scale-[0.98] transition-all"
              >
                保存设置
              </button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default TodoApp;
