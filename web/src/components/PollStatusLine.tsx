import type { PollSchedule } from '../api'
import { describePolls } from '../polls'
import { formatDateTime } from '../time'

interface PollStatusLineProps {
  schedule: PollSchedule
  now: number
}

export function PollStatusLine({ schedule, now }: PollStatusLineProps) {
  const { lastCheck, nextCheck, failed } = describePolls(schedule, now)
  return (
    <p
      className="poll-status"
      data-failed={failed}
      title={schedule.last ? `Last check: ${formatDateTime(schedule.last.ran_at)}` : undefined}
    >
      <span className="poll-status-light" />
      <span>
        {lastCheck}
        {nextCheck ? <span className="poll-status-next"> · {nextCheck}</span> : null}
      </span>
    </p>
  )
}
