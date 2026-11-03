import {
  CloudAlert,
  CloudCheck,
  Download,
  FileCode2,
  FileText,
  FileType,
  LoaderCircle,
  Monitor,
  Moon,
  PanelLeft,
  Printer,
  Sun,
} from 'lucide-react'
import { useState } from 'react'
import DropdownMenu from '@/components/smoothui/dropdown-menu'
import SmoothButton from '@/components/smoothui/smooth-button'
import { Hint } from '@/components/toolbar/tool-button'
import type { SaveStatus } from '@/editor/use-autosave'
import { UNTITLED } from '@/lib/documents'
import { MOD } from '@/lib/platform'
import type { Theme } from '@/lib/use-theme'
import { cn } from '@/lib/utils'

const THEMES = {
  light: { label: 'Light', icon: <Sun /> },
  dark: { label: 'Dark', icon: <Moon /> },
  system: { label: 'System', icon: <Monitor /> },
} satisfies Record<Theme, { label: string; icon: React.ReactNode }>

const STATUS = {
  saved: { icon: CloudCheck, label: 'Saved' },
  pending: { icon: LoaderCircle, label: 'Saving…' },
  saving: { icon: LoaderCircle, label: 'Saving…' },
  error: { icon: CloudAlert, label: 'Not saved. Click to retry' },
} satisfies Record<SaveStatus, { icon: unknown; label: string }>

export interface TopBarProps {
  title: string
  onTitle: (title: string) => void
  onTitleDone: () => void
  status: SaveStatus
  onSave: () => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onPrint: () => void
  onExportDocx: () => Promise<void>
  onExportHtml: () => void
  theme: Theme
  onTheme: (theme: Theme) => void
}

export function TopBar(props: TopBarProps) {
  const { title, status } = props
  // The title only changes through this input; the workspace remounts per document.
  const [draft, setDraft] = useState(title)
  const [exporting, setExporting] = useState(false)

  const commit = () => {
    const next = draft.trim() || UNTITLED
    setDraft(next)
    if (next !== title) props.onTitle(next)
  }

  const { icon: StatusIcon, label: statusLabel } = STATUS[status]

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-border border-b bg-background px-2 sm:px-3 print:hidden">
      <Hint label={props.sidebarOpen ? 'Hide documents' : 'Show documents'} shortcut={`${MOD}O`}>
        <SmoothButton
          aria-expanded={props.sidebarOpen}
          aria-label="Documents"
          className="text-foreground/75"
          onClick={props.onToggleSidebar}
          size="icon-sm"
          variant="ghost"
        >
          <PanelLeft />
        </SmoothButton>
      </Hint>
      <img alt="Ark" className="size-6 shrink-0" src="/favicon.svg" />

      <div className="flex min-w-0 flex-1 items-center gap-1">
        <input
          aria-label="Document title"
          className="min-w-0 max-w-full truncate rounded-md border border-transparent bg-transparent px-1.5 py-1 font-medium text-[15px] outline-none [field-sizing:content] hover:border-border focus:border-ring"
          onBlur={commit}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
              props.onTitleDone()
            } else if (e.key === 'Escape') {
              setDraft(title)
              props.onTitleDone()
            }
          }}
          spellCheck={false}
          value={draft}
        />
        <button
          aria-live="polite"
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
            status === 'error' ? 'text-destructive' : 'text-muted-foreground',
          )}
          disabled={status !== 'error'}
          onClick={props.onSave}
          title={statusLabel}
          type="button"
        >
          <StatusIcon
            aria-hidden
            className={cn('size-3.5', (status === 'saving' || status === 'pending') && 'animate-spin')}
          />
          <span className="hidden sm:inline">{statusLabel}</span>
        </button>
      </div>

      <DropdownMenu
        align="end"
        items={[
          {
            key: 'pdf',
            label: 'PDF',
            icon: <FileText />,
            shortcut: `${MOD}P`,
            onSelect: props.onPrint,
          },
          {
            key: 'docx',
            label: 'Word document (.docx)',
            icon: <FileType />,
            onSelect: () => {
              setExporting(true)
              void props.onExportDocx().finally(() => setExporting(false))
            },
          },
          {
            key: 'html',
            label: 'Web page (.html)',
            icon: <FileCode2 />,
            onSelect: props.onExportHtml,
          },
          { key: 'sep', label: '', separator: true },
          { key: 'print', label: 'Print…', icon: <Printer />, onSelect: props.onPrint },
        ]}
      >
        <SmoothButton loading={exporting} prefix={exporting ? null : <Download />} size="sm" variant="outline">
          <span className="hidden sm:inline">Export</span>
        </SmoothButton>
      </DropdownMenu>
      <DropdownMenu
        align="end"
        items={(Object.keys(THEMES) as Theme[]).map((key) => ({
          key,
          label: THEMES[key].label,
          icon: THEMES[key].icon,
          shortcut: key === props.theme ? '✓' : undefined,
          onSelect: () => props.onTheme(key),
        }))}
      >
        <SmoothButton aria-label={`Theme: ${THEMES[props.theme].label}`} className="text-foreground/75" size="icon-sm" variant="ghost">
          {THEMES[props.theme].icon}
        </SmoothButton>
      </DropdownMenu>
    </header>
  )
}
