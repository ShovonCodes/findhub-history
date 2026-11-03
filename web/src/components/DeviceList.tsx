import type { Device } from '../api'
import { trackerColor } from '../colors'
import { formatDateTime, timeAgo } from '../time'

interface DeviceListProps {
  devices: Device[]
  selectedId: string | null
  now: number
  onSelect: (deviceId: string) => void
}

export function DeviceList({ devices, selectedId, now, onSelect }: DeviceListProps) {
  if (devices.length === 0) {
    return <p className="empty">No trackers yet. They appear after the first check.</p>
  }

  return (
    <ul className="device-list">
      {devices.map((device, index) => (
        <li key={device.id}>
          <button
            className="device-card"
            aria-pressed={device.id === selectedId}
            onClick={() => onSelect(device.id)}
          >
            <span
              className="device-dot"
              style={{ background: trackerColor(index), color: trackerColor(index) }}
            />
            <span className="device-text">
              <span className="device-name">{device.name || 'Unnamed device'}</span>
              <span className="device-detail">{describe(device, now)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function describe(device: Device, now: number) {
  const seen = device.last_seen
  if (!seen) return 'No location yet'

  const where = seen.semantic_name
    ? `at ${seen.semantic_name}`
    : seen.accuracy
      ? `within ${Math.round(seen.accuracy)} m`
      : null
  return (
    <time dateTime={new Date(seen.reported_at * 1000).toISOString()} title={formatDateTime(seen.reported_at)}>
      Seen {timeAgo(seen.reported_at, now)}
      {where ? ` · ${where}` : ''}
    </time>
  )
}
