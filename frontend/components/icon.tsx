import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

type IconSize = 16 | 20 | 24

export function Icon({
  name,
  filled = false,
  size = 20,
  className,
  label,
  ...props
}: {
  name: string
  filled?: boolean
  size?: IconSize
  className?: string
  label?: string
} & ComponentProps<"span">) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      data-filled={filled || undefined}
      className={cn("icon material-symbols-outlined", className)}
      style={{ fontSize: size, width: size, height: size }}
      {...props}
    >
      {name}
    </span>
  )
}
