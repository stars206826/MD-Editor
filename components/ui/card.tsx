import { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-slate-900/70 shadow-panel backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}
