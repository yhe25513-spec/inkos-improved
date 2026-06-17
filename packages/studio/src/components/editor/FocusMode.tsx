import * as React from "react";
import { cn } from "../../lib/utils";

export interface FocusModeProps {
  children: React.ReactNode;
  /** 是否启用专注模式 */
  enabled?: boolean;
  /** 退出专注模式 */
  onExit?: () => void;
  /** 显示字数统计 */
  showWordCount?: boolean;
  /** 当前字数 */
  wordCount?: number;
  className?: string;
}

export function FocusMode({
  children,
  enabled = false,
  onExit,
  showWordCount = true,
  wordCount = 0,
  className,
}: FocusModeProps) {
  React.useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onExit?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onExit]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div className={cn("focus-mode", className)}>
      {/* 顶部工具栏 */}
      <div className="focus-mode-header fixed top-0 left-0 right-0 p-4 flex justify-between items-center bg-background/80 backdrop-blur-sm z-10">
        <span className="text-sm text-muted-foreground">专注模式</span>
        <div className="flex items-center gap-4">
          {showWordCount && (
            <span className="text-sm text-muted-foreground">
              {wordCount.toLocaleString()} 字
            </span>
          )}
          <button
            onClick={onExit}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            退出专注模式 (ESC)
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 flex items-center justify-center pt-16 pb-8 px-8">
        {children}
      </div>
    </div>
  );
}

export default FocusMode;
