export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 2

export function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom * 100) / 100))
}
