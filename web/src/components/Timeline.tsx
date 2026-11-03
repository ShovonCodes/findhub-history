import { useEffect, useRef } from 'react'
import type { PositionedLocation } from '../api'
import type { Stay } from '../stays'
import { formatDateTime, formatTimeOfDay } from '../time'

export interface Focus {
  kind: 'stay' | 'point'
  at: number
}

interface TimelineProps {
  stays: Stay[]
  focus: Focus | null
  now: number
  onFocus: (focus: Focus) => void
}

export function Timeline({ stays, focus, now, onFocus }: TimelineProps) {
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-pressed="true"]')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focus])

  if (stays.length === 0) {
    return <p className="empty">No positions in this period.</p>
  }

  const isFocused = (kind: Focus['kind'], at: number) => focus?.kind === kind && focus.at === at

  return (
    <ol className="timeline" ref={listRef}>
      {stays.map((stay) =>
        stay.points.length === 1 ? (
          <li key={stay.startedAt}>
            <PointRow
              point={stay.points[0]}
              now={now}
              focused={isFocused('point', stay.startedAt)}
              onFocus={onFocus}
            />
          </li>
        ) : (
          <li key={stay.startedAt} className="stay">
            <button
              className="timeline-row stay-row"
              aria-pressed={isFocused('stay', stay.startedAt)}
              onClick={() => onFocus({ kind: 'stay', at: stay.startedAt })}
            >
              <span className="timeline-marker" />
              <span className="timeline-text">
                <span className="timeline-time">
                  {formatTimeOfDay(stay.startedAt, now)} – {formatTimeOfDay(stay.endedAt, now)}
                </span>
                <span className="timeline-detail">
                  Stayed here · {stay.points.length} sightings
                </span>
              </span>
              <Accuracy metres={stay.accuracy} />
            </button>
            <ol className="stay-points">
              {stay.points.map((point) => (
                <li key={point.reported_at}>
                  <PointRow
                    point={point}
                    now={now}
                    focused={isFocused('point', point.reported_at)}
                    onFocus={onFocus}
                  />
                </li>
              ))}
            </ol>
          </li>
        ),
      )}
    </ol>
  )
}

interface PointRowProps {
  point: PositionedLocation
  now: number
  focused: boolean
  onFocus: (focus: Focus) => void
}

function PointRow({ point, now, focused, onFocus }: PointRowProps) {
  return (
    <button
      className="timeline-row"
      aria-pressed={focused}
      onClick={() => onFocus({ kind: 'point', at: point.reported_at })}
    >
      <span className="timeline-marker" />
      <span className="timeline-text">
        <time
          className="timeline-time"
          dateTime={new Date(point.reported_at * 1000).toISOString()}
          title={formatDateTime(point.reported_at)}
        >
          {formatTimeOfDay(point.reported_at, now)}
        </time>
        <span className="timeline-detail">{describeSource(point)}</span>
      </span>
      <Accuracy metres={point.accuracy} />
    </button>
  )
}

function Accuracy({ metres }: { metres: number | null }) {
  return <span className="timeline-accuracy">{metres ? `± ${Math.round(metres)} m` : '–'}</span>
}

function describeSource(point: PositionedLocation): string {
  if (point.semantic_name) return point.semantic_name
  if (point.is_own_report === null) return 'Position'
  return point.is_own_report ? 'Own report' : 'Seen by a nearby phone'
}
