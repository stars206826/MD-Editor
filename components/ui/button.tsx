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
          "inline-flex items-center justify-center rounded-xl text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-60",
          size === "default" && "px-4 py-2",
          size === "sm" && "px-2 py-1",
          variant === "primary" && "bg-amber-600 text-white hover:bg-amber-500 shadow-sm",
          variant === "secondary" && "bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200",
          variant === "ghost" && "bg-transparent text-stone-600 hover:bg-stone-100",
          variant === "danger" && "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
