import { useMemo, useState } from "react";
import { X, Search, CheckSquare, Square, Loader2, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";

interface PlanIssue {
  readonly id: string;
  readonly severity: "critical" | "warning" | "info";
  readonly category: string;
  readonly description: string;
  readonly suggestion: string;
  readonly repairScope?: string;
}

interface PlanGroup {
  readonly groupId: string;
  readonly labelZh: string;
  readonly labelEn: string;
  readonly items: ReadonlyArray<PlanIssue>;
}

interface PlanResponse {
  readonly chapterNumber: number;
  readonly preScore: number;
  readonly passed: boolean;
  readonly summary: string;
  readonly threshold: number;
  readonly wordCount: {
    readonly actual: number;
    readonly target: number;
    readonly ok: boolean;
  };
  readonly groups: ReadonlyArray<PlanGroup>;
}

interface ReviseResponse {
  readonly applied: boolean;
  readonly status: string;
  readonly wordCount: number;
  readonly fixedIssues: ReadonlyArray<string>;
  readonly skippedReason?: string;
  readonly chapterNumber: number;
}

export function RevisionPlanPanel(props: {
  readonly bookId: string;
  readonly defaultChapterNumber?: number;
  readonly isZh: boolean;
  readonly onClose: () => void;
}) {
  const { bookId, defaultChapterNumber = 1, isZh, onClose } = props;
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [revising, setRevising] = useState(false);
  const [reviseResult, setReviseResult] = useState<ReviseResponse | null>(null);
  const [postPlan, setPostPlan] = useState<PlanResponse | null>(null);
  const [postLoading, setPostLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<ReadonlyArray<string>>([]);
  const [chapterInput, setChapterInput] = useState<string>(String(defaultChapterNumber));
  const [activeChapter, setActiveChapter] = useState<number>(defaultChapterNumber);

  // Audit the current chapter on demand (button click).
  function runAudit() {
    const num = Number(chapterInput);
    if (!Number.isFinite(num) || num <= 0) {
      setError(isZh ? "请输入有效的章节号" : "Please enter a valid chapter number");
      return;
    }
    setActiveChapter(num);
    setPostPlan(null);
    setReviseResult(null);
    setPlan(null);
    setChecked([]);
    setError(null);
    setLoading(true);
    fetch(`/api/v1/books/${encodeURIComponent(bookId)}/audit-with-plan/${encodeURIComponent(num)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === "object" && "error" in data) {
          setError(String(data.error));
        } else {
          setPlan(data as PlanResponse);
          const defaultIds: string[] = [];
          for (const g of (data as PlanResponse).groups) {
            if (g.groupId === "critical" || g.groupId === "warning") {
              for (const it of g.items) defaultIds.push(it.id);
            }
          }
          setChecked(defaultIds);
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }

  const flatIssues = useMemo(() => {
    const out: PlanIssue[] = [];
    if (plan) for (const g of plan.groups) for (const i of g.items) out.push(i);
    return out;
  }, [plan]);

  function toggleOne(id: string) {
    setChecked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleAllInGroup(groupId: string, value: boolean) {
    if (!plan) return;
    const groupItems = plan.groups.find((g) => g.groupId === groupId)?.items ?? [];
    const ids = groupItems.map((i) => i.id);
    setChecked((prev) => {
      if (value) {
        const merged = new Set(prev);
        for (const id of ids) merged.add(id);
        return Array.from(merged);
      }
      return prev.filter((id) => !ids.includes(id));
    });
  }

  async function applyRevisions(mode: "spot-fix" | "polish" | "rewrite") {
    setRevising(true);
    setError(null);
    try {
      const r = await fetch(`/api/v1/books/${encodeURIComponent(bookId)}/apply-revisions/${encodeURIComponent(activeChapter)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await r.json();
      if (data && typeof data === "object" && "error" in data) {
        setError(String(data.error));
      } else {
        setReviseResult(data as ReviseResponse);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setRevising(false);
    }
  }

  async function refreshPlan() {
    setPostLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/v1/books/${encodeURIComponent(bookId)}/audit-with-plan/${encodeURIComponent(activeChapter)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      if (data && typeof data === "object" && "error" in data) {
        setError(String(data.error));
      } else {
        setPostPlan(data as PlanResponse);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setPostLoading(false);
    }
  }

  const t = (zh: string, en: string) => (isZh ? zh : en);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/40 bg-background/95 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {t(`第${activeChapter}章 · 修订计划`, `Chapter ${activeChapter} · Revision Plan`)}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
        >
          <X size={15} />
        </button>
      </div>

      {/* Chapter picker row */}
      <div className="flex items-center gap-2 border-b border-border/40 bg-secondary/20 px-4 py-2.5 text-xs">
        <span className="text-muted-foreground">{t("章节号", "Chapter")}</span>
        <input
          type="number"
          min={1}
          value={chapterInput}
          onChange={(e) => setChapterInput(e.target.value)}
          className="w-20 rounded-md border border-border/40 bg-background px-2 py-1 text-foreground focus:border-primary/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={runAudit}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-primary/15 px-2.5 py-1 font-medium text-primary hover:bg-primary/25 disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
          <span>{loading ? t("审计中…", "Auditing…") : t("审计", "Audit")}</span>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            <span>{t("正在审计章节…", "Auditing chapter…")}</span>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {plan && !loading && (
          <>
            {/* Score strip */}
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border/30 bg-secondary/30 p-3">
              <ScoreCell
                label={t("当前分", "Score")}
                value={plan.preScore}
                threshold={plan.threshold}
                isZh={isZh}
              />
              {postPlan ? (
                <ScoreCell
                  label={t("修订后", "After revise")}
                  value={postPlan.preScore}
                  threshold={plan.threshold}
                  isZh={isZh}
                  delta={postPlan.preScore - plan.preScore}
                />
              ) : reviseResult?.applied ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={13} className={postLoading ? "animate-spin" : ""} />
                  <span>{t("已应用，刷新审计中…", "Applied; refreshing audit…")}</span>
                </div>
              ) : null}
              <div className="text-xs text-muted-foreground">
                {t(
                  `字数 ${plan.wordCount.actual}/${plan.wordCount.target} ${plan.wordCount.ok ? "✓" : "⚠"}`,
                  `Words ${plan.wordCount.actual}/${plan.wordCount.target} ${plan.wordCount.ok ? "✓" : "⚠"}`,
                )}
              </div>
              {plan.passed ? (
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                  {t("已通过", "PASSED")}
                </span>
              ) : (
                <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
                  {t("未通过", "BELOW THRESHOLD")}
                </span>
              )}
            </div>

            {/* Summary */}
            {plan.summary && (
              <p className="mb-3 whitespace-pre-wrap rounded-md bg-secondary/20 px-3 py-2 text-[13px] leading-6 text-muted-foreground">
                {plan.summary}
              </p>
            )}

            {/* Issue groups */}
            {plan.groups.map((group) => {
              if (group.items.length === 0) return null;
              const isGroupCritical = group.groupId === "critical";
              const allChecked = group.items.every((i) => checked.includes(i.id));
              return (
                <div key={group.groupId} className="mb-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isGroupCritical ? (
                        <AlertTriangle size={14} className="text-destructive" />
                      ) : (
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      )}
                      <span className="text-sm font-semibold text-foreground">
                        {isZh ? group.labelZh : group.labelEn}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({group.items.length})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleAllInGroup(group.groupId, !allChecked)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    >
                      {allChecked ? <CheckSquare size={13} /> : <Square size={13} />}
                      <span>{allChecked ? t("取消全选", "Uncheck all") : t("全选", "Check all")}</span>
                    </button>
                  </div>
                  <ul className="space-y-1.5">
                    {group.items.map((it) => {
                      const isChecked = checked.includes(it.id);
                      return (
                        <li
                          key={it.id}
                          className={`rounded-md border px-3 py-2 ${
                            isChecked
                              ? "border-primary/30 bg-primary/5"
                              : "border-border/30 bg-secondary/20 hover:border-border/60"
                          }`}
                        >
                          <label className="flex items-start gap-2 text-left">
                            <input
                              type="checkbox"
                              className="mt-0.5 h-3.5 w-3.5 accent-primary"
                              checked={isChecked}
                              onChange={() => toggleOne(it.id)}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5 text-[13px] leading-5">
                                <span className="rounded bg-secondary/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  {it.category}
                                </span>
                                {it.repairScope ? (
                                  <span className="rounded bg-secondary/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                                    {it.repairScope}
                                  </span>
                                ) : null}
                                <span className="text-foreground">{it.description}</span>
                              </div>
                              {it.suggestion ? (
                                <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                                  {t("建议", "Suggestion")}：{it.suggestion}
                                </p>
                              ) : null}
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}

            {flatIssues.length === 0 && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-4 text-center text-sm text-emerald-400">
                {t("没有发现需要修复的问题。", "No issues found.")}
              </div>
            )}

            {/* Revise result */}
            {reviseResult && (
              <div className="mt-3 rounded-lg border border-border/40 bg-secondary/20 px-3 py-3 text-sm">
                <div className="mb-1 flex items-center gap-2 text-foreground">
                  {reviseResult.applied ? (
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  ) : (
                    <AlertTriangle size={14} className="text-amber-400" />
                  )}
                  <span className="font-medium">
                    {reviseResult.applied
                      ? t("已修订", "Revised")
                      : t("未改动", "Unchanged")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({t("状态", "status")}: {reviseResult.status})
                  </span>
                </div>
                {reviseResult.skippedReason ? (
                  <p className="text-[12px] text-muted-foreground">{reviseResult.skippedReason}</p>
                ) : null}
                {reviseResult.fixedIssues?.length > 0 ? (
                  <ul className="mt-1 list-disc pl-5 text-[12px] text-muted-foreground">
                    {reviseResult.fixedIssues.slice(0, 6).map((it, idx) => (
                      <li key={idx}>{it}</li>
                    ))}
                    {reviseResult.fixedIssues.length > 6 ? (
                      <li>{t("…等", "…and more")}</li>
                    ) : null}
                  </ul>
                ) : null}
                {reviseResult.applied && !postPlan ? (
                  <button
                    type="button"
                    onClick={refreshPlan}
                    disabled={postLoading}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-60"
                  >
                    {postLoading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    <span>{t("重新审计看分数", "Re-audit to see new score")}</span>
                  </button>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between border-t border-border/40 px-4 py-3">
        <div className="text-xs text-muted-foreground">
          {plan && !loading ? (
            <span>
              {t(`已勾选 ${checked.length} / ${flatIssues.length} 项`, `${checked.length} / ${flatIssues.length} selected`)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border/40 bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          >
            {t("关闭", "Close")}
          </button>
          <button
            type="button"
            onClick={() => applyRevisions("polish")}
            disabled={!plan || loading || revising || (flatIssues.length > 0 && checked.length === 0)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {revising ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            <span>{t("智能修订", "Auto revise")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreCell(props: {
  readonly label: string;
  readonly value: number;
  readonly threshold: number;
  readonly isZh: boolean;
  readonly delta?: number;
}) {
  const { label, value, threshold, delta } = props;
  const color = value >= threshold ? "text-emerald-400" : "text-amber-400";
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xl font-semibold tabular-nums ${color}`}>{value}</span>
      <span className="text-[11px] text-muted-foreground">/ {threshold}</span>
      {typeof delta === "number" && delta !== 0 ? (
        <span
          className={`text-[11px] font-medium ${
            delta > 0 ? "text-emerald-400" : "text-amber-400"
          }`}
        >
          ({delta > 0 ? "+" : ""}{delta})
        </span>
      ) : null}
    </div>
  );
}
