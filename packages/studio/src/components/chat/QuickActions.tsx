import {
  Zap,
  FileText,
  ShieldCheck,
  RefreshCcw,
  ChevronDown,
  ChevronRight,
  Layers,
} from "lucide-react";
import { useState } from "react";

export interface QuickActionsProps {
  readonly onAction: (command: string, requestedIntent?: "write_next") => void;
  readonly onAudit?: () => void;
  readonly onRevise?: () => void;
  readonly disabled: boolean;
  readonly isZh: boolean;
}

interface ActionDef {
  readonly icon: React.ReactNode;
  readonly labelZh: string;
  readonly labelEn: string;
  readonly commandZh: string;
  readonly commandEn: string;
  readonly requestedIntent?: "write_next";
  readonly primary?: boolean;
  readonly hintZh?: string;
  readonly hintEn?: string;
  readonly isAudit?: boolean;
  readonly isRevise?: boolean;
}

// 写作流程相关的核心操作
const CORE_ACTIONS: ReadonlyArray<ActionDef> = [
  {
    icon: <Zap size={15} />,
    labelZh: "写下一章",
    labelEn: "Write next",
    commandZh: "写下一章",
    commandEn: "write next chapter",
    requestedIntent: "write_next",
    primary: true,
    hintZh: "推荐操作",
    hintEn: "Recommended",
  },
  {
    icon: <FileText size={15} />,
    labelZh: "先写大纲",
    labelEn: "Plan first",
    commandZh: "先为下一章写大纲，按大纲生成正文",
    commandEn: "plan the next chapter first, then generate body",
  },
  {
    icon: <Layers size={15} />,
    labelZh: "规划章节组",
    labelEn: "Plan chapter group",
    commandZh: "规划接下来3-5章的短期情节规划",
    commandEn: "plan the next 3-5 chapters as a group",
  },
  {
    icon: <ShieldCheck size={15} />,
    labelZh: "审核上一章",
    labelEn: "Audit last chapter",
    commandZh: "审核上一章，检查一致性和质量",
    commandEn: "audit the last chapter for quality and consistency",
    isAudit: true,
  },
  {
    icon: <RefreshCcw size={15} />,
    labelZh: "修订上一章",
    labelEn: "Revise last chapter",
    commandZh: "修订上一章，提升写作质量",
    commandEn: "revise and polish the last chapter",
    isRevise: true,
  },
];

export function QuickActions({ onAction, onAudit, onRevise, disabled, isZh }: QuickActionsProps) {
  const [showAll, setShowAll] = useState(false);
  const actions = CORE_ACTIONS;
  const primary = actions.find((a) => a.primary) ?? actions[0];
  const secondary = actions.filter((a) => !a.primary);

  const handleAction = (action: ActionDef) => {
    if (action.isAudit && onAudit) {
      onAudit();
    } else if (action.isRevise && onRevise) {
      onRevise();
    } else {
      onAction(isZh ? action.commandZh : action.commandEn, action.requestedIntent);
    }
  };

  return (
    <div className="px-2 pt-3 pb-1">
      <div className="flex items-center gap-2 flex-wrap">
        {/* 主操作按钮 — 醒目的品牌色 */}
        <button
          onClick={() => handleAction(primary)}
          disabled={disabled}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:brightness-110 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-40 disabled:pointer-events-none"
        >
          {primary.icon}
          <span>{isZh ? primary.labelZh : primary.labelEn}</span>
          <ChevronRight size={14} className="opacity-70" />
        </button>

        {/* 次操作按钮 — 柔和的灰蓝色 */}
        {secondary.slice(0, showAll ? secondary.length : 2).map((action) => (
          <button
            key={action.labelZh}
            onClick={() => handleAction(action)}
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl bg-secondary/60 text-foreground border border-border/40 hover:bg-secondary hover:border-primary/30 hover:text-primary transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            {action.icon}
            <span>{isZh ? action.labelZh : action.labelEn}</span>
          </button>
        ))}

        {/* 更多/收起 切换 */}
        {secondary.length > 2 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-xl bg-secondary/30 text-muted-foreground border border-border/30 hover:bg-secondary hover:text-foreground transition-all"
          >
            {isZh ? (showAll ? "收起" : "更多") : (showAll ? "Less" : "More")}
            <ChevronDown
              size={14}
              className={`transition-transform ${showAll ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>
    </div>
  );
}
