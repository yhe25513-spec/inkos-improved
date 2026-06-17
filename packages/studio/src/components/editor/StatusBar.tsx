import * as React from "react";
import { cn } from "../../lib/utils";

export interface StatusBarProps {
  /** 当前章节号 */
  chapterNumber?: number;
  /** 总章节数 */
  totalChapters?: number;
  /** 字数 */
  wordCount?: number;
  /** AI内容占比 */
  aiPercentage?: number;
  /** 合规状态 */
  complianceStatus?: "pass" | "fail" | "warning" | "pending";
  /** 自动保存状态 */
  autoSaveStatus?: "saving" | "saved" | "error";
  /** 最后保存时间 */
  lastSaved?: string;
  className?: string;
}

export function StatusBar({
  chapterNumber,
  totalChapters,
  wordCount = 0,
  aiPercentage,
  complianceStatus = "pending",
  autoSaveStatus,
  lastSaved,
  className,
}: StatusBarProps) {
  const complianceConfig = {
    pass: { label: "合规", className: "text-green-500" },
    fail: { label: "未通过", className: "text-red-500" },
    warning: { label: "警告", className: "text-yellow-500" },
    pending: { label: "待检查", className: "text-muted-foreground" },
  };

  const saveConfig = {
    saving: { label: "保存中...", className: "text-yellow-500" },
    saved: { label: "已保存", className: "text-green-500" },
    error: { label: "保存失败", className: "text-red-500" },
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2 border-t border-border/30 text-xs text-muted-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        {/* 章节信息 */}
        {chapterNumber && totalChapters && (
          <span>
            第 {chapterNumber} / {totalChapters} 章
          </span>
        )}

        {/* 字数 */}
        <span>{wordCount.toLocaleString()} 字</span>

        {/* AI内容占比 */}
        {aiPercentage !== undefined && (
          <span
            className={cn(
              "flex items-center gap-1",
              aiPercentage > 0.5 ? "text-yellow-500" : "text-muted-foreground",
            )}
          >
            AI: {(aiPercentage * 100).toFixed(1)}%
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* 合规状态 */}
        <span className={complianceConfig[complianceStatus].className}>
          {complianceConfig[complianceStatus].label}
        </span>

        {/* 保存状态 */}
        {autoSaveStatus && (
          <span className={saveConfig[autoSaveStatus].className}>
            {saveConfig[autoSaveStatus].label}
          </span>
        )}

        {/* 最后保存时间 */}
        {lastSaved && (
          <span className="text-muted-foreground/50">
            {lastSaved}
          </span>
        )}
      </div>
    </div>
  );
}

export default StatusBar;
