import { describe, expect, it } from 'vitest'
import { timeAgo } from './time'

const NOW = 1_800_000_000

describe('timeAgo', () => {
  it.each([
    [NOW - 20, 'just now'],
    [NOW + 30, 'just now'],
    [NOW - 14 * 60, '14 min ago'],
    [NOW - 3 * 3600 - 59, '3 h ago'],
    [NOW - 30 * 3600, 'yesterday'],
    [NOW - 5 * 86400, '5 days ago'],
  ])('formats %i', (timestamp, expected) => {
    expect(timeAgo(timestamp, NOW)).toBe(expected)
  })
})
