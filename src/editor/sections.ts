import { type Editor, Extension, mergeAttributes, Node } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { canSplit } from '@tiptap/pm/transform'
import type { JSONContent } from '@tiptap/react'
import { FIRST_SECTION_ID, newSectionId } from '@/lib/sections'

/*
 * Sections. The document is a run of section nodes, each holding ordinary
 * blocks: doc → section+ → block+. A section break is the boundary between two
 * sections; it always starts a new page. Inserting one splits the section at
 * the cursor, and Backspace at the start of a section (or "Remove section
 * break") joins it to the one before. Section nodes only carry an id; their
 * settings are stored separately (see lib/sections.ts).
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sections: {
      /** Start a new section, on a new page, at the cursor. */
      insertSectionBreak: () => ReturnType
      /** Merge the section at `index` into the one before it. */
      removeSectionBreak: (index: number) => ReturnType
    }
  }
}

export const SectionDocument = Document.extend({ content: 'section+' })

export const Section = Node.create({
  name: 'section',
  content: 'block+',

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-id'),
        renderHTML: (attributes) => (attributes.id ? { 'data-id': attributes.id } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'section[data-section]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['section', mergeAttributes(HTMLAttributes, { 'data-section': '' }), 0]
  },

  addCommands() {
    return {
      insertSectionBreak:
        () =>
        ({ state, tr, dispatch }) => {
          if (!state.selection.empty) tr.deleteSelection()
          const $pos = tr.selection.$from
          if ($pos.depth < 2 || !$pos.parent.isTextblock) return false
          const typesAfter = [{ type: this.type, attrs: { id: newSectionId() } }]
          // At the start of a paragraph, break before it rather than leaving an empty one behind.
          const atStart = $pos.parentOffset === 0 && $pos.index($pos.depth - 1) > 0
          const pos = atStart ? $pos.before() : $pos.pos
          const depth = atStart ? $pos.depth - 1 : $pos.depth
          if (!canSplit(tr.doc, pos, depth, typesAfter)) return false
          // The cursor maps into the new section on its own: the split is inserted before it.
          if (dispatch) tr.split(pos, depth, typesAfter).scrollIntoView()
          return true
        },

      removeSectionBreak:
        (index) =>
        ({ state, tr, dispatch }) => {
          if (index <= 0 || index >= state.doc.childCount) return false
          let pos = 0
          for (let i = 0; i < index; i++) pos += state.doc.child(i).nodeSize
          if (dispatch) tr.join(pos)
          return true
        },
    }
  },
})

const housekeeping = new PluginKey('sectionHousekeeping')

/**
 * Keeps section ids present and unique (paste or "select all and type" can
 * produce sections without one, or two with the same), and keeps an empty
 * paragraph at the very end so there's always somewhere to type after a
 * final table or list. Replaces StarterKit's TrailingNode, which would wrap
 * that paragraph in a new section of its own.
 */
export const SectionHousekeeping = Extension.create({
  name: 'sectionHousekeeping',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: housekeeping,
        appendTransaction: (transactions, oldState, newState) => {
          if (!transactions.some((t) => t.docChanged)) return null
          const { doc, tr, schema } = newState
          const seen = new Set<string>()
          // Ids that existed before and are gone now go back to sections that lost theirs,
          // so selecting everything and typing keeps the first section's settings.
          const present = new Set<string>()
          doc.forEach((section) => {
            if (section.attrs.id) present.add(section.attrs.id)
          })
          const reusable: string[] = []
          oldState.doc.forEach((section) => {
            const id = section.attrs.id
            if (id && !present.has(id)) reusable.push(id)
          })

          let pos = 0
          doc.forEach((section) => {
            const id = section.attrs.id as string | null
            if (!id || seen.has(id)) {
              const next = (!id && reusable.shift()) || newSectionId()
              tr.setNodeAttribute(pos, 'id', next)
              seen.add(next)
            } else {
              seen.add(id)
            }
            pos += section.nodeSize
          })

          const last = doc.lastChild
          if (last && last.lastChild?.type.name !== 'paragraph') {
            tr.insert(doc.content.size - 1, schema.nodes.paragraph.create())
          }
          return tr.docChanged ? tr.setMeta('addToHistory', false) : null
        },
      }),
    ]
  },
})

/** The ids of the document's sections, in order. */
export function sectionIds(doc: PMNode) {
  const ids: string[] = []
  doc.forEach((section) => ids.push((section.attrs.id as string | null) ?? ''))
  return ids
}

/** Index of the section the cursor is in. */
export function currentSectionIndex(editor: Editor) {
  return editor.state.selection.$from.index(0)
}

/**
 * Puts stored content into sections: documents saved before sections existed
 * (and HTML from imports) become one section with the first section's id.
 * Also adds the trailing paragraph up front, so "Undo" isn't enabled the
 * moment a document opens.
 */
export function withSections(content: JSONContent | string): JSONContent | string {
  if (typeof content === 'string') {
    if (content.includes('data-section')) return content
    const html = !content.trim() || content.trimEnd().endsWith('</p>') ? content : `${content}<p></p>`
    return `<section data-section data-id="${FIRST_SECTION_ID}">${html || '<p></p>'}</section>`
  }
  const children = content.content ?? []
  const wrapped = children.some((child) => child.type === 'section')
    ? children
    : [{ type: 'section', attrs: { id: FIRST_SECTION_ID }, content: children.length ? children : [{ type: 'paragraph' }] }]
  const sections = wrapped.map((section, i) => ({
    ...section,
    attrs: { ...section.attrs, id: section.attrs?.id ?? (i === 0 ? FIRST_SECTION_ID : newSectionId()) },
  }))
  const last = sections.at(-1)
  if (last && last.content?.at(-1)?.type !== 'paragraph') {
    sections[sections.length - 1] = { ...last, content: [...(last.content ?? []), { type: 'paragraph' }] }
  }
  return { ...content, content: sections }
}
