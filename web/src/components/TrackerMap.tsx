import { latLngBounds, type LatLngTuple } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useEffectEvent } from 'react'
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { Device, PositionedLocation } from '../api'
import { trackerColor } from '../colors'
import { formatDateTime } from '../time'

const WORLD_CENTER: LatLngTuple = [20, 0]
const WORLD_ZOOM = 2
const MAX_FIT_ZOOM = 16
const FIT_PADDING: [number, number] = [48, 48]

interface TrackerMapProps {
  devices: Device[]
  selectedId: string | null
  trail: PositionedLocation[]
  fitKey: string | null
  onSelect: (deviceId: string) => void
}

export function TrackerMap({ devices, selectedId, trail, fitKey, onSelect }: TrackerMapProps) {
  const selectedIndex = devices.findIndex((device) => device.id === selectedId)
  const selected = selectedIndex >= 0 ? devices[selectedIndex] : null
  const trailPoints = trail.map(toLatLng)
  const fitPoints = selected?.position
    ? [...trailPoints, toLatLng(selected.position)]
    : devices.flatMap((device) => (device.position ? [toLatLng(device.position)] : []))

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

      {selected?.position?.accuracy ? (
        <Circle
          center={toLatLng(selected.position)}
          radius={selected.position.accuracy}
          pathOptions={{ color: trackerColor(selectedIndex), weight: 1, fillOpacity: 0.12 }}
        />
      ) : null}

      {selected && trailPoints.length > 1 ? (
        <Polyline
          positions={trailPoints}
          pathOptions={{ color: trackerColor(selectedIndex), weight: 3, opacity: 0.6 }}
        />
      ) : null}
      {selected
        ? trail.map((point) => (
            <CircleMarker
              key={point.reported_at}
              center={toLatLng(point)}
              radius={4}
              pathOptions={{
                color: '#ffffff',
                weight: 1.5,
                fillColor: trackerColor(selectedIndex),
                fillOpacity: 1,
              }}
            >
              <Tooltip direction="top" offset={[0, -4]}>
                {formatDateTime(point.reported_at)}
              </Tooltip>
            </CircleMarker>
          ))
        : null}

      {markerOrder(devices, selectedId).map(({ device, index }) => {
        const isSelected = device.id === selectedId
        return device.position ? (
          // Keyed on selection so Leaflet recreates the marker on top with a fixed label.
          <CircleMarker
            key={`${device.id}|${isSelected}`}
            center={toLatLng(device.position)}
            radius={isSelected ? 10 : 8}
            pathOptions={{
              color: '#ffffff',
              weight: 3,
              fillColor: trackerColor(index),
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => onSelect(device.id) }}
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

function markerOrder(devices: Device[], selectedId: string | null) {
  const indexed = devices.map((device, index) => ({ device, index }))
  return [
    ...indexed.filter(({ device }) => device.id !== selectedId),
    ...indexed.filter(({ device }) => device.id === selectedId),
  ]
}

function toLatLng(location: PositionedLocation): LatLngTuple {
  return [location.latitude, location.longitude]
}
