import type { JSONContent } from '@tiptap/react'
import { createStore, del, get, set, values } from 'idb-keyval'
import { DEFAULT_PAGE_SETUP, type PageSetup } from './page'

export interface DocMeta {
  id: string
  title: string
  /** The first few words of the document, for the file list. */
  preview: string
  createdAt: number
  updatedAt: number
}

export interface DocRecord extends DocMeta {
  /** Tiptap JSON, or HTML for documents that haven't been edited since import. */
  content: JSONContent | string
  pageSetup: PageSetup
}

type DocBody = Pick<DocRecord, 'content' | 'pageSetup'>

// Metadata and content live in separate databases so the file list doesn't
// have to read every document (and every embedded image) to render.
const metaStore = createStore('ark-meta', 'meta')
const bodyStore = createStore('ark-content', 'content')

const LAST_DOCUMENT_KEY = 'ark:last-document'

export const UNTITLED = 'Untitled document'

export function createDocument(
  init: Partial<Pick<DocRecord, 'title' | 'content' | 'preview'>> = {},
): DocRecord {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title: init.title ?? UNTITLED,
    preview: init.preview ?? '',
    content: init.content ?? '',
    pageSetup: DEFAULT_PAGE_SETUP,
    createdAt: now,
    updatedAt: now,
  }
}

export async function listDocuments(): Promise<DocMeta[]> {
  const all = await values<DocMeta>(metaStore)
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadDocument(id: string): Promise<DocRecord | undefined> {
  const [meta, body] = await Promise.all([
    get<DocMeta>(id, metaStore),
    get<DocBody>(id, bodyStore),
  ])
  if (!meta || !body) return undefined
  // Fill in settings added since the document was saved.
  return { ...meta, ...body, pageSetup: { ...DEFAULT_PAGE_SETUP, ...body.pageSetup } }
}

export async function saveDocument(doc: DocRecord) {
  const { content, pageSetup, ...meta } = doc
  // Body first: a crash in between leaves stale metadata, never a listed
  // document without content.
  await set(doc.id, { content, pageSetup } satisfies DocBody, bodyStore)
  await set(doc.id, meta satisfies DocMeta, metaStore)
}

export async function deleteDocument(id: string) {
  await Promise.all([del(id, metaStore), del(id, bodyStore)])
  if (readLastDocumentId() === id) rememberLastDocument(null)
}

export function readLastDocumentId() {
  try {
    return localStorage.getItem(LAST_DOCUMENT_KEY)
  } catch {
    return null
  }
}

export function rememberLastDocument(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_DOCUMENT_KEY, id)
    else localStorage.removeItem(LAST_DOCUMENT_KEY)
  } catch {
    // Private mode etc. – reopening the latest document is a convenience.
  }
}

export function previewFromText(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 160)
}
