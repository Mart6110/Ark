import { type Editor, EditorContent } from '@tiptap/react'
import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { HeaderFooterEditor } from '@/components/header-footer-editor'
import { headerFooterHtml } from '@/editor/header-footer'
import { connectPages, type PageBox, type PageGeometry } from '@/editor/pagination'
import { PAGE_GAP } from '@/lib/page'
import { buildPrintRoot, type PrintPage } from '@/lib/print'
import { cn } from '@/lib/utils'
import {
  type HeaderFooterDoc,
  type HeaderFooterField,
  type HeaderFooterHeights,
  headerFooterFor,
  NO_HEIGHTS,
  pageNumbers,
  type ResolvedSection,
  type SectionGeometry,
  type SectionSettings,
  sectionGeometry,
} from '@/lib/sections'

export interface PageInfo {
  current: number
  total: number
  /** Index of the section the current page belongs to. */
  section: number
}

/** A header or footer being edited, on a given page. */
export interface HeaderFooterTarget {
  page: number
  kind: 'header' | 'footer'
  /** Where the click was, to put the cursor there. */
  point?: { x: number; y: number }
}

interface PagesProps {
  editor: Editor
  sections: ResolvedSection[]
  zoom: number
  onPageInfo: (info: PageInfo) => void
  editing: HeaderFooterTarget | null
  onEdit: (target: HeaderFooterTarget | null) => void
  onHeaderFooterChange: (sourceSection: number, field: HeaderFooterField, doc: HeaderFooterDoc) => void
  onSectionChange: (section: number, patch: Partial<SectionSettings>) => void
  onLinkChange: (section: number, linked: boolean) => void
  onHeaderFooterEditor: (editor: Editor | null) => void
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const HEIGHT_KEYS: (keyof HeaderFooterHeights)[] = ['header', 'footer', 'firstHeader', 'firstFooter']

/** The CSS variables a header or footer's page fields read their numbers from. */
const fieldVars = (pageNumber: number, pageCount: number) =>
  ({
    '--page-number': JSON.stringify(String(pageNumber)),
    '--page-count': JSON.stringify(String(pageCount)),
  }) as CSSProperties

/**
 * Renders every section's headers and footers off-screen at its text width and
 * reports their heights: a tall header pushes that section's text down.
 */
function useHeaderFooterHeights(sections: ResolvedSection[], geometries: SectionGeometry[]) {
  const container = useRef<HTMLDivElement>(null)
  const [heights, setHeights] = useState<HeaderFooterHeights[]>([])

  useLayoutEffect(() => {
    const el = container.current
    if (!el) return
    const measure = () => {
      const next = sections.map((_, i) => {
        const row = { ...NO_HEIGHTS }
        for (const key of HEIGHT_KEYS) {
          const box = el.querySelector<HTMLElement>(`[data-measure="${i}-${key}"]`)
          row[key] = box?.innerHTML ? box.getBoundingClientRect().height : 0
        }
        return row
      })
      setHeights((previous) =>
        previous.length === next.length &&
        previous.every((row, i) => HEIGHT_KEYS.every((key) => Math.abs(row[key] - next[i][key]) < 0.5))
          ? previous
          : next,
      )
    }
    measure()
    // Fonts finish loading after the first measurement.
    const observer = new ResizeObserver(measure)
    for (const child of el.children) observer.observe(child)
    return () => observer.disconnect()
  })

  const measurer = (
    <div aria-hidden className="hf-measure" ref={container}>
      {sections.map((section, i) =>
        HEIGHT_KEYS.map((key) => (
          <div
            className="hf-box"
            // Static, escaped HTML built from the stored header or footer.
            dangerouslySetInnerHTML={{ __html: headerFooterHtml(section.headerFooter[key]) }}
            data-measure={`${i}-${key}`}
            key={`${i}-${key}`}
            style={{ width: geometries[i].width - geometries[i].margins.left - geometries[i].margins.right }}
          />
        )),
      )}
    </div>
  )
  return { heights, measurer }
}

/**
 * The page sheets, with the editor laid over them. The Pagination extension
 * (editor/pagination.ts) pushes text down so it lands on the right sheet;
 * this component draws the sheets, their headers and footers, and tells the
 * extension each section's geometry.
 */
export function Pages({
  editor,
  sections,
  zoom,
  onPageInfo,
  editing,
  onEdit,
  onHeaderFooterChange,
  onSectionChange,
  onLinkChange,
  onHeaderFooterEditor,
}: PagesProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [reported, setPages] = useState<PageBox[]>(() => editor.storage.pagination.pages)
  const [hover, setHover] = useState<{ page: number; kind: 'header' | 'footer' } | null>(null)

  const plainGeometries = useMemo(() => sections.map((s) => sectionGeometry(s.settings, NO_HEIGHTS)), [sections])
  const { heights, measurer } = useHeaderFooterHeights(sections, plainGeometries)
  const geometries = useMemo(
    () => sections.map((s, i) => sectionGeometry(s.settings, heights[i] ?? NO_HEIGHTS)),
    [sections, heights],
  )

  const geometryKey = JSON.stringify({
    pageGap: PAGE_GAP,
    zoom,
    sections: Object.fromEntries(
      sections.map((s, i) => {
        const g = geometries[i]
        return [
          s.id,
          {
            pageHeight: g.height,
            textTop: g.textTop,
            textBottom: g.textBottom,
            firstTextTop: g.firstTextTop,
            firstTextBottom: g.firstTextBottom,
          },
        ]
      }),
    ),
  } satisfies PageGeometry)
  useEffect(() => connectPages(editor, JSON.parse(geometryKey) as PageGeometry, setPages), [editor, geometryKey])

  // Until the first layout, show the first page so the document doesn't flash empty.
  const first = geometries[0]
  const pages: PageBox[] = reported.length
    ? reported.filter((page) => page.section < sections.length)
    : [
        {
          section: 0,
          sectionId: sections[0]?.id ?? '',
          firstOfSection: true,
          top: 0,
          height: first.height,
          textTop: first.firstTextTop,
          textBottom: first.height - first.firstTextBottom,
        },
      ]
  const numbers = pageNumbers(
    pages.map((p) => p.section),
    sections,
  )
  const width = Math.max(...geometries.map((g) => g.width))
  const sheetLeft = (g: SectionGeometry) => (width - g.width) / 2
  const origin = pages[0].textTop
  const last = pages[pages.length - 1]

  // Each section's text column, centred on its own page.
  const columnCss = sections
    .map((s, i) => {
      const g = geometries[i]
      const rule = `margin-left: ${sheetLeft(g) + g.margins.left}px; width: ${g.width - g.margins.left - g.margins.right}px;`
      const selector = s.id ? `section[data-id="${CSS.escape(s.id)}"]` : `section:nth-child(${i + 1})`
      return `.page-body .doc-content .ProseMirror > ${selector} { ${rule} }`
    })
    .join('\n')
  const fallbackColumn = `.page-body .doc-content .ProseMirror > section { margin-left: ${sheetLeft(first) + first.margins.left}px; width: ${first.width - first.margins.left - first.margins.right}px; }`

  // The current page: where the caret is, or the header or footer being edited.
  const pagesRef = useRef(pages)
  useLayoutEffect(() => {
    pagesRef.current = pages
  })
  useEffect(() => {
    let frame = 0
    let reportedKey = ''
    const measure = () => {
      frame = 0
      if (editor.isDestroyed) return
      const list = pagesRef.current
      let current = 0
      if (editing) current = clamp(editing.page, 0, list.length - 1)
      else {
        try {
          const top = editor.view.dom.getBoundingClientRect().top
          const caret = editor.view.coordsAtPos(editor.state.selection.head)
          const y = (caret.top - top) / zoom + list[0].textTop
          current = Math.max(0, list.findLastIndex((page) => page.top <= y + 1))
        } catch {
          // coordsAtPos throws while the view is mid-update; keep the first page.
        }
      }
      const info = { current: current + 1, total: list.length, section: list[current]?.section ?? 0 }
      const key = `${info.current}/${info.total}/${info.section}`
      if (key !== reportedKey) {
        reportedKey = key
        onPageInfo(info)
      }
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    schedule()
    editor.on('transaction', schedule)
    return () => {
      editor.off('transaction', schedule)
      cancelAnimationFrame(frame)
    }
  }, [editor, zoom, pages.length, editing, onPageInfo])

  // Print the pages as laid out on screen (see lib/print.ts).
  const printPages: PrintPage[] = pages.map((page, i) => {
    const g = geometries[page.section] ?? first
    const content = headerFooterFor(sections[page.section] ?? sections[0], page.firstOfSection)
    return {
      width: g.width,
      height: g.height,
      marginLeft: g.margins.left,
      marginRight: g.margins.right,
      textTop: page.textTop - page.top,
      textBottom: page.top + page.height - page.textBottom,
      headerTop: g.headerTop,
      footerBottom: g.footerBottom,
      headerHtml: headerFooterHtml(content.header),
      footerHtml: headerFooterHtml(content.footer),
      pageNumber: numbers[i],
      pageCount: pages.length,
      landscape: g.width > g.height,
    }
  })
  const printData = useRef(printPages)
  useLayoutEffect(() => {
    printData.current = printPages
  })
  useEffect(() => {
    let root: HTMLElement | null = null
    const before = () => {
      root?.remove()
      root = buildPrintRoot(editor.view.dom, printData.current)
      document.body.append(root)
    }
    const after = () => {
      root?.remove()
      root = null
    }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
      after()
    }
  }, [editor])

  /** The page and header or footer zone under a point, in CSS px of the pages. */
  const zoneAt = (clientX: number, clientY: number) => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return null
    const x = (clientX - rect.left) / zoom
    const y = (clientY - rect.top) / zoom
    const index = pages.findIndex((page) => y >= page.top && y <= page.top + page.height)
    if (index < 0) return null
    const page = pages[index]
    const g = geometries[page.section] ?? first
    const left = sheetLeft(g)
    if (x < left || x > left + g.width) return null
    if (y < page.textTop) return { page: index, kind: 'header' as const }
    if (y > page.textBottom) return { page: index, kind: 'footer' as const }
    return null
  }

