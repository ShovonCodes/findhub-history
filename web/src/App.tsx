import { useEffect, useMemo, useState } from 'react'
import {
  type Device,
  type PollSchedule,
  type PositionedLocation,
  fetchDevices,
  fetchPollSchedule,
  fetchTrail,
} from './api'
import { DeviceList } from './components/DeviceList'
import { PollStatusLine } from './components/PollStatusLine'
import { RangePicker } from './components/RangePicker'
import { ReplayBar } from './components/ReplayBar'
import { TimeStrip } from './components/TimeStrip'
import { type Focus, Timeline } from './components/Timeline'
import { TrackerMap } from './components/TrackerMap'
import { type RangeId, rangeSeconds } from './ranges'
import { REPLAY_STEP_MS, type Replay, type ReplaySpeed, startReplay, stepReplay } from './replay'
import { groupIntoStays } from './stays'
import { nowInSeconds } from './time'
import { type TimeWindow, withinWindow } from './timeWindow'

const REFRESH_MS = 60_000

interface Trail {
  selectionKey: string
  points: PositionedLocation[]
}

export default function App() {
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [polls, setPolls] = useState<PollSchedule | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(nowInSeconds)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [range, setRange] = useState<RangeId>('day')
  const [trail, setTrail] = useState<Trail | null>(null)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [timeWindow, setTimeWindow] = useState<TimeWindow | null>(null)
  const [replay, setReplay] = useState<Replay | null>(null)
  const [speed, setSpeed] = useState<ReplaySpeed>(1)

  useEffect(() => {
    const load = () =>
      Promise.all([fetchDevices(), fetchPollSchedule()]).then(
        ([loadedDevices, loadedPolls]) => {
          setDevices(loadedDevices)
          setPolls(loadedPolls)
          setError(null)
          setNow(nowInSeconds())
        },
        (caught: Error) => setError(caught.message),
      )
    void load()
    const timer = setInterval(load, REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  const selected = devices?.find((device) => device.id === selectedId) ?? null
  const selectionKey = `${selectedId}|${range}`
  const trailKey = `${selectionKey}|${selected?.position?.reported_at}`

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    const since = nowInSeconds() - rangeSeconds(range)
    fetchTrail(selectedId, since).then(
      (points) => !cancelled && setTrail({ selectionKey, points }),
      (caught: Error) => !cancelled && setError(caught.message),
    )
    return () => {
      cancelled = true
    }
  }, [selectedId, range, selectionKey, trailKey])

  const trailPoints = selected && trail?.selectionKey === selectionKey ? trail.points : null
  const windowPoints = useMemo(
    () => withinWindow(trailPoints ?? [], timeWindow),
    [trailPoints, timeWindow],
  )
  const readings = useMemo(
    () => windowPoints.map((point) => point.reported_at).sort((a, b) => a - b),
    [windowPoints],
  )
  const stays = useMemo(() => groupIntoStays(windowPoints), [windowPoints])
  const replayedStays = useMemo(
    () =>
      replay
        ? groupIntoStays(windowPoints.filter((point) => point.reported_at <= replay.at))
        : stays,
    [replay, windowPoints, stays],
  )
  const replayPoint = replay
    ? (windowPoints.find((point) => point.reported_at === replay.at) ?? null)
    : null
  const timelineFocus = useMemo<Focus | null>(
    () => (replay ? { kind: 'point', at: replay.at } : focus),
    [replay, focus],
  )

  useEffect(() => {
    if (!replay?.playing) return
    const timer = setTimeout(
      () => setReplay((current) => current && stepReplay(readings, current)),
      REPLAY_STEP_MS / speed,
    )
    return () => clearTimeout(timer)
  }, [replay, readings, speed])

  const resetView = () => {
    setFocus(null)
    setReplay(null)
  }
  const toggleSelection = (deviceId: string) => {
    setSelectedId((current) => (current === deviceId ? null : deviceId))
    setTimeWindow(null)
    resetView()
  }
  const changeRange = (next: RangeId) => {
    setRange(next)
    setTimeWindow(null)
    resetView()
  }
  const changeWindow = (next: TimeWindow | null) => {
    setTimeWindow(next)
    resetView()
  }
  const focusOn = (next: Focus) => {
    setReplay(null)
    setFocus(next)
  }
  const play = () => {
    setFocus(null)
    setReplay((current) => startReplay(readings, current))
  }

  return (
    <div className="app">
      <aside className="panel">
        <header className="panel-header">
          <h1>Find Hub History</h1>
          {polls ? <PollStatusLine schedule={polls} now={now} /> : null}
        </header>

        {error ? <p className="notice">Can't reach the server: {error}</p> : null}

        <section className="card" aria-labelledby="devices-heading">
          <div className="card-head">
            <h2 id="devices-heading">Devices</h2>
            {devices ? <span className="card-hint">{devices.length}</span> : null}
          </div>
          {devices === null ? (
            <p className="empty">Loading…</p>
          ) : (
            <DeviceList
              devices={devices}
              selectedId={selectedId}
              now={now}
              onSelect={toggleSelection}
            />
          )}
        </section>

        {selected ? (
          <section className="card history" aria-labelledby="history-heading">
            <div className="card-head">
              <h2 id="history-heading">History</h2>
              <span className="card-hint">
                {trailPoints ? describeCount(windowPoints.length, trailPoints.length) : 'Loading…'}
              </span>
            </div>
            <RangePicker value={range} onChange={changeRange} />
            {trailPoints ? (
              <>
                <TimeStrip
                  span={{ start: now - rangeSeconds(range), end: now }}
                  readings={trailPoints.map((point) => point.reported_at)}
                  window={timeWindow}
                  playhead={replay?.at ?? null}
                  now={now}
                  onChange={changeWindow}
                />
                <Timeline stays={stays} focus={timelineFocus} now={now} onFocus={focusOn} />
              </>
            ) : null}
          </section>
        ) : null}
      </aside>

      <main className="map-area">
        <TrackerMap
          devices={devices ?? []}
          selectedId={selectedId}
          stays={replayedStays}
          focus={replay ? null : focus}
          replayPoint={replayPoint}
          now={now}
          fitKey={
            selectedId === null || trail?.selectionKey === selectionKey
              ? `${selectionKey}|${timeWindow?.from}|${timeWindow?.to}`
              : null
          }
          onSelect={toggleSelection}
          onFocus={focusOn}
        />
        {selected && readings.length > 0 ? (
          <ReplayBar
            replay={replay}
            readings={readings}
            speed={speed}
            now={now}
            onPlay={play}
            onPause={() => setReplay((current) => current && { ...current, playing: false })}
            onStop={() => setReplay(null)}
            onSpeedChange={setSpeed}
          />
        ) : null}
      </main>
    </div>
  )
}

function describeCount(shown: number, total: number): string {
  const count = shown === total ? plural(total, 'point') : `${shown} of ${plural(total, 'point')}`
  return `${count}, newest first`
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
