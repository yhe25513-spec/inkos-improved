import * as React from "react";
import { cn } from "../../lib/utils";

type ComplianceStatus = "pass" | "fail" | "warning" | "pending";

interface ComplianceBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: ComplianceStatus;
  score?: number;
  showScore?: boolean;
}

const statusConfig: Record<ComplianceStatus, { label: string; className: string }> = {
  pass: {
    label: "通过",
    className: "badge-compliance-pass",
  },
  fail: {
    label: "未通过",
    className: "badge-compliance-fail",
  },
  warning: {
    label: "警告",
    className: "badge-compliance-warning",
  },
  pending: {
    label: "待检查",
    className: "bg-gray-100 text-gray-600",
  },
};

const ComplianceBadge = React.forwardRef<HTMLDivElement, ComplianceBadgeProps>(
  ({ className, status, score, showScore = false, ...props }, ref) => {
    const config = statusConfig[status];

    return (
      <div
        ref={ref}
        className={cn("badge-compliance", config.className, className)}
        {...props}
      >
        <span className="inline-block w-2 h-2 rounded-full bg-current" />
        <span>{config.label}</span>
        {showScore && score !== undefined && (
          <span className="ml-1 font-mono">{score}</span>
        )}
      </div>
    );
  },
);
ComplianceBadge.displayName = "ComplianceBadge";

export { ComplianceBadge };
export type { ComplianceBadgeProps, ComplianceStatus };
