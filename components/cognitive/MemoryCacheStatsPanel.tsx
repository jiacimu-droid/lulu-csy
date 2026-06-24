import React, { useState, useEffect, useCallback } from 'react';
import { DB } from '../../utils/db';
import { findCharacterByAnyId } from '../../utils/cognitiveNetworkCharacterStats';
import type { CharacterProfile } from '../../types';

interface CacheStats {
  totalMemories: number;
  charBreakdown: {
    charId: string;
    charName: string;
    count: number;
    avgImportance: number;
    avgMentions: number;
    recentlyMentioned: number;
    highImportance: number;
  }[];
  overall: {
    avgImportance: number;
    avgMentions: number;
    neverMentioned: number;
    highImportanceCount: number;
    totalChars: number;
  };
}

interface MemoryCacheStatsPanelProps {
  characters: CharacterProfile[];
  selectedCharId: string | null;
}

const MemoryCacheStatsPanel: React.FC<MemoryCacheStatsPanelProps> = ({
  characters,
  selectedCharId,
}) => {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const targetChars = selectedCharId
        ? characters.filter((c) => c.id === selectedCharId)
        : characters;

      let totalMemories = 0;
      const charBreakdown: CacheStats['charBreakdown'] = [];
      let totalImportance = 0;
      let totalMentions = 0;
      let neverMentioned = 0;
      let highImportanceCount = 0;

      for (const char of targetChars) {
        const headers = await DB.getVectorMemoryHeaders(char.id);
        const count = headers.length;
        if (count === 0) continue;

        const avgImportance =
          count > 0
            ? headers.reduce((s, h) => s + (h.importance || 0), 0) / count
            : 0;
        const avgMentions =
          count > 0
            ? headers.reduce((s, h) => s + (h.mentionCount || 0), 0) / count
            : 0;
        const recentlyMentioned = headers.filter(
          (h) =>
            h.lastMentioned &&
            Date.now() - h.lastMentioned < 7 * 24 * 60 * 60 * 1000
        ).length;
        const charHighImportance = headers.filter(
          (h) => (h.importance || 0) >= 0.7
        ).length;

        totalMemories += count;
        totalImportance += headers.reduce((s, h) => s + (h.importance || 0), 0);
        totalMentions += headers.reduce((s, h) => s + (h.mentionCount || 0), 0);
        neverMentioned += headers.filter(
          (h) => !(h.mentionCount || 0)
        ).length;
        highImportanceCount += charHighImportance;

        charBreakdown.push({
          charId: char.id,
          charName: char.name,
          count,
          avgImportance: Math.round(avgImportance * 100) / 100,
          avgMentions: Math.round(avgMentions * 100) / 100,
          recentlyMentioned,
          highImportance: charHighImportance,
        });
      }

      setStats({
        totalMemories,
        charBreakdown,
        overall: {
          avgImportance:
            totalMemories > 0
              ? Math.round((totalImportance / totalMemories) * 100) / 100
              : 0,
          avgMentions:
            totalMemories > 0
              ? Math.round((totalMentions / totalMemories) * 100) / 100
              : 0,
          neverMentioned,
          highImportanceCount,
          totalChars: targetChars.length,
        },
      });
    } catch (e) {
      console.warn('[CacheStats] 加载失败:', e);
    } finally {
      setLoading(false);
    }
  }, [characters, selectedCharId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (!stats && !loading) return null;

  return (
    <section className="relative overflow-hidden rounded-[14px] border border-[#d4af37]/18 bg-[#151319] p-4 shadow-[0_16px_34px_rgba(0,0,0,0.36),0_1px_0_rgba(255,255,255,0.07)_inset]">
      <div className="absolute inset-px rounded-[13px] border border-white/[0.035] pointer-events-none" />
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#fff1bd]/34 to-transparent" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[10px] text-[#e5d08f]/88 tracking-[0.2em] font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e5d08f] shadow-[0_0_8px_rgba(229,208,143,0.52)]" />
              缓存统计
            </div>
            <p className="mt-2 text-[12px] text-[#FFFBF7]/66 leading-relaxed">
              {selectedCharId
                ? `${
                    findCharacterByAnyId(characters, selectedCharId)?.name || ''
                  } 的向量记忆缓存状态`
                : '所有角色的向量记忆缓存状态'}
            </p>
          </div>
          <div className="shrink-0 flex gap-2">
            <button
              onClick={loadStats}
              disabled={loading}
              className="rounded-full border border-[#e5d08f]/18 bg-[#FFFBF7]/[0.92] px-3 py-1.5 text-[10px] font-bold text-[#17151B] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '刷新中...' : '刷新'}
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-[10px] font-semibold text-white/48 transition-all hover:bg-white/[0.08]"
            >
              {expanded ? '收起' : '展开'}
            </button>
          </div>
        </div>

        {loading && !stats ? (
          <div className="mt-4 space-y-2">
            <div className="h-[54px] animate-pulse rounded-[9px] border border-white/[0.045] bg-white/[0.035]" />
            <div className="h-[54px] animate-pulse rounded-[9px] border border-white/[0.045] bg-white/[0.035]" />
          </div>
        ) : stats ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="min-w-0 rounded-[10px] border border-white/[0.055] bg-white/[0.035] px-2.5 py-2">
                <div className="truncate text-[8px] text-white/28 tracking-[0.18em] font-semibold">
                  记忆总数
                </div>
                <div className="mt-1 truncate text-[13px] text-[#FFFBF7]/82 font-semibold">
                  {stats.totalMemories}
                </div>
              </div>
              <div className="min-w-0 rounded-[10px] border border-white/[0.055] bg-white/[0.035] px-2.5 py-2">
                <div className="truncate text-[8px] text-white/28 tracking-[0.18em] font-semibold">
                  平均重要度
                </div>
                <div className="mt-1 truncate text-[13px] text-[#FFFBF7]/82 font-semibold">
                  {stats.overall.avgImportance.toFixed(2)}
                </div>
              </div>
              <div className="min-w-0 rounded-[10px] border border-white/[0.055] bg-white/[0.035] px-2.5 py-2">
                <div className="truncate text-[8px] text-white/28 tracking-[0.18em] font-semibold">
                  平均被提及
                </div>
                <div className="mt-1 truncate text-[13px] text-[#FFFBF7]/82 font-semibold">
                  {stats.overall.avgMentions.toFixed(1)}
                </div>
              </div>
              <div className="min-w-0 rounded-[10px] border border-white/[0.055] bg-white/[0.035] px-2.5 py-2">
                <div className="truncate text-[8px] text-white/28 tracking-[0.18em] font-semibold">
                  高重要记忆
                </div>
                <div className="mt-1 truncate text-[13px] text-[#fff1bd]/82 font-semibold">
                  {stats.overall.highImportanceCount}
                </div>
              </div>
            </div>

            {stats.overall.neverMentioned > 0 && (
              <div className="mt-2 rounded-[10px] border border-[#d99aae]/18 bg-[#d99aae]/[0.055] px-3 py-2">
                <p className="text-[10px] text-[#ffdce8]/72">
                  {stats.overall.neverMentioned} 段记忆从未被检索到
                  （{stats.totalMemories > 0
                    ? Math.round(
                        (stats.overall.neverMentioned / stats.totalMemories) * 100
                      )
                    : 0}%
                  ）
                </p>
              </div>
            )}

            {expanded && stats.charBreakdown.length > 0 && (
              <div className="mt-3 space-y-2">
                {stats.charBreakdown.map((char) => (
                  <div
                    key={char.charId}
                    className="rounded-[10px] border border-white/[0.055] bg-white/[0.035] px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] font-semibold text-white/68">
                        {char.charName}
                      </span>
                      <span className="shrink-0 text-[10px] text-[#fff1bd]/62">
                        {char.count} 段
                      </span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 gap-1 text-[9px] text-white/36">
                      <span>重要度 {char.avgImportance}</span>
                      <span>提及 {char.avgMentions}次</span>
                      <span>近期活跃 {char.recentlyMentioned}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
};

export default MemoryCacheStatsPanel;
