import { latLng, latLngBounds, type LatLngTuple } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useEffectEvent } from 'react'
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { Device } from '../api'
import { trackerColor } from '../colors'
import type { Coordinates, Stay } from '../stays'
import { formatDateTime } from '../time'
import type { Focus } from './Timeline'

const WORLD_CENTER: LatLngTuple = [20, 0]
const WORLD_ZOOM = 2
const MAX_FIT_ZOOM = 16
const MAX_FOCUS_ZOOM = 18
const FIT_PADDING: [number, number] = [48, 48]
const FOCUSED_COLOR = '#ffffff'
const FOCUSED_FILL = '#67e8f9'

interface TrackerMapProps {
  devices: Device[]
  selectedId: string | null
  stays: Stay[]
  focus: Focus | null
  fitKey: string | null
  onSelect: (deviceId: string) => void
  onFocus: (focus: Focus) => void
}

interface Spot {
  center: Coordinates
  accuracy: number | null
}

export function TrackerMap({
  devices,
  selectedId,
  stays,
  focus,
  fitKey,
  onSelect,
  onFocus,
}: TrackerMapProps) {
  const selectedIndex = devices.findIndex((device) => device.id === selectedId)
  const selected = selectedIndex >= 0 ? devices[selectedIndex] : null
  const color = trackerColor(selectedIndex)
  const fitPoints = selected?.position
    ? stays.length > 0
      ? stays.map((stay) => toLatLng(stay.center))
      : [toLatLng(selected.position)]
    : devices.flatMap((device) => (device.position ? [toLatLng(device.position)] : []))
  const focusedStay =
    focus?.kind === 'stay' ? stays.find((stay) => stay.startedAt === focus.at) : undefined
  const focusedPoint =
    focus?.kind === 'point'
      ? stays.flatMap((stay) => stay.points).find((point) => point.reported_at === focus.at)
      : undefined
  const focusedSpot: Spot | null = focusedStay ?? (focusedPoint ? toSpot(focusedPoint) : null)
  const currentStay =
    selected?.position && stays[0]?.endedAt === selected.position.reported_at ? stays[0] : null

  return (
    <MapContainer className="map" center={WORLD_CENTER} zoom={WORLD_ZOOM} zoomControl={false}>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      <FitToPoints
        points={fitPoints}
        fitKey={fitKey === null ? null : `${fitKey}|${fitPoints.length > 0}`}
      />
      <FlyToSpot spot={focusedSpot} focusKey={focus ? `${focus.kind}|${focus.at}` : null} />

      {selected && stays.length > 1 ? (
        <Polyline
          positions={stays.map((stay) => toLatLng(stay.center)).reverse()}
          pathOptions={{ color, weight: 2, opacity: 0.55, dashArray: '2 7', lineCap: 'round' }}
        />
      ) : null}

      {selected
        ? stays.map((stay) => (
            <StayMarker
              key={stay.startedAt}
              stay={stay}
              color={color}
              showCenter={stay !== currentStay}
              onFocus={() => onFocus(focusOn(stay))}
            />
          ))
        : null}

      {focusedStay
        ? focusedStay.points.map((point) => (
            <CircleMarker
              key={point.reported_at}
              center={toLatLng(point)}
              radius={3}
              interactive={false}
              pathOptions={{ stroke: false, fillColor: FOCUSED_COLOR, fillOpacity: 0.85 }}
            />
          ))
        : null}

      {focusedSpot ? <FocusedSpot key={focus?.at} spot={focusedSpot} /> : null}

      {markerOrder(devices, selectedId).map(({ device, index }) => {
        const isSelected = device.id === selectedId
        const onClick = () =>
          isSelected ? currentStay && onFocus(focusOn(currentStay)) : onSelect(device.id)
        return device.position ? (
          // Keyed on selection so Leaflet recreates the marker on top with a fixed label.
          <CircleMarker
            key={`${device.id}|${isSelected}`}
            center={toLatLng(device.position)}
            radius={isSelected ? 9 : 8}
            interactive={!isSelected || currentStay !== null}
            pathOptions={{
              color: '#050a18',
              weight: 3,
              fillColor: trackerColor(index),
              fillOpacity: 1,
            }}
            eventHandlers={{ click: onClick }}
          >
            <Tooltip
              direction="top"
              offset={[0, -10]}
              permanent={isSelected}
              className="device-label"
            >
              {device.name}
            </Tooltip>
          </CircleMarker>
        ) : null
      })}
    </MapContainer>
  )
}

