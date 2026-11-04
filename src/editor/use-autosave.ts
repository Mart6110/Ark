import type { Editor } from '@tiptap/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { type DocRecord, previewFromText, saveDocument } from '@/lib/documents'
import type { SectionMap } from '@/lib/sections'

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

const DELAY = 700

/**
 * Saves the document to IndexedDB shortly after each change. `flush()` saves
 * immediately (Ctrl+S, switching documents) and resolves to whether it worked.
 */
export function useAutosave(
  editor: Editor,
  base: DocRecord,
  title: string,
  sections: SectionMap,
) {
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [savedAt, setSavedAt] = useState(base.updatedAt)
  const timer = useRef<number | undefined>(undefined)
  const dirty = useRef(false)
  const latest = useRef({ title, sections })
  useEffect(() => {
    latest.current = { title, sections }
  })
  const saved = useRef({ title: base.title, sections: base.sections })

  const save = useCallback(async () => {
    window.clearTimeout(timer.current)
    if (!dirty.current || editor.isDestroyed) return true
    dirty.current = false
    setStatus('saving')
    const snapshot = latest.current
    try {
      const updatedAt = Date.now()
      await saveDocument({
        ...base,
        ...snapshot,
        content: editor.getJSON(),
        preview: previewFromText(editor.getText({ blockSeparator: ' ' })),
        updatedAt,
      })
      saved.current = snapshot
      setSavedAt(updatedAt)
      // Edits made while writing are saved by the timer they scheduled.
      setStatus(dirty.current ? 'pending' : 'saved')
      return true
    } catch (error) {
      console.error('Autosave failed', error)
      dirty.current = true
      setStatus('error')
      return false
    }
  }, [base, editor])

  const schedule = useCallback(
    (delay = DELAY) => {
      dirty.current = true
      setStatus('pending')
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(save, delay)
    },
    [save],
  )

  useEffect(() => {
    const onUpdate = () => schedule()
    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
    }
  }, [editor, schedule])

  // Renames are rare and deliberate: save right away, so closing the tab
  // straight after can't lose them. Section settings change while typing in
  // a header or footer, so they wait like any other edit.
  useEffect(() => {
    if (title !== saved.current.title) schedule(0)
    else if (sections !== saved.current.sections) schedule()
  }, [title, sections, schedule])

  // Leaving the tab is the last reliable moment to write.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void save()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', save)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', save)
    }
  }, [save])

  return { status, savedAt, flush: save }
}
