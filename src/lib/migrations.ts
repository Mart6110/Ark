import { listDocuments, loadDocument, saveDocument, UNTITLED } from './documents'

const DONE_KEY = 'ark:migrations'
const VERSION = 1

// The first version of Ark was in Danish. These are the names it gave things.
const DANISH_WELCOME_TITLE = 'Velkommen til Ark'
const DANISH_WELCOME_OPENING = 'Ark er en lille tekstbehandler i browseren'
const DANISH_UNTITLED = 'Dokument uden titel'

export interface WelcomeDocument {
  title: string
  html: string
  preview: string
}

/**
 * Brings documents saved by older versions up to date, once per browser:
 * the Danish welcome document becomes the English one (unless it has been
 * rewritten), and the Danish default title becomes the English one.
 */
export async function migrateDocuments(welcome: WelcomeDocument) {
  try {
    if (Number(localStorage.getItem(DONE_KEY)) >= VERSION) return
  } catch {
    // No localStorage: run the (idempotent) migration anyway.
  }

  for (const meta of await listDocuments()) {
    const isWelcome = meta.title === DANISH_WELCOME_TITLE && meta.preview.includes(DANISH_WELCOME_OPENING)
    if (!isWelcome && meta.title !== DANISH_UNTITLED) continue
    const doc = await loadDocument(meta.id)
    if (!doc) continue
    await saveDocument(
      isWelcome
        ? { ...doc, title: welcome.title, content: welcome.html, preview: welcome.preview }
        : { ...doc, title: UNTITLED },
    )
  }

  try {
    localStorage.setItem(DONE_KEY, String(VERSION))
  } catch {
    // Runs again next time; harmless.
  }
}
