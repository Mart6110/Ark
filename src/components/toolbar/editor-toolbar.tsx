import type { Editor } from '@tiptap/react'
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Baseline,
  Bold,
  CalendarDays,
  Code,
  Columns3,
  FileUp,
  Globe,
  Highlighter,
  Italic,
  Link,
  List,
  ListChecks,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  Minus,
  Paintbrush,
  PanelTop,
  Plus,
  Redo2,
  RemoveFormatting,
  Rows3,
  SquareSplitVertical,
  Strikethrough,
  Table2,
  TableCellsMerge,
  TableCellsSplit,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { ImageUrlDialog } from '@/components/image-url-dialog'
import DropdownMenu, { type DropdownMenuItemConfig } from '@/components/smoothui/dropdown-menu'
import Select from '@/components/smoothui/select'
import { toast } from '@/components/smoothui/toast'
import { ToolbarGroup, ToolbarRoot } from '@/components/smoothui/toolbar'
import {
  applyBlockStyle,
  indent,
  insertDate,
  outdent,
  refocus,
  refocusAfterMenu,
} from '@/editor/commands'
import {
  BLOCK_FONT_SIZE,
  DEFAULT_FONT_LABEL,
  FONT_FAMILIES,
  FONT_SIZES,
  firstFamilyName,
  HIGHLIGHT_COLORS,
  parseFontSize,
  TEXT_COLORS,
} from '@/editor/fonts'
import { startFormatPainter } from '@/editor/format-painter'
import { type Alignment, type BlockStyle, useFormatting } from '@/editor/use-formatting'
import { imageFileToDataUrl } from '@/lib/files'
import { MOD } from '@/lib/platform'
import { ColorButton } from './color-picker'
import { TablePicker } from './table-picker'
import { Divider, ToolButton } from './tool-button'

const STYLES: { value: BlockStyle; label: string }[] = [
  { value: 'p', label: 'Normal text' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'h4', label: 'Heading 4' },
  { value: 'quote', label: 'Quote' },
]

const ALIGN: Record<Alignment, { label: string; icon: React.ReactNode; shortcut: string }> = {
  left: { label: 'Align left', icon: <TextAlignStart />, shortcut: 'L' },
  center: { label: 'Center', icon: <TextAlignCenter />, shortcut: 'E' },
  right: { label: 'Align right', icon: <TextAlignEnd />, shortcut: 'R' },
  justify: { label: 'Justify', icon: <TextAlignJustify />, shortcut: 'J' },
}

const DEFAULT_FAMILY = 'default'

/** Light select styling so the dropdowns sit flush in the toolbar. */
const SELECT_CLASS =
  'h-8 rounded-lg border-transparent bg-transparent px-2 text-[13px] shadow-none hover:bg-foreground/[0.06]'

