import { FileText, FileUp, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertDialog } from '@/components/smoothui/dialog'
import Input from '@/components/smoothui/input'
import SmoothButton from '@/components/smoothui/smooth-button'
import Spinner from '@/components/smoothui/spinner'
import { Hint } from '@/components/toolbar/tool-button'
import { type DocMeta, listDocuments } from '@/lib/documents'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'

export interface SidebarProps {
  currentId: string
  /** Live title of the open document (the stored one lags behind autosave). */
  currentTitle: string
  /** Changes after every save, so the list re-reads dates and titles. */
  savedAt: number
  onNew: () => Promise<void>
  onOpen: (id: string) => Promise<void>
  onImport: (file: File) => Promise<void>
  onDelete: (id: string) => Promise<void>
  /** Shown on small screens, where the sidebar overlays the page. */
  onClose?: () => void
  className?: string
}

export function Sidebar(props: SidebarProps) {
  const { currentId, currentTitle, savedAt } = props
  const [docs, setDocs] = useState<DocMeta[] | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DocMeta | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    listDocuments()
      .then((list) => {
        if (!cancelled) setDocs(list)
      })
      .catch(() => {
        if (!cancelled) setDocs([])
      })
    return () => {
      cancelled = true
    }
  }, [savedAt, currentId])

  const filtered = useMemo(() => {
    if (!docs) return null
    const withLiveTitle = docs.map((d) => (d.id === currentId ? { ...d, title: currentTitle } : d))
    const q = query.trim().toLowerCase()
    return q
      ? withLiveTitle.filter((d) => `${d.title} ${d.preview}`.toLowerCase().includes(q))
      : withLiveTitle
  }, [docs, query, currentId, currentTitle])

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key)
    try {
      await action()
    } finally {
      setBusy(null)
    }
  }

  return (
    <aside
      aria-label="Documents"
      className={cn('flex min-h-0 flex-col bg-background print:hidden', props.className)}
    >
      <div className="flex items-center gap-1 px-3 pt-3 pb-2">
        <h2 className="flex-1 font-semibold text-[13px] text-muted-foreground uppercase tracking-wider">
          Documents
        </h2>
        <Hint label="New document">
          <SmoothButton
            aria-label="New document"
            loading={busy === 'new'}
            onClick={() => run('new', props.onNew)}
            size="icon-sm"
            variant="ghost"
          >
            <Plus />
          </SmoothButton>
        </Hint>
        {props.onClose ? (
          <SmoothButton aria-label="Close sidebar" onClick={props.onClose} size="icon-sm" variant="ghost">
            <X />
          </SmoothButton>
        ) : null}
      </div>

      <label className="relative mx-3 mb-2 block">
        <Search
          aria-hidden
          className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-4 text-muted-foreground"
        />
        <Input
          aria-label="Search documents"
          className="h-8 rounded-lg pl-8"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          type="search"
          value={query}
        />
      </label>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {filtered === null ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-muted-foreground text-sm">
            {query ? 'Nothing matches that search.' : 'No documents yet.'}
          </p>
        ) : (
          <ul className="grid gap-0.5">
            {filtered.map((doc) => {
              const current = doc.id === currentId
              return (
                <li className="group relative" key={doc.id}>
                  <button
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 pr-9 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                      current ? 'bg-brand/10' : 'hover:bg-foreground/[0.05]',
                    )}
                    disabled={busy !== null}
                    onClick={() => {
                      if (current) props.onClose?.()
                      else void run(`open:${doc.id}`, () => props.onOpen(doc.id))
                    }}
                    type="button"
                  >
                    <FileText
                      aria-hidden
                      className={cn('mt-0.5 size-4 shrink-0', current ? 'text-brand' : 'text-muted-foreground')}
                    />
                    <span className="grid min-w-0 flex-1">
                      <span className={cn('truncate text-sm', current && 'font-medium')}>{doc.title}</span>
                      <span className="truncate text-muted-foreground text-xs">
                        {busy === `open:${doc.id}` ? 'Opening…' : timeAgo(doc.updatedAt)}
                      </span>
                    </span>
                  </button>
                  <SmoothButton
                    aria-label={`Delete ${doc.title}`}
                    className="absolute top-1.5 right-1 size-7 text-muted-foreground opacity-100 hover:text-destructive sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100"
                    onClick={() => setPendingDelete(doc)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <Trash2 />
                  </SmoothButton>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="border-border border-t p-3">
        <SmoothButton
          className="w-full"
          loading={busy === 'import'}
          onClick={() => fileInput.current?.click()}
          prefix={<FileUp />}
          size="sm"
          variant="outline"
        >
          Import .docx
        </SmoothButton>
        <input
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void run('import', () => props.onImport(file))
          }}
          ref={fileInput}
          type="file"
        />
      </div>

      <AlertDialog
        description={
          pendingDelete
            ? `“${pendingDelete.id === currentId ? currentTitle : pendingDelete.title}” will be permanently removed from this browser. This can't be undone.`
            : undefined
        }
        footer={
          <>
            <SmoothButton onClick={() => setPendingDelete(null)} size="sm" variant="outline">
              Cancel
            </SmoothButton>
            <SmoothButton
              loading={busy === 'delete'}
              onClick={() => {
                const doc = pendingDelete
                if (!doc) return
                void run('delete', async () => {
                  await props.onDelete(doc.id)
                  setDocs((all) => all?.filter((d) => d.id !== doc.id) ?? null)
                  setPendingDelete(null)
                })
              }}
              size="sm"
              variant="destructive"
            >
              Delete
            </SmoothButton>
          </>
        }
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        open={pendingDelete !== null}
        title="Delete document?"
      />
    </aside>
  )
}
