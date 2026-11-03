import type { PositionedLocation } from './api'

const EARTH_RADIUS_METRES = 6_371_000

export interface Coordinates {
  latitude: number
  longitude: number
}

export interface Stay {
  points: PositionedLocation[]
  center: Coordinates
  accuracy: number | null
  startedAt: number
  endedAt: number
}

export function groupIntoStays(points: PositionedLocation[]): Stay[] {
  const oldestFirst = [...points].sort((a, b) => a.reported_at - b.reported_at)
  const stays: Stay[] = []
  for (const point of oldestFirst) {
    const current = stays.at(-1)
    if (current && belongsTo(current, point)) {
      stays[stays.length - 1] = toStay([point, ...current.points])
    } else {
      stays.push(toStay([point]))
    }
  }
  return stays.reverse()
}

export function distanceInMetres(a: Coordinates, b: Coordinates): number {
  const meanLatitude = toRadians((a.latitude + b.latitude) / 2)
  const x = toRadians(b.longitude - a.longitude) * Math.cos(meanLatitude)
  const y = toRadians(b.latitude - a.latitude)
  return Math.hypot(x, y) * EARTH_RADIUS_METRES
}

function belongsTo(stay: Stay, point: PositionedLocation): boolean {
  if (!stay.accuracy || !point.accuracy) return false
  return distanceInMetres(stay.center, point) <= Math.max(stay.accuracy, point.accuracy)
}

function toStay(newestFirst: PositionedLocation[]): Stay {
  const accuracies = newestFirst.map((point) => point.accuracy ?? 0)
  const allMeasured = accuracies.every((accuracy) => accuracy > 0)
  return {
    points: newestFirst,
    center: allMeasured ? weightedCenter(newestFirst) : newestFirst[0],
    accuracy: allMeasured ? Math.min(...accuracies) : null,
    startedAt: newestFirst.at(-1)!.reported_at,
    endedAt: newestFirst[0].reported_at,
  }
}

function weightedCenter(points: PositionedLocation[]): Coordinates {
  const weights = points.map((point) => 1 / point.accuracy! ** 2)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  const average = (value: (point: PositionedLocation) => number) =>
    points.reduce((sum, point, index) => sum + value(point) * weights[index], 0) / total
  return {
    latitude: average((point) => point.latitude),
    longitude: average((point) => point.longitude),
  }
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}
