import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "rounded-full bg-primary/15 text-bia-aqua border border-bia-aqua/20 [a]:hover:bg-primary/25",
        secondary:
          "rounded-full bg-bia-purple/10 text-bia-purple border border-bia-purple/20 [a]:hover:bg-bia-purple/20",
        destructive:
          "rounded-full border border-red-500/20 bg-red-500/10 text-red-400 focus-visible:ring-red-500/20 [a]:hover:bg-red-500/20",
        outline:
          "rounded-full border-bia-gray/30 text-bia-gray-light [a]:hover:bg-bia-blue-mid [a]:hover:text-white",
        ghost:
          "rounded-full hover:bg-bia-blue-mid hover:text-white dark:hover:bg-bia-blue-mid",
        link: "text-bia-aqua underline-offset-4 hover:underline",
        success:
          "rounded-full border border-bia-aqua/20 bg-bia-aqua/10 text-bia-aqua [a]:hover:bg-bia-aqua/20",
        warning:
          "rounded-full border border-yellow-500/20 bg-yellow-500/10 text-yellow-400 [a]:hover:bg-yellow-500/20",
        completed:
          "rounded-full border border-bia-purple/20 bg-bia-purple/10 text-bia-purple [a]:hover:bg-bia-purple/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
