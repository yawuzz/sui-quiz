import * as React from "react";
import clsx from "clsx";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "outline";
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold",
        variant === "default" && "bg-primary text-primary-foreground",
        variant === "outline" && "border border-border bg-transparent text-foreground",
        className
      )}
      {...props}
    />
  );
}

