import { type Editor, EditorContent } from '@tiptap/react'
import { type CSSProperties, type MouseEvent, useEffect, useState } from 'react'
import { connectPages } from '@/editor/pagination'
import { MARGIN_PRESETS, MM_TO_PX, PAGE_GAP, type PageSetup, pageSize } from '@/lib/page'

export interface PageInfo {
  current: number
  total: number
}

interface PagesProps {
  editor: Editor
  pageSetup: PageSetup
  zoom: number
  onPageInfo: (info: PageInfo) => void
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/**
 * The page sheets, with the editor laid over them. The Pagination extension
 * (editor/pagination.ts) pushes text down so it lands on the right sheet;
 * this component draws the sheets and tells the extension their geometry.
 */
export function Pages({ editor, pageSetup, zoom, onPageInfo }: PagesProps) {
  const size = pageSize(pageSetup)
  const mm = MARGIN_PRESETS[pageSetup.margins].margins
  const height = size.height * MM_TO_PX
  const margin = {
    top: mm.top * MM_TO_PX,
    right: mm.right * MM_TO_PX,
    bottom: mm.bottom * MM_TO_PX,
    left: mm.left * MM_TO_PX,
  }
  const stride = height + PAGE_GAP
  const contentHeight = height - margin.top - margin.bottom
  const [pages, setPages] = useState(() => editor.storage.pagination.pages)

  useEffect(
    () =>
      connectPages(
        editor,
        { pageHeight: height, pageGap: PAGE_GAP, marginTop: margin.top, marginBottom: margin.bottom, zoom },
        setPages,
      ),
    [editor, height, margin.top, margin.bottom, zoom],
  )

  // Current page = which sheet the caret is on.
  useEffect(() => {
    let frame = 0
    let reported = ''
    const measure = () => {
      frame = 0
      if (editor.isDestroyed) return
      let current = 1
      try {
        const top = editor.view.dom.getBoundingClientRect().top
        const caret = editor.view.coordsAtPos(editor.state.selection.head)
        current = clamp(Math.floor((caret.top - top) / zoom / stride) + 1, 1, pages)
      } catch {
        // coordsAtPos throws while the view is mid-update; keep page 1.
      }
      const key = `${current}/${pages}`
      if (key !== reported) {
        reported = key
        onPageInfo({ current, total: pages })
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
  }, [editor, zoom, stride, pages, onPageInfo])

  // Clicking in a margin puts the caret on the nearest line.
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

  const pageRule = `@page { size: A4 ${pageSetup.orientation}; margin: ${mm.top}mm ${mm.right}mm ${mm.bottom}mm ${mm.left}mm;${
    pageSetup.pageNumbers
      ? ' @bottom-center { content: counter(page); font: 9pt "Geist Variable", Arial, sans-serif; color: #78716c; }'
      : ''
  } }`

  return (
    <div className="pages relative mx-auto" style={{ zoom, width: `${size.width}mm` }}>
      <style>{pageRule}</style>
      {Array.from({ length: pages }, (_, i) => (
        <div
          aria-hidden
          className="page-sheet"
          key={i}
          style={{ top: i * stride, height }}
        >
          {pageSetup.pageNumbers ? (
            <span className="page-number" style={{ bottom: margin.bottom / 2 }}>
              {i + 1}
            </span>
          ) : null}
        </div>
      ))}
      <div
        className="page-body relative"
        onMouseDown={onMouseDown}
        style={
          {
            padding: `${margin.top}px ${margin.right}px ${margin.bottom}px ${margin.left}px`,
            '--content-min-height': `${(pages - 1) * stride + contentHeight}px`,
            '--page-content-height': `${contentHeight}px`,
          } as CSSProperties
        }
      >
        <EditorContent className="doc-content" editor={editor} />
      </div>
    </div>
  )
}
