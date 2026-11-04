export interface TimeWindow {
  from: number
  to: number
}

export interface Span {
  start: number
  end: number
}

export function withinWindow<T extends { reported_at: number }>(
  points: T[],
  window: TimeWindow | null,
): T[] {
  if (!window) return points
  return points.filter((point) => point.reported_at >= window.from && point.reported_at <= window.to)
}

export function windowBetween(from: number, to: number, span: Span): TimeWindow | null {
  const openStart = from <= span.start
  const openEnd = to >= span.end
  if (openStart && openEnd) return null
  return { from: openStart ? -Infinity : from, to: openEnd ? Infinity : to }
}

export function clampToSpan(window: TimeWindow | null, span: Span): TimeWindow {
  return {
    from: Math.max(window?.from ?? -Infinity, span.start),
    to: Math.min(window?.to ?? Infinity, span.end),
  }
}
