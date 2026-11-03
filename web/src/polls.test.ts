import { describe, expect, it } from 'vitest'
import { describePolls } from './polls'

const NOW = 1_800_000_000
const QUARTER_HOUR = 900

describe('describePolls', () => {
  it('says when nothing has been checked yet', () => {
    expect(describePolls({ last: null, interval: null }, NOW)).toEqual({
      lastCheck: 'Not checked yet',
      nextCheck: null,
      failed: false,
    })
  })

  it('counts down to the next check', () => {
    const schedule = { last: { ran_at: NOW - 5 * 60, succeeded: true }, interval: QUARTER_HOUR }

    expect(describePolls(schedule, NOW)).toEqual({
      lastCheck: 'Checked 5 min ago',
      nextCheck: 'next in 10 min',
      failed: false,
    })
  })

  it('rounds the countdown up to whole minutes', () => {
    const schedule = {
      last: { ran_at: NOW - 14 * 60 - 30, succeeded: true },
      interval: QUARTER_HOUR,
    }

    expect(describePolls(schedule, NOW).nextCheck).toBe('next in 1 min')
  })

  it('expects a late check any moment within one interval', () => {
    const schedule = { last: { ran_at: NOW - 20 * 60, succeeded: true }, interval: QUARTER_HOUR }

    expect(describePolls(schedule, NOW).nextCheck).toBe('next any moment')
  })

  it('stops promising a next check once checks have clearly stopped', () => {
    const schedule = { last: { ran_at: NOW - 3 * 3600, succeeded: true }, interval: QUARTER_HOUR }

    expect(describePolls(schedule, NOW)).toMatchObject({
      lastCheck: 'Checked 3 h ago',
      nextCheck: null,
    })
  })

  it('makes no promise before the interval is known', () => {
    const schedule = { last: { ran_at: NOW - 60, succeeded: true }, interval: null }

    expect(describePolls(schedule, NOW).nextCheck).toBeNull()
  })

  it('reports a failed check', () => {
    const schedule = { last: { ran_at: NOW - 60, succeeded: false }, interval: QUARTER_HOUR }

    expect(describePolls(schedule, NOW)).toMatchObject({
      lastCheck: 'Last check failed 1 min ago',
      failed: true,
    })
  })
})
