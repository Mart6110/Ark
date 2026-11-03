import { useEditor } from '@tiptap/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LinkDialog } from '@/components/link-dialog'
import { type PageInfo, Pages } from '@/components/page'
import { Sidebar } from '@/components/sidebar'
import { toast } from '@/components/smoothui/toast'
import { StatusBar } from '@/components/status-bar'
import { EditorToolbar } from '@/components/toolbar/editor-toolbar'
import { TopBar } from '@/components/top-bar'
import { withTrailingParagraph } from '@/editor/commands'
import { extensions } from '@/editor/extensions'
import { imageEditorProps } from '@/editor/images'
import { useAutosave } from '@/editor/use-autosave'
import {
  createDocument,
  type DocRecord,
  deleteDocument,
  loadDocument,
  previewFromText,
  saveDocument,
} from '@/lib/documents'
import { downloadBlob, printDocument, safeFileName } from '@/lib/files'
import { exportHtml } from '@/lib/html-export'
import { MM_TO_PX, pageSize } from '@/lib/page'
import { useLocalState } from '@/lib/use-local-state'
import { useMediaQuery } from '@/lib/use-media-query'
import { useTheme } from '@/lib/use-theme'
import { clampZoom } from '@/lib/zoom'

/**
 * Everything for one open document. App remounts it (key = document id) when
 * another document is opened, which also resets undo history.
 */
