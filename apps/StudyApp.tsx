import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOS } from '../context/OSContext';
import { DB } from '../utils/db';
import { CharacterProfile } from '../types';
import { ContextBuilder } from '../utils/context';
import { safeResponseJson } from '../utils/safeApi';
import Modal from '../components/os/Modal';

// ─── Types ────────────────────────────────────────────────────────
interface PomodoroSession {
  id: string;
  task: string;
  duration: number; // minutes
  charId: string;
  charName: string;
  completed: boolean;
  startedAt: number;
  endedAt?: number;
  imageUrl?: string;
}

type ViewMode = 'setup' | 'running' | 'break' | 'completed' | 'history';

const TIME_OPTIONS = [
  { label: '15 分钟', value: 15 },
  { label: '25 分钟', value: 25 },
  { label: '45 分钟', value: 45 },
  { label: '60 分钟', value: 60 },
];

const BREAK_TIME = 5 * 60; // 5 minutes in seconds

// ─── Circular Progress Component ──────────────────────────────────
const CircularProgress: React.FC<{
  progress: number; // 0-1
  size: number;
  strokeWidth: number;
  children?: React.ReactNode;
}> = ({ progress, size, strokeWidth, children }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="url(#timerGradient)"
          strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
        <defs>
          <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f6d365" />
            <stop offset="100%" stopColor="#fda085" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────
const StudyApp: React.FC = () => {
  const { closeApp, characters, activeCharacterId, apiConfig, addToast, userProfile, ttsConfig, updateCharacter } = useOS();

  // ── Navigation ──
  const [mode, setMode] = useState<ViewMode>('setup');

  // ── Setup State ──
  const [taskInput, setTaskInput] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(25);
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('30');
  const [selectedChar, setSelectedChar] = useState<CharacterProfile | null>(null);

  // ── Running State ──
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [generatedImage, setGeneratedImage] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentSessionRef = useRef<PomodoroSession | null>(null);

  // ── Chat State ──
  const [chatMessages, setChatMessages] = useState<Array<{role: string; content: string}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── History ──
  const [history, setHistory] = useState<PomodoroSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // ── TTS ──
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentSprite = selectedChar?.sprites?.['normal'] || selectedChar?.avatar;

  // ── Init ──
  useEffect(() => {
    if (activeCharacterId) {
      const char = characters.find(c => c.id === activeCharacterId) || characters[0];
      setSelectedChar(char);
    }
    loadHistory();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ── History ──
  const loadHistory = async () => {
    try {
      const stored = localStorage.getItem('pomodoro_history');
      if (stored) setHistory(JSON.parse(stored));
    } catch { /* ignore */ }
  };

  const saveToHistory = (session: PomodoroSession) => {
    const updated = [session, ...history].slice(0, 50);
    setHistory(updated);
    localStorage.setItem('pomodoro_history', JSON.stringify(updated));
  };

  // ── Timer Logic ──
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ── Save to Vector Memory ──
  const saveToVectorMemory = async (task: string, duration: number, charId: string, charName: string) => {
    if (!apiConfig.apiKey) return;
    try {
      const memoryText = `${charName}陪伴用户完成了番茄钟专注学习，任务是"${task}"，专注时长${duration}分钟。`;
      const embeddingRes = await fetch(`${apiConfig.baseUrl.replace(/\/$/, '')}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` },
        body: JSON.stringify({ model: apiConfig.model.includes('bge') ? apiConfig.model : 'text-embedding-3-small', input: memoryText })
      });
      const embData = await embeddingRes.json();
      const embedding = embData.data?.[0]?.embedding;
      if (embedding) {
        await DB.saveVectorMemory(charId, memoryText, { source: 'pomodoro', task, duration, charName }, embedding);
      }
    } catch (e) { console.warn('Vector memory save failed:', e); }
  };

  // ── AI Image Generation ──
  const generateSceneImage = async (task: string, charName: string) => {
    if (!apiConfig.apiKey || !apiConfig.baseUrl) return;
    setIsGeneratingImage(true);
    try {
      const promptRes = await fetch(`${apiConfig.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` },
        body: JSON.stringify({
          model: apiConfig.model,
          messages: [{ role: 'user', content: `将以下学习场景描述转化为一个精美的插画场景提示词（英文，50词以内）：\n\n任务：${task}\n角色：${charName}在陪伴学习\n\n要求：柔和暖色调、温馨治愈、动漫风格、适合手机壁纸` }],
          max_tokens: 200,
        })
      });
      const promptData = await safeResponseJson(promptRes);
      const imagePrompt = promptData.choices?.[0]?.message?.content || `${charName} studying together, warm cozy room, soft lighting, anime style, pastel colors, kawaii`;

      const imgRes = await fetch(`${apiConfig.baseUrl.replace(/\/$/, '')}/images/generations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: imagePrompt,
          n: 1,
          size: '1024x1024',
        })
      });
      const imgData = await safeResponseJson(imgRes);
      const imageUrl = imgData.data?.[0]?.url;
      if (imageUrl) {
        setGeneratedImage(imageUrl);
        if (currentSessionRef.current) {
          currentSessionRef.current.imageUrl = imageUrl;
        }
      }
    } catch (e) {
      console.warn('Image generation failed:', e);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // ── AI Chat ──
  const sendChatMessage = async (message: string) => {
    if (!message.trim() || !selectedChar || !apiConfig.apiKey) return;
    const userMsg = message.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatLoading(true);

    try {
      const context = ContextBuilder.buildCoreContext(selectedChar, userProfile, true);
      const taskInfo = currentSessionRef.current
        ? `User is currently studying: "${currentSessionRef.current.task}". ${Math.floor(timeLeft / 60)} minutes remaining.`
        : '';

      const prompt = `${context}\n\n### [System: Pomodoro Study Companion]\nYou are ${selectedChar.name}, a study companion. The user is studying right now.\n${taskInfo}\n- Keep responses SHORT (1-2 sentences max)\n- Be encouraging and warm\n- Stay in character\n- Use casual, friendly language\n\nUser: ${userMsg}`;

      const res = await fetch(`${apiConfig.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` },
        body: JSON.stringify({
          model: apiConfig.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
          max_tokens: 200,
        })
      });
      const data = await safeResponseJson(res);
      const reply = data.choices?.[0]?.message?.content || '加油哦～';
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      speakText(reply);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '嗯...我卡住了，你自己先加油！' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // ── TTS ──
  const speakText = async (text: string) => {
    if (!ttsConfig?.apiKey || !ttsConfig?.baseUrl) return;
    try {
      const res = await fetch(`${ttsConfig.baseUrl}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ttsConfig.groupId};${ttsConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: ttsConfig.model || 'speech-2.8-hd',
          text,
          voice_setting: ttsConfig.voiceSetting || { voice_id: 'audiobook_female_1', speed: 1, vol: 1, pitch: 0 },
          audio_setting: ttsConfig.audioSetting || { format: 'mp3', sample_rate: 32000, bitrate: 128000, channel: 1 },
        })
      });
      const data = await res.json();
      if (data.audio?.url) {
        if (audioRef.current) audioRef.current.pause();
        audioRef.current = new Audio(data.audio.url);
        audioRef.current.play();
      }
    } catch { /* TTS failed silently */ }
  };

  // ── Start / Pause / Resume / Give Up ──
  const handleStart = () => {
    if (!taskInput.trim()) { addToast('请输入学习任务', 'error'); return; }
    if (!selectedChar) { addToast('请选择陪伴角色', 'error'); return; }
    const durationMinutes = isCustomTime ? (parseInt(customMinutes) || 25) : selectedDuration;
    if (durationMinutes < 1 || durationMinutes > 180) { addToast('请输入1-180分钟的时长', 'error'); return; }
    const seconds = durationMinutes * 60;
    setTotalTime(seconds);
    setTimeLeft(seconds);
    setIsPaused(false);
    setIsBreak(false);
    setChatMessages([]);
    setGeneratedImage('');
    setShowChat(false);

    const session: PomodoroSession = {
      id: `pom-${Date.now()}`,
      task: taskInput.trim(),
      duration: durationMinutes,
      charId: selectedChar.id,
      charName: selectedChar.name,
      completed: false,
      startedAt: Date.now(),
    };
    currentSessionRef.current = session;
    setMode('running');
    saveToVectorMemory(taskInput.trim(), durationMinutes, selectedChar.id, selectedChar.name);
    startTimer();
    sendChatMessage('我开始学习了！');
    generateSceneImage(taskInput.trim(), selectedChar.name);
  };

  const handlePause = () => {
    setIsPaused(true);
    stopTimer();
  };

  const handleResume = () => {
    setIsPaused(false);
    startTimer();
  };

  const handleGiveUp = () => {
    stopTimer();
    const session = currentSessionRef.current;
    if (session && !session.completed) {
      const abandoned = { ...session, completed: false, endedAt: Date.now() };
      saveToHistory(abandoned);
    }
    setMode('setup');
    setTimeLeft(0);
    setGeneratedImage('');
    setChatMessages([]);
  };

  // ── Cleanup ──
  useEffect(() => {
    return () => { stopTimer(); if (audioRef.current) audioRef.current.pause(); };
  }, []);

  // ── Timer Complete ──
  useEffect(() => {
    if (timeLeft === 0 && totalTime > 0 && mode === 'running') {
      stopTimer();
      const session = currentSessionRef.current;
      if (session) {
        const completed = { ...session, completed: true, endedAt: Date.now() };
        currentSessionRef.current = completed;
        saveToHistory(completed);
      }
      setIsBreak(true);
      setTimeLeft(BREAK_TIME);
      setTotalTime(BREAK_TIME);
      setMode('break');
      speakText('专注时间结束！休息一下吧。');
      startTimer();
    } else if (timeLeft === 0 && totalTime > 0 && mode === 'break') {
      stopTimer();
      setIsBreak(false);
      setMode('completed');
      speakText('休息结束！要继续学习吗？');
    }
  }, [timeLeft, totalTime, mode, stopTimer, startTimer]);

  // ── Format Time ──
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ═══════════════════════════════════════════════════════════════════
  //  RENDER: SETUP VIEW
  // ═══════════════════════════════════════════════════════════════════
  if (mode === 'setup') {
    return (
      <div className="h-full w-full bg-[#fdfbf7] flex flex-col font-sans relative">
        <div className="sully-safe-topbar h-20 bg-[#fdfbf7]/90 backdrop-blur-md flex items-end pb-3 px-6 border-b border-[#e5e5e5] shrink-0 sticky top-0 z-20">
          <div className="flex justify-between items-center w-full">
            <button onClick={closeApp} className="p-2 -ml-2 rounded-full hover:bg-black/5 active:scale-90 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-600"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            </button>
            <span className="font-bold text-slate-800 text-lg tracking-wide">番茄钟</span>
            <button onClick={() => setShowHistory(true)} className="p-2 -mr-2 rounded-full hover:bg-black/5 active:scale-90 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-600"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-6 space-y-6">
          <section>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">今天要做什么？</label>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <input type="text" value={taskInput} onChange={e => setTaskInput(e.target.value)} placeholder="例如：写一篇论文、背单词、读一章书..." className="w-full text-sm text-slate-800 placeholder:text-slate-300 outline-none bg-transparent" />
            </div>
          </section>

          <section>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">专注时长</label>
            <div className="grid grid-cols-5 gap-3">
              {TIME_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => { setSelectedDuration(opt.value); setIsCustomTime(false); }} className={`py-3 px-1 rounded-2xl text-xs font-bold transition-all ${selectedDuration === opt.value && !isCustomTime ? 'bg-gradient-to-br from-amber-400 to-orange-400 text-white shadow-lg shadow-orange-200 scale-105' : 'bg-white text-slate-500 border border-slate-200 hover:border-amber-300'}`}>
                  {opt.label}
                </button>
              ))}
              <button onClick={() => setIsCustomTime(true)} className={`py-3 px-1 rounded-2xl text-xs font-bold transition-all ${isCustomTime ? 'bg-gradient-to-br from-amber-400 to-orange-400 text-white shadow-lg shadow-orange-200 scale-105' : 'bg-white text-slate-500 border border-slate-200 hover:border-amber-300'}`}>
                自定义
              </button>
            </div>
            {isCustomTime && (
              <div className="mt-3 flex items-center gap-3 bg-white rounded-2xl border border-slate-200 p-3 shadow-sm">
                <input type="number" value={customMinutes} onChange={e => setCustomMinutes(e.target.value)} min="1" max="180" className="w-20 text-center text-sm font-bold text-slate-800 outline-none bg-slate-50 rounded-xl py-2" />
                <span className="text-xs text-slate-400">分钟</span>
              </div>
            )}
          </section>

          <section>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">选择陪伴角色</label>
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory">
              {characters.map(char => (
                <button key={char.id} onClick={() => setSelectedChar(char)} className={`snap-start flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl transition-all min-w-[80px] ${selectedChar?.id === char.id ? 'bg-white shadow-md ring-2 ring-amber-400' : 'bg-white/50 border border-slate-100'}`}>
                  <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-white shadow-sm"><img src={char.avatar} alt={char.name} className="w-full h-full object-cover" /></div>
                  <span className={`text-[10px] font-bold ${selectedChar?.id === char.id ? 'text-amber-600' : 'text-slate-500'}`}>{char.name}</span>
                </button>
              ))}
            </div>
          </section>

          <button onClick={handleStart} disabled={!taskInput.trim() || !selectedChar} className="w-full py-4 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold text-sm rounded-2xl shadow-lg shadow-orange-200 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed">开始学习 ✦</button>
        </div>

        {showHistory && (
          <Modal title="学习记录" onClose={() => setShowHistory(false)} footer={null}>
            <div className="max-h-[60vh] overflow-y-auto no-scrollbar space-y-3">
              {history.length === 0 ? (
                <p className="text-center text-slate-400 text-xs py-8">还没有学习记录，快去开启第一个番茄钟吧～</p>
              ) : (
                history.map(h => (
                  <div key={h.id} className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${h.completed ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}`}>{h.completed ? '✓' : '✗'}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{h.task}</p>
                      <p className="text-[10px] text-slate-400">{h.charName} · {h.duration}分钟 · {new Date(h.startedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  RENDER: RUNNING / BREAK VIEW
  // ═══════════════════════════════════════════════════════════════════
  if (mode === 'running' || mode === 'break') {
    const progress = totalTime > 0 ? (totalTime - timeLeft) / totalTime : 0;

    return (
      <div className="h-full w-full bg-gradient-to-br from-[#2d1f3d] via-[#1a1a2e] to-[#16213e] flex flex-col relative overflow-hidden font-sans">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white/5 animate-float-particle" style={{ width: `${8 + i * 4}px`, height: `${8 + i * 4}px`, left: `${15 + i * 15}%`, top: `${20 + (i % 3) * 25}%`, animationDelay: `${i * 0.7}s`, animationDuration: `${4 + i}s` }} />
          ))}
        </div>

        <div className="sully-safe-floating-top absolute top-0 w-full p-4 flex justify-between z-30">
          <button onClick={handleGiveUp} className="bg-white/10 text-white/60 p-2 rounded-full backdrop-blur-md hover:bg-white/20 transition-colors border border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="bg-white/10 text-white/70 px-4 py-1.5 rounded-full backdrop-blur-md text-[10px] font-bold border border-white/5">
            {mode === 'running' ? '专注中' : '休息中'} · {currentSessionRef.current?.task}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6">
          <CircularProgress progress={progress} size={220} strokeWidth={8}>
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold text-white tabular-nums tracking-tight">{formatTime(timeLeft)}</span>
              <span className="text-[10px] text-white/40 mt-1 tracking-widest uppercase">{isPaused ? '已暂停' : mode === 'running' ? 'Focus' : 'Break'}</span>
            </div>
          </CircularProgress>

          <div className="mt-6 w-full max-w-[240px] aspect-square rounded-2xl overflow-hidden shadow-2xl shadow-black/30 border border-white/10 relative">
            {isGeneratingImage ? (
              <div className="w-full h-full bg-white/5 flex flex-col items-center justify-center gap-2 animate-pulse">
                <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] text-white/40">正在生成学习场景...</span>
              </div>
            ) : generatedImage ? (
              <img src={generatedImage} alt="学习场景" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-amber-400/20 to-rose-400/20 flex items-center justify-center">
                {currentSprite && <img src={currentSprite} alt="角色" className="h-[80%] object-contain drop-shadow-lg" />}
              </div>
            )}
            {generatedImage && currentSprite && <img src={currentSprite} alt="角色" className="absolute bottom-0 right-0 h-[50%] object-contain drop-shadow-lg" />}
          </div>

          <p className="mt-4 text-xs text-white/50 text-center max-w-[200px] truncate">{currentSessionRef.current?.task}</p>
        </div>

        <button onClick={() => setShowChat(!showChat)} className="absolute bottom-24 right-4 z-30 w-11 h-11 bg-white/15 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:bg-white/25 transition-colors shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-white/70"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337L5.25 21l.587-2.288A8.247 8.247 0 0 1 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" /></svg>
        </button>

        {showChat && (
          <div className="absolute inset-x-0 bottom-0 z-40 bg-[#1a1a2e]/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl flex flex-col" style={{ height: '55%' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                {selectedChar && <><img src={selectedChar.avatar} alt="" className="w-6 h-6 rounded-full" /><span className="text-xs font-bold text-white/80">{selectedChar.name}</span></>}
              </div>
              <button onClick={() => setShowChat(false)} className="text-white/40 hover:text-white/80 text-xs">收起</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 no-scrollbar">
              {chatMessages.length === 0 && <p className="text-center text-white/20 text-[11px] py-4">和角色聊聊天吧～</p>}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-[11px] leading-relaxed ${msg.role === 'user' ? 'bg-amber-500/80 text-white rounded-br-md' : 'bg-white/10 text-white/90 rounded-bl-md'}`}>{msg.content}</div>
                </div>
              ))}
              {isChatLoading && <div className="flex justify-start"><div className="bg-white/10 px-3 py-2 rounded-2xl rounded-bl-md"><div className="flex gap-1"><div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} /><div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} /><div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} /></div></div></div>}
              <div ref={chatEndRef} />
            </div>
            <div className="px-4 py-3 border-t border-white/5 flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChatMessage(chatInput)} placeholder="说点什么..." className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/20 outline-none border border-white/5 focus:border-amber-400/50" />
              <button onClick={() => sendChatMessage(chatInput)} disabled={!chatInput.trim() || isChatLoading} className="bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-30">发送</button>
            </div>
          </div>
        )}

        <div className="absolute bottom-0 w-full p-4 z-30 pb-safe">
          <div className="flex justify-center gap-4">
            {isPaused ? (
              <button onClick={handleResume} className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-900/30 active:scale-95 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-7 h-7"><path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>
              </button>
            ) : (
              <button onClick={handlePause} className="w-16 h-16 bg-white/15 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:bg-white/25 active:scale-95 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-7 h-7"><path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" /></svg>
              </button>
            )}
          </div>
        </div>

        <style>{`@keyframes float-particle {0%,100%{transform:translateY(0)}50%{transform:translateY(-15px)}} .animate-float-particle{animation:float-particle 4s ease-in-out infinite}`}</style>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  RENDER: COMPLETED VIEW
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="h-full w-full bg-gradient-to-br from-[#fdfbf7] to-[#fff5eb] flex flex-col font-sans relative">
      <div className="sully-safe-topbar h-20 bg-transparent flex items-end pb-3 px-6 shrink-0 sticky top-0 z-20">
        <div className="flex justify-between items-center w-full">
          <button onClick={closeApp} className="p-2 -ml-2 rounded-full hover:bg-black/5 active:scale-90 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-600"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
          </button>
          <span className="font-bold text-slate-800 text-lg tracking-wide">太棒了！</span>
          <div className="w-8" />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center shadow-xl shadow-orange-200 mb-6">
          {selectedChar ? (
            <img src={selectedChar.sprites?.['happy'] || selectedChar.avatar} alt="" className="h-[80%] object-contain" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-14 h-14"><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" /></svg>
          )}
        </div>

        <h2 className="text-2xl font-bold text-slate-800 mb-2">专注完成！</h2>
        <p className="text-sm text-slate-500 mb-6 text-center">{selectedChar?.name || '角色'} 陪你完成了 {currentSessionRef.current?.duration || (isCustomTime ? parseInt(customMinutes) || 25 : selectedDuration)} 分钟的专注学习</p>

        <div className="w-full bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-500">{currentSessionRef.current?.duration || (isCustomTime ? parseInt(customMinutes) || 25 : selectedDuration)}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">专注分钟</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-500">{history.filter(h => h.completed).length}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">今日完成</p>
            </div>
          </div>
        </div>

        {generatedImage && (
          <div className="w-full max-w-[200px] aspect-square rounded-2xl overflow-hidden border border-slate-100 mb-6 shadow-sm">
            <img src={generatedImage} alt="学习场景" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="w-full space-y-3">
          <button onClick={() => { setMode('setup'); setTimeLeft(0); setGeneratedImage(''); setChatMessages([]); }} className="w-full py-4 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold text-sm rounded-2xl shadow-lg shadow-orange-200 active:scale-[0.98] transition-all">再来一个番茄钟 ✦</button>
          <button onClick={closeApp} className="w-full py-3 bg-slate-100 text-slate-500 font-bold text-sm rounded-2xl active:scale-[0.98] transition-all">回到桌面</button>
        </div>
      </div>
    </div>
  );
};

export default StudyApp;
