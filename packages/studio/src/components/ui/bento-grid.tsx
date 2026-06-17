import * as React from "react";
import { cn } from "../../lib/utils";

interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 2 | 3 | "auto";
  gap?: "sm" | "md" | "lg";
}

const BentoGrid = React.forwardRef<HTMLDivElement, BentoGridProps>(
  ({ className, columns = "auto", gap = "md", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bento-grid",
          columns === 2 && "bento-grid-2",
          columns === 3 && "bento-grid-3",
          gap === "sm" && "gap-2",
          gap === "md" && "gap-4",
          gap === "lg" && "gap-6",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
BentoGrid.displayName = "BentoGrid";

interface BentoItemProps extends React.HTMLAttributes<HTMLDivElement> {
  span?: 1 | 2;
  hover?: boolean;
}

const BentoItem = React.forwardRef<HTMLDivElement, BentoItemProps>(
  ({ className, span = 1, hover = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bento-item",
          span === 2 && "bento-item-span-2",
          !hover && "hover:transform-none hover:shadow-none hover:border-border",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
BentoItem.displayName = "BentoItem";

export { BentoGrid, BentoItem };
export type { BentoGridProps, BentoItemProps };
