import { type FormEvent, useEffect, useRef, useState } from 'react'
import Dialog from '@/components/smoothui/dialog'
import Input from '@/components/smoothui/input'
import SmoothButton from '@/components/smoothui/smooth-button'
import { loadImageElement } from '@/lib/files'

export function ImageUrlDialog({
  open,
  onOpenChange,
  onInsert,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (src: string, alt: string) => void
}) {
  const [url, setUrl] = useState('')
  const [alt, setAlt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [wasOpen, setWasOpen] = useState(false)
  // Guards the frozen copy of the form shown while the dialog animates out.
  const submitted = useRef(false)
  useEffect(() => {
    if (open) submitted.current = false
  }, [open])

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setUrl('')
      setAlt('')
      setError(null)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitted.current) return
    submitted.current = true
    setChecking(true)
    setError(null)
    try {
      await loadImageElement(url.trim())
      onInsert(url.trim(), alt.trim())
      onOpenChange(false)
    } catch {
      submitted.current = false
      setError("The image couldn't be loaded. Check the address.")
    } finally {
      setChecking(false)
    }
  }

  return (
    <Dialog
      description="Images from the web load each time the document opens. Upload the image instead if it needs to work offline and in .docx exports."
      onOpenChange={onOpenChange}
      open={open}
      title="Image from a URL"
    >
      <form className="grid gap-4" onSubmit={submit}>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Image address</span>
          <Input
            aria-invalid={error ? true : undefined}
            autoFocus
            inputMode="url"
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…/image.jpg"
            required
            value={url}
          />
          {error ? <span className="text-destructive text-xs">{error}</span> : null}
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Alt text</span>
          <Input onChange={(e) => setAlt(e.target.value)} placeholder="Describe the image" value={alt} />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <SmoothButton onClick={() => onOpenChange(false)} size="sm" variant="outline">
            Cancel
          </SmoothButton>
          <SmoothButton color="accent" loading={checking} size="sm" type="submit" variant="solid">
            Insert
          </SmoothButton>
        </div>
      </form>
    </Dialog>
  )
}
