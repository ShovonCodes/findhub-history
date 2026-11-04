export const RANGES = [
  { id: 'hour', label: '1h', name: 'Last hour', seconds: 3600 },
  { id: 'twoHours', label: '2h', name: 'Last 2 hours', seconds: 2 * 3600 },
  { id: 'day', label: '24h', name: 'Last 24 hours', seconds: 24 * 3600 },
  { id: 'week', label: '7d', name: 'Last 7 days', seconds: 7 * 24 * 3600 },
  { id: 'month', label: '30d', name: 'Last 30 days', seconds: 30 * 24 * 3600 },
] as const

export type RangeId = (typeof RANGES)[number]['id']

export function rangeSeconds(id: RangeId): number {
  return RANGES.find((range) => range.id === id)!.seconds
}
