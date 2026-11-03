import type { JSONContent } from '@tiptap/react'
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  PageOrientation,
  Paragraph,
  type ParagraphChild,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { loadImageElement } from './files'
import { MARGIN_PRESETS, MM_TO_PX, type PageSetup, pageSize } from './page'

/*
 * Tiptap JSON → .docx. Covers what the editor can produce: headings, lists,
 * tables, images, links and character formatting. Anything else becomes plain
 * paragraphs.
 */

const MM_TO_TWIP = 1440 / 25.4
const PX_TO_TWIP = 15

type Block = Paragraph | Table
type Mark = NonNullable<JSONContent['marks']>[number]

interface Context {
  /** Bumped for every ordered list so each one restarts at 1. */
  listInstance: number
  contentWidthPx: number
}

interface BlockOptions {
  style?: string
  list?: { kind: 'bullet' | 'ordered' | 'task'; level: number; instance: number }
  bold?: boolean
}

const ALIGNMENT = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
} as const

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
] as const

const LIST_TYPES = new Set(['bulletList', 'orderedList', 'taskList'])

let colorContext: CanvasRenderingContext2D | null | undefined

/** Any CSS color → "RRGGBB", which is what Word wants. */
function toHex(color: unknown): string | undefined {
  if (typeof color !== 'string' || !color) return undefined
  colorContext ??= document.createElement('canvas').getContext('2d')
  if (!colorContext) return undefined
  colorContext.fillStyle = '#000000'
  colorContext.fillStyle = color
  const normalized = colorContext.fillStyle
  if (normalized.startsWith('#')) return normalized.slice(1).toUpperCase()
  const rgb = normalized.match(/\d+(\.\d+)?/g)
  if (!rgb || rgb.length < 3) return undefined
  return rgb
    .slice(0, 3)
    .map((n) => Math.round(Number(n)).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

/** "12pt" / "16px" → half-points. */
function toHalfPoints(size: unknown): number | undefined {
  if (typeof size !== 'string') return undefined
  const value = Number.parseFloat(size)
  if (!Number.isFinite(value)) return undefined
  const points = size.endsWith('px') ? value * 0.75 : value
  return Math.round(points * 2)
}

// The web fonts Ark ships aren't installed where Word runs; use the closest
// fonts that are.
const DOCX_FONTS: Record<string, string> = {
  'Geist Variable': 'Arial',
  'Source Serif 4 Variable': 'Georgia',
}
const BODY_FONT = 'Georgia'
const HEADING_FONT = 'Arial'
const LINK_COLOR = 'C2410C'

function firstFamily(family: unknown): string | undefined {
  if (typeof family !== 'string') return undefined
  const name = family.split(',')[0]?.trim().replace(/^["']|["']$/g, '')
  return name ? (DOCX_FONTS[name] ?? name) : undefined
}

function textRun(text: string, marks: Mark[], forceBold?: boolean) {
  const has = (type: string) => marks.some((m) => m.type === type)
  const style = marks.find((m) => m.type === 'textStyle')?.attrs ?? {}
  const highlight = marks.find((m) => m.type === 'highlight')
  const isLink = has('link')

  return new TextRun({
    text,
    bold: forceBold || has('bold') || undefined,
    italics: has('italic') || undefined,
    underline: has('underline') || isLink ? {} : undefined,
    strike: has('strike') || undefined,
    color: toHex(style.color) ?? (isLink ? LINK_COLOR : undefined),
    font: firstFamily(style.fontFamily) ?? (has('code') ? 'Consolas' : undefined),
    size: toHalfPoints(style.fontSize),
    shading: highlight
      ? {
          type: ShadingType.CLEAR,
          color: 'auto',
          fill: toHex(highlight.attrs?.color) ?? 'FFFF00',
        }
      : undefined,
  })
}

const IMAGE_TYPES: Record<string, 'png' | 'jpg' | 'gif' | 'bmp'> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
}

async function imageRun(attrs: Record<string, unknown>, ctx: Context) {
  const src = String(attrs.src ?? '')
  const blob = await (await fetch(src)).blob()
  const objectUrl = URL.createObjectURL(blob)
  try {
    const img = await loadImageElement(objectUrl)
    const natural = { width: img.naturalWidth || 300, height: img.naturalHeight || 200 }

    let type = IMAGE_TYPES[blob.type]
    let data: Uint8Array
    if (type) {
      data = new Uint8Array(await blob.arrayBuffer())
    } else {
      // WebP, SVG, AVIF… → PNG, which every Word version can show.
      const canvas = document.createElement('canvas')
      canvas.width = natural.width
      canvas.height = natural.height
      canvas.getContext('2d')?.drawImage(img, 0, 0)
      const png = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      )
      if (!png) throw new Error('Could not convert the image')
      data = new Uint8Array(await png.arrayBuffer())
      type = 'png'
    }

    let width = Number(attrs.width) || natural.width
    let height = Number(attrs.height) || (width * natural.height) / natural.width
    if (width > ctx.contentWidthPx) {
      height = (height * ctx.contentWidthPx) / width
      width = ctx.contentWidthPx
    }
    const alt = typeof attrs.alt === 'string' && attrs.alt ? attrs.alt : undefined

    return new ImageRun({
      type,
      data,
      transformation: { width: Math.round(width), height: Math.round(height) },
      altText: alt ? { name: alt, description: alt, title: alt } : undefined,
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function inlineChildren(
  nodes: JSONContent[] = [],
  ctx: Context,
  forceBold?: boolean,
): Promise<ParagraphChild[]> {
  const out: ParagraphChild[] = []
  for (const node of nodes) {
    if (node.type === 'text' && node.text) {
      const marks = node.marks ?? []
      const run = textRun(node.text, marks, forceBold)
      const link = marks.find((m) => m.type === 'link')
      out.push(
        link?.attrs?.href
          ? new ExternalHyperlink({ link: String(link.attrs.href), children: [run] })
          : run,
      )
    } else if (node.type === 'hardBreak') {
      out.push(new TextRun({ break: 1 }))
    } else if (node.type === 'image') {
      try {
        out.push(await imageRun(node.attrs ?? {}, ctx))
      } catch {
        // Typically a remote image without CORS headers.
        out.push(new TextRun({ text: '[image]', italics: true, color: '78716C' }))
      }
    }
  }
  return out
}

function alignment(node: JSONContent) {
  const align = node.attrs?.textAlign as keyof typeof ALIGNMENT | undefined
  return align ? ALIGNMENT[align] : undefined
}

async function paragraph(
  node: JSONContent,
  ctx: Context,
  opts: BlockOptions,
  listItemFirst: boolean,
  checked?: boolean,
) {
  const children = await inlineChildren(node.content, ctx, opts.bold)
  const list = opts.list
  const level = list?.level ?? 0

  if (list?.kind === 'task' && listItemFirst) {
    children.unshift(new TextRun({ text: checked ? '☒ ' : '☐ ' }))
  }

  return new Paragraph({
    children,
    alignment: alignment(node),
    heading:
      node.type === 'heading'
        ? HEADINGS[Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 4) - 1]
        : undefined,
    style: node.type === 'heading' ? undefined : opts.style,
    numbering:
      list && listItemFirst && list.kind !== 'task'
        ? {
            reference: list.kind === 'ordered' ? 'ordered' : 'bullets',
            level,
            instance: list.kind === 'ordered' ? list.instance : undefined,
          }
        : undefined,
    // Follow-on paragraphs in a list item, and task items, line up with the text.
    indent:
      list && (!listItemFirst || list.kind === 'task')
        ? { left: 720 * (level + 1) - (list.kind === 'task' ? 360 : 0) }
        : undefined,
  })
}

const TABLE_RULE = { style: BorderStyle.SINGLE, size: 4, color: 'E7E5E4' }

async function table(node: JSONContent, ctx: Context): Promise<Table> {
  const rows = node.content ?? []
  const firstRow = rows[0]?.content ?? []
  const colWidthsPx = firstRow.flatMap((cell) => {
    const span = Number(cell.attrs?.colspan ?? 1)
    const widths = cell.attrs?.colwidth as number[] | null | undefined
    return Array.from({ length: span }, (_, i) => widths?.[i] ?? null)
  })
  const tableWidthTwip = Math.round(ctx.contentWidthPx * PX_TO_TWIP)
  // Columns the user never resized share whatever width is left.
  const fixed = colWidthsPx.reduce<number>((sum, w) => sum + (w ?? 0), 0)
  const flexible = colWidthsPx.filter((w) => w === null).length
  const fallbackPx = flexible
    ? Math.max((ctx.contentWidthPx - fixed) / flexible, 40)
    : 0
  const columnWidths = colWidthsPx.map((w) =>
    Math.round((w ?? fallbackPx) * PX_TO_TWIP),
  )
  const scale =
    fixed > ctx.contentWidthPx ? tableWidthTwip / columnWidths.reduce((a, b) => a + b, 0) : 1

  const tableRows: TableRow[] = []
  for (const row of rows) {
    const cells: TableCell[] = []
    const isHeader = (row.content ?? []).every((c) => c.type === 'tableHeader')
    for (const cell of row.content ?? []) {
      const header = cell.type === 'tableHeader'
      const children = await blocks(cell.content, ctx, { bold: header })
      const colspan = Number(cell.attrs?.colspan ?? 1)
      const rowspan = Number(cell.attrs?.rowspan ?? 1)
      cells.push(
        new TableCell({
          children: children.length ? children : [new Paragraph({})],
          columnSpan: colspan > 1 ? colspan : undefined,
          rowSpan: rowspan > 1 ? rowspan : undefined,
          shading: header
            ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F7F4F0' }
            : undefined,
        }),
      )
    }
    tableRows.push(new TableRow({ children: cells, tableHeader: isHeader || undefined }))
  }

  return new Table({
    rows: tableRows,
    columnWidths: columnWidths.length
      ? columnWidths.map((w) => Math.round(w * scale))
      : [tableWidthTwip],
    width: { size: tableWidthTwip, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    borders: {
      top: TABLE_RULE,
      bottom: TABLE_RULE,
      left: TABLE_RULE,
      right: TABLE_RULE,
      insideHorizontal: TABLE_RULE,
      insideVertical: TABLE_RULE,
    },
  })
}

async function blocks(
  nodes: JSONContent[] = [],
  ctx: Context,
  opts: BlockOptions = {},
): Promise<Block[]> {
  const out: Block[] = []

  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph':
      case 'heading':
        out.push(await paragraph(node, ctx, { ...opts, list: undefined }, false))
        break

      case 'blockquote':
        out.push(...(await blocks(node.content, ctx, { ...opts, style: 'Quote' })))
        break

      case 'bulletList':
      case 'orderedList':
      case 'taskList': {
        const kind =
          node.type === 'orderedList' ? 'ordered' : node.type === 'taskList' ? 'task' : 'bullet'
        const level = opts.list ? Math.min(opts.list.level + 1, 8) : 0
        const list = {
          kind,
          level,
          instance: kind === 'ordered' ? ++ctx.listInstance : 0,
        } as const
        for (const item of node.content ?? []) {
          let first = true
          for (const child of item.content ?? []) {
            if (LIST_TYPES.has(child.type ?? '')) {
              out.push(...(await blocks([child], ctx, { ...opts, list })))
            } else if (child.type === 'paragraph' || child.type === 'heading') {
              out.push(
                await paragraph(child, ctx, { ...opts, list }, first, Boolean(item.attrs?.checked)),
              )
              first = false
            } else {
              out.push(...(await blocks([child], ctx, opts)))
            }
          }
        }
        break
      }

      case 'table':
        out.push(await table(node, ctx))
        // Word merges two adjacent tables; an empty paragraph keeps them apart.
        out.push(new Paragraph({}))
        break

      case 'codeBlock': {
        const text = (node.content ?? []).map((n) => n.text ?? '').join('')
        for (const line of text.split('\n')) {
          out.push(
            new Paragraph({
              children: [new TextRun({ text: line, font: 'Consolas', size: 20 })],
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F5F5F5' },
              spacing: { after: 0 },
            }),
          )
        }
        break
      }

      case 'horizontalRule':
        out.push(
          new Paragraph({
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D6D3D1', space: 1 },
            },
          }),
        )
        break

      case 'pageBreak':
        out.push(new Paragraph({ children: [new PageBreak()] }))
        break

      default:
        if (node.content) out.push(...(await blocks(node.content, ctx, opts)))
    }
  }

  return out
}

const bulletLevels = Array.from({ length: 9 }, (_, level) => ({
  level,
  format: LevelFormat.BULLET,
  text: ['•', '◦', '▪'][level % 3],
  alignment: AlignmentType.LEFT,
  style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
}))

const orderedLevels = Array.from({ length: 9 }, (_, level) => ({
  level,
  format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level % 3],
  text: `%${level + 1}.`,
  alignment: AlignmentType.LEFT,
  style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
}))

// Mirrors the on-screen styles in index.css.
const headingStyle = (
  level: number,
  size: number,
  before: number,
  after: number,
  { allCaps = false, color = '0C0A09' } = {},
) => ({
  id: `Heading${level}`,
  name: `Heading ${level}`,
  basedOn: 'Normal',
  next: 'Normal',
  quickFormat: true,
  run: { font: HEADING_FONT, size, bold: true, color, allCaps },
  paragraph: {
    spacing: { before, after, line: 288 },
    keepNext: true,
    outlineLevel: level - 1,
  },
})

export async function exportDocx(
  content: JSONContent,
  { title, pageSetup }: { title: string; pageSetup: PageSetup },
) {
  const page = pageSize({ ...pageSetup, orientation: 'portrait' })
  const margins = MARGIN_PRESETS[pageSetup.margins].margins
  const landscape = pageSetup.orientation === 'landscape'
  const contentWidthMm = (landscape ? page.height : page.width) - margins.left - margins.right

  const ctx: Context = { listInstance: 0, contentWidthPx: contentWidthMm * MM_TO_PX }
  const children = await blocks(content.content, ctx)

  const doc = new Document({
    title,
    creator: 'Ark',
    styles: {
      default: {
        document: {
          run: { font: BODY_FONT, size: 24, color: '1C1917' },
          paragraph: { spacing: { after: 156, line: 360 } },
        },
      },
      paragraphStyles: [
        headingStyle(1, 48, 360, 120),
        headingStyle(2, 34, 320, 100),
        headingStyle(3, 27, 240, 80),
        headingStyle(4, 21, 240, 80, { allCaps: true, color: '57534E' }),
        {
          id: 'Quote',
          name: 'Quote',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { italics: true, color: '44403C' },
          paragraph: {
            indent: { left: 284 },
            border: {
              left: { style: BorderStyle.SINGLE, size: 18, color: 'EA580C', space: 10 },
            },
          },
        },
      ],
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: bulletLevels },
        { reference: 'ordered', levels: orderedLevels },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: Math.round(page.width * MM_TO_TWIP),
              height: Math.round(page.height * MM_TO_TWIP),
              orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: Math.round(margins.top * MM_TO_TWIP),
              right: Math.round(margins.right * MM_TO_TWIP),
              bottom: Math.round(margins.bottom * MM_TO_TWIP),
              left: Math.round(margins.left * MM_TO_TWIP),
            },
          },
        },
        footers: pageSetup.pageNumbers
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        children: [PageNumber.CURRENT],
                        font: HEADING_FONT,
                        size: 18,
                        color: '78716C',
                      }),
                    ],
                  }),
                ],
              }),
            }
          : undefined,
        children: children.length ? children : [new Paragraph({})],
      },
    ],
  })

  return Packer.toBlob(doc)
}
