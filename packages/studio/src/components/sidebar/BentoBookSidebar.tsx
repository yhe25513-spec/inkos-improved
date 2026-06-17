import * as React from "react";
import { cn } from "../../lib/utils";
import { BentoGrid, BentoItem } from "../ui/bento-grid";
import { StatCard } from "../ui/stat-card";
import { ProgressBar } from "../ui/progress-bar";
import { GlassCard } from "../ui/glass-card";
import {
  BookOpen,
  FileText,
  Users,
  Clock,
  TrendingUp,
  Plus,
} from "lucide-react";

interface BookStats {
  totalChapters: number;
  completedChapters: number;
  totalWords: number;
  characters: number;
  lastUpdated: string;
}

interface BentoBookSidebarProps {
  bookId: string;
  title: string;
  stats: BookStats;
  onNewChapter?: () => void;
  onViewAll?: () => void;
  className?: string;
}

export function BentoBookSidebar({
  bookId,
  title,
  stats,
  onNewChapter,
  onViewAll,
  className,
}: BentoBookSidebarProps) {
  const progress = stats.totalChapters > 0
    ? (stats.completedChapters / stats.totalChapters) * 100
    : 0;

  return (
    <div className={cn("w-80 h-full border-l border-border bg-card/50 p-4", className)}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-serif font-semibold text-foreground truncate">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          书籍详情
        </p>
      </div>

      {/* Bento Grid Layout */}
      <BentoGrid columns={2} gap="sm">
        {/* 总章节 */}
        <BentoItem>
          <StatCard
            value={stats.totalChapters}
            label="总章节"
            icon={<BookOpen size={20} />}
          />
        </BentoItem>

        {/* 已完成 */}
        <BentoItem>
          <StatCard
            value={stats.completedChapters}
            label="已完成"
            icon={<FileText size={20} />}
            trend={stats.completedChapters > 0 ? "up" : "neutral"}
            trendValue={`+${stats.completedChapters}`}
          />
        </BentoItem>

        {/* 总字数 */}
        <BentoItem>
          <StatCard
            value={formatWordCount(stats.totalWords)}
            label="总字数"
            icon={<TrendingUp size={20} />}
          />
        </BentoItem>

        {/* 角色数 */}
        <BentoItem>
          <StatCard
            value={stats.characters}
            label="角色数"
            icon={<Users size={20} />}
          />
        </BentoItem>

        {/* 进度条 - 跨两列 */}
        <BentoItem span={2}>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">写作进度</span>
              <span className="font-medium">{progress.toFixed(0)}%</span>
            </div>
            <ProgressBar value={progress} size="md" />
            <p className="text-xs text-muted-foreground">
              {stats.completedChapters} / {stats.totalChapters} 章
            </p>
          </div>
        </BentoItem>

        {/* 最近更新 */}
        <BentoItem span={2}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock size={14} />
            <span>最近更新: {stats.lastUpdated}</span>
          </div>
        </BentoItem>
      </BentoGrid>

      {/* Action Buttons */}
      <div className="mt-6 space-y-2">
        <button
          onClick={onNewChapter}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          <span>写新章节</span>
        </button>
        <button
          onClick={onViewAll}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg hover:bg-secondary transition-colors"
        >
          <span>查看全部</span>
        </button>
      </div>
    </div>
  );
}

function formatWordCount(words: number): string {
  if (words >= 10000) {
    return `${(words / 10000).toFixed(1)}万`;
  }
  return words.toLocaleString();
}

export default BentoBookSidebar;
