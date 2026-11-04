import type { JSONContent } from '@tiptap/core'
import {
  DEFAULT_PAGE_SETUP,
  MARGIN_PRESETS,
  type Margins,
  MM_TO_PX,
  type MarginPreset,
  type Orientation,
  type PageSetup,
  pageSize,
} from './page'

/*
 * A document is a run of sections (section breaks start a new one). Each
 * section has its own page layout, header and footer and page numbering.
 * The section nodes in the document only carry an id; their settings live
 * next to the content (DocRecord.sections), keyed by that id, so that typing
 * in a header doesn't touch, and re-render, the document itself.
 */

/** Tiptap JSON of a header or footer (a doc of paragraphs), or null when empty. */
export type HeaderFooterDoc = JSONContent | null

export interface HeaderFooterContent {
  header: HeaderFooterDoc
  footer: HeaderFooterDoc
  /** Used on the section's first page when `differentFirstPage` is on. */
  firstHeader: HeaderFooterDoc
  firstFooter: HeaderFooterDoc
}

export type HeaderFooterField = keyof HeaderFooterContent

export interface SectionSettings {
  orientation: Orientation
  margins: MarginPreset
  /** The section's first page has its own header and footer. */
  differentFirstPage: boolean
  /** Start page numbering again at `startAt` where this section begins. */
  restartNumbering: boolean
  startAt: number
  /**
   * The section's own header and footer, or null for "same as the previous
   * section". The first section always has its own.
   */
  headerFooter: HeaderFooterContent | null
}

export type SectionMap = Record<string, SectionSettings>

/** Id of the first section in documents created before sections existed. */
export const FIRST_SECTION_ID = 'main'

export function newSectionId() {
  return crypto.randomUUID().slice(0, 8)
}

export const PAGE_NUMBER_FOOTER: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [{ type: 'pageField', attrs: { field: 'page' } }],
    },
  ],
}

const EMPTY_HEADER_FOOTER: HeaderFooterContent = {
  header: null,
  footer: null,
  firstHeader: null,
  firstFooter: null,
}

/** A new document: portrait, normal margins, the page number in the footer. */
export function defaultFirstSection(): SectionSettings {
  return settingsFromPageSetup(DEFAULT_PAGE_SETUP)
}

/** Documents saved before sections existed had one page setup for the whole document. */
export function settingsFromPageSetup(setup: PageSetup): SectionSettings {
  return {
    orientation: setup.orientation,
    margins: setup.margins,
    differentFirstPage: false,
    restartNumbering: false,
    startAt: 1,
    headerFooter: { ...EMPTY_HEADER_FOOTER, footer: setup.pageNumbers ? PAGE_NUMBER_FOOTER : null },
  }
}

/** Whether a header or footer has nothing in it (no text, no fields). */
export function isEmptyHeaderFooter(doc: HeaderFooterDoc) {
  if (!doc) return true
  const visit = (node: JSONContent): boolean =>
    !(node.type === 'text' && node.text?.trim()) &&
    node.type !== 'pageField' &&
    (node.content ?? []).every(visit)
  return visit(doc)
}

export interface ResolvedSection {
  id: string
  index: number
  /** The section's settings, with "same as previous" layout already filled in. */
  settings: SectionSettings
  /** Whether the section has settings of its own (false right after a section break). */
  stored: boolean
  /** Index of the section whose header and footer this one shows. */
  headerFooterSource: number
  headerFooter: HeaderFooterContent
}

/**
 * Settings for every section, in document order. A section without stored
 * settings (one just created by a section break) carries on the previous
 * section's layout and shares its header and footer.
 */