export function DocumentWorkspace({
  initial,
  onSwitch,
}: {
  initial: DocRecord
  onSwitch: (doc: DocRecord) => void
}) {
  const [title, setTitle] = useState(initial.title)
  const [pageSetup, setPageSetup] = useState(initial.pageSetup)
  const [linkDialog, setLinkDialog] = useState(false)
  const [pageInfo, setPageInfo] = useState<PageInfo>({ current: 1, total: 1 })
  const [zoom, setZoom] = useLocalState('ark:zoom', 1)
  const [theme, setTheme] = useTheme()
  const workspaceRef = useRef<HTMLDivElement>(null)

  // Docked on wide screens (remembered), an overlay on small ones (starts closed).
  const wide = useMediaQuery('(min-width: 1024px)')
  const [sidebarDocked, setSidebarDocked] = useLocalState('ark:sidebar', true)
  const [sidebarOverlay, setSidebarOverlay] = useState(false)
  const sidebarOpen = wide ? sidebarDocked : sidebarOverlay
  const setSidebarOpen = wide ? setSidebarDocked : setSidebarOverlay

  const editor = useEditor({
    extensions,
    content: withTrailingParagraph(initial.content),
    autofocus: 'start',
    editorProps: {
      ...imageEditorProps,
      attributes: {
        'aria-label': 'Document',
        spellcheck: 'true',
        lang: 'en',
      },
      // Ctrl/⌘+click follows a link.
      handleClick(_view, _pos, event) {
        if (!(event.ctrlKey || event.metaKey)) return false
        const link = (event.target as HTMLElement).closest('a')
        if (!link?.href) return false
        window.open(link.href, '_blank', 'noopener,noreferrer')
        return true
      },
    },
  })

  const { status, savedAt, flush } = useAutosave(editor, initial, title, pageSetup)

  const fitWidth = useCallback(() => {
    const el = workspaceRef.current
    if (!el) return
    const style = getComputedStyle(el)
    const available =
      el.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)
    // Floor to the zoom step so rounding never makes the page a pixel too wide.
    setZoom(clampZoom(Math.floor((available / (pageSize(pageSetup).width * MM_TO_PX)) * 100) / 100))
  }, [pageSetup, setZoom])

  // On a phone the page wouldn't fit at 100%. Only checked when the document opens.
  useEffect(() => {
    const width = workspaceRef.current?.clientWidth ?? window.innerWidth
    if (width < pageSize(pageSetup).width * MM_TO_PX * zoom) fitWidth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = useCallback(async () => {
    if (await flush()) toast.success('Saved')
    else
      toast.error("The document couldn't be saved", {
        description: 'Browser storage may be full or turned off.',
      })
  }, [flush])

  const print = useCallback(() => {
    // Let menus close before the print snapshot is taken.
    requestAnimationFrame(() => printDocument(title))
  }, [title])

  const switchTo = useCallback(
    async (next: DocRecord) => {
      await flush()
      onSwitch(next)
    },
    [flush, onSwitch],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        void save()
      } else if (key === 'p') {
        event.preventDefault()
        print()
      } else if (key === 'k') {
        event.preventDefault()
        setLinkDialog(true)
      } else if (key === 'o') {
        event.preventDefault()
        setSidebarOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [save, print, setSidebarOpen])

  const sidebar = (
    <Sidebar
      className={wide ? 'w-64 shrink-0 border-border border-r' : 'h-full w-72 max-w-[85vw] shadow-xl'}
      currentId={initial.id}
      currentTitle={title}
      onClose={wide ? undefined : () => setSidebarOverlay(false)}
      onDelete={async (id) => {
        await deleteDocument(id)
        if (id === initial.id) {
          const fresh = createDocument()
          await saveDocument(fresh)
          onSwitch(fresh)
        }
        toast('Document deleted')
      }}
      onImport={async (file) => {
        try {
          // mammoth is large, so it loads on first use.
          const { importDocx } = await import('@/lib/docx-import')
          const result = await importDocx(file)
          const doc = createDocument({
            title: file.name.replace(/\.docx$/i, ''),
            content: result.html,
            preview: previewFromText(result.text),
          })
          await saveDocument(doc)
          await switchTo(doc)
          toast.success(`Imported “${doc.title}”`, {
            description: result.warnings
              ? "Some formatting couldn't be converted and was left out."
              : undefined,
          })
        } catch (error) {
          console.error(error)
          toast.error("That file couldn't be imported", {
            description: 'Only .docx files are supported (not the older .doc format).',
          })
        }
      }}
      onNew={async () => {
        const doc = createDocument()
        await saveDocument(doc)
        await switchTo(doc)
      }}
      onOpen={async (id) => {
        const doc = await loadDocument(id)
        if (doc) await switchTo(doc)
        else toast.error('That document no longer exists')
      }}
      savedAt={savedAt}
    />
  )

  return (
    <div className="app-shell flex h-dvh flex-col overflow-hidden bg-workspace">
      <TopBar
        onExportDocx={async () => {
          try {
            // docx is large, so it loads on first use.
            const { exportDocx } = await import('@/lib/docx-export')
            const blob = await exportDocx(editor.getJSON(), { title, pageSetup })
            downloadBlob(blob, `${safeFileName(title)}.docx`)
          } catch (error) {
            console.error(error)
            toast.error('Export failed')
          }
        }}
        onExportHtml={() =>
          downloadBlob(
            exportHtml(editor.getHTML(), { title, pageSetup }),
            `${safeFileName(title)}.html`,
          )
        }
        onPrint={print}
        onSave={save}
        onTheme={setTheme}
        onTitle={setTitle}
        onTitleDone={() => editor.commands.focus()}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        sidebarOpen={sidebarOpen}
        status={status}
        theme={theme}
        title={title}
      />

      <div className="app-body relative flex min-h-0 flex-1">
        {sidebarOpen && wide ? sidebar : null}
        {sidebarOpen && !wide ? (
          <div className="fixed inset-0 z-40 flex print:hidden">
            {sidebar}
            <button
              aria-label="Close documents"
              className="flex-1 bg-black/30"
              onClick={() => setSidebarOverlay(false)}
              type="button"
            />
          </div>
        ) : null}

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 justify-center px-3 pt-3 pb-1 print:hidden">
            <EditorToolbar editor={editor} onOpenLink={() => setLinkDialog(true)} />
          </div>
          <div
            className="workspace min-h-0 flex-1 overflow-auto px-3 pt-4 pb-10 sm:px-8"
            ref={workspaceRef}
          >
            <Pages editor={editor} onPageInfo={setPageInfo} pageSetup={pageSetup} zoom={zoom} />
          </div>
        </main>
      </div>

      <StatusBar
        editor={editor}
        onFitWidth={fitWidth}
        onPageSetup={setPageSetup}
        onZoom={setZoom}
        pageInfo={pageInfo}
        pageSetup={pageSetup}
        zoom={zoom}
      />

      <LinkDialog editor={editor} onOpenChange={setLinkDialog} open={linkDialog} />
    </div>
  )
}
