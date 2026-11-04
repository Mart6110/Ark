export type Orientation = 'portrait' | 'landscape'
export type MarginPreset = 'normal' | 'narrow' | 'moderate' | 'wide'

/**
 * How documents saved before sections existed stored their layout (now a
 * section's settings, see sections.ts). Still read to bring them up to date.
 */
export interface PageSetup {
  orientation: Orientation
  margins: MarginPreset
  /** Page number in the bottom margin, on screen, in print and in .docx. */
  pageNumbers: boolean
}

export interface Margins {
  top: number
  right: number
  bottom: number
  left: number
}

/** Margin presets in millimetres, matching Word's. */
export const MARGIN_PRESETS: Record<
  MarginPreset,
  { label: string; margins: Margins }
> = {
  normal: {
    label: 'Normal',
    margins: { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 },
  },
  narrow: {
    label: 'Narrow',
    margins: { top: 12.7, right: 12.7, bottom: 12.7, left: 12.7 },
  },
  moderate: {
    label: 'Moderate',
    margins: { top: 25.4, right: 19.05, bottom: 25.4, left: 19.05 },
  },
  wide: {
    label: 'Wide',
    margins: { top: 25.4, right: 50.8, bottom: 25.4, left: 50.8 },
  },
}

export const DEFAULT_PAGE_SETUP: PageSetup = {
  orientation: 'portrait',
  margins: 'normal',
  pageNumbers: true,
}

/** Gap between pages on screen, in CSS px. */
export const PAGE_GAP = 28

const A4 = { width: 210, height: 297 }

/** Page size in millimetres. */
export function pageSize({ orientation }: { orientation: Orientation }) {
  return orientation === 'portrait'
    ? A4
    : { width: A4.height, height: A4.width }
}

export const MM_TO_PX = 96 / 25.4

/** "2.54 cm" */
export function formatCm(mm: number) {
  return `${(mm / 10).toLocaleString('en-GB', { maximumFractionDigits: 2 })} cm`
}
