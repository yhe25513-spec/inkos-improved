import * as React from "react";
import { cn } from "../../lib/utils";

interface WritingEditorProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** 显示字数统计 */
  showWordCount?: boolean;
  /** 显示行号 */
  showLineNumbers?: boolean;
  /** 专注模式 */
  focusMode?: boolean;
  /** 退出专注模式 */
  onExitFocus?: () => void;
  /** 自动保存状态 */
  autoSaveStatus?: "saving" | "saved" | "error";
}

const WritingEditor = React.forwardRef<HTMLTextAreaElement, WritingEditorProps>(
  (
    {
      className,
      showWordCount = true,
      showLineNumbers = false,
      focusMode = false,
      onExitFocus,
      autoSaveStatus,
      value,
      onChange,
      ...props
    },
    ref,
  ) => {
    const [wordCount, setWordCount] = React.useState(0);
    const [charCount, setCharCount] = React.useState(0);

    React.useEffect(() => {
      if (typeof value === "string") {
        const text = value;
        setCharCount(text.length);
        // 简单的中文字数统计
        const chineseChars = (text.match(/[一-鿿]/g) || []).length;
        const englishWords = text.replace(/[一-鿿]/g, " ").split(/\s+/).filter(Boolean).length;
        setWordCount(chineseChars + englishWords);
      }
    }, [value]);

    if (focusMode) {
      return (
        <div className="focus-mode">
          <div className="focus-mode-header fixed top-0 left-0 right-0 p-4 flex justify-between items-center bg-background/80 backdrop-blur-sm z-10">
            <span className="text-sm text-muted-foreground">专注模式</span>
            <div className="flex items-center gap-4">
              {showWordCount && (
                <span className="text-sm text-muted-foreground">
                  {wordCount} 字
                </span>
              )}
              <button
                onClick={onExitFocus}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                退出专注模式 (ESC)
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center pt-16 pb-8 px-8">
            <textarea
              ref={ref}
              value={value}
              onChange={onChange}
              className={cn(
                "writing-editor w-full max-w-3xl h-full bg-transparent border-none outline-none resize-none",
                "text-foreground placeholder:text-muted-foreground/30",
                className,
              )}
              placeholder="开始写作..."
              {...props}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="relative flex flex-col h-full">
        <textarea
          ref={ref}
          value={value}
          onChange={onChange}
          className={cn(
            "writing-editor flex-1 w-full bg-transparent border-none outline-none resize-none p-4",
            "text-foreground placeholder:text-muted-foreground/50",
            showLineNumbers && "pl-12",
            className,
          )}
          placeholder="开始写作..."
          {...props}
        />

        {/* 底部状态栏 */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-border/30 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            {showWordCount && (
              <span>{wordCount} 字 / {charCount} 字符</span>
            )}
            {autoSaveStatus && (
              <span
                className={cn(
                  "flex items-center gap-1",
                  autoSaveStatus === "saving" && "text-yellow-500",
                  autoSaveStatus === "saved" && "text-green-500",
                  autoSaveStatus === "error" && "text-red-500",
                )}
              >
                {autoSaveStatus === "saving" && "⟳ 保存中..."}
                {autoSaveStatus === "saved" && "✓ 已保存"}
                {autoSaveStatus === "error" && "✕ 保存失败"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground/50">Markdown</span>
          </div>
        </div>
      </div>
    );
  },
);
WritingEditor.displayName = "WritingEditor";

export { WritingEditor };
export type { WritingEditorProps };
