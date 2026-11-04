import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react'
import { formatDateTime, formatTimeOfDay } from '../time'
import { type Span, type TimeWindow, clampToSpan, windowBetween } from '../timeWindow'

const TAP_SLOP_PX = 4
const KEY_STEPS = 48

type Edge = keyof TimeWindow

interface Drag {
  anchor: number
  startX: number
  moved: boolean
}

interface TimeStripProps {
  span: Span
  readings: number[]
  window: TimeWindow | null
  playhead: number | null
  now: number
  onChange: (window: TimeWindow | null) => void
}

export function TimeStrip({ span, readings, window, playhead, now, onChange }: TimeStripProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const [draft, setDraft] = useState<TimeWindow | null>(null)
  const shown = draft ?? clampToSpan(window, span)
  const narrowed = draft !== null || window !== null

  const fraction = (time: number) => clamp((time - span.start) / (span.end - span.start), 0, 1)
  const offset = (time: number) => `${fraction(time) * 100}%`
  const timeAt = (clientX: number) => {
    const { left, width } = trackRef.current!.getBoundingClientRect()
    return span.start + clamp((clientX - left) / width, 0, 1) * (span.end - span.start)
  }
  const label = (time: number) => (time >= span.end ? 'Now' : formatTimeOfDay(time, now))

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const edge = (event.target as HTMLElement).closest<HTMLElement>('[data-edge]')?.dataset.edge
    const anchor = edge === 'from' ? shown.to : edge === 'to' ? shown.from : timeAt(event.clientX)
    drag.current = { anchor, startX: event.clientX, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const continueDrag = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current) return
    current.moved ||= Math.abs(event.clientX - current.startX) > TAP_SLOP_PX
    if (!current.moved) return
    const time = timeAt(event.clientX)
    setDraft({ from: Math.min(current.anchor, time), to: Math.max(current.anchor, time) })
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.moved && draft) onChange(windowBetween(draft.from, draft.to, span))
    cancelDrag(event)
  }

  const cancelDrag = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null
    setDraft(null)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const moveEdge = (edge: Edge, event: KeyboardEvent<HTMLElement>) => {
    const step = (span.end - span.start) / KEY_STEPS
    const targets: Record<string, number> = {
      ArrowLeft: shown[edge] - step,
      ArrowDown: shown[edge] - step,
      ArrowRight: shown[edge] + step,
      ArrowUp: shown[edge] + step,
      Home: span.start,
      End: span.end,
    }
    const target = targets[event.key]
    if (target === undefined) return
    event.preventDefault()
    if (edge === 'from') {
      onChange(windowBetween(clamp(target, span.start, shown.to - step), shown.to, span))
    } else {
      onChange(windowBetween(shown.from, clamp(target, shown.from + step, span.end), span))
    }
  }

  const handle = (edge: Edge, name: string) => (
    <span
      className="time-strip-handle"
      data-edge={edge}
      role="slider"
      tabIndex={0}
      aria-label={name}
      aria-valuemin={span.start}
      aria-valuemax={span.end}
      aria-valuenow={Math.round(shown[edge])}
      aria-valuetext={formatDateTime(shown[edge])}
      style={{ left: offset(shown[edge]) }}
      onKeyDown={(event) => moveEdge(edge, event)}
    />
  )

  return (
    <div className="time-strip">
      <div
        className="time-strip-track"
        ref={trackRef}
        data-narrowed={narrowed}
        onPointerDown={startDrag}
        onPointerMove={continueDrag}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
      >
        <span
          className="time-strip-window"
          style={{ left: offset(shown.from), right: `${(1 - fraction(shown.to)) * 100}%` }}
        />
        {readings.map((time) => (
          <span
            key={time}
            className="time-strip-reading"
            data-inside={time >= shown.from && time <= shown.to}
            style={{ left: offset(time) }}
          />
        ))}
        {playhead === null ? null : (
          <span className="time-strip-playhead" style={{ left: offset(playhead) }} />
        )}
        {handle('from', 'Start of selected time')}
        {handle('to', 'End of selected time')}
      </div>
      <div className="time-strip-labels">
        <span>{label(shown.from)}</span>
        {window ? (
          <button className="time-strip-clear" onClick={() => onChange(null)}>
            Show all
          </button>
        ) : (
          <span className="time-strip-hint">Drag to pick a time</span>
        )}
        <span>{label(shown.to)}</span>
      </div>
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
