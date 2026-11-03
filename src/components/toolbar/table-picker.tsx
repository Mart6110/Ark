import { Table } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import { PopoverContent, PopoverRoot, PopoverTrigger } from '@/components/smoothui/popover'
import { cn } from '@/lib/utils'
import { ToolButton } from './tool-button'

const COLS = 8
const ROWS = 6

/** Hover a grid to pick a table size. Arrow keys and Enter work too. */
export function TablePicker({ onInsert }: { onInsert: (rows: number, cols: number) => void }) {
  const [open, setOpen] = useState(false)
  const [size, setSize] = useState({ rows: 1, cols: 1 })

  const insert = (rows: number, cols: number) => {
    onInsert(rows, cols)
    setOpen(false)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, [number, number]> = {
      ArrowRight: [0, 1],
      ArrowLeft: [0, -1],
      ArrowDown: [1, 0],
      ArrowUp: [-1, 0],
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      setSize((s) => ({
        rows: Math.min(Math.max(s.rows + move[0], 1), ROWS),
        cols: Math.min(Math.max(s.cols + move[1], 1), COLS),
      }))
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      insert(size.rows, size.cols)
    }
  }

  return (
    <PopoverRoot
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setSize({ rows: 1, cols: 1 })
      }}
      open={open}
    >
      <PopoverTrigger render={<ToolButton icon={<Table />} label="Insert table" />} />
      <PopoverContent align="start" className="w-auto rounded-xl p-3">
        <div
          aria-label={`Table size: ${size.cols} columns, ${size.rows} rows. Use the arrow keys and Enter.`}
          className="grid gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onKeyDown={onKeyDown}
          role="application"
          style={{ gridTemplateColumns: `repeat(${COLS}, 1.125rem)` }}
          tabIndex={0}
        >
          {Array.from({ length: ROWS * COLS }, (_, i) => {
            const row = Math.floor(i / COLS) + 1
            const col = (i % COLS) + 1
            const on = row <= size.rows && col <= size.cols
            return (
              <div
                className={cn(
                  'size-[1.125rem] cursor-pointer rounded-[4px] transition-colors',
                  on ? 'bg-brand/70' : 'bg-foreground/[0.07]',
                )}
                key={i}
                onClick={() => insert(row, col)}
                onMouseEnter={() => setSize({ rows: row, cols: col })}
              />
            )
          })}
        </div>
        <div className="mt-2.5 text-center text-muted-foreground text-xs tabular-nums">
          {size.cols} × {size.rows}
        </div>
      </PopoverContent>
    </PopoverRoot>
  )
}
