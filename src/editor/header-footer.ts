import { getSchema, mergeAttributes, Node } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyleKit } from '@tiptap/extension-text-style'
import { DOMSerializer, Node as PMNode } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'
import type { HeaderFooterDoc } from '@/lib/sections'

export type PageFieldKind = 'page' | 'pages'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageField: {
      /** Insert the page number or the page count at the cursor. */
      insertPageField: (field: PageFieldKind) => ReturnType
    }
  }
}

/**
 * The page number or page count. It's empty in the DOM: the number comes from
 * CSS (`--page-number` / `--page-count` on the header or footer box), so one
 * rendering serves every page.
 */
export const PageField = Node.create({
  name: 'pageField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      field: {
        default: 'page',
        parseHTML: (element) => (element.getAttribute('data-field') === 'pages' ? 'pages' : 'page'),
        renderHTML: (attributes) => ({ 'data-field': attributes.field }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-field]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'page-field' })]
  },

  renderText({ node }) {
    return node.attrs.field === 'pages' ? '[pages]' : '[page]'
  },

  addCommands() {
    return {
      insertPageField:
        (field) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { field } }),
    }
  },
})

/** What a header or footer can hold: formatted text on one or more lines, and page fields. */
export const headerFooterExtensions = [
  StarterKit.configure({
    heading: false,
    blockquote: false,
    bulletList: false,
    orderedList: false,
    listItem: false,
    listKeymap: false,
    codeBlock: false,
    horizontalRule: false,
    trailingNode: false,
    dropcursor: false,
    gapcursor: false,
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
  }),
  TextStyleKit.configure({ backgroundColor: false, lineHeight: false }),
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['paragraph'] }),
  PageField,
]

let serializer: { schema: ReturnType<typeof getSchema>; dom: DOMSerializer } | undefined
const cache = new WeakMap<object, string>()

/** Static HTML for a header or footer, as it appears on every page that shows it. */
export function headerFooterHtml(doc: HeaderFooterDoc) {
  if (!doc) return ''
  const cached = cache.get(doc)
  if (cached !== undefined) return cached
  serializer ??= (() => {
    const schema = getSchema(headerFooterExtensions)
    return { schema, dom: DOMSerializer.fromSchema(schema) }
  })()
  let html = ''
  try {
    const node = PMNode.fromJSON(serializer.schema, doc)
    const container = document.createElement('div')
    container.append(serializer.dom.serializeFragment(node.content))
    html = container.innerHTML
  } catch (error) {
    console.error('Unreadable header or footer', error)
  }
  cache.set(doc, html)
  return html
}
