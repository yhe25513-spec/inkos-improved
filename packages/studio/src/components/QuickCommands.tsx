import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import {
  ChevronDown,
  Users,
  BookOpen,
  LineChart,
  Sparkles,
  FileSearch,
  Database,
  Save,
  AlertTriangle,
  Palette,
  Wrench,
} from "lucide-react";

interface QuickCommand {
  readonly label: string;
  readonly command: string;
  readonly icon: string | React.ReactNode;
  readonly description: string;
}

// 角色 & 设定 — 用于了解世界与人物
const CHARACTER_COMMANDS: ReadonlyArray<QuickCommand> = [
  {
    label: "角色",
    command: "查看所有角色信息",
    icon: <Users size={14} />,
    description: "查看角色列表和说话风格",
  },
  {
    label: "伏笔",
    command: "查看所有伏笔状态",
    icon: <AlertTriangle size={14} />,
    description: "查看伏笔回收与未回收状态",
  },
  {
    label: "世界观",
    command: "检查世界观一致性",
    icon: <BookOpen size={14} />,
    description: "检查世界观健康度与一致性",
  },
];

// 质量检查 — 用于审核与检测
const QUALITY_COMMANDS: ReadonlyArray<QuickCommand> = [
  {
    label: "体检",
    command: "检查书籍健康状态",
    icon: <Sparkles size={14} />,
    description: "整体健康检查",
  },
  {
    label: "检测",
    command: "检查 AI 写作痕迹",
    icon: <FileSearch size={14} />,
    description: "检测 AI 痕迹",
  },
  {
    label: "状态",
    command: "查看书籍状态",
    icon: <LineChart size={14} />,
    description: "查看章节与质量状态",
  },
];

// 数据管理 — 导出和存档
const DATA_COMMANDS: ReadonlyArray<QuickCommand> = [
  {
    label: "存档",
    command: "整合章节状态",
    icon: <Save size={14} />,
    description: "整合归档",
  },
  {
    label: "实体",
    command: "查看提取到的实体",
    icon: <Database size={14} />,
    description: "查看角色/地点/组织等实体",
  },
];

// 叙事编排 — 风格配置
const NARRATIVE_COMMANDS: ReadonlyArray<QuickCommand> = [
  {
    label: "经典叙事",
    command: "切换到经典叙事风格",
    icon: <Palette size={14} />,
    description: "传统小说叙事风格",
  },
  {
    label: "黑暗奇幻",
    command: "切换到黑暗奇幻叙事风格",
    icon: <Palette size={14} />,
    description: "黑暗压抑的奇幻风格",
  },
  {
    label: "电影风格",
    command: "切换到电影风格叙事",
    icon: <Palette size={14} />,
    description: "电影化叙事，注重视觉冲击",
  },
  {
    label: "极简风格",
    command: "切换到极简叙事风格",
    icon: <Palette size={14} />,
    description: "简洁精炼，强调留白",
  },
];

// 自定义技能
const SKILLS_COMMANDS: ReadonlyArray<QuickCommand> = [
  {
    label: "查看技能",
    command: "列出所有可用的自定义技能",
    icon: <Wrench size={14} />,
    description: "查看内置和自定义技能",
  },
];

const PRIMARY_COMMANDS: ReadonlyArray<QuickCommand> = CHARACTER_COMMANDS;

interface QuickCommandsProps {
  readonly onCommand: (command: string) => void;
  readonly disabled?: boolean;
}

export function QuickCommands({ onCommand, disabled = false }: QuickCommandsProps) {
  const [open, setOpen] = useState(false);

  const btnBase = [
    "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium rounded-lg transition-all",
    "border border-border/30 bg-secondary/30 text-foreground",
    "hover:text-primary hover:border-primary/30 hover:bg-primary/5",
    "disabled:opacity-50 disabled:pointer-events-none",
  ].join(" ");

  const sectionTitle = [
    "text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60",
    "col-span-full pt-1 pb-0.5",
  ].join(" ");

  return (
    <div className="px-2 py-1">
      {/* Character & setting — 主操作，默认展开可见 */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {PRIMARY_COMMANDS.map((cmd) => (
          <button
            key={cmd.command}
            onClick={() => onCommand(cmd.command)}
            disabled={disabled}
            className={btnBase}
            title={cmd.description}
          >
            <span className="flex items-center justify-center">{cmd.icon}</span>
            <span>{cmd.label}</span>
          </button>
        ))}
      </div>

      {/* More tools — 折叠区 */}
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer border border-border/30 bg-secondary/20 text-muted-foreground hover:text-foreground hover:bg-secondary/40 disabled:opacity-50 disabled:pointer-events-none"
        >
          <span>{open ? "收起" : "更多工具"}</span>
          <ChevronDown
            size={12}
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 grid gap-x-2 gap-y-1.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))" }}>
          <div className={sectionTitle}>质量检查</div>
          {QUALITY_COMMANDS.map((cmd) => (
            <button
              key={cmd.command}
              onClick={() => onCommand(cmd.command)}
              disabled={disabled}
              className={btnBase}
              title={cmd.description}
            >
              <span className="flex items-center justify-center">{cmd.icon}</span>
              <span>{cmd.label}</span>
            </button>
          ))}

          <div className={sectionTitle}>数据管理</div>
          {DATA_COMMANDS.map((cmd) => (
            <button
              key={cmd.command}
              onClick={() => onCommand(cmd.command)}
              disabled={disabled}
              className={btnBase}
              title={cmd.description}
            >
              <span className="flex items-center justify-center">{cmd.icon}</span>
              <span>{cmd.label}</span>
            </button>
          ))}

          <div className={sectionTitle}>叙事风格</div>
          {NARRATIVE_COMMANDS.map((cmd) => (
            <button
              key={cmd.command}
              onClick={() => onCommand(cmd.command)}
              disabled={disabled}
              className={btnBase}
              title={cmd.description}
            >
              <span className="flex items-center justify-center">{cmd.icon}</span>
              <span>{cmd.label}</span>
            </button>
          ))}

          <div className={sectionTitle}>自定义技能</div>
          {SKILLS_COMMANDS.map((cmd) => (
            <button
              key={cmd.command}
              onClick={() => onCommand(cmd.command)}
              disabled={disabled}
              className={btnBase}
              title={cmd.description}
            >
              <span className="flex items-center justify-center">{cmd.icon}</span>
              <span>{cmd.label}</span>
            </button>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export {
  CHARACTER_COMMANDS as ALL_COMMANDS,
  CHARACTER_COMMANDS as PRIMARY_COMMANDS,
  QUALITY_COMMANDS,
  DATA_COMMANDS,
  NARRATIVE_COMMANDS,
  SKILLS_COMMANDS,
};
