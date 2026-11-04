import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyleKit } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import { PageBreak, PageBreakShortcut } from './page-break'
import { Pagination } from './pagination'
import { Section, SectionDocument, SectionHousekeeping } from './sections'

export const extensions = [
  StarterKit.configure({
    // Replaced by the section-aware versions below.
    document: false,
    trailingNode: false,
    heading: { levels: [1, 2, 3, 4] },
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
  }),
  SectionDocument,
  Section,
  SectionHousekeeping,
  TextStyleKit.configure({ backgroundColor: false, lineHeight: false }),
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  // Inline, like pictures in Word: they sit in a paragraph and follow its alignment.
  Image.configure({
    inline: true,
    allowBase64: true,
    resize: {
      enabled: true,
      directions: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      minWidth: 24,
      minHeight: 24,
      alwaysPreserveAspectRatio: true,
    },
  }),
  TableKit.configure({ table: { resizable: true, cellMinWidth: 40 } }),
  TaskList,
  TaskItem.configure({ nested: true }),
  PageBreak,
  PageBreakShortcut,
  Pagination,
]
