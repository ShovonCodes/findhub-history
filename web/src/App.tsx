import { useEffect, useState } from 'react'
import { type Device, type PositionedLocation, fetchDevices, fetchTrail } from './api'
import { DeviceList } from './components/DeviceList'
import { RangePicker } from './components/RangePicker'
import { TrackerMap } from './components/TrackerMap'
import { RANGES, type RangeId } from './ranges'
import { nowInSeconds } from './time'

const REFRESH_MS = 60_000

interface Trail {
  key: string
  points: PositionedLocation[]
}

export default function App() {
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(nowInSeconds)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [range, setRange] = useState<RangeId>('day')
  const [trail, setTrail] = useState<Trail | null>(null)

  useEffect(() => {
    const load = () =>
      fetchDevices().then(
        (loaded) => {
          setDevices(loaded)
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
  const trailKey = `${selectedId}|${range}|${selected?.position?.reported_at}`

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    const since = nowInSeconds() - RANGES.find((option) => option.id === range)!.seconds
    fetchTrail(selectedId, since).then(
      (points) => !cancelled && setTrail({ key: trailKey, points }),
      (caught: Error) => !cancelled && setError(caught.message),
    )
    return () => {
      cancelled = true
    }
  }, [selectedId, range, trailKey])

  const trailPoints = selected && trail?.key === trailKey ? trail.points : []
  const toggleSelection = (deviceId: string) =>
    setSelectedId((current) => (current === deviceId ? null : deviceId))

  return (
    <div className="app">
      <aside className="panel">
        <header className="panel-header">
          <h1>Find Hub</h1>
          {devices ? <p className="subtitle">{plural(devices.length, 'device')}</p> : null}
        </header>

        {error ? <p className="notice">Can't reach the server: {error}</p> : null}

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

        {selected ? (
          <section className="history" aria-label={`${selected.name} history`}>
            <div className="history-header">
              <h2>History</h2>
              <span className="history-count">{plural(trailPoints.length, 'point')}</span>
            </div>
            <RangePicker value={range} onChange={setRange} />
          </section>
        ) : null}
      </aside>

      <main className="map-area">
        <TrackerMap
          devices={devices ?? []}
          selectedId={selectedId}
          trail={trailPoints}
          fitKey={`${selectedId}|${range}`}
          onSelect={toggleSelection}
        />
      </main>
    </div>
  )
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
