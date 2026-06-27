import { useEffect, useMemo, useState } from "react";
import type { SSEMessage } from "../../hooks/use-sse";
import { Loader2, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "../../lib/utils";

// -- Types --

export interface PipelineStageInfo {
  label: string;
  status: "pending" | "active" | "completed" | "error";
  progress?: {
    elapsedMs?: number;
    totalChars?: number;
    status?: string;
  };
}

export interface PipelineExecution {
  id: string;
  bookId: string;
  chapterNumber?: number;
  stages: PipelineStageInfo[];
  startedAt: number;
  completedAt?: number;
  error?: string | null;
}

// -- Known agent stage labels (Chinese) --

const KNOWN_STAGES_ZH: Record<string, string> = {
  "整理会话记忆": "记忆整理",
  "分析剧情走向": "剧情规划",
  "分析角色状态": "角色分析",
  "检查伏笔完整性": "伏笔检查",
  "AI生成章节内容": "内容生成",
  "检查内容质量": "质量审计",
  "逻辑一致性": "逻辑一致性",
};

const KNOWN_STAGES_EN: Record<string, string> = {
  "Organize conversation memory": "Memory",
  "Analyze plot direction": "Plot",
  "Analyze character state": "Characters",
  "Check hook completeness": "Hooks",
  "AI generates chapter content": "Writing",
  "Check content quality": "Audit",
  "Logic consistency": "Logic",
};

function resolveStageLabel(raw: string, isZh: boolean): string {
  const map = isZh ? KNOWN_STAGES_ZH : KNOWN_STAGES_EN;
  return map[raw] ?? raw;
}

// -- SSE log parser --

/**
 * Parse SSE log events into pipeline stage information.
 *
 * Log events follow a pattern like:
 *   [writer] 正在生成第 24 章...
 *   [auditor] 检查一致性...
 *   [stage] 记忆整理
 *
 * We extract stage names from structured log lines.
 */
function parseLogForStages(
  logMessages: ReadonlyArray<{ tag: string; message: string }>,
  isZh: boolean,
): PipelineStageInfo[] {
  const stages: PipelineStageInfo[] = [];
  const stageMap = new Map<string, number>();

  for (const log of logMessages) {
    const tag = log.tag.toLowerCase();
    const msg = log.message;

    // Detect stage start events
    if (tag === "stage" || tag === "agent" || tag === "sub_agent") {
      // Try to extract stage label from message
      const stageLabel = extractStageLabel(msg, isZh);
      if (stageLabel && !stageMap.has(stageLabel)) {
        stageMap.set(stageLabel, stages.length);
        stages.push({
          label: stageLabel,
          status: "pending",
        });
      }
    }

    // Detect completion
    if (tag === "complete" || tag === "done" || msg.includes("完成") || msg.includes("complete")) {
      for (const s of stages) {
        if (s.status === "pending" || s.status === "active") {
          s.status = "completed";
        }
      }
    }

    // Detect error
    if (tag === "error" || msg.includes("失败") || msg.includes("error")) {
      for (const s of stages) {
        if (s.status === "active") {
          s.status = "error";
        }
      }
    }
  }

  return stages;
}

function extractStageLabel(message: string, isZh: boolean): string | null {
  // Pattern: "正在执行: 记忆整理" or "Agent: 剧情规划"
  const zhMatch = message.match(/(?:正在执行|Agent|阶段)[:：]\s*(.+)/);
  if (zhMatch) return resolveStageLabel(zhMatch[1].trim(), isZh);

  // Pattern: "整理会话记忆" (just the stage name)
  const knownKeys = Object.keys(KNOWN_STAGES_ZH);
  for (const key of knownKeys) {
    if (message.includes(key)) {
      return resolveStageLabel(key, isZh);
    }
  }

  return null;
}

// -- Hook: derive pipeline state from SSE messages --

export function usePipelineState(
  messages: ReadonlyArray<SSEMessage>,
  isZh: boolean,
): PipelineExecution | null {
  const [pipeline, setPipeline] = useState<PipelineExecution | null>(null);

  useEffect(() => {
    if (messages.length === 0) return;

    // Find the latest write:start event
    let writeStartIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].event === "write:start" || messages[i].event === "draft:start") {
        writeStartIndex = i;
        break;
      }
    }

    if (writeStartIndex === -1) {
      setPipeline(null);
      return;
    }

    // Check if the pipeline has completed
    const recentMessages = messages.slice(writeStartIndex);
    const lastMsg = recentMessages[recentMessages.length - 1];
    const isComplete = lastMsg?.event === "write:complete" || lastMsg?.event === "draft:complete";
    const isError = lastMsg?.event === "write:error" || lastMsg?.event === "draft:error";

    // Extract log events
    const logEvents = recentMessages
      .filter((m) => m.event === "log")
      .map((m) => {
        const data = m.data as { tag?: string; message?: string } | null;
        return { tag: data?.tag ?? "", message: data?.message ?? "" };
      });

    // Extract stages from logs
    const stages = parseLogForStages(logEvents, isZh);

    // If no stages detected from logs, create default stages based on the operation
    if (stages.length === 0) {
      stages.push(
        { label: isZh ? "准备输入" : "Preparing", status: "pending" },
        { label: isZh ? "生成内容" : "Generating", status: "pending" },
        { label: isZh ? "完成" : "Complete", status: "pending" },
      );
    }

    // Mark current active stage
    const activeIndex = findActiveStageIndex(logEvents, stages);
    for (let i = 0; i < stages.length; i++) {
      if (i < activeIndex) {
        stages[i].status = "completed";
      } else if (i === activeIndex) {
        stages[i].status = "active";
      }
    }

    if (isComplete) {
      for (const s of stages) {
        if (s.status === "active" || s.status === "pending") {
          s.status = "completed";
        }
      }
    }

    if (isError) {
      for (const s of stages) {
        if (s.status === "active") {
          s.status = "error";
        } else if (s.status === "pending") {
          s.status = "pending";
        }
      }
    }

    const bookId = (lastMsg?.data as { bookId?: string })?.bookId ?? "";
    const chapterNumber = (lastMsg?.data as { chapterNumber?: number })?.chapterNumber;

    setPipeline({
      id: `pipeline-${writeStartIndex}`,
      bookId,
      chapterNumber,
      stages,
      startedAt: messages[writeStartIndex].timestamp,
      completedAt: isComplete ? messages[messages.length - 1].timestamp : undefined,
      error: isError ? (lastMsg?.data as { error?: string })?.error ?? "Unknown error" : null,
    });
  }, [messages, isZh]);

  return pipeline;
}

