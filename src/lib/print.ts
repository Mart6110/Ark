/*
 * Printing (and so PDF export). The screen layout is already paginated: the
 * Pagination extension puts a spacer element at the start of every page but
 * the first. When printing starts, the text between two spacers is copied
 * into its own page-sized box, together with that page's header and footer,
 * and the copies are what gets printed. Each box has its own size, so pages
 * of a landscape section print landscape, and the PDF has exactly the pages
 * on screen.
 */

export interface PrintPage {
  /** All in CSS px. */
  width: number
  height: number
  marginLeft: number
  marginRight: number
  /** Distance from the top edge to the text, and from the text to the bottom edge. */
  textTop: number
  textBottom: number
  headerTop: number
  footerBottom: number
  headerHtml: string
  footerHtml: string
  pageNumber: number
  pageCount: number
  landscape: boolean
}

const isSpacer = (node: Node) =>
  node instanceof Element &&
  (node.classList.contains('page-spacer') || node.classList.contains('page-spacer-row'))

/** Whether anything other than spacers comes before `node` among its siblings. */
function hasContentBefore(node: Node) {
  for (let sibling = node.previousSibling; sibling; sibling = sibling.previousSibling) {
    if (sibling instanceof Element ? !isSpacer(sibling) : Boolean(sibling.textContent)) return true
  }
  return false
}

/**
 * The elements a page break cuts through, outermost first, and whether each
 * one started on an earlier page.
 */
function cutElements(spacer: Element, root: Element) {
  const chain: { element: Element; child: Node; continued: boolean }[] = []
  let child: Node = spacer
  let continued = false
  for (let element = spacer.parentElement; element && element !== root; element = element.parentElement) {
    continued = continued || hasContentBefore(child)
    chain.unshift({ element, child, continued })
    child = element
  }
  return chain
}

/**
 * Copies one page of the editor. Range.cloneContents() leaves out the
 * elements around the whole range (a page inside one list copies bare list
 * items), so those are added back as empty shells: every copy starts at a
 * section, with all its lists and tables around its content.
 */
function copyPage(range: Range, root: Element) {
  let copy: Node = range.cloneContents()
  const common = range.commonAncestorContainer
  for (let element = common instanceof Element ? common : common.parentElement; element && element !== root; element = element.parentElement) {
    const shell = element.cloneNode(false)
    shell.appendChild(copy)
    copy = shell
  }
  const fragment = document.createDocumentFragment()
  fragment.append(copy)
  return fragment
}

/**
 * Elements a page start cuts through are copied as shells around the rest of
 * their content. Mark the ones that began on an earlier page, so they don't
 * repeat a top margin, bullet or checkbox, and let lists and tables carry on
 * where they left off.
 */
function fixContinuations(fragment: DocumentFragment, spacer: Element, root: Element) {
  let clone = fragment.firstElementChild
  for (const { element, child, continued } of cutElements(spacer, root)) {
    if (!clone) break
    const next = clone.firstElementChild
    if (continued) {
      clone.setAttribute('data-continued', '')
      if (element instanceof HTMLOListElement) {
        let before = 0
        for (let sibling = child.previousSibling; sibling; sibling = sibling.previousSibling) {
          if (sibling instanceof HTMLLIElement) before += 1
        }
        clone.setAttribute('start', String((Number(element.getAttribute('start')) || 1) + before))
      }
    }
    if (element instanceof HTMLTableElement) {
      const columns = element.querySelector(':scope > colgroup')
      if (columns && !clone.querySelector(':scope > colgroup')) clone.prepend(columns.cloneNode(true))
    }
    clone = next
  }
}

function box(className: string, style: Partial<CSSStyleDeclaration>, html = '') {
  const el = document.createElement('div')
  el.className = className
  Object.assign(el.style, style)
  if (html) el.innerHTML = html
  return el
}

/** Builds the printable copy of the pages. Remove it again after printing. */
export function buildPrintRoot(editorDom: HTMLElement, pages: PrintPage[]) {
  const root = document.createElement('div')
  root.className = 'print-root'
  root.setAttribute('aria-hidden', 'true')
  const spacers = Array.from(editorDom.querySelectorAll('.page-spacer, .page-spacer-row'))
  const count = Math.min(pages.length, spacers.length + 1)

  for (let i = 0; i < count; i++) {
    const page = pages[i]
    const range = document.createRange()
    if (i === 0) range.setStart(editorDom, 0)
    else range.setStartAfter(spacers[i - 1])
    if (i === count - 1) range.setEnd(editorDom, editorDom.childNodes.length)
    else range.setEndBefore(spacers[i])
    const fragment = copyPage(range, editorDom)
    if (i > 0) fixContinuations(fragment, spacers[i - 1], editorDom)

    const sheet = box(page.landscape ? 'print-page print-landscape' : 'print-page', {
      width: `${page.width}px`,
      height: `${page.height}px`,
    })
    sheet.style.setProperty('--page-number', JSON.stringify(String(page.pageNumber)))
    sheet.style.setProperty('--page-count', JSON.stringify(String(page.pageCount)))
    const width = `${page.width - page.marginLeft - page.marginRight}px`
    const left = `${page.marginLeft}px`

    if (page.headerHtml) {
      sheet.append(box('hf-box hf-header', { top: `${page.headerTop}px`, left, width }, page.headerHtml))
    }
    const body = box('print-body doc-content', {
      top: `${page.textTop}px`,
      left,
      width,
      height: `${page.height - page.textTop - page.textBottom}px`,
    })
    const text = body.appendChild(box('ProseMirror', {}))
    text.append(fragment)
    sheet.append(body)
    if (page.footerHtml) {
      sheet.append(box('hf-box hf-footer', { bottom: `${page.footerBottom}px`, left, width }, page.footerHtml))
    }
    root.append(sheet)
  }
  return root
}
