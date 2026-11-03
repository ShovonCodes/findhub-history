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
import { type Focus, Timeline } from './components/Timeline'
import { TrackerMap } from './components/TrackerMap'
import { RANGES, type RangeId } from './ranges'
import { groupIntoStays } from './stays'
import { nowInSeconds } from './time'

const REFRESH_MS = 60_000

interface Trail {
  key: string
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
    const since = nowInSeconds() - RANGES.find((option) => option.id === range)!.seconds
    fetchTrail(selectedId, since).then(
      (points) => !cancelled && setTrail({ key: trailKey, selectionKey, points }),
      (caught: Error) => !cancelled && setError(caught.message),
    )
    return () => {
      cancelled = true
    }
  }, [selectedId, range, selectionKey, trailKey])

  const trailPoints = selected && trail?.key === trailKey ? trail.points : null
  const stays = useMemo(() => groupIntoStays(trailPoints ?? []), [trailPoints])

  const toggleSelection = (deviceId: string) => {
    setSelectedId((current) => (current === deviceId ? null : deviceId))
    setFocus(null)
  }
  const changeRange = (next: RangeId) => {
    setRange(next)
    setFocus(null)
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
                {trailPoints
                  ? `${plural(trailPoints.length, 'point')}, newest first`
                  : 'Loading…'}
              </span>
            </div>
            <RangePicker value={range} onChange={changeRange} />
            {trailPoints ? (
              <Timeline stays={stays} focus={focus} now={now} onFocus={setFocus} />
            ) : null}
          </section>
        ) : null}
      </aside>

      <main className="map-area">
        <TrackerMap
          devices={devices ?? []}
          selectedId={selectedId}
          stays={stays}
          focus={focus}
          fitKey={selectedId === null || trail?.selectionKey === selectionKey ? selectionKey : null}
          onSelect={toggleSelection}
          onFocus={setFocus}
        />
      </main>
    </div>
  )
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
