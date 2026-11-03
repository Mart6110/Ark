import mammoth from 'mammoth'

// mammoth drops underline by default and maps only headings; these cover the
// other built-in Word styles the editor has an equivalent for.
const STYLE_MAP = [
  'u => u',
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Quote'] => blockquote > p:fresh",
  "p[style-name='Intense Quote'] => blockquote > p:fresh",
]

export interface ImportResult {
  html: string
  text: string
  /** Number of things mammoth couldn't convert (unknown styles, etc.). */
  warnings: number
}

export async function importDocx(file: File): Promise<ImportResult> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    { styleMap: STYLE_MAP },
  )
  // Space out block ends so the preview doesn't run paragraphs together.
  const spaced = result.value.replace(/<\/(p|h\d|li|td|th|blockquote)>/g, '$& ')
  const text =
    new DOMParser().parseFromString(spaced, 'text/html').body.textContent ?? ''
  return {
    html: result.value,
    text,
    warnings: result.messages.filter((m) => m.type === 'warning').length,
  }
}
