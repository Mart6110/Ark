const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const absolute = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['minute', 60],
  ['hour', 60 * 60],
  ['day', 60 * 60 * 24],
]

/** "just now", "5 minutes ago", "yesterday", or a date for anything older than a week. */
export function timeAgo(timestamp: number, now = Date.now()) {
  const seconds = Math.round((timestamp - now) / 1000)
  if (Math.abs(seconds) < 60) return 'just now'
  if (Math.abs(seconds) >= 7 * 24 * 60 * 60) return absolute.format(timestamp)
  const [unit, size] = UNITS.findLast(([, s]) => Math.abs(seconds) >= s) ?? UNITS[0]
  return relative.format(Math.round(seconds / size), unit)
}