function findActiveStageIndex(
  logEvents: ReadonlyArray<{ tag: string; message: string }>,
  stages: PipelineStageInfo[],
): number {
  let activeIndex = 0;
  for (const log of logEvents) {
    const msg = log.message;
    // Match log messages to stage indices
    for (let i = 0; i < stages.length; i++) {
      if (msg.includes(stages[i].label) || stages[i].label.includes(msg.slice(0, 4))) {
        activeIndex = Math.max(activeIndex, i + 1);
      }
    }
  }
  return activeIndex;
}

// -- Component: AgentPipelinePanel --

interface AgentPipelinePanelProps {
  readonly pipeline: PipelineExecution | null;
  readonly onViewDetails?: () => void;
  readonly isZh?: boolean;
}

interface NextActionDef {
  readonly labelZh: string;
  readonly labelEn: string;
  readonly commandZh: string;
  readonly commandEn: string;
  readonly requestedIntent?: "write_next";
  readonly primary?: boolean;
}

function resolveNextActions(isZh: boolean, hasError: boolean): ReadonlyArray<NextActionDef> {
  if (hasError) {
    return [
      {
        labelZh: "重试当前章节",
        labelEn: "Retry current chapter",
        commandZh: "重试当前章节，检查失败原因后重新写入",
        commandEn: "retry the current chapter after checking failure cause",
      },
      {
        labelZh: "查看问题",
        labelEn: "Review issues",
        commandZh: "查看刚才失败的章节有哪些问题",
        commandEn: "review the issues in the failed chapter",
      },
    ];
  }
  return [
    {
      labelZh: "继续写下一章",
      labelEn: "Write next chapter",
      commandZh: "写下一章",
      commandEn: "write next chapter",
      requestedIntent: "write_next",
      primary: true,
    },
    {
      labelZh: "审核刚完成的章节",
      labelEn: "Audit last chapter",
      commandZh: "审核刚完成的章节，检查质量与一致性",
      commandEn: "audit the last chapter for quality and consistency",
    },
    {
      labelZh: "查看角色状态",
      labelEn: "Review characters",
      commandZh: "查看所有角色状态与最新信息",
      commandEn: "review all character states and latest info",
    },
    {
      labelZh: "检查伏笔",
      labelEn: "Check hooks",
      commandZh: "检查伏笔回收与待揭露的关键信息",
      commandEn: "check hook resolution and pending reveals",
    },
  ];
}

