import type { PollSchedule } from './api'
import { timeAgo } from './time'

export interface PollStatus {
  lastCheck: string
  nextCheck: string | null
  failed: boolean
}

export function describePolls({ last, interval }: PollSchedule, now: number): PollStatus {
  if (!last) return { lastCheck: 'Not checked yet', nextCheck: null, failed: false }

  return {
    lastCheck: `${last.succeeded ? 'Checked' : 'Last check failed'} ${timeAgo(last.ran_at, now)}`,
    nextCheck: interval ? describeNextCheck(last.ran_at + interval - now, interval) : null,
    failed: !last.succeeded,
  }
}

function describeNextCheck(secondsLeft: number, interval: number): string | null {
  if (secondsLeft > 0) return `next in ${Math.ceil(secondsLeft / 60)} min`
  return -secondsLeft < interval ? 'next any moment' : null
}
