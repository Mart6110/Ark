import { RectangleHorizontal, RectangleVertical } from 'lucide-react'
import { PopoverContent, PopoverRoot, PopoverTrigger } from '@/components/smoothui/popover'
import Switch from '@/components/smoothui/switch'
import { ToggleGroupItem, ToggleGroupRoot } from '@/components/smoothui/toggle-group'
import { formatCm, MARGIN_PRESETS, type MarginPreset, type PageSetup } from '@/lib/page'

const MARGIN_KEYS = Object.keys(MARGIN_PRESETS) as MarginPreset[]

function describeMargins(key: MarginPreset) {
  const { top, left } = MARGIN_PRESETS[key].margins
  return top === left
    ? `${formatCm(top)} on every side`
    : `${formatCm(top)} top and bottom, ${formatCm(left)} sides`
}

/** Paper, orientation, margins and page numbers, behind a button in the status bar. */
export function PageSetupButton({
  pageSetup,
  onChange,
}: {
  pageSetup: PageSetup
  onChange: (setup: PageSetup) => void
}) {
  const portrait = pageSetup.orientation === 'portrait'
  const Icon = portrait ? RectangleVertical : RectangleHorizontal

  return (
    <PopoverRoot>
      <PopoverTrigger
        render={
          <button
            className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 outline-none hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-foreground/[0.08]"
            type="button"
          />
        }
      >
        <Icon aria-hidden className="size-3.5" />
        <span className="sr-only sm:not-sr-only">A4 · {portrait ? 'Portrait' : 'Landscape'}</span>
        <span className="hidden md:inline">· {MARGIN_PRESETS[pageSetup.margins].label} margins</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-xl" side="top" sideOffset={8}>
        <h3 className="mb-3 font-semibold text-sm">Page setup</h3>

        <div className="mb-1.5 text-muted-foreground text-xs">Orientation</div>
        <ToggleGroupRoot
          aria-label="Orientation"
          className="mb-4 grid w-full grid-cols-2"
          onValueChange={(value: string[]) => {
            if (value[0]) onChange({ ...pageSetup, orientation: value[0] as PageSetup['orientation'] })
          }}
          value={[pageSetup.orientation]}
        >
          <ToggleGroupItem value="portrait">
            <RectangleVertical className="size-4" /> Portrait
          </ToggleGroupItem>
          <ToggleGroupItem value="landscape">
            <RectangleHorizontal className="size-4" /> Landscape
          </ToggleGroupItem>
        </ToggleGroupRoot>

        <div className="mb-1.5 text-muted-foreground text-xs">Margins</div>
        <ToggleGroupRoot
          aria-label="Margins"
          className="grid w-full grid-cols-4"
          onValueChange={(value: string[]) => {
            if (value[0]) onChange({ ...pageSetup, margins: value[0] as MarginPreset })
          }}
          value={[pageSetup.margins]}
        >
          {MARGIN_KEYS.map((key) => (
            <ToggleGroupItem className="px-1 text-xs" key={key} value={key}>
              {MARGIN_PRESETS[key].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroupRoot>
        <p className="mt-1.5 mb-4 text-muted-foreground text-xs">{describeMargins(pageSetup.margins)}</p>

        <label className="flex items-center justify-between gap-3 border-border border-t pt-3 text-sm">
          <span>
            Page numbers
            <span className="block text-muted-foreground text-xs">At the bottom of every page</span>
          </span>
          <Switch
            aria-label="Page numbers"
            checked={pageSetup.pageNumbers}
            onCheckedChange={(pageNumbers) => onChange({ ...pageSetup, pageNumbers })}
          />
        </label>
      </PopoverContent>
    </PopoverRoot>
  )
}
