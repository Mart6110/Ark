export function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Document'
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Opens the browser's print dialog, where "Save as PDF" lives. */
export function printDocument(title: string) {
  const previous = document.title
  // Browsers use the page title as the default PDF file name.
  document.title = safeFileName(title)
  window.addEventListener(
    'afterprint',
    () => {
      document.title = previous
    },
    { once: true },
  )
  window.print()
}

function readAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function loadImageElement(src: string) {
  const img = new Image()
  img.src = src
  return img.decode().then(() => img)
}

const MAX_IMAGE_WIDTH = 1600

/**
 * Reads an image file as a data URL, downscaling large photos so documents
 * (which embed their images) stay small enough to store and export.
 */
export async function imageFileToDataUrl(file: Blob) {
  const dataUrl = await readAsDataUrl(file)
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return dataUrl

  const img = await loadImageElement(dataUrl)
  if (img.naturalWidth <= MAX_IMAGE_WIDTH && file.size < 1_000_000) return dataUrl

  const scale = Math.min(1, MAX_IMAGE_WIDTH / img.naturalWidth)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
  return file.type === 'image/png'
    ? canvas.toDataURL('image/png')
    : canvas.toDataURL('image/jpeg', 0.88)
}
