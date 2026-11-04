# Ark - word processor

A word processor that runs in the browser: a formatting toolbar, real A4 pages with headers, footers and page numbers, sections with their own layout, paragraph styles, tables, images, and export to PDF and .docx. Everything is stored locally in the browser.

Built with Vite, React 19, TypeScript, Tailwind CSS v4, [SmoothUI](https://smoothui.dev) (on Base UI), [Tiptap 3](https://tiptap.dev) as the editor engine, `mammoth` for .docx import and `docx` for .docx export.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173. The first run creates a **Welcome to Ark** document that shows off most of what the editor can do.

`npm run build` writes a production build to `dist/` (plain static files), and `npm run lint` runs oxlint.

## Features

| Where | What |
| --- | --- |
| **Toolbar** | Undo/redo, paragraph style (Normal text, Heading 1–4, Quote), font and size, bold/italic/underline/strikethrough/inline code, text and highlight color, link, table, the Insert menu (images, page break, section break, divider, today's date), alignment, bulleted/numbered lists and checklists with indenting, copy formatting, clear formatting |
| **Headers and footers** | Click the top or bottom margin of any page to edit them in place, with the toolbar's text formatting and the page number and page count fields. A bar beside them turns on a different first page and, in later sections, "Same as previous section". Esc or a click in the text goes back |
| **Table menu** | Shows up in the toolbar while the cursor is in a table: insert/delete rows and columns, merge/split cells, header row |
| **Sidebar** | Documents with search, new document, delete, .docx import. Docked on wide screens (Ctrl+O toggles it), an overlay on phones |
| **Top bar** | Document title, save status, Export (PDF, .docx, .html, print), theme |
| **Status bar** | Page and word counts, page setup for the section the cursor is in (orientation, margins, different first page, "Same as previous section", first page number or restart numbering, remove section break), zoom. Click the percentage to toggle between 100% and fit-to-width |

Images can also be pasted or dragged in. Large photos are scaled down to 1600 px so documents stay small enough to store.

### Shortcuts

| Keys | Action |
| --- | --- |
| Ctrl+B / I / U | Bold, italic, underline |
| Ctrl+Shift+7 / 8 / 9 | Numbered list, bulleted list, checklist |
| Ctrl+Shift+L / E / R / J | Align left, center, right, justify |
| Ctrl+Alt+1 … 4 | Heading 1–4 |
| Ctrl+K | Insert or edit a link (Ctrl+click opens one) |
| Ctrl+Enter | Page break |
| Esc | Leave a header or footer |
| Ctrl+S | Save now (it also happens on its own) |
| Ctrl+P | Print or save as PDF |
| Ctrl+O | Show or hide the documents sidebar |

## How it works

**Pages.** Text flows across separate A4 pages as you type (`src/editor/pagination.ts`). The document itself has no pages: the Pagination extension measures the layout and inserts invisible spacer decorations that push content to the top of the next sheet. Paragraphs split between lines (never leaving a single line behind or carrying one over), list items move with their bullet, tables split between rows, a heading never ends a page on its own, and a manual page break (Ctrl+Enter) starts a new page. Lines and table rows taller than a page can't be split, and images are limited to the height of a page. Layout runs once per frame after a change and takes a few milliseconds even for long documents, because it measures with the spacers hidden by a CSS class and only updates the editor when a page start actually moves.

The sheets are drawn behind the editor (`src/components/page.tsx`) and stay white in dark mode.

**Sections.** The document is a run of section nodes holding the blocks: `doc → section+ → block+` (`src/editor/sections.ts`). A section break splits the section at the cursor; Backspace at the start of a section, or "Remove section break", joins it to the one before. Every section starts on a new page and can have its own orientation, margins, header and footer, different first page and page numbering. The section nodes only carry an id: their settings are stored next to the content, keyed by that id (`src/lib/sections.ts`), so typing in a header doesn't touch or re-render the document. A new section carries on the previous one's layout and shares its header and footer until you change them. Pagination gets each section's page size and text area and reports every page it made; sheets of different sizes are centred above each other, and each section's text column is placed on its own sheets by a CSS rule per section.

**Headers and footers.** They're rich text, edited by a second, small Tiptap editor placed over the page's margin (`src/components/header-footer-editor.tsx`, extensions in `src/editor/header-footer.ts`); while it's open the toolbar works on it and hides what a header can't hold (lists, tables, images, breaks). On every other page the same content is drawn as static HTML. The page number and page count fields are empty in the HTML and get their numbers from CSS variables set per page, so one rendering serves every page. A header or footer taller than its margin pushes the text away from it, as in Word: their rendered heights are measured off-screen and fed into the pagination.

**Typography.** Body text is Source Serif 4 at 12 pt and headings are Geist, both bundled with the app. The page's colors are fixed (they're what gets printed), while the app around it follows the light/dark theme.

**Storage.** The first version of Ark was in Danish; on first start, `src/lib/migrations.ts` turns a stored Danish welcome document into the English one (unless it has been rewritten) and renames "Dokument uden titel" documents. Documents saved before sections existed open as one section with their old page setup (a page number setting becomes a page-number footer). Documents are saved to IndexedDB about 0.7 seconds after each change, including section settings and headers and footers; title changes are saved straight away. Metadata (title, date, preview) and content live in separate databases (`ark-meta` and `ark-content`), so the sidebar doesn't have to read every image to list documents. The last open document is remembered in `localStorage`. Documents only exist in the browser that wrote them.

**PDF.** PDF export uses the browser's print dialog (choose "Save as PDF"). When printing starts, `src/lib/print.ts` copies each page off the screen: the text between two spacers goes into a page-sized box, with that page's header and footer, and only those boxes are printed (named `@page` rules give landscape boxes landscape paper). Elements a page boundary cuts through are copied as shells: a paragraph or list item that started on the page before doesn't repeat its top margin, bullet or checkbox, a numbered list carries on counting and a table keeps its column widths. The PDF therefore has exactly the pages on screen. That was checked in Chrome by comparing every page's first and last line on screen and in print (within 1 px) for split paragraphs, a long numbered list, a 45-row table, headings and checklists, and a mixed portrait/landscape document page by page. Other browsers may differ. The bundled fonts are embedded.

**.docx.** Import runs `mammoth` (headings, lists, tables, images, links, bold/italic/underline, and the Title, Subtitle and Quote styles); mammoth doesn't read headers, footers or section breaks, so an imported file is one section. Export builds the file with `docx` from Tiptap's JSON: styles, numbering, tables with column widths, images, links, colors, font sizes, page breaks, and one Word section per Ark section with its page setup, header and footer (page number and page count as real Word fields), different first page and page numbering restart. A section that shares the previous section's header and footer leaves its own out, which is what Word's "Link to Previous" means. Word paginates on its own, so its page breaks can differ from Ark's. The bundled web fonts aren't installed where Word runs, so the export uses Georgia for body text and Arial for headings. Advanced formatting (footnotes, columns, text wrapping around images and so on) is lost, on purpose. Images from other websites only make it into the .docx if the server allows CORS; otherwise you'll see "[image]".

## Where things live

| Path | What |
| --- | --- |
| `src/components/document-workspace.tsx` | One open document: editor, layout, autosave, shortcuts, import/export |
| `src/components/toolbar/` | The formatting toolbar, color and table pickers |
| `src/components/sidebar.tsx` | Document list |
| `src/components/top-bar.tsx`, `status-bar.tsx`, `page-setup.tsx` | The bars around the page |
| `src/components/page.tsx` | The page sheets with their headers and footers, the current page, and the print copy |
| `src/components/header-footer-editor.tsx` | Editing a header or footer in place, and its options bar |
| `src/editor/pagination.ts` | Pagination: measures the text and pushes it onto the right page |
| `src/editor/sections.ts`, `src/lib/sections.ts` | Section nodes and commands; section settings, page geometry and numbering |
| `src/editor/header-footer.ts` | What a header or footer can hold, the page fields, and their static HTML |
| `src/lib/print.ts` | Copies the pages for printing |
| `src/editor/` | Other Tiptap extensions, page break node, formatting state, autosave, copy formatting |
| `src/lib/documents.ts` | IndexedDB storage |
| `src/lib/docx-import.ts`, `docx-export.ts` | .docx in and out (lazy-loaded; they're large) |
| `src/components/smoothui/` | SmoothUI components (see below) |

## SmoothUI

SmoothUI is a shadcn registry, configured in `components.json` as `@smoothui`. Components are copied into `src/components/smoothui/` and excluded from linting, because `shadcn add` overwrites local edits. So don't edit them in place; wrap them instead. To add one:

```bash
npx shadcn@latest add @smoothui/<name>
```

Two things to know when building on them:

- `Select` and the dropdown menus give focus back to their trigger when they close. The toolbar then hands focus back to the document (`refocus` and `refocusAfterMenu` in `src/editor/commands.ts`), so you can keep typing.
- `Dialog` keeps showing a frozen copy of its content while it animates out. Forms in dialogs must therefore be guarded against double submits with a ref, not with props (see `link-dialog.tsx`).

## Not built (yet)

- Images and lists in headers and footers, different odd and even pages, and section breaks that don't start a new page
- Repeating table header rows on each page
- Real-time collaboration, comments, AI help
- Syncing between devices, or any server at all
- Find and replace, line spacing, and indenting plain paragraphs
- Tests in the repo (features were checked in a headless browser during development)
