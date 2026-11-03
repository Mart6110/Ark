export const DEFAULT_FONT_LABEL = 'Source Serif'

export const FONT_FAMILIES = [
  { label: 'Geist', value: '"Geist Variable", "Helvetica Neue", Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
]

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72]

/** Sizes from index.css, so the size box shows something sensible for headings. */
export const BLOCK_FONT_SIZE: Record<string, number> = {
  h1: 24,
  h2: 17,
  h3: 13.5,
  h4: 10.5,
  p: 12,
  quote: 12,
}

export function firstFamilyName(family: string) {
  return family.split(',')[0].trim().replace(/^["']|["']$/g, '')
}

/** "12pt" → 12, "16px" → 12. */
export function parseFontSize(size: string | null | undefined) {
  if (!size) return null
  const value = Number.parseFloat(size)
  if (!Number.isFinite(value)) return null
  return size.endsWith('px') ? Math.round(value * 0.75 * 2) / 2 : value
}

export const TEXT_COLORS = [
  ['#000000', '#292524', '#44403c', '#57534e', '#78716c', '#a8a29e', '#d6d3d1', '#e7e5e4', '#f5f5f4', '#ffffff'],
  ['#b91c1c', '#c2410c', '#b45309', '#4d7c0f', '#047857', '#0e7490', '#1d4ed8', '#4338ca', '#7e22ce', '#be185d'],
  ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399', '#22d3ee', '#60a5fa', '#818cf8', '#c084fc', '#f472b6'],
]

/** Soft marker colors that keep black text readable. */
export const HIGHLIGHT_COLORS = [
  ['#fef08a', '#fed7aa', '#fecaca', '#fbcfe8'],
  ['#ddd6fe', '#bae6fd', '#bbf7d0', '#e7e5e4'],
]
