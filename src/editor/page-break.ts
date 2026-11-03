import { Extension, isNodeSelection, mergeAttributes, Node } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      /** Insert a manual page break (Ctrl+Enter, like Word). */
      setPageBreak: () => ReturnType
    }
  }
}

/**
 * A manual page break. On screen it's a marker; when printing it forces a new
 * page, and the .docx export writes a real Word page break.
 */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-page-break': '', class: 'page-break' }),
    ]
  },

  addCommands() {
    return {
      // Same approach as Tiptap's horizontal rule: insert, then put the caret
      // in the block after it so typing doesn't replace the break.
      setPageBreak:
        () =>
        ({ chain, state }) => {
          const { selection } = state
          const insert = chain()
          if (isNodeSelection(selection)) {
            insert.insertContentAt(selection.$to.pos, { type: this.name })
          } else {
            insert.insertContent({ type: this.name })
          }
          return insert
            .command(({ tr, dispatch }) => {
              if (!dispatch) return true
              const { $to } = tr.selection
              const after = $to.nodeAfter
              if (after?.isTextblock) {
                tr.setSelection(TextSelection.create(tr.doc, $to.pos + 1))
              } else if (after?.isBlock) {
                tr.setSelection(NodeSelection.create(tr.doc, $to.pos))
              } else if (after) {
                tr.setSelection(TextSelection.create(tr.doc, $to.pos))
              } else {
                const paragraph = $to.parent.type.contentMatch.defaultType?.create()
                if (paragraph) {
                  tr.insert($to.end(), paragraph)
                  tr.setSelection(TextSelection.create(tr.doc, $to.end() + 1))
                }
              }
              tr.scrollIntoView()
              return true
            })
            .run()
        },
    }
  },
})

/**
 * Ctrl+Enter inserts a page break, as in Word. HardBreak (in StarterKit) binds
 * the same key, so this needs a higher priority. It's a separate extension
 * because a node's priority also decides its order in the schema.
 */
export const PageBreakShortcut = Extension.create({
  name: 'pageBreakShortcut',
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.setPageBreak(),
    }
  },
})
