/** The document new users start with. Doubles as a tour of what the editor can do. */
export const WELCOME_HTML = `
<h1>Welcome to Ark</h1>
<p>Ark is a small word processor that lives in your browser. Everything you write is <strong>saved automatically</strong> on this device. There's no server and no account.</p>
<h2>What you can do</h2>
<ul>
  <li><p>Format text with <strong>bold</strong>, <em>italic</em>, <u>underline</u>, <mark data-color="#fef08a" style="background-color: #fef08a">highlights</mark> and <span style="color: #c2410c">color</span>.</p></li>
  <li><p>Pick a paragraph style, from headings to quotes, in the first menu of the toolbar.</p></li>
  <li><p>Add tables, images, links, page breaks and section breaks.</p></li>
  <li><p>Click the top or bottom margin of a page to write a header or footer, with page numbers.</p></li>
  <li><p>Export to PDF, Word (.docx) or a web page, and import .docx files from the sidebar.</p></li>
</ul>
<h2>Shortcuts</h2>
<table>
  <tbody>
    <tr><th><p>Keys</p></th><th><p>Action</p></th></tr>
    <tr><td><p>Ctrl+B, Ctrl+I, Ctrl+U</p></td><td><p>Bold, italic, underline</p></td></tr>
    <tr><td><p>Ctrl+K</p></td><td><p>Insert or edit a link</p></td></tr>
    <tr><td><p>Ctrl+Enter</p></td><td><p>Page break</p></td></tr>
    <tr><td><p>Ctrl+S</p></td><td><p>Save now (it also happens on its own)</p></td></tr>
    <tr><td><p>Ctrl+P</p></td><td><p>Print or save as PDF</p></td></tr>
  </tbody>
</table>
<blockquote><p>Text flows from page to page as you write, and pages print exactly as you see them. Orientation, margins and page numbering are under page setup, at the bottom of the window, and a section break lets part of the document have its own.</p></blockquote>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><p>Open Ark</p></li>
  <li data-type="taskItem" data-checked="false"><p>Write your first document</p></li>
</ul>
`

export const WELCOME_TEXT =
  'Ark is a small word processor that lives in your browser. Everything you write is saved automatically on this device.'
