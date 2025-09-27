import * as React from "react";
import { clsx } from "clsx";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline";
  size?: "default" | "icon" | "sm" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
          variant === "default" && "bg-primary text-primary-foreground hover:bg-primary/90",
          variant === "outline" && "border border-border bg-card/60 hover:bg-card",
          size === "default" && "h-10 px-4 py-2",
          size === "icon" && "h-10 w-10",
          size === "sm" && "h-9 rounded-md px-3",
          size === "lg" && "h-11 rounded-md px-8",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

