import { type Editor, useEditorState } from '@tiptap/react'

export type BlockStyle = 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'quote'
export type Alignment = 'left' | 'center' | 'right' | 'justify'

const ALIGNMENTS: Alignment[] = ['center', 'right', 'justify']

/** Everything the toolbar needs to know about the current selection. */
export function useFormatting(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor }) => {
      const textStyle = editor.getAttributes('textStyle')
      const level = editor.getAttributes('heading').level as number | undefined
      const block: BlockStyle = editor.isActive('heading')
        ? (`h${level ?? 1}` as BlockStyle)
        : editor.isActive('blockquote')
          ? 'quote'
          : 'p'
      const can = editor.can()
      // A header or footer editor has no lists or tables, and asking about them would throw.
      const lists = Boolean(editor.schema.nodes.listItem)
      const tables = Boolean(editor.schema.nodes.table)

      return {
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        underline: editor.isActive('underline'),
        strike: editor.isActive('strike'),
        code: editor.isActive('code'),
        block,
        bulletList: editor.isActive('bulletList'),
        orderedList: editor.isActive('orderedList'),
        taskList: editor.isActive('taskList'),
        align: ALIGNMENTS.find((a) => editor.isActive({ textAlign: a })) ?? 'left',
        link: editor.isActive('link'),
        fontFamily: (textStyle.fontFamily as string | undefined) ?? null,
        fontSize: (textStyle.fontSize as string | undefined) ?? null,
        inTable: editor.isActive('table'),
        headerRow: editor.isActive('tableHeader'),
        canUndo: can.undo(),
        canRedo: can.redo(),
        canIndent: lists && (can.sinkListItem('listItem') || can.sinkListItem('taskItem')),
        canOutdent: lists && (can.liftListItem('listItem') || can.liftListItem('taskItem')),
        canMerge: tables && can.mergeCells(),
        canSplit: tables && can.splitCell(),
        canSectionBreak: Boolean(editor.schema.nodes.section) && can.insertSectionBreak(),
        hasSelection: !editor.state.selection.empty,
      }
    },
  })
}

export type Formatting = ReturnType<typeof useFormatting>
