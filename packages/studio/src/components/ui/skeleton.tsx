import * as React from "react";
import { cn } from "../../lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  variant?: "text" | "circular" | "rectangular";
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, width, height, variant = "text", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "skeleton",
          variant === "text" && "rounded",
          variant === "circular" && "rounded-full",
          variant === "rectangular" && "rounded-lg",
          className,
        )}
        style={{ width, height }}
        {...props}
      />
    );
  },
);
Skeleton.displayName = "Skeleton";

export { Skeleton };
export type { SkeletonProps };
