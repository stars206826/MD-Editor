import { forwardRef, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-2xl border border-border bg-slate-950/70 px-4 py-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";
