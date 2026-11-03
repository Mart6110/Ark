import type { Editor } from '@tiptap/react'

/**
 * Word's format painter: remembers the formatting at the cursor and applies
 * it to the next text the user selects with the mouse.
 */
export function startFormatPainter(editor: Editor, onDone: () => void) {
  const { state } = editor
  const marks = (state.storedMarks ?? state.selection.$from.marks()).filter(
    (mark) => mark.type.name !== 'link',
  )
  const dom = editor.view.dom
  dom.classList.add('format-painter')

  const stop = () => {
    dom.classList.remove('format-painter')
    dom.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('keydown', onKeyDown, true)
    onDone()
  }

  const onMouseUp = () => {
    // Let ProseMirror finish updating the selection first.
    requestAnimationFrame(() => {
      if (editor.isDestroyed) return stop()
      if (editor.state.selection.empty) return
      const chain = editor.chain().focus().unsetAllMarks()
      for (const mark of marks) chain.setMark(mark.type.name, mark.attrs)
      chain.run()
      stop()
    })
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') stop()
  }

  dom.addEventListener('mouseup', onMouseUp)
  window.addEventListener('keydown', onKeyDown, true)
  return stop
}
