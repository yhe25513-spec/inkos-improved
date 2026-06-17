import { useState } from "react";

interface QuickCommand {
  readonly label: string;
  readonly command: string;
  readonly icon: string;
  readonly description: string;
  readonly color: string;
}

const QUICK_COMMANDS: ReadonlyArray<QuickCommand> = [
  {
    label: "写大纲",
    command: "/plan",
    icon: "📝",
    description: "生成章节大纲",
    color: "bg-blue-500 hover:bg-blue-600",
  },
  {
    label: "写正文",
    command: "/write",
    icon: "✍️",
    description: "写下一章",
    color: "bg-green-500 hover:bg-green-600",
  },
  {
    label: "修订",
    command: "/revise",
    icon: "🔧",
    description: "修订当前章节",
    color: "bg-red-500 hover:bg-red-600",
  },
  {
    label: "体检",
    command: "/health",
    icon: "🏥",
    description: "检查世界观健康",
    color: "bg-yellow-500 hover:bg-yellow-600",
  },
  {
    label: "存档",
    command: "/consolidate",
    icon: "💾",
    description: "整合章节状态",
    color: "bg-purple-500 hover:bg-purple-600",
  },
  {
    label: "检测",
    command: "/detect",
    icon: "🔍",
    description: "检测 AI 痕迹",
    color: "bg-orange-500 hover:bg-orange-600",
  },
  {
    label: "状态",
    command: "/status",
    icon: "📊",
    description: "查看书籍状态",
    color: "bg-gray-500 hover:bg-gray-600",
  },
  {
    label: "伏笔",
    command: "/hooks",
    icon: "🪝",
    description: "查看伏笔状态",
    color: "bg-pink-500 hover:bg-pink-600",
  },
  {
    label: "角色",
    command: "/characters",
    icon: "👥",
    description: "查看角色列表",
    color: "bg-indigo-500 hover:bg-indigo-600",
  },
];

interface QuickCommandsProps {
  readonly onCommand: (command: string) => void;
  readonly disabled?: boolean;
}

export function QuickCommands({ onCommand, disabled = false }: QuickCommandsProps) {
  const [hoveredCommand, setHoveredCommand] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap gap-2 p-3 border-b bg-muted/30">
      <span className="text-xs text-muted-foreground mr-2 self-center">快捷指令:</span>
      {QUICK_COMMANDS.map((cmd) => (
        <button
          key={cmd.command}
          onClick={() => onCommand(cmd.command)}
          onMouseEnter={() => setHoveredCommand(cmd.command)}
          onMouseLeave={() => setHoveredCommand(null)}
          disabled={disabled}
          className={[
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md text-white transition-all",
            cmd.color,
            disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:scale-105",
            hoveredCommand === cmd.command ? "ring-2 ring-offset-1 ring-primary/50" : "",
          ].join(" ")}
          title={cmd.description}
        >
          <span>{cmd.icon}</span>
          <span>{cmd.label}</span>
        </button>
      ))}
    </div>
  );
}

export { QUICK_COMMANDS };
