import { REPLAY_SPEEDS, type Replay, type ReplaySpeed } from '../replay'
import { formatClockTime, formatDateTime, formatDay } from '../time'

interface ReplayBarProps {
  replay: Replay | null
  readings: number[]
  speed: ReplaySpeed
  now: number
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onSpeedChange: (speed: ReplaySpeed) => void
}

export function ReplayBar({
  replay,
  readings,
  speed,
  now,
  onPlay,
  onPause,
  onStop,
  onSpeedChange,
}: ReplayBarProps) {
  const playing = replay?.playing ?? false

  return (
    <div className="replay-bar" role="group" aria-label="Replay">
      <button
        className="replay-play"
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={playing ? onPause : onPlay}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div className="replay-status">
        {replay ? (
          <>
            <time className="replay-time" title={formatDateTime(replay.at)}>
              {formatClockTime(replay.at)}
            </time>
            <span className="replay-count">
              {[formatDay(replay.at, now), `${readings.indexOf(replay.at) + 1} of ${readings.length}`]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </>
        ) : (
          <>
            <span className="replay-time">Replay</span>
            <span className="replay-count">
              {readings.length} {readings.length === 1 ? 'point' : 'points'}
            </span>
          </>
        )}
      </div>

      <div className="replay-speeds" role="radiogroup" aria-label="Replay speed">
        {REPLAY_SPEEDS.map((option) => (
          <button
            key={option}
            role="radio"
            aria-checked={option === speed}
            onClick={() => onSpeedChange(option)}
          >
            {option}×
          </button>
        ))}
      </div>

      {replay ? (
        <button className="replay-stop" aria-label="Stop replay" onClick={onStop}>
          <StopIcon />
        </button>
      ) : null}
    </div>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
      <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
    </svg>
  )
}
