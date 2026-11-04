import { type Editor, EditorContent, useEditor } from '@tiptap/react'
import { Check, Files, Hash } from 'lucide-react'
import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { headerFooterExtensions } from '@/editor/header-footer'
import type { PageBox } from '@/editor/pagination'
import {
  type HeaderFooterDoc,
  type HeaderFooterField,
  headerFooterFor,
  isEmptyHeaderFooter,
  type ResolvedSection,
  type SectionGeometry,
  type SectionSettings,
} from '@/lib/sections'
import { cn } from '@/lib/utils'

interface Props {
  kind: 'header' | 'footer'
  page: PageBox
  pageNumber: number
  pageCount: number
  section: ResolvedSection
  sectionCount: number
  geometry: SectionGeometry
  sheetLeft: number
  /** The pages' zoom; the options bar is shown at its normal size whatever it is. */
  zoom: number
  point?: { x: number; y: number }
  onChange: (sourceSection: number, field: HeaderFooterField, doc: HeaderFooterDoc) => void
  onSectionChange: (section: number, patch: Partial<SectionSettings>) => void
  onLinkChange: (section: number, linked: boolean) => void
  onEditor: (editor: Editor | null) => void
  onDone: () => void
}

/**
 * Editing a header or footer, in place on its page. What's edited is the
 * content the page shows: the section's own, or (for "same as previous") the
 * earlier section's it shares.
 */
export function HeaderFooterEditor(props: Props) {
  const { kind, page, section } = props
  const content = headerFooterFor(section, page.firstOfSection)
  const field = kind === 'header' ? content.headerField : content.footerField
  const doc = kind === 'header' ? content.header : content.footer
  // A new editor for each piece of content, so undo history doesn't leak between them.
  return <ActiveEditor {...props} doc={doc} field={field} key={`${section.headerFooterSource}-${field}`} />
}

function BarButton({
  children,
  onClick,
  pressed,
  label,
}: {
  children: ReactNode
  onClick: () => void
  pressed?: boolean
  label?: string
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        'flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-foreground/75 hover:bg-foreground/[0.07] hover:text-foreground',
        pressed !== undefined && 'pl-1',
      )}
      // Keep the cursor in the header or footer.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      type="button"
    >
      {pressed !== undefined ? (
        <span
          className={cn(
            'grid size-3.5 place-items-center rounded-[4px] border',
            pressed ? 'border-brand bg-brand text-white' : 'border-foreground/25',
          )}
        >
          {pressed ? <Check className="size-2.5" strokeWidth={3} /> : null}
        </span>
      ) : null}
      {children}
    </button>
  )
}

function ActiveEditor({
  kind,
  page,
  pageNumber,
  pageCount,
  section,
  sectionCount,
  geometry,
  sheetLeft,
  zoom,
  point,
  doc,
  field,
  onChange,
  onSectionChange,
  onLinkChange,
  onEditor,
  onDone,
}: Props & { doc: HeaderFooterDoc; field: HeaderFooterField }) {
  const latest = useRef({ onChange, onDone, source: section.headerFooterSource, field })
  useLayoutEffect(() => {
    latest.current = { onChange, onDone, source: section.headerFooterSource, field }
  })

  const first = page.firstOfSection && section.settings.differentFirstPage
  const what = `${first ? 'First page ' : ''}${kind === 'header' ? 'header' : 'footer'}`
  const label = what.charAt(0).toUpperCase() + what.slice(1)

  const editor = useEditor({
    extensions: headerFooterExtensions,
    content: doc ?? '',
    editorProps: {
      attributes: { class: 'hf-content', 'aria-label': label, spellcheck: 'true', lang: 'en' },
      handleKeyDown: (_view, event) => {
        if (event.key !== 'Escape') return false
        latest.current.onDone()
        return true
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      const { onChange, source, field } = latest.current
      onChange(source, field, isEmptyHeaderFooter(json) ? null : json)
    },
  })

  useEffect(() => {
    onEditor(editor)
    return () => onEditor(null)
  }, [editor, onEditor])

  // Put the cursor where the page was clicked; the point only matters on opening.
  const openedAt = useRef(point)
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (editor.isDestroyed) return
      const at = openedAt.current
      const hit = at ? editor.view.posAtCoords({ left: at.x, top: at.y }) : null
      editor.chain().focus(hit?.pos ?? 'end').run()
    })
    return () => cancelAnimationFrame(frame)
  }, [editor])

  // The bar may wrap, but never past the right edge of the window.
  const boxRef = useRef<HTMLDivElement>(null)
  const [barWidth, setBarWidth] = useState<number>()
  useLayoutEffect(() => {
    const measure = () => {
      const left = boxRef.current?.getBoundingClientRect().left
      if (left !== undefined) setBarWidth(Math.max(200, window.innerWidth - left - 12))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [zoom])

  const header = kind === 'header'
  const linked = section.index > 0 && section.headerFooterSource !== section.index
  const style = {
    left: sheetLeft + geometry.margins.left,
    width: geometry.width - geometry.margins.left - geometry.margins.right,
    top: header ? page.top + geometry.headerTop : page.top + page.height - geometry.footerBottom,
    '--page-number': JSON.stringify(String(pageNumber)),
    '--page-count': JSON.stringify(String(pageCount)),
  } as CSSProperties

  return (
    <div className={cn('hf-box hf-editor', header ? 'hf-header' : 'hf-footer')} ref={boxRef} style={style}>
      <EditorContent editor={editor} />
      <div
        aria-label={`${label} options`}
        className={cn(
          'hf-bar absolute left-[-7px] z-10 flex w-max flex-wrap items-center gap-0.5 whitespace-nowrap rounded-xl border border-border bg-background p-1 text-foreground shadow-lg',
          header ? 'top-full mt-2' : 'bottom-full mb-2',
        )}
        role="toolbar"
        // Undo the pages' zoom, so the bar stays readable on a phone.
        style={{ zoom: zoom < 1 ? 1 / zoom : undefined, maxWidth: barWidth }}
      >
        <span className="px-1.5 font-medium text-[11px] text-brand">
          {label}
          {sectionCount > 1 ? ` · Section ${section.index + 1}` : ''}
          {linked ? ` · same as section ${section.headerFooterSource + 1}` : ''}
        </span>
        <span aria-hidden className="h-4 w-px bg-border" />
        <BarButton label="Insert page number" onClick={() => editor.chain().focus().insertPageField('page').run()}>
          <Hash className="size-3" /> Page number
        </BarButton>
        <BarButton label="Insert page count" onClick={() => editor.chain().focus().insertPageField('pages').run()}>
          <Files className="size-3" /> Page count
        </BarButton>
        <span aria-hidden className="h-4 w-px bg-border" />
        <BarButton
          onClick={() => onSectionChange(section.index, { differentFirstPage: !section.settings.differentFirstPage })}
          pressed={section.settings.differentFirstPage}
        >
          Different first page
        </BarButton>
        {section.index > 0 ? (
          <BarButton onClick={() => onLinkChange(section.index, !linked)} pressed={linked}>
            Same as previous section
          </BarButton>
        ) : null}
        <span aria-hidden className="h-4 w-px bg-border" />
        <BarButton onClick={onDone}>Done</BarButton>
      </div>
    </div>
  )
}