export function resolveSections(ids: string[], map: SectionMap): ResolvedSection[] {
  const out: ResolvedSection[] = []
  ids.forEach((id, index) => {
    const previous = out[index - 1]
    const own = map[id]
    let settings: SectionSettings
    if (own) settings = own
    else if (!previous) settings = defaultFirstSection()
    else
      settings = {
        ...previous.settings,
        differentFirstPage: false,
        restartNumbering: false,
        startAt: 1,
        headerFooter: null,
      }
    if (!previous && !settings.headerFooter) settings = { ...settings, headerFooter: EMPTY_HEADER_FOOTER }
    const linked = !settings.headerFooter && previous
    out.push({
      id,
      index,
      settings,
      stored: Boolean(own),
      headerFooterSource: linked ? previous.headerFooterSource : index,
      headerFooter: linked ? previous.headerFooter : (settings.headerFooter ?? EMPTY_HEADER_FOOTER),
    })
  })
  return out
}

/** The content shown on a page, given whether it's the first page of its section. */
export function headerFooterFor(section: ResolvedSection, firstOfSection: boolean) {
  const first = firstOfSection && section.settings.differentFirstPage
  return {
    header: first ? section.headerFooter.firstHeader : section.headerFooter.header,
    footer: first ? section.headerFooter.firstFooter : section.headerFooter.footer,
    headerField: (first ? 'firstHeader' : 'header') as HeaderFooterField,
    footerField: (first ? 'firstFooter' : 'footer') as HeaderFooterField,
  }
}

/** Heights of a section's rendered headers and footers, in CSS px. */
export interface HeaderFooterHeights {
  header: number
  footer: number
  firstHeader: number
  firstFooter: number
}

export const NO_HEIGHTS: HeaderFooterHeights = { header: 0, footer: 0, firstHeader: 0, firstFooter: 0 }

/** Space kept between a header or footer and the text, like Word. */
const HEADER_GAP = 4 * MM_TO_PX
/** Word's default distance from the edge of the page to a header or footer. */
const HEADER_DISTANCE = 12.5 * MM_TO_PX

export interface SectionGeometry {
  /** Page size, in CSS px. */
  width: number
  height: number
  margins: Margins
  /** From the top edge of the page to the top of the header. */
  headerTop: number
  /** From the bottom edge of the page to the bottom of the footer. */
  footerBottom: number
  /** Distance from the page edges to the text, on ordinary pages and on the section's first page. */
  textTop: number
  textBottom: number
  firstTextTop: number
  firstTextBottom: number
}

/** Page size, margins and where the text starts and ends, for one section. */
export function sectionGeometry(settings: SectionSettings, heights: HeaderFooterHeights): SectionGeometry {
  const size = pageSize(settings)
  const mm = MARGIN_PRESETS[settings.margins].margins
  const margins = {
    top: mm.top * MM_TO_PX,
    right: mm.right * MM_TO_PX,
    bottom: mm.bottom * MM_TO_PX,
    left: mm.left * MM_TO_PX,
  }
  // Halfway into narrow margins, so a one-line header still clears the text.
  const headerTop = Math.min(HEADER_DISTANCE, margins.top / 2)
  const footerBottom = Math.min(HEADER_DISTANCE, margins.bottom / 2)
  // A header taller than the margin pushes the text down, as in Word.
  const top = (height: number) => (height > 0 ? Math.max(margins.top, headerTop + height + HEADER_GAP) : margins.top)
  const bottom = (height: number) =>
    height > 0 ? Math.max(margins.bottom, footerBottom + height + HEADER_GAP) : margins.bottom
  const first = settings.differentFirstPage
  return {
    width: size.width * MM_TO_PX,
    height: size.height * MM_TO_PX,
    margins,
    headerTop,
    footerBottom,
    textTop: top(heights.header),
    textBottom: bottom(heights.footer),
    firstTextTop: top(first ? heights.firstHeader : heights.header),
    firstTextBottom: bottom(first ? heights.firstFooter : heights.footer),
  }
}

/** The number printed on each page, given the section each page belongs to. */
export function pageNumbers(pageSections: number[], sections: ResolvedSection[]) {
  const numbers: number[] = []
  pageSections.forEach((section, i) => {
    const startsSection = i === 0 || pageSections[i - 1] !== section
    const settings = sections[section]?.settings
    if (startsSection && settings?.restartNumbering) numbers.push(settings.startAt)
    else if (i === 0) numbers.push(1)
    else numbers.push(numbers[i - 1] + 1)
  })
  return numbers
}
