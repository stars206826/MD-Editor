import { forwardRef, InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
