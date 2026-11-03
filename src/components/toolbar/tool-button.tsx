import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { ChevronDown } from 'lucide-react'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { ToolbarButton, ToolbarSeparator } from '@/components/smoothui/toolbar'
import { TooltipContent } from '@/components/smoothui/tooltip'
import { cn } from '@/lib/utils'

export function Hint({
  label,
  shortcut,
  children,
}: {
  label: string
  shortcut?: string
  children: ReactElement
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
        {shortcut ? <span className="ml-1.5 opacity-60">{shortcut}</span> : null}
      </TooltipContent>
    </TooltipPrimitive.Root>
  )
}

export type ToolButtonProps = Omit<ComponentProps<typeof ToolbarButton>, 'children'> & {
  label: string
  icon: ReactNode
  shortcut?: string
  /** Pressed state for toggles (bold, lists…). */
  active?: boolean
  /** Show the label next to the icon. */
  showLabel?: boolean
  caret?: boolean
}

export const TOOL_BUTTON_CLASS =
  'h-8 gap-1 rounded-lg px-1.5 font-normal text-foreground/80 hover:bg-foreground/[0.06] hover:text-foreground aria-pressed:bg-brand/12 aria-pressed:text-brand data-popup-open:bg-foreground/[0.08] dark:aria-pressed:bg-brand/20 [&_svg]:size-4'

/**
 * A toolbar button. It never takes focus on click, so the document keeps its
 * selection while you format it.
 */
export function ToolButton({
  label,
  icon,
  shortcut,
  active,
  showLabel = false,
  caret = false,
  className,
  onMouseDown,
  ...props
}: ToolButtonProps) {
  return (
    <Hint label={label} shortcut={shortcut}>
      <ToolbarButton
        aria-label={label}
        aria-pressed={active}
        className={cn(TOOL_BUTTON_CLASS, !showLabel && !caret && 'w-8 px-0', className)}
        onMouseDown={(event) => {
          event.preventDefault()
          onMouseDown?.(event)
        }}
        {...props}
      >
        {icon}
        {showLabel ? <span className="text-[13px]">{label}</span> : null}
        {caret ? <ChevronDown aria-hidden className="size-3! opacity-60" /> : null}
      </ToolbarButton>
    </Hint>
  )
}

export function Divider() {
  return <ToolbarSeparator className="mx-1 my-1.5 bg-foreground/12" />
}
