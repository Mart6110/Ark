import type { Editor } from '@tiptap/react'
import type { BlockStyle } from './use-formatting'

export function applyBlockStyle(editor: Editor, style: BlockStyle) {
  const chain = editor.chain().focus()
  if (style === 'quote') {
    if (!editor.isActive('blockquote')) chain.setParagraph().setBlockquote().run()
    else chain.setParagraph().run()
    return
  }
  if (editor.isActive('blockquote')) chain.unsetBlockquote()
  if (style === 'p') chain.setParagraph().run()
  else chain.setHeading({ level: Number(style.slice(1)) as 1 | 2 | 3 | 4 }).run()
}

export function indent(editor: Editor) {
  const chain = editor.chain().focus()
  if (editor.isActive('taskItem')) chain.sinkListItem('taskItem').run()
  else chain.sinkListItem('listItem').run()
}

export function outdent(editor: Editor) {
  const chain = editor.chain().focus()
  if (editor.isActive('taskItem')) chain.liftListItem('taskItem').run()
  else chain.liftListItem('listItem').run()
}

export function insertDate(editor: Editor) {
  const date = new Date().toLocaleDateString('en-GB', { dateStyle: 'long' })
  editor.chain().focus().insertContent(date).run()
}

/**
 * Returns focus to the document after a control that grabs it back once its
 * change handler has run (the SmoothUI Select focuses its trigger).
 */
function focusEditor(editor: Editor) {
  if (editor.isDestroyed) return
  // Don't pull focus back if the user has already moved on to a text field
  // (the title) or a dialog.
  const active = document.activeElement
  if (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active?.closest('[role="dialog"], [role="alertdialog"]')
  ) {
    return
  }
  // view.focus() is synchronous; the focus command waits for a frame.
  editor.view.focus()
}

export function refocus(editor: Editor) {
  // A microtask runs after the control's own focus() call but before the
  // browser handles the next key press.
  queueMicrotask(() => focusEditor(editor))
}

/**
 * Like refocus, for dropdown menus: Base UI hands focus back to the menu's
 * trigger as it closes, after the item's click handler has returned.
 */
export function refocusAfterMenu(editor: Editor) {
  setTimeout(() => focusEditor(editor))
}

export function countWords(text: string) {
  const words = text.trim().split(/\s+/)
  return words[0] === '' ? 0 : words.length
}
