import { ChevronDown } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { PopoverContent, PopoverRoot, PopoverTrigger } from '@/components/smoothui/popover'
import { ToolbarButton } from '@/components/smoothui/toolbar'
import { Hint, TOOL_BUTTON_CLASS } from './tool-button'
import { cn } from '@/lib/utils'

interface ColorButtonProps {
  label: string
  icon: ReactNode
  /** The color the main half applies. */
  color: string
  onApply: (color: string) => void
  onClear: () => void
  clearLabel: string
  rows: string[][]
  /** Larger swatches for short palettes. */
  large?: boolean
}

/** Split button: the left half re-applies the last color, the arrow opens the palette. */
export function ColorButton({
  label,
  icon,
  color,
  onApply,
  onClear,
  clearLabel,
  rows,
  large = false,
}: ColorButtonProps) {
  const [open, setOpen] = useState(false)
  const pick = (c: string) => {
    onApply(c)
    setOpen(false)
  }

  return (
    <div className="flex items-center">
      <Hint label={label}>
        <ToolbarButton
          aria-label={label}
          className={cn(TOOL_BUTTON_CLASS, 'w-8 flex-col gap-0 rounded-r-none px-0')}
          onClick={() => onApply(color)}
          onMouseDown={(e) => e.preventDefault()}
        >
          {icon}
          <span
            aria-hidden
            className="-mt-0.5 h-[3px] w-4 rounded-full ring-1 ring-foreground/10"
            style={{ background: color }}
          />
        </ToolbarButton>
      </Hint>
      <PopoverRoot onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          render={
            <ToolbarButton
              aria-label={`${label}: choose color`}
              className={cn(TOOL_BUTTON_CLASS, 'w-4 rounded-l-none px-0 [&_svg]:size-3')}
              onMouseDown={(e) => e.preventDefault()}
            />
          }
        >
          <ChevronDown className="opacity-60" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto rounded-xl p-2.5">
          <div className={cn('grid', large ? 'gap-2' : 'gap-1.5')}>
            {rows.map((row) => (
              <div className={cn('flex', large ? 'gap-2' : 'gap-1.5')} key={row.join()}>
                {row.map((c) => (
                  <button
                    aria-label={c}
                    className={cn(
                      'rounded-full outline-none ring-1 ring-black/10 transition-transform hover:scale-115 focus-visible:ring-2 focus-visible:ring-brand dark:ring-white/15',
                      large ? 'size-7' : 'size-5',
                    )}
                    key={c}
                    onClick={() => pick(c)}
                    onMouseDown={(e) => e.preventDefault()}
                    style={{ background: c }}
                    title={c}
                    type="button"
                  />
                ))}
              </div>
            ))}
          </div>
          <button
            className="mt-2.5 w-full rounded-md px-2 py-1.5 text-left text-muted-foreground text-xs hover:bg-accent hover:text-foreground"
            onClick={() => {
              onClear()
              setOpen(false)
            }}
            onMouseDown={(e) => e.preventDefault()}
            type="button"
          >
            {clearLabel}
          </button>
        </PopoverContent>
      </PopoverRoot>
    </div>
  )
}
