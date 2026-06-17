import * as React from "react";
import { cn } from "../../lib/utils";

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, value, label, icon, trend, trendValue, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("stat-card", className)} {...props}>
        <div className="flex items-center justify-between">
          <div className="stat-card-value">{value}</div>
          {icon && <div className="stat-card-icon">{icon}</div>}
        </div>
        <div className="stat-card-label">{label}</div>
        {trend && trendValue && (
          <div
            className={cn(
              "text-xs font-medium mt-1",
              trend === "up" && "text-green-600",
              trend === "down" && "text-red-600",
              trend === "neutral" && "text-muted-foreground",
            )}
          >
            {trend === "up" && "↑"}
            {trend === "down" && "↓"}
            {trendValue}
          </div>
        )}
      </div>
    );
  },
);
StatCard.displayName = "StatCard";

export { StatCard };
export type { StatCardProps };
