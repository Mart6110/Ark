import { useCallback, useEffect, useState } from 'react'
import { DocumentWorkspace } from '@/components/document-workspace'
import Toaster from '@/components/smoothui/toast'
import Spinner from '@/components/smoothui/spinner'
import { TooltipProvider } from '@/components/smoothui/tooltip'
import {
  createDocument,
  type DocRecord,
  listDocuments,
  loadDocument,
  previewFromText,
  readLastDocumentId,
  rememberLastDocument,
  saveDocument,
} from '@/lib/documents'
import { migrateDocuments } from '@/lib/migrations'
import { WELCOME_HTML, WELCOME_TEXT } from '@/welcome'

const WELCOME = {
  title: 'Welcome to Ark',
  html: WELCOME_HTML,
  preview: previewFromText(WELCOME_TEXT),
}

let initialDocument: Promise<DocRecord> | undefined

/** Memoized: StrictMode runs effects twice, which would create two welcome documents. */
function getInitialDocument() {
  initialDocument ??= openInitialDocument()
  return initialDocument
}

async function openInitialDocument(): Promise<DocRecord> {
  await migrateDocuments(WELCOME)

  const lastId = readLastDocumentId()
  const last = lastId ? await loadDocument(lastId) : undefined
  if (last) return last

  const [latest] = await listDocuments()
  const fallback = latest ? await loadDocument(latest.id) : undefined
  if (fallback) return fallback

  const welcome = createDocument({ title: WELCOME.title, content: WELCOME.html, preview: WELCOME.preview })
  await saveDocument(welcome)
  return welcome
}

export default function App() {
  const [doc, setDoc] = useState<DocRecord | null>(null)

  useEffect(() => {
    let cancelled = false
    getInitialDocument()
      .catch((error) => {
        // No IndexedDB (some private modes): edit in memory; saving will report the error.
        console.error(error)
        return createDocument({ title: WELCOME.title, content: WELCOME.html })
      })
      .then((initial) => {
        if (!cancelled) setDoc(initial)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (doc) rememberLastDocument(doc.id)
  }, [doc])

  const switchTo = useCallback((next: DocRecord) => setDoc(next), [])

  return (
    <TooltipProvider delay={500}>
      <Toaster className="print:hidden">
        {doc ? (
          <DocumentWorkspace initial={doc} key={doc.id} onSwitch={switchTo} />
        ) : (
          <div className="flex h-dvh items-center justify-center bg-workspace">
            <Spinner size="lg" />
          </div>
        )}
      </Toaster>
    </TooltipProvider>
  )
}
