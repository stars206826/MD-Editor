import { ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "default" | "sm";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-xl text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60",
          size === "default" && "px-4 py-2",
          size === "sm" && "px-2 py-1",
          variant === "primary" && "bg-sky-400 text-slate-950 hover:bg-sky-300",
          variant === "secondary" && "bg-slate-800 text-slate-100 hover:bg-slate-700",
          variant === "ghost" && "bg-transparent text-slate-300 hover:bg-slate-800/70",
          variant === "danger" && "bg-red-500/15 text-red-200 hover:bg-red-500/25",
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
