import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-[var(--gl-border-radius-sm)] border border-[var(--gl-control-border-color-default)] bg-[var(--gl-control-background-color-default)] px-2.5 py-1 text-sm text-foreground shadow-none transition-[color,box-shadow,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[var(--gl-control-placeholder-color)] hover:border-[var(--gl-control-border-color-hover)] focus-visible:border-[var(--gl-control-border-color-focus)] focus-visible:ring-2 focus-visible:ring-[var(--gl-focus-ring-outer-color)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[var(--gl-control-background-color-disabled)] disabled:border-[var(--gl-control-border-color-disabled)] disabled:opacity-60 aria-invalid:border-[var(--gl-control-border-color-error)] aria-invalid:ring-2 aria-invalid:ring-[var(--gl-text-color-danger)]/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