export function EditorToolbar({
  editor,
  onOpenLink,
}: {
  editor: Editor
  onOpenLink: () => void
}) {
  const f = useFormatting(editor)
  const [textColor, setTextColor] = useState('#c2410c')
  const [highlight, setHighlight] = useState(HIGHLIGHT_COLORS[0][0])
  const [painting, setPainting] = useState(false)
  const [urlDialog, setUrlDialog] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const chain = () => editor.chain().focus()
  /** For dropdown items: run the command, then take focus back from the menu. */
  const menu = (run: () => void) => () => {
    run()
    refocusAfterMenu(editor)
  }

  const currentSize = parseFontSize(f.fontSize) ?? BLOCK_FONT_SIZE[f.block]
  const sizeOptions = (
    FONT_SIZES.includes(currentSize)
      ? FONT_SIZES
      : [...FONT_SIZES, currentSize].sort((a, b) => a - b)
  ).map((size) => ({ label: String(size), value: String(size) }))

  const familyName = f.fontFamily ? firstFamilyName(f.fontFamily) : null
  const knownFamily = FONT_FAMILIES.find(
    (font) =>
      familyName && firstFamilyName(font.value).toLowerCase() === familyName.toLowerCase(),
  )
  const familyOptions = [
    { label: DEFAULT_FONT_LABEL, value: DEFAULT_FAMILY },
    ...FONT_FAMILIES,
    ...(f.fontFamily && !knownFamily
      ? [{ label: familyName ?? f.fontFamily, value: f.fontFamily }]
      : []),
  ]

  const insertImage = (src: string, alt: string) =>
    editor.chain().focus().setImage({ src, alt: alt || undefined }).run()

  const insertItems: DropdownMenuItemConfig[] = [
    {
      key: 'image-file',
      label: 'Image from this device…',
      icon: <FileUp />,
      onSelect: () => fileInput.current?.click(),
    },
    {
      key: 'image-url',
      label: 'Image from a URL…',
      icon: <Globe />,
      onSelect: () => setUrlDialog(true),
    },
    { key: 'sep', label: '', separator: true },
    {
      key: 'break',
      label: 'Page break',
      icon: <SquareSplitVertical />,
      shortcut: `${MOD}↵`,
      onSelect: menu(() => editor.chain().focus().setPageBreak().run()),
    },
    {
      key: 'rule',
      label: 'Divider',
      icon: <Minus />,
      onSelect: menu(() => editor.chain().focus().setHorizontalRule().run()),
    },
    {
      key: 'date',
      label: "Today's date",
      icon: <CalendarDays />,
      onSelect: menu(() => insertDate(editor)),
    },
  ]

  const tableItems: DropdownMenuItemConfig[] = [
    { key: 'above', label: 'Insert row above', icon: <ArrowUpToLine />, onSelect: menu(() => chain().addRowBefore().run()) },
    { key: 'below', label: 'Insert row below', icon: <ArrowDownToLine />, onSelect: menu(() => chain().addRowAfter().run()) },
    { key: 'left', label: 'Insert column left', icon: <ArrowLeftToLine />, onSelect: menu(() => chain().addColumnBefore().run()) },
    { key: 'right', label: 'Insert column right', icon: <ArrowRightToLine />, onSelect: menu(() => chain().addColumnAfter().run()) },
    { key: 'sep1', label: '', separator: true },
    { key: 'merge', label: 'Merge cells', icon: <TableCellsMerge />, disabled: !f.canMerge, onSelect: menu(() => chain().mergeCells().run()) },
    { key: 'split', label: 'Split cell', icon: <TableCellsSplit />, disabled: !f.canSplit, onSelect: menu(() => chain().splitCell().run()) },
    {
      key: 'header',
      label: f.headerRow ? 'Remove header row' : 'Make first row a header',
      icon: <PanelTop />,
      onSelect: menu(() => chain().toggleHeaderRow().run()),
    },
    { key: 'sep2', label: '', separator: true },
    { key: 'del-row', label: 'Delete row', icon: <Rows3 />, onSelect: menu(() => chain().deleteRow().run()) },
    { key: 'del-col', label: 'Delete column', icon: <Columns3 />, onSelect: menu(() => chain().deleteColumn().run()) },
    {
      key: 'del-table',
      label: 'Delete table',
      icon: <Trash2 />,
      variant: 'destructive',
      onSelect: menu(() => chain().deleteTable().run()),
    },
  ]

  return (
    <ToolbarRoot
      aria-label="Formatting"
      className="max-w-full gap-0.5 overflow-x-auto rounded-2xl border-border/80 bg-background p-1 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_16px_-6px_rgb(0_0_0/0.08)] [scrollbar-width:none] print:hidden"
    >
      <ToolbarGroup className="gap-0">
        <ToolButton
          disabled={!f.canUndo}
          icon={<Undo2 />}
          label="Undo"
          onClick={() => chain().undo().run()}
          shortcut={`${MOD}Z`}
        />
        <ToolButton
          disabled={!f.canRedo}
          icon={<Redo2 />}
          label="Redo"
          onClick={() => chain().redo().run()}
          shortcut={`${MOD}Y`}
        />
      </ToolbarGroup>
      <Divider />

      <Select
        aria-label="Paragraph style"
        className={`${SELECT_CLASS} w-[8.25rem]`}
        onValueChange={(value) => {
          applyBlockStyle(editor, value as BlockStyle)
          refocus(editor)
        }}
        options={STYLES}
        size="sm"
        value={f.block}
      />
      <Divider />
      <Select
        aria-label="Font"
        className={`${SELECT_CLASS} w-[8.5rem]`}
        onValueChange={(value) => {
          if (value === DEFAULT_FAMILY) editor.chain().unsetFontFamily().run()
          else editor.chain().setFontFamily(value).run()
          refocus(editor)
        }}
        options={familyOptions}
        size="sm"
        value={f.fontFamily ? (knownFamily?.value ?? f.fontFamily) : DEFAULT_FAMILY}
      />
      <Select
        aria-label="Font size"
        className={`${SELECT_CLASS} w-[4.25rem] tabular-nums`}
        onValueChange={(value) => {
          editor.chain().setFontSize(`${value}pt`).run()
          refocus(editor)
        }}
        options={sizeOptions}
        size="sm"
        value={String(currentSize)}
      />
      <Divider />

      <ToolbarGroup className="gap-0">
        <ToolButton active={f.bold} icon={<Bold />} label="Bold" onClick={() => chain().toggleBold().run()} shortcut={`${MOD}B`} />
        <ToolButton active={f.italic} icon={<Italic />} label="Italic" onClick={() => chain().toggleItalic().run()} shortcut={`${MOD}I`} />
        <ToolButton active={f.underline} icon={<Underline />} label="Underline" onClick={() => chain().toggleUnderline().run()} shortcut={`${MOD}U`} />
        <ToolButton active={f.strike} icon={<Strikethrough />} label="Strikethrough" onClick={() => chain().toggleStrike().run()} shortcut={`${MOD}Shift+S`} />
        <ToolButton active={f.code} icon={<Code />} label="Inline code" onClick={() => chain().toggleCode().run()} shortcut={`${MOD}E`} />
      </ToolbarGroup>
      <ColorButton
        clearLabel="Default color"
        color={textColor}
        icon={<Baseline />}
        label="Text color"
        onApply={(color) => {
          setTextColor(color)
          chain().setColor(color).run()
        }}
        onClear={() => chain().unsetColor().run()}
        rows={TEXT_COLORS}
      />
      <ColorButton
        clearLabel="No highlight"
        color={highlight}
        icon={<Highlighter />}
        label="Highlight"
        large
        onApply={(color) => {
          setHighlight(color)
          chain().setHighlight({ color }).run()
        }}
        onClear={() => chain().unsetHighlight().run()}
        rows={HIGHLIGHT_COLORS}
      />
      <Divider />

      <ToolbarGroup className="gap-0">
        <ToolButton active={f.link} icon={<Link />} label={f.link ? 'Edit link' : 'Link'} onClick={onOpenLink} shortcut={`${MOD}K`} />
        <TablePicker
          onInsert={(rows, cols) =>
            editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
          }
        />
        <DropdownMenu items={insertItems}>
          <ToolButton caret icon={<Plus />} label="Insert" showLabel />
        </DropdownMenu>
      </ToolbarGroup>
      <Divider />

      <ToolbarGroup className="gap-0">
        <DropdownMenu
          items={(Object.keys(ALIGN) as Alignment[]).map((key) => ({
            key,
            label: ALIGN[key].label,
            icon: ALIGN[key].icon,
            shortcut: `${MOD}Shift+${ALIGN[key].shortcut}`,
            onSelect: menu(() => chain().setTextAlign(key).run()),
          }))}
        >
          <ToolButton caret icon={ALIGN[f.align].icon} label="Alignment" />
        </DropdownMenu>
        <ToolButton active={f.bulletList} icon={<List />} label="Bulleted list" onClick={() => chain().toggleBulletList().run()} shortcut={`${MOD}Shift+8`} />
        <ToolButton active={f.orderedList} icon={<ListOrdered />} label="Numbered list" onClick={() => chain().toggleOrderedList().run()} shortcut={`${MOD}Shift+7`} />
        <ToolButton active={f.taskList} icon={<ListChecks />} label="Checklist" onClick={() => chain().toggleTaskList().run()} shortcut={`${MOD}Shift+9`} />
        <ToolButton disabled={!f.canOutdent} icon={<ListIndentDecrease />} label="Decrease indent" onClick={() => outdent(editor)} shortcut="Shift+Tab" />
        <ToolButton disabled={!f.canIndent} icon={<ListIndentIncrease />} label="Increase indent" onClick={() => indent(editor)} shortcut="Tab" />
      </ToolbarGroup>
      <Divider />

      <ToolbarGroup className="gap-0">
        <ToolButton
          active={painting}
          icon={<Paintbrush />}
          label="Copy formatting"
          onClick={() => {
            if (painting) return
            setPainting(true)
            startFormatPainter(editor, () => setPainting(false))
            toast('Select the text to apply the formatting to. Esc cancels.', { timeout: 3500 })
          }}
        />
        <ToolButton
          icon={<RemoveFormatting />}
          label="Clear formatting"
          onClick={() => chain().unsetAllMarks().setParagraph().unsetTextAlign().run()}
        />
      </ToolbarGroup>

      {f.inTable ? (
        <>
          <Divider />
          <DropdownMenu items={tableItems}>
            <ToolButton
              caret
              className="text-brand hover:text-brand"
              icon={<Table2 />}
              label="Table"
              showLabel
            />
          </DropdownMenu>
        </>
      ) : null}

      <input
        accept="image/*"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          try {
            insertImage(await imageFileToDataUrl(file), file.name)
          } catch {
            toast.error("The image couldn't be loaded")
          }
        }}
        ref={fileInput}
        type="file"
      />
      <ImageUrlDialog onInsert={insertImage} onOpenChange={setUrlDialog} open={urlDialog} />
    </ToolbarRoot>
  )
}
