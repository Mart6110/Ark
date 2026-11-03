import type { Editor } from '@tiptap/react'
import { Minus, Plus } from 'lucide-react'
import Slider from '@/components/smoothui/slider'
import { useDocumentStats } from '@/editor/use-document-stats'
import type { PageSetup } from '@/lib/page'
import { clampZoom, MAX_ZOOM, MIN_ZOOM } from '@/lib/zoom'
import type { PageInfo } from './page'
import { PageSetupButton } from './page-setup'

const number = new Intl.NumberFormat('en-GB')

export function StatusBar({
  editor,
  pageInfo,
  zoom,
  onZoom,
  onFitWidth,
  pageSetup,
  onPageSetup,
}: {
  editor: Editor
  pageInfo: PageInfo
  zoom: number
  onZoom: (zoom: number) => void
  onFitWidth: () => void
  pageSetup: PageSetup
  onPageSetup: (setup: PageSetup) => void
}) {
  const stats = useDocumentStats(editor)
  return (
    <footer className="flex h-8 shrink-0 items-center gap-3 overflow-hidden whitespace-nowrap border-border border-t bg-background px-3 text-muted-foreground text-xs print:hidden">
      <span>
        Page {pageInfo.current} of {pageInfo.total}
      </span>
      <span aria-hidden className="text-foreground/20">·</span>
      <span>
        {stats.selectedWords !== null
          ? `${number.format(stats.selectedWords)} of ${number.format(stats.words)} words`
          : `${number.format(stats.words)} ${stats.words === 1 ? 'word' : 'words'}`}
      </span>
      <span aria-hidden className="hidden text-foreground/20 sm:inline">·</span>
      <span className="hidden sm:inline">{number.format(stats.characters)} characters</span>

      <div className="ml-auto flex items-center gap-1.5">
        <PageSetupButton onChange={onPageSetup} pageSetup={pageSetup} />
        <span aria-hidden className="hidden h-4 w-px bg-border sm:block" />
        <button
          aria-label="Zoom out"
          className="rounded p-0.5 hover:bg-foreground/10 disabled:opacity-40"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => onZoom(clampZoom(zoom - 0.1))}
          type="button"
        >
          <Minus className="size-3.5" />
        </button>
        <Slider
          aria-label="Zoom"
          className="hidden w-24 sm:flex"
          max={MAX_ZOOM * 100}
          min={MIN_ZOOM * 100}
          onValueChange={(value) => onZoom(clampZoom(value / 100))}
          step={5}
          value={Math.round(zoom * 100)}
        />
        <button
          aria-label="Zoom in"
          className="rounded p-0.5 hover:bg-foreground/10 disabled:opacity-40"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => onZoom(clampZoom(zoom + 0.1))}
          type="button"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          className="w-11 rounded px-1 text-right tabular-nums hover:bg-foreground/10 hover:text-foreground"
          onClick={() => (zoom === 1 ? onFitWidth() : onZoom(1))}
          title={zoom === 1 ? 'Fit to width' : 'Reset to 100%'}
          type="button"
        >
          {Math.round(zoom * 100)}%
        </button>
      </div>
    </footer>
  )
}