  // Clicking a page's top or bottom margin edits its header or footer; clicking the text stops.
  const onMouseDownCapture = (event: MouseEvent) => {
    if (event.button !== 0) return
    const target = event.target as Element
    if (target.closest('.hf-editor, .hf-bar')) return
    const zone = zoneAt(event.clientX, event.clientY)
    if (zone) {
      event.preventDefault()
      event.stopPropagation()
      onEdit({ ...zone, point: { x: event.clientX, y: event.clientY } })
    } else if (editing) {
      onEdit(null)
    }
  }

  // Clicking beside the text (outside the editor) puts the caret on the nearest line.
  const onMouseDown = (event: MouseEvent) => {
    const dom = editor.view.dom
    if (event.button !== 0 || dom.contains(event.target as Node)) return
    event.preventDefault()
    const rect = dom.getBoundingClientRect()
    const lastBottom = dom.lastElementChild?.getBoundingClientRect().bottom ?? rect.bottom
    const pos = editor.view.posAtCoords({
      left: clamp(event.clientX, rect.left + 1, rect.right - 1),
      top: clamp(event.clientY, rect.top + 1, Math.max(rect.top + 1, lastBottom - 2)),
    })
    editor
      .chain()
      .focus()
      .setTextSelection(pos?.pos ?? editor.state.doc.content.size)
      .run()
  }

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    const zone = zoneAt(event.clientX, event.clientY)
    setHover((current) =>
      current?.page === zone?.page && current?.kind === zone?.kind ? current : zone,
    )
  }

  const editingPage = editing ? pages[editing.page] : undefined
  const editingSection = editingPage ? sections[editingPage.section] : undefined

  return (
    <>
      {measurer}
      <div
        // Plain strings: Tailwind finds class names by scanning the source, and
        // a template literal would hide "mx-auto" from it.
        className={cn('pages relative mx-auto', editing && 'hf-editing')}
        onMouseDownCapture={onMouseDownCapture}
        onPointerLeave={() => setHover(null)}
        onPointerMove={onPointerMove}
        ref={rootRef}
        style={{ zoom, width }}
      >
        <style>{`${fallbackColumn}\n${columnCss}`}</style>
        {pages.map((page, i) => {
          const g = geometries[page.section] ?? first
          const section = sections[page.section]
          const content = headerFooterFor(section, page.firstOfSection)
          const left = sheetLeft(g)
          const boxStyle = { left: left + g.margins.left, width: g.width - g.margins.left - g.margins.right }
          const editingHere = editing?.page === i
          const startsSection = page.firstOfSection && page.section > 0
          return (
            <div key={`${page.sectionId}-${i}`}>
              <div
                aria-hidden
                className="page-sheet"
                style={{ top: page.top, height: page.height, left, width: g.width }}
              />
              {startsSection ? (
                <div aria-hidden className="section-label" style={{ top: page.top + 8, left: left + 10 }}>
                  Section {page.section + 1}
                </div>
              ) : null}
              <div
                aria-hidden
                className={cn('hf-box hf-header', editingHere && editing?.kind === 'header' && 'hf-hidden')}
                // Static, escaped HTML built from the stored header.
                dangerouslySetInnerHTML={{ __html: headerFooterHtml(content.header) }}
                style={{ ...boxStyle, top: page.top + g.headerTop, ...fieldVars(numbers[i], pages.length) }}
              />
              <div
                aria-hidden
                className={cn('hf-box hf-footer', editingHere && editing?.kind === 'footer' && 'hf-hidden')}
                dangerouslySetInnerHTML={{ __html: headerFooterHtml(content.footer) }}
                style={{
                  ...boxStyle,
                  top: page.top + page.height - g.footerBottom,
                  ...fieldVars(numbers[i], pages.length),
                }}
              />
              {hover?.page === i && !(editingHere && editing?.kind === hover.kind) ? (
                <div
                  aria-hidden
                  className="hf-hover"
                  data-kind={hover.kind}
                  style={
                    hover.kind === 'header'
                      ? { left: boxStyle.left - 6, width: boxStyle.width + 12, top: page.top + 4, height: page.textTop - page.top - 8 }
                      : {
                          left: boxStyle.left - 6,
                          width: boxStyle.width + 12,
                          top: page.textBottom + 4,
                          height: page.top + page.height - page.textBottom - 8,
                        }
                  }
                >
                  <span>{hover.kind === 'header' ? 'Edit header' : 'Edit footer'}</span>
                </div>
              ) : null}
            </div>
          )
        })}

        {editing && editingPage && editingSection ? (
          <HeaderFooterEditor
            geometry={geometries[editingPage.section] ?? first}
            kind={editing.kind}
            onChange={onHeaderFooterChange}
            onDone={() => {
              onEdit(null)
              editor.commands.focus()
            }}
            onEditor={onHeaderFooterEditor}
            onLinkChange={onLinkChange}
            onSectionChange={onSectionChange}
            page={editingPage}
            pageCount={pages.length}
            pageNumber={numbers[editing.page]}
            point={editing.point}
            section={editingSection}
            sectionCount={sections.length}
            sheetLeft={sheetLeft(geometries[editingPage.section] ?? first)}
            zoom={zoom}
          />
        ) : null}

        <div
          className="page-body relative"
          onMouseDown={onMouseDown}
          style={
            {
              paddingTop: origin,
              paddingBottom: last.top + last.height - last.textBottom,
              '--content-min-height': `${last.textBottom - origin}px`,
              '--page-content-height': `${Math.min(...geometries.map((g) => g.height - g.textTop - g.textBottom))}px`,
            } as CSSProperties
          }
        >
          <EditorContent className="doc-content" editor={editor} />
        </div>
      </div>
    </>
  )
}
