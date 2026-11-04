import { RectangleHorizontal, RectangleVertical } from 'lucide-react'
import type { ReactNode } from 'react'
import NumberField from '@/components/smoothui/number-field'
import { PopoverContent, PopoverRoot, PopoverTrigger } from '@/components/smoothui/popover'
import Switch from '@/components/smoothui/switch'
import { ToggleGroupItem, ToggleGroupRoot } from '@/components/smoothui/toggle-group'
import { formatCm, MARGIN_PRESETS, type MarginPreset } from '@/lib/page'
import type { ResolvedSection, SectionSettings } from '@/lib/sections'

const MARGIN_KEYS = Object.keys(MARGIN_PRESETS) as MarginPreset[]

function describeMargins(key: MarginPreset) {
  const { top, left } = MARGIN_PRESETS[key].margins
  return top === left
    ? `${formatCm(top)} on every side`
    : `${formatCm(top)} top and bottom, ${formatCm(left)} sides`
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
  children,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  children?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span>
        {label}
        <span className="block text-muted-foreground text-xs">{description}</span>
      </span>
      <span className="flex items-center gap-2">
        {children}
        <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
      </span>
    </div>
  )
}

/**
 * Page layout, header and footer options and page numbering for the section
 * the cursor is in, behind a button in the status bar.
 */
export function PageSetupButton({
  section,
  sectionCount,
  onChange,
  onLinkChange,
  onRemoveBreak,
}: {
  section: ResolvedSection
  sectionCount: number
  onChange: (patch: Partial<SectionSettings>) => void
  onLinkChange: (linked: boolean) => void
  onRemoveBreak: () => void
}) {
  const { settings, index } = section
  const portrait = settings.orientation === 'portrait'
  const Icon = portrait ? RectangleVertical : RectangleHorizontal
  const several = sectionCount > 1
  const linked = index > 0 && section.headerFooterSource !== index

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
        {several ? <span className="hidden md:inline">Section {index + 1} ·</span> : null}
        <span className="sr-only sm:not-sr-only">A4 · {portrait ? 'Portrait' : 'Landscape'}</span>
        <span className="hidden md:inline">· {MARGIN_PRESETS[settings.margins].label} margins</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[80dvh] w-80 overflow-y-auto rounded-xl" side="top" sideOffset={8}>
        <h3 className="font-semibold text-sm">
          Page setup
          {several ? (
            <span className="font-normal text-muted-foreground">
              {' '}
              · Section {index + 1} of {sectionCount}
            </span>
          ) : null}
        </h3>
        <p className="mb-3 text-muted-foreground text-xs">
          {several ? 'Applies to this section.' : 'Insert › Section break gives part of the document its own setup.'}
        </p>

        <div className="mb-1.5 text-muted-foreground text-xs">Orientation</div>
        <ToggleGroupRoot
          aria-label="Orientation"
          className="mb-4 grid w-full grid-cols-2"
          onValueChange={(value: string[]) => {
            if (value[0]) onChange({ orientation: value[0] as SectionSettings['orientation'] })
          }}
          value={[settings.orientation]}
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
            if (value[0]) onChange({ margins: value[0] as MarginPreset })
          }}
          value={[settings.margins]}
        >
          {MARGIN_KEYS.map((key) => (
            <ToggleGroupItem className="px-1 text-xs" key={key} value={key}>
              {MARGIN_PRESETS[key].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroupRoot>
        <p className="mt-1.5 mb-3 text-muted-foreground text-xs">{describeMargins(settings.margins)}</p>

        <div className="border-border border-t pt-3">
          <div className="text-muted-foreground text-xs">Header and footer</div>
          <p className="mb-1 text-muted-foreground text-xs">Click the top or bottom margin of a page to edit them.</p>
          <SwitchRow
            checked={settings.differentFirstPage}
            description={`Its own header and footer on the first page${several ? ' of this section' : ''}`}
            label="Different first page"
            onChange={(differentFirstPage) => onChange({ differentFirstPage })}
          />
          {index > 0 ? (
            <SwitchRow
              checked={linked}
              description={`Use section ${index}'s header and footer`}
              label="Same as previous section"
              onChange={onLinkChange}
            />
          ) : null}
        </div>

        <div className="mt-2 border-border border-t pt-3">
          <div className="text-muted-foreground text-xs">Page numbers</div>
          {index === 0 ? (
            <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span>
                First page number
                <span className="block text-muted-foreground text-xs">What the page number field shows on page 1</span>
              </span>
              <NumberField
                aria-label="First page number"
                className="w-24"
                max={9999}
                min={0}
                onValueChange={(value) => {
                  const startAt = value ?? 1
                  onChange({ startAt, restartNumbering: startAt !== 1 })
                }}
                value={settings.restartNumbering ? settings.startAt : 1}
              />
            </div>
          ) : (
            <SwitchRow
              checked={settings.restartNumbering}
              description={settings.restartNumbering ? 'This section starts again at' : 'Carry on from the previous section'}
              label="Restart numbering"
              onChange={(restartNumbering) => onChange({ restartNumbering })}
            >
              {settings.restartNumbering ? (
                <NumberField
                  aria-label="Restart at"
                  className="w-24"
                  max={9999}
                  min={0}
                  onValueChange={(value) => onChange({ startAt: value ?? 1 })}
                  value={settings.startAt}
                />
              ) : null}
            </SwitchRow>
          )}
        </div>

        {index > 0 ? (
          <div className="mt-2 border-border border-t pt-3">
            <button
              className="rounded-md px-1.5 py-1 text-destructive text-sm hover:bg-destructive/10"
              onClick={onRemoveBreak}
              type="button"
            >
              Remove section break
            </button>
            <p className="px-1.5 text-muted-foreground text-xs">Joins this section to section {index}, which keeps its setup.</p>
          </div>
        ) : null}
      </PopoverContent>
    </PopoverRoot>
  )
}
