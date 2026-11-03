import type { EditorView } from '@tiptap/pm/view'
import { imageFileToDataUrl } from '@/lib/files'

function imageFiles(list: FileList | null | undefined) {
  return Array.from(list ?? []).filter((file) => file.type.startsWith('image/'))
}

async function insertImages(view: EditorView, files: File[], pos?: number) {
  const { schema } = view.state
  for (const file of files) {
    const src = await imageFileToDataUrl(file)
    const node = schema.nodes.image.create({ src, alt: file.name })
    const tr =
      pos === undefined
        ? view.state.tr.replaceSelectionWith(node)
        : view.state.tr.insert(pos, node)
    view.dispatch(tr.scrollIntoView())
  }
}

/** Paste and drop handlers for image files (screenshots, files from disk). */
export const imageEditorProps = {
  handlePaste(view: EditorView, event: ClipboardEvent) {
    const files = imageFiles(event.clipboardData?.files)
    // Let Tiptap handle HTML pastes that merely include an image.
    if (!files.length || event.clipboardData?.getData('text/html')) return false
    void insertImages(view, files)
    return true
  },
  handleDrop(view: EditorView, event: DragEvent, _slice: unknown, moved: boolean) {
    const files = imageFiles(event.dataTransfer?.files)
    if (moved || !files.length) return false
    const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
    event.preventDefault()
    void insertImages(view, files, pos)
    return true
  },
}
