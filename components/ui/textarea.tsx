import { forwardRef, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-2xl border border-stone-200 bg-white px-4 py-4 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";
