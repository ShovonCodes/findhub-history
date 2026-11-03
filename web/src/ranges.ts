export const RANGES = [
  { id: 'day', label: '24 hours', seconds: 24 * 3600 },
  { id: 'week', label: '7 days', seconds: 7 * 24 * 3600 },
  { id: 'month', label: '30 days', seconds: 30 * 24 * 3600 },
] as const

export type RangeId = (typeof RANGES)[number]['id']
