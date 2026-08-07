import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Button styles aligned with Pajamas (GitLab) density:
 * ~4px radius, 32px default height, confirm/outline/danger/ghost/link variants.
 * Spec: https://design.gitlab.com/components/button
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-sm border border-transparent text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Pajamas confirm (primary CTA)
        default:
          "bg-[var(--gl-button-confirm-primary-background-color-default)] text-[var(--gl-button-confirm-primary-foreground-color-default)] hover:bg-[var(--gl-button-confirm-primary-background-color-hover)] active:bg-[var(--gl-button-confirm-primary-background-color-active)]",
        // Pajamas default / secondary outlined
        outline:
          "border-[var(--gl-button-default-primary-border-color-default)] bg-[var(--gl-button-default-primary-background-color-default)] text-[var(--gl-button-default-primary-foreground-color-default)] hover:bg-[var(--gl-button-default-primary-background-color-hover)] hover:border-[var(--gl-button-default-primary-border-color-hover)] aria-expanded:bg-[var(--gl-button-default-primary-background-color-active)]",
        secondary:
          "bg-[var(--gl-background-color-strong)] text-foreground hover:brightness-95 aria-expanded:brightness-90",
        // Pajamas tertiary
        ghost:
          "text-foreground hover:bg-[var(--gl-background-color-strong)] aria-expanded:bg-[var(--gl-background-color-strong)]",
        // Pajamas danger
        destructive:
          "bg-[var(--gl-button-danger-primary-background-color-default)] text-[var(--gl-button-danger-primary-foreground-color-default)] border-[var(--gl-button-danger-primary-border-color-default)] hover:bg-[var(--gl-button-danger-primary-background-color-hover)]",
        link: "text-[var(--gl-text-color-link)] underline-offset-4 hover:underline border-transparent",
      },
      size: {
        default:
          "h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-sm px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-sm px-2.5 text-xs",
        lg: "h-9 gap-2 px-4",
        icon: "size-8",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-sm",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
