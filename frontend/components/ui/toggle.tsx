"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Toggle as TogglePrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-[var(--gl-border-radius-sm)] text-sm font-medium whitespace-nowrap transition-[color,box-shadow,background-color] outline-none hover:bg-[var(--gl-background-color-strong)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-[var(--gl-focus-ring-outer-color)] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-pressed:bg-[var(--gl-background-color-strong)] aria-pressed:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-[var(--gl-control-border-color-default)] bg-[var(--gl-control-background-color-default)] shadow-none hover:bg-[var(--gl-background-color-strong)]",
      },
      size: {
        default: "h-8 min-w-8 px-2",
        sm: "h-7 min-w-7 px-1.5",
        lg: "h-9 min-w-9 px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
