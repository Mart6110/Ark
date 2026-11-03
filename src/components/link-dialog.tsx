import { getMarkRange, type Range } from '@tiptap/core'
import type { Editor } from '@tiptap/react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import Dialog from '@/components/smoothui/dialog'
import Input from '@/components/smoothui/input'
import SmoothButton from '@/components/smoothui/smooth-button'

function normalizeUrl(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^(https?:|mailto:|tel:|#)/i.test(trimmed)) return trimmed
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return `mailto:${trimmed}`
  return `https://${trimmed}`
}

/** Insert or edit a hyperlink (Ctrl+K). */
export function LinkDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: Editor
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  // The text the link covers: the whole existing link, or the selection.
  const [range, setRange] = useState<Range>({ from: 0, to: 0 })
  const [editing, setEditing] = useState(false)
  const [wasOpen, setWasOpen] = useState(false)
  // While the dialog animates out it shows a frozen copy of this form (with
  // the old props), so a quick Enter/Space could submit twice. A ref is read
  // at call time, so it guards even that copy.
  const submitted = useRef(false)
  useEffect(() => {
    if (open) submitted.current = false
  }, [open])

  // Fill the form each time the dialog opens.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const { state } = editor
      const isLink = editor.isActive('link')
      const target =
        (isLink && getMarkRange(state.selection.$from, state.schema.marks.link)) ||
        state.selection
      setRange({ from: target.from, to: target.to })
      setText(state.doc.textBetween(target.from, target.to, ' '))
      setUrl(isLink ? String(editor.getAttributes('link').href ?? '') : '')
      setEditing(isLink)
    }
  }

  const close = () => {
    onOpenChange(false)
    editor.commands.focus()
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const href = normalizeUrl(url)
    if (!href || submitted.current) return
    submitted.current = true
    const original = editor.state.doc.textBetween(range.from, range.to, ' ')
    const label = text.trim() || href
    const chain = editor.chain().focus()
    if (label !== original) {
      chain
        .insertContentAt(range, {
          type: 'text',
          text: label,
          marks: [{ type: 'link', attrs: { href } }],
        })
        .unsetMark('link')
        .run()
    } else {
      // Keeps the formatting inside the linked text.
      chain.setTextSelection(range).setLink({ href }).run()
    }
    onOpenChange(false)
  }

  return (
    <Dialog
      description="Ctrl+click (⌘+click on a Mac) a link in the document to open it."
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      open={open}
      title={editing ? 'Edit link' : 'Insert link'}
    >
      <form className="grid gap-4" onSubmit={submit}>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Text</span>
          <Input onChange={(e) => setText(e.target.value)} placeholder="What the link says" value={text} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Address</span>
          <Input
            autoFocus
            inputMode="url"
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            required
            value={url}
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {editing ? (
            <SmoothButton
              className="mr-auto"
              onClick={() => {
                if (submitted.current) return
                submitted.current = true
                editor.chain().focus().setTextSelection(range).unsetLink().run()
                onOpenChange(false)
              }}
              size="sm"
              variant="ghost"
            >
              Remove link
            </SmoothButton>
          ) : null}
          <SmoothButton onClick={close} size="sm" variant="outline">
            Cancel
          </SmoothButton>
          <SmoothButton color="accent" size="sm" type="submit" variant="solid">
            {editing ? 'Save' : 'Insert'}
          </SmoothButton>
        </div>
      </form>
    </Dialog>
  )
}
