import type { JSONContent } from '@tiptap/core'
import { MARGIN_PRESETS } from './page'
import type { ResolvedSection } from './sections'

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

const hasPageNumber = (doc: JSONContent | null): boolean =>
  Boolean(doc) && (doc?.type === 'pageField' || (doc?.content ?? []).some(hasPageNumber))

/**
 * A standalone web page with the document and a print-friendly stylesheet.
 * It's a plain web page: it prints with the first section's page size and
 * margins, and a page number if that section's footer has one, but not the
 * headers and footers themselves (PDF export keeps those).
 */
export function exportHtml(bodyHtml: string, { title, sections }: { title: string; sections: ResolvedSection[] }) {
  const first = sections[0]
  const pageSetup = {
    orientation: first.settings.orientation,
    margins: first.settings.margins,
    pageNumbers: hasPageNumber(first.headerFooter.footer),
  }
  const m = MARGIN_PRESETS[pageSetup.margins].margins
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>
  @page { size: A4 ${pageSetup.orientation}; margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;${pageSetup.pageNumbers ? ' @bottom-center { content: counter(page); font: 9pt Arial, sans-serif; color: #78716c; }' : ''} }
  body { max-width: 44rem; margin: 3rem auto; padding: 0 1.25rem; font: 12pt/1.5 "Source Serif 4", Georgia, serif; color: #1c1917; }
  p { margin: 0 0 0.65em; }
  h1, h2, h3, h4 { font-family: "Helvetica Neue", Arial, sans-serif; font-weight: 650; letter-spacing: -0.015em; line-height: 1.2; color: #0c0a09; margin: 1em 0 0.35em; }
  h1 { font-size: 24pt; } h2 { font-size: 17pt; } h3 { font-size: 13.5pt; }
  h4 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: 0.06em; color: #57534e; }
  blockquote { margin: 0.9em 0; padding-left: 1em; border-left: 3px solid #ea580c; font-style: italic; color: #44403c; }
  table { border-collapse: collapse; width: 100%; margin: 0.4em 0 0.9em; font-size: 0.95em; }
  td, th { border: 1px solid #e7e5e4; padding: 0.35em 0.6em; vertical-align: top; text-align: left; }
  th { background: #f7f4f0; font-family: "Helvetica Neue", Arial, sans-serif; font-size: 0.9em; }
  td p, th p, li p { margin: 0; }
  img { max-width: 100%; height: auto; }
  a { color: #c2410c; }
  hr { border: 0; height: 1px; background: #d6d3d1; }
  ul[data-type="taskList"] { list-style: none; padding-left: 0.1em; }
  ul[data-type="taskList"] li { display: flex; gap: 0.5em; }
  .page-break { break-after: page; }
  section[data-section] + section[data-section] { break-before: page; }
  @media print { body { margin: 0; max-width: none; padding: 0; } }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`
  return new Blob([html], { type: 'text/html;charset=utf-8' })
}
