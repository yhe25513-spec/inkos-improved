import * as React from "react";
import { cn } from "../../lib/utils";

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0-100
  max?: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  color?: "primary" | "success" | "warning" | "danger";
}

const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ className, value, max = 100, showLabel = false, size = "md", color = "primary", ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        {showLabel && (
          <div className="flex justify-between mb-1">
            <span className="text-sm text-muted-foreground">进度</span>
            <span className="text-sm font-medium">{percentage.toFixed(0)}%</span>
          </div>
        )}
        <div
          className={cn(
            "progress-bar",
            size === "sm" && "h-1",
            size === "md" && "h-1.5",
            size === "lg" && "h-2",
          )}
        >
          <div
            className={cn(
              "progress-bar-fill",
              color === "primary" && "bg-primary",
              color === "success" && "bg-green-500",
              color === "warning" && "bg-yellow-500",
              color === "danger" && "bg-red-500",
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  },
);
ProgressBar.displayName = "ProgressBar";

export { ProgressBar };
export type { ProgressBarProps };
