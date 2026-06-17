import * as React from "react";
import { cn } from "../../lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  blur?: "sm" | "md" | "lg";
  opacity?: number;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, blur = "md", opacity, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "glass-card rounded-xl",
          blur === "sm" && "backdrop-blur-sm",
          blur === "md" && "backdrop-blur-md",
          blur === "lg" && "backdrop-blur-lg",
          className,
        )}
        style={opacity ? { opacity } : undefined}
        {...props}
      >
        {children}
      </div>
    );
  },
);
GlassCard.displayName = "GlassCard";

export { GlassCard };
export type { GlassCardProps };