interface StayMarkerProps {
  stay: Stay
  color: string
  showCenter: boolean
  onFocus: () => void
}

function StayMarker({ stay, color, showCenter, onFocus }: StayMarkerProps) {
  return (
    <>
      {stay.accuracy ? (
        <Circle
          center={toLatLng(stay.center)}
          radius={stay.accuracy}
          interactive={false}
          pathOptions={{ color, weight: 1, opacity: 0.35, fillOpacity: 0.06 }}
        />
      ) : null}
      {showCenter ? (
        <CircleMarker
          center={toLatLng(stay.center)}
          radius={stay.points.length === 1 ? 5 : 7}
          pathOptions={{ color: '#050a18', weight: 2, fillColor: color, fillOpacity: 0.95 }}
          eventHandlers={{ click: onFocus }}
        >
          <Tooltip direction="top" offset={[0, -6]} className="device-label">
            {describeStay(stay)}
          </Tooltip>
        </CircleMarker>
      ) : null}
    </>
  )
}

function FocusedSpot({ spot }: { spot: Spot }) {
  return (
    <>
      {spot.accuracy ? (
        <Circle
          center={toLatLng(spot.center)}
          radius={spot.accuracy}
          interactive={false}
          pathOptions={{
            color: FOCUSED_COLOR,
            weight: 2,
            opacity: 0.9,
            fillColor: FOCUSED_FILL,
            fillOpacity: 0.16,
          }}
        />
      ) : null}
      <CircleMarker
        center={toLatLng(spot.center)}
        radius={7}
        interactive={false}
        pathOptions={{ color: '#050a18', weight: 3, fillColor: FOCUSED_COLOR, fillOpacity: 1 }}
      />
    </>
  )
}

function FitToPoints({ points, fitKey }: { points: LatLngTuple[]; fitKey: string | null }) {
  const map = useMap()

  const fit = useEffectEvent(() => {
    if (points.length === 0) return
    map.fitBounds(latLngBounds(points), { padding: FIT_PADDING, maxZoom: MAX_FIT_ZOOM })
  })

  // Refit once per selection or range, after its trail loads, not on every data refresh.
  useEffect(() => {
    if (fitKey !== null) fit()
  }, [fitKey])

  return null
}

function FlyToSpot({ spot, focusKey }: { spot: Spot | null; focusKey: string | null }) {
  const map = useMap()

  const fly = useEffectEvent(() => {
    if (!spot) return
    const bounds = latLng(toLatLng(spot.center)).toBounds(2 * (spot.accuracy ?? 50))
    map.flyToBounds(bounds, { padding: FIT_PADDING, maxZoom: MAX_FOCUS_ZOOM, duration: 0.6 })
  })

  useEffect(() => {
    if (focusKey !== null) fly()
  }, [focusKey])

  return null
}

function describeStay(stay: Stay): string {
  if (stay.points.length === 1) return formatDateTime(stay.startedAt)
  const period = `${formatDateTime(stay.startedAt)} – ${formatDateTime(stay.endedAt)}`
  return `${period} · ${stay.points.length} sightings`
}

function focusOn(stay: Stay): Focus {
  return { kind: stay.points.length === 1 ? 'point' : 'stay', at: stay.startedAt }
}

function markerOrder(devices: Device[], selectedId: string | null) {
  const indexed = devices.map((device, index) => ({ device, index }))
  return [
    ...indexed.filter(({ device }) => device.id !== selectedId),
    ...indexed.filter(({ device }) => device.id === selectedId),
  ]
}

function toSpot(point: Coordinates & { accuracy: number | null }): Spot {
  return { center: point, accuracy: point.accuracy }
}

function toLatLng(location: Coordinates): LatLngTuple {
  return [location.latitude, location.longitude]
}
