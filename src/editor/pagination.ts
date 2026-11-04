import { type Editor, Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'

/*
 * Paginated layout without touching the document.
 *
 * The page sheets are drawn behind the editor (see components/page.tsx). This
 * plugin measures the text and inserts "spacer" widget decorations that push
 * content down to the top of the next sheet:
 *
 *   - inside a paragraph, at the start of the first line that doesn't fit, so
 *     paragraphs split between lines;
 *   - before a list item, when the item's first line has to move (keeps the
 *     bullet with its text);
 *   - as an empty table row before the first row that doesn't fit.
 *
 * Every spacer sits *inside* its paragraph, list or table, so it shifts what
 * follows by exactly its own height and never changes how margins collapse.
 * Layout is measured with the spacers hidden by a CSS class (no DOM changes),
 * which makes every pass independent of the previous one, and a transaction
 * is only dispatched when the page starts actually move. Printing cuts the
 * text into pages at the spacers (lib/print.ts), so the PDF has the same
 * pages as the screen.
 *
 * Pages come in sections (see sections.ts): every section starts on a new
 * page and can have its own page size and text area, so the plugin works
 * out each page's geometry as it goes and reports the pages it made.
 *
 * Where a page starts with an element (not halfway through one), that
 * element's top margin is kept at the top of the page, as print does for a
 * forced break; a heading that starts a page keeps its space above.
 */

/** One section's pages, in CSS pixels at 100 % zoom. */
export interface SectionPageGeometry {
  pageHeight: number
  /** The text area, as distances from the top and bottom edges of the page. */
  textTop: number
  textBottom: number
  /** The same on the section's first page (its header or footer can differ). */
  firstTextTop: number
  firstTextBottom: number
}

export interface PageGeometry {
  pageGap: number
  /** The CSS zoom applied to the pages, to turn screen pixels into CSS pixels. */
  zoom: number
  /** By section id. A section the geometry doesn't know yet carries on the previous one's. */
  sections: Record<string, SectionPageGeometry>
}

/** One page, in CSS px from the top edge of the first page. */
export interface PageBox {
  section: number
  sectionId: string
  firstOfSection: boolean
  top: number
  height: number
  textTop: number
  textBottom: number
}

export interface PaginationStorage {
  geometry: PageGeometry | null
  pages: PageBox[]
  onPages: ((pages: PageBox[]) => void) | null
  /** Re-run layout now (geometry changed). */
  relayout: () => void
}

declare module '@tiptap/core' {
  interface Storage {
    pagination: PaginationStorage
  }
}

type SpacerKind = 'inline' | 'block' | 'row'

interface Spacer {
  pos: number
  height: number
  kind: SpacerKind
  /** Column count, for table rows. */
  columns?: number
}

const key = new PluginKey<DecorationSet>('pagination')

/**
 * Leaves a little room at the bottom of every page, so print, which lays out
 * with slightly different rounding, never needs to break earlier than we did.
 */
const PRINT_SAFETY = 3

function spacerDecoration({ pos, height, kind, columns }: Spacer) {
  return Decoration.widget(
    pos,
    () => {
      if (kind === 'row') {
        const row = document.createElement('tr')
        row.className = 'page-spacer-row'
        row.contentEditable = 'false'
        const cell = row.appendChild(document.createElement('td'))
        cell.colSpan = columns ?? 1
        cell.style.height = `${height}px`
        return row
      }
      const el = document.createElement(kind === 'inline' ? 'span' : 'div')
      el.className = 'page-spacer'
      el.contentEditable = 'false'
      el.style.height = `${height}px`
      return el
    },
    {
      side: -1,
      ignoreSelection: true,
      key: `page-spacer:${kind}:${pos}:${height.toFixed(1)}`,
      spacer: { pos, height, kind, columns } satisfies Spacer,
    },
  )
}

/** Whether the decorations already on screen are the layout we just computed. */
function sameLayout(current: Decoration[], next: Spacer[]) {
  if (current.length !== next.length) return false
  const sorted = [...current].sort((a, b) => a.from - b.from)
  return sorted.every((decoration, i) => {
    const old = decoration.spec.spacer as Spacer
    const s = next[i]
    return (
      decoration.from === s.pos &&
      old.kind === s.kind &&
      old.columns === s.columns &&
      Math.abs(old.height - s.height) < 0.5
    )
  })
}

interface Line {
  top: number
  bottom: number
  /** Screen coordinates inside the line, to look up where it starts. */
  probe: { left: number; top: number }
}

interface Target {
  pos: number
  kind: SpacerKind
  columns?: number
  /**
   * The element the spacer is the first child of, if any. In print, the
   * break propagates up from there (see the comment at the top).
   */
  anchor?: Element | null
}

const isSpacer = (el: Element) =>
  el.classList.contains('page-spacer') || el.classList.contains('page-spacer-row')

/** First element child, ignoring (hidden) spacers from the previous layout. */
function firstChild(parent: Element) {
  let child = parent.firstElementChild
  while (child && isSpacer(child)) child = child.nextElementSibling
  return child
}

/**
 * The top margin print keeps when a page starts with `el`: its own, collapsed
 * with the margins of its first descendants down to the first padding/border.
 */
function keptMarginTop(el: Element) {
  let style = getComputedStyle(el)
  let margin = Number.parseFloat(style.marginTop)
  let current = el
  while (
    Number.parseFloat(style.paddingTop) === 0 &&
    Number.parseFloat(style.borderTopWidth) === 0
  ) {
    const child = firstChild(current)
    if (!child) break
    style = getComputedStyle(child)
    if (!style.display.startsWith('block') && style.display !== 'list-item' && style.display !== 'flex') break
    margin = Math.max(margin, Number.parseFloat(style.marginTop))
    current = child
  }
  return margin
}

/** Works out where every page starts, from the layout without any spacers. */
function computeSpacers(view: EditorView, g: PageGeometry): { spacers: Spacer[]; pages: PageBox[] } | null {
  const { doc } = view.state
  const firstId = (doc.firstChild?.attrs.id as string | null) ?? ''
  let geometry = g.sections[firstId] ?? Object.values(g.sections)[0]
  if (!geometry) return null
  const screenOrigin = view.dom.getBoundingClientRect().top
  /** Screen y → CSS px from the top of the text area, without spacers. */
  const y = (screenY: number) => (screenY - screenOrigin) / g.zoom

  const pages: PageBox[] = []
  const openPage = (section: number, sectionId: string, firstOfSection: boolean, top: number) => {
    const textTop = firstOfSection ? geometry.firstTextTop : geometry.textTop
    const textBottom = firstOfSection ? geometry.firstTextBottom : geometry.textBottom
    pages.push({
      section,
      sectionId,
      firstOfSection,
      top,
      height: geometry.pageHeight,
      textTop: top + textTop,
      textBottom: top + geometry.pageHeight - textBottom,
    })
  }
  openPage(0, firstId, true, 0)
  /** The editor's top edge is the first page's text top; page coordinates are relative to it. */
  const origin = pages[0].textTop

  const spacers: Spacer[] = []
  let shift = 0
  /** Set by a manual page break or a new section: the next content starts a new page. */
  let forceBreak = false
  /** The section the next page belongs to, when a section starts. */
  let nextSection: { index: number; id: string } | null = null
  /** A heading that ended up last on its page moves along with what follows it. */
  let heading: { top: number; target: Target; page: number } | null = null

  const current = () => pages[pages.length - 1]
  const pageBottom = () => current().textBottom - origin - PRINT_SAFETY
  const pageTop = () => current().textTop - origin

  /** How far below the page top the moved content starts in print. */
  const startOffset = (target: Target, naturalTop: number) => {
    if (!target.anchor) return 0
    let outer = target.anchor
    while (outer.parentElement && outer.parentElement !== view.dom && firstChild(outer.parentElement) === outer) {
      outer = outer.parentElement
    }
    return keptMarginTop(outer) + naturalTop - y(outer.getBoundingClientRect().top)
  }

  const newPage = (naturalTop: number, { anchor, ...target }: Target) => {
    const offset = startOffset({ ...target, anchor }, naturalTop)
    const previous = current()
    const top = previous.top + previous.height + g.pageGap
    if (nextSection) {
      geometry = g.sections[nextSection.id] ?? geometry
      openPage(nextSection.index, nextSection.id, true, top)
      nextSection = null
    } else {
      openPage(previous.section, previous.sectionId, false, top)
    }
    const height = pageTop() + offset - (naturalTop + shift)
    spacers.push({ ...target, height })
    shift += height
  }

  /** Before moving a unit's first line: take an orphaned heading along. */
  const moveFirstLine = (naturalTop: number, target: Target) => {
    if (heading && heading.page === pages.length - 1 && heading.top + shift > pageTop() + 1) {
      newPage(heading.top, heading.target)
    } else {
      newPage(naturalTop, target)
    }
    heading = null
  }

  const contentBox = (el: HTMLElement) => {
    const style = getComputedStyle(el)
    const box = el.getBoundingClientRect()
    return {
      top: y(box.top) + Number.parseFloat(style.paddingTop) + Number.parseFloat(style.borderTopWidth),
      bottom: y(box.bottom) - Number.parseFloat(style.paddingBottom) - Number.parseFloat(style.borderBottomWidth),
    }
  }

  /** Where line `line` of the textblock at `pos` starts, or null if that can't be found. */
  const lineStart = (line: Line, node: PMNode, pos: number) => {
    const hit = view.posAtCoords(line.probe)
    return hit && hit.pos > pos + 1 && hit.pos < pos + node.nodeSize - 1 ? hit.pos : null
  }

  const textLines = (el: HTMLElement): Line[] => {
    const { top: contentTop, bottom: contentBottom } = contentBox(el)

    const range = document.createRange()
    range.selectNodeContents(el)
    const rects = Array.from(range.getClientRects())
      .filter((r) => r.height > 0)
      .sort((a, b) => a.top - b.top)
    const rows: { top: number; bottom: number; left: number }[] = []
    for (const r of rects) {
      const last = rows.at(-1)
      if (last && r.top < last.bottom - 1) {
        last.bottom = Math.max(last.bottom, r.bottom)
        last.left = Math.min(last.left, r.left)
      } else {
        rows.push({ top: r.top, bottom: r.bottom, left: r.left })
      }
    }
    if (rows.length <= 1) {
      return [{ top: contentTop, bottom: contentBottom, probe: { left: 0, top: 0 } }]
    }

    // Line boxes meet halfway between the text of neighbouring lines.
    return rows.map((row, i) => ({
      top: i === 0 ? contentTop : y((rows[i - 1].bottom + row.top) / 2),
      bottom: i === rows.length - 1 ? contentBottom : y((row.bottom + rows[i + 1].top) / 2),
      probe: { left: row.left + 1, top: (row.top + row.bottom) / 2 },
    }))
  }

  const placeTextblock = (node: PMNode, pos: number, start: Target) => {
    const el = view.nodeDOM(pos)
    if (!(el instanceof HTMLElement)) return
    const box = el.getBoundingClientRect()
    // A spacer at the start of the text is the textblock's first child.
    const firstLine = start.kind === 'inline' ? { ...start, anchor: el } : start

    if (forceBreak) {
      forceBreak = false
      heading = null
      newPage(contentBox(el).top, firstLine)
    }

    if (y(box.bottom) + shift <= pageBottom()) {
      heading =
        node.type.name === 'heading' ? { top: contentBox(el).top, target: firstLine, page: pages.length - 1 } : null
      return
    }

    const lines = textLines(el)
    const startOf = (i: number) => lineStart(lines[i], node, pos)
    let first = 0
    for (let guard = 0; guard < lines.length + 2; guard++) {
      const bottom = pageBottom()
      let j = lines.findIndex((line, i) => i >= first && line.bottom + shift > bottom)
      if (j === -1) break

      if (j === first) {
        // The first line on this page doesn't fit. If it's already at the top
        // of a page it's taller than a page: let it overflow and go on.
        if (lines[j].top + shift <= pageTop() + 1) {
          first = j + 1
          if (first >= lines.length) break
          const start = startOf(first)
          if (start !== null) newPage(lines[first].top, { pos: start, kind: 'inline' })
          continue
        }
      } else {
        // Don't leave a single line behind, or carry a single line over.
        if (j === 1 && first === 0) j = 0
        else if (j === lines.length - 1 && j - 1 > first && lines.length >= 3) j -= 1
      }

      if (j === 0) moveFirstLine(lines[0].top, firstLine)
      else {
        const start = startOf(j)
        if (start === null) break
        newPage(lines[j].top, { pos: start, kind: 'inline' })
      }
      first = j
    }
    heading = null
  }

  const placeTable = (node: PMNode, pos: number) => {
    const wrapper = view.nodeDOM(pos)
    if (!(wrapper instanceof HTMLElement)) return
    const rows = Array.from(wrapper.querySelectorAll<HTMLTableRowElement>('tbody > tr:not(.page-spacer-row)'))
    const columns = Math.max(
      1,
      ...rows.map((row) => Array.from(row.cells).reduce((n, cell) => n + cell.colSpan, 0)),
    )
    const rowPositions: number[] = []
    node.forEach((_row, offset) => rowPositions.push(pos + 1 + offset))
    const tops = rows.map((row) => y(row.getBoundingClientRect().top))
    const bottoms = rows.map((row) => y(row.getBoundingClientRect().bottom))
    const target = (i: number): Target => ({
      pos: rowPositions[i],
      kind: 'row',
      columns,
      anchor: i === 0 ? rows[0].parentElement : null,
    })
    if (!rows.length || rows.length !== rowPositions.length) return

    if (forceBreak) {
      forceBreak = false
      heading = null
      newPage(tops[0], target(0))
    }

    let first = 0
    for (let guard = 0; guard < rows.length + 2; guard++) {
      const j = bottoms.findIndex((b, i) => i >= first && b + shift > pageBottom())
      if (j === -1) break
      if (j === first && tops[j] + shift <= pageTop() + 1) {
        // A row taller than a page: it overflows.
        first = j + 1
        if (first >= rows.length) break
        newPage(tops[first], target(first))
        continue
      }
      if (j === 0) moveFirstLine(tops[0], target(0))
      else newPage(tops[j], target(j))
      first = j
    }
    heading = null
  }

  const walk = (parent: PMNode, parentPos: number) => {
    parent.forEach((child, offset) => {
      const pos = parentPos + offset
      const name = child.type.name
      if (name === 'pageBreak') {
        forceBreak = true
        heading = null
      } else if (child.isTextblock) {
        placeTextblock(child, pos, { pos: pos + 1, kind: 'inline' })
      } else if (name === 'table') {
        placeTable(child, pos)
      } else if (name === 'listItem' || name === 'taskItem') {
        // The item's first line moves together with its bullet or checkbox.
        const item = view.nodeDOM(pos)
        const list = item instanceof Element ? item.parentElement : null
        const itemTarget: Target = {
          pos,
          kind: 'block',
          anchor: list && firstChild(list) === item ? list : null,
        }
        let first = true
        child.forEach((grandchild, childOffset) => {
          const childPos = pos + 1 + childOffset
          if (grandchild.isTextblock) {
            placeTextblock(grandchild, childPos, first ? itemTarget : { pos: childPos + 1, kind: 'inline' })
          } else {
            walk(grandchild, childPos + 1)
          }
          first = false
        })
      } else if (child.childCount > 0 && !child.isLeaf) {
        walk(child, pos + 1)
      }
      // Other leaves (horizontal rules) are thin enough to sit in the margin.
    })
  }

  // Top level: sections. Each one after the first starts on a new page.
  doc.forEach((section, offset, index) => {
    if (index > 0) {
      forceBreak = true
      nextSection = { index, id: (section.attrs.id as string | null) ?? '' }
      heading = null
    }
    walk(section, offset + 1)
  })
  return { spacers: spacers.sort((a, b) => a.pos - b.pos), pages }
}

const samePages = (a: PageBox[], b: PageBox[]) =>
  a.length === b.length &&
  a.every(
    (page, i) =>
      page.sectionId === b[i].sectionId &&
      page.section === b[i].section &&
      page.firstOfSection === b[i].firstOfSection &&
      Math.abs(page.top - b[i].top) < 0.5 &&
      Math.abs(page.height - b[i].height) < 0.5 &&
      Math.abs(page.textTop - b[i].textTop) < 0.5 &&
      Math.abs(page.textBottom - b[i].textBottom) < 0.5,
  )

class PaginationView {
  private frame = 0
  private retry = 0
  private observer: ResizeObserver
  private lastSize = ''
  private view: EditorView
  private storage: PaginationStorage

  constructor(view: EditorView, storage: PaginationStorage) {
    this.view = view
    this.storage = storage
    this.observer = new ResizeObserver(() => {
      // Our own layout passes resize the editor too; only react to real changes.
      const size = this.size()
      if (size !== this.lastSize) this.schedule()
    })
    this.observer.observe(view.dom)
    storage.relayout = () => this.schedule()
    this.schedule()
  }

  private size() {
    const { width, height } = this.view.dom.getBoundingClientRect()
    return `${Math.round(width)}x${Math.round(height)}`
  }

  update(view: EditorView, previous: { doc: PMNode }) {
    this.view = view
    if (!view.state.doc.eq(previous.doc)) this.schedule()
  }

  schedule() {
    if (!this.frame) this.frame = requestAnimationFrame(() => this.layout())
  }

  private layout() {
    this.frame = 0
    const { view, storage } = this
    const geometry = storage.geometry
    if (!geometry || !view.dom.isConnected) return
    // Re-rendering around an IME composition would cancel it.
    if (view.composing) {
      window.clearTimeout(this.retry)
      this.retry = window.setTimeout(() => this.schedule(), 150)
      return
    }

    const dom = view.dom
    // Hold the height while spacers are hidden, so the scroll position can't jump.
    dom.style.minHeight = `${dom.getBoundingClientRect().height / geometry.zoom}px`
    dom.classList.add('pagination-measuring')
    const layout = computeSpacers(view, geometry)
    dom.classList.remove('pagination-measuring')
    dom.style.minHeight = ''
    if (!layout) return
    if (!sameLayout(key.getState(view.state)?.find() ?? [], layout.spacers)) {
      view.dispatch(view.state.tr.setMeta(key, layout.spacers).setMeta('addToHistory', false))
    }
    this.lastSize = this.size()

    if (!samePages(storage.pages, layout.pages)) {
      storage.pages = layout.pages
      storage.onPages?.(layout.pages)
    }
  }

  destroy() {
    cancelAnimationFrame(this.frame)
    window.clearTimeout(this.retry)
    this.observer.disconnect()
  }
}

/**
 * Tells the extension the page geometry and where to report the pages.
 * Returns a function that stops the reporting.
 */
export function connectPages(editor: Editor, geometry: PageGeometry, onPages: (pages: PageBox[]) => void) {
  const storage = editor.storage.pagination
  storage.geometry = geometry
  storage.onPages = onPages
  storage.relayout()
  return () => {
    if (storage.onPages === onPages) storage.onPages = null
  }
}

export const Pagination = Extension.create<object, PaginationStorage>({
  name: 'pagination',

  addStorage() {
    return { geometry: null, pages: [], onPages: null, relayout: () => {} }
  },

  addProseMirrorPlugins() {
    const storage = this.storage
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const spacers = tr.getMeta(key) as Spacer[] | undefined
            if (spacers) return DecorationSet.create(tr.doc, spacers.map(spacerDecoration))
            return set.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations: (state) => key.getState(state),
        },
        view: (view) => new PaginationView(view, storage),
      }),
    ]
  },
})
