import * as React from "react";
import { cn } from "../../lib/utils";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Code,
  Link,
  Image,
  Minus,
  Undo,
  Redo,
} from "lucide-react";

interface ToolbarProps {
  disabled?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onInsert?: (type: string, value?: string) => void;
  className?: string;
}

interface ToolbarButton {
  icon: React.ReactNode;
  label: string;
  action: string;
  shortcut?: string;
}

export function Toolbar({
  disabled = false,
  onUndo,
  onRedo,
  onInsert,
  className,
}: ToolbarProps) {
  const buttons: ToolbarButton[] = [
    { icon: <Bold size={16} />, label: "粗体", action: "bold", shortcut: "Ctrl+B" },
    { icon: <Italic size={16} />, label: "斜体", action: "italic", shortcut: "Ctrl+I" },
    { icon: <Underline size={16} />, label: "下划线", action: "underline", shortcut: "Ctrl+U" },
    { icon: <List size={16} />, label: "无序列表", action: "unordered-list" },
    { icon: <ListOrdered size={16} />, label: "有序列表", action: "ordered-list" },
    { icon: <Quote size={16} />, label: "引用", action: "quote" },
    { icon: <Code size={16} />, label: "代码", action: "code" },
    { icon: <Link size={16} />, label: "链接", action: "link" },
    { icon: <Image size={16} />, label: "图片", action: "image" },
    { icon: <Minus size={16} />, label: "分割线", action: "divider" },
  ];

  const handleClick = (action: string) => {
    if (disabled) return;
    onInsert?.(action);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1 p-2 border-b border-border/30 bg-card/50",
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
    >
      <div className="flex items-center gap-1 pr-2 border-r border-border/30">
        <button
          onClick={onUndo}
          disabled={disabled}
          className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-50"
          title="撤销 (Ctrl+Z)"
        >
          <Undo size={16} />
        </button>
        <button
          onClick={onRedo}
          disabled={disabled}
          className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-50"
          title="重做 (Ctrl+Y)"
        >
          <Redo size={16} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        {buttons.map((button) => (
          <button
            key={button.action}
            onClick={() => handleClick(button.action)}
            disabled={disabled}
            className={cn(
              "p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-50",
              "text-muted-foreground hover:text-foreground",
            )}
            title={button.shortcut ? `${button.label} (${button.shortcut})` : button.label}
          >
            {button.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Toolbar;
