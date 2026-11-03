import type { Editor } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { countWords } from './commands'

export interface DocumentStats {
  words: number
  characters: number
  selectedWords: number | null
}

/** Word and character counts, recomputed at most every 200 ms while typing. */
export function useDocumentStats(editor: Editor) {
  const [stats, setStats] = useState<DocumentStats>({
    words: 0,
    characters: 0,
    selectedWords: null,
  })

  useEffect(() => {
    let timer: number | undefined
    const compute = () => {
      timer = undefined
      if (editor.isDestroyed) return
      const { doc, selection } = editor.state
      const text = doc.textBetween(0, doc.content.size, ' ', ' ')
      setStats({
        words: countWords(text),
        characters: text.replace(/\s/g, '').length,
        selectedWords: selection.empty
          ? null
          : countWords(doc.textBetween(selection.from, selection.to, ' ', ' ')),
      })
    }
    const schedule = () => {
      timer ??= window.setTimeout(compute, 200)
    }
    compute()
    editor.on('transaction', schedule)
    return () => {
      editor.off('transaction', schedule)
      window.clearTimeout(timer)
    }
  }, [editor])

  return stats
}
