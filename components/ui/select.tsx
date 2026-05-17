"use client";

import { forwardRef, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

Select.displayName = "Select";
