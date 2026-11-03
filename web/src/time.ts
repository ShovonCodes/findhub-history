const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

export function timeAgo(timestamp: number, now: number): string {
  const elapsed = Math.max(0, now - timestamp)
  if (elapsed < MINUTE) return 'just now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`
  const days = Math.floor(elapsed / DAY)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

export function formatTimeOfDay(timestamp: number, now: number): string {
  const date = new Date(timestamp * 1000)
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (date.toDateString() === new Date(now * 1000).toDateString()) return time
  const dateOptions: Intl.DateTimeFormatOptions =
    now - timestamp < 6 * DAY ? { weekday: 'short' } : { day: 'numeric', month: 'short' }
  return `${date.toLocaleDateString(undefined, dateOptions)} ${time}`
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