export function AgentPipelinePanel({ pipeline, onViewDetails, onNextAction, isZh = true }: AgentPipelinePanelProps & {
  readonly onNextAction?: (command: string, requestedIntent?: "write_next") => void;
}) {
  if (!pipeline) return null;

  const isRunning = pipeline.stages.some((s) => s.status === "active" || s.status === "pending");
  const hasError = pipeline.stages.some((s) => s.status === "error");
  const isComplete = pipeline.stages.every((s) => s.status === "completed");

  const statusColor = hasError ? "text-destructive" : isComplete ? "text-emerald-500" : "text-primary";
  const statusLabel = hasError
    ? (isZh ? "执行出错" : "Error")
    : isComplete
      ? (isZh ? "已完成" : "Complete")
      : isRunning
        ? (isZh ? "执行中" : "Running")
        : "";

  const nextActions = isComplete || hasError ? resolveNextActions(isZh, hasError) : [];

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {isZh ? "Agent 执行过程" : "Agent Pipeline"}
          </span>
          <span className={cn("text-xs font-medium", statusColor)}>
            ● {statusLabel}
          </span>
        </div>
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {isZh ? "查看详情" : "Details"} ▾
          </button>
        )}
      </div>

      {/* Stage flow */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {pipeline.stages.map((stage, i) => (
          <div key={i} className="flex items-center gap-1 shrink-0">
            <StageNode stage={stage} isZh={isZh} />
            {i < pipeline.stages.length - 1 && (
              <ChevronRight size={12} className="text-muted-foreground/40 shrink-0 mt-2" />
            )}
          </div>
        ))}
      </div>

      {/* Error message */}
      {hasError && pipeline.error && (
        <div className="mt-2 text-xs text-destructive bg-destructive/5 rounded-lg px-2 py-1">
          {pipeline.error}
        </div>
      )}

      {/* 完成后推荐操作区 */}
      {isComplete && onNextAction && nextActions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/30">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
            {isZh ? "下一步" : "Next step"}
          </div>
          <div className="flex flex-wrap gap-2">
            {nextActions.map((action, idx) => {
              const isPrimary = action.primary;
              return (
                <button
                  key={idx}
                  onClick={() => onNextAction(
                    isZh ? action.commandZh : action.commandEn,
                    action.requestedIntent,
                  )}
                  className={[
                    "inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg transition-all",
                    isPrimary
                      ? "bg-primary text-primary-foreground hover:brightness-110 shadow shadow-primary/20"
                      : "bg-secondary/60 text-foreground border border-border/40 hover:bg-secondary hover:border-primary/30 hover:text-primary",
                  ].join(" ")}
                >
                  {action.labelZh && !isZh ? undefined : undefined}
                  <span>{isZh ? action.labelZh : action.labelEn}</span>
                  {isPrimary && <ChevronRight size={13} className="opacity-70" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StageNode({ stage, isZh }: { stage: PipelineStageInfo; isZh: boolean }) {
  const { status, label, progress } = stage;

  const icon = useMemo(() => {
    switch (status) {
      case "completed":
        return <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />;
      case "error":
        return <XCircle size={14} className="text-destructive shrink-0" />;
      case "active":
        return <Loader2 size={14} className="text-primary animate-spin shrink-0" />;
      default:
        return (
          <span className="w-3.5 h-3.5 rounded-full border border-border/40 shrink-0" />
        );
    }
  }, [status]);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all min-w-[72px]",
        status === "active" && "bg-primary/5 border border-primary/20",
        status === "completed" && "bg-emerald-500/5",
        status === "error" && "bg-destructive/5",
        status === "pending" && "opacity-50",
      )}
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <span className={cn(
          "text-[11px] leading-4 font-medium truncate max-w-[80px]",
          status === "active" ? "text-primary" : "text-muted-foreground",
        )}>
          {label}
        </span>
      </div>
      {progress && status === "active" && (
        <div className="text-[9px] text-muted-foreground/60">
          {progress.totalChars ? `${progress.totalChars} 字` : `${Math.round((progress.elapsedMs ?? 0) / 1000)}s`}
        </div>
      )}
    </div>
  );
}
