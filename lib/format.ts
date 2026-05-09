const TZ = 'Europe/Amsterdam'

export function formatDateTimeNL(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('nl-NL', {
    timeZone: TZ,
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatDateShortNL(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export function formatTimeNL(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

export function formatDateLongNL(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
}

const URGENT_THRESHOLD_MS = 48 * 60 * 60 * 1000

export function isDeadlineUrgent(deadline: Date | string, now: Date = new Date()): boolean {
  const d = typeof deadline === 'string' ? new Date(deadline) : deadline
  const diff = d.getTime() - now.getTime()
  return diff > 0 && diff < URGENT_THRESHOLD_MS
}
