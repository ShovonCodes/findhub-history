import { describe, expect, it } from 'vitest'
import type { PositionedLocation } from './api'
import { distanceInMetres, groupIntoStays } from './stays'

const ORIGIN = { latitude: 48.0, longitude: 11.0 }
const METRES_PER_DEGREE = 111_195

function sighting(reportedAt: number, northMetres: number, accuracy: number | null = 100) {
  return {
    reported_at: reportedAt,
    latitude: ORIGIN.latitude + northMetres / METRES_PER_DEGREE,
    longitude: ORIGIN.longitude,
    altitude: null,
    accuracy,
    semantic_name: null,
    is_own_report: false,
  } satisfies PositionedLocation
}

function times(stays: ReturnType<typeof groupIntoStays>) {
  return stays.map((stay) => stay.points.map((point) => point.reported_at))
}

describe('distanceInMetres', () => {
  it('measures short distances', () => {
    expect(distanceInMetres(ORIGIN, sighting(0, 250))).toBeCloseTo(250, 0)
  })
})

describe('groupIntoStays', () => {
  it("merges sightings that lie within one another's accuracy into one stay", () => {
    const stays = groupIntoStays([
      sighting(100, 8),
      sighting(200, -8),
      sighting(201, 24),
      sighting(300, -29, 110),
      sighting(400, 7, 105),
    ])

    expect(times(stays)).toEqual([[400, 300, 201, 200, 100]])
    expect(stays[0].startedAt).toBe(100)
    expect(stays[0].endedAt).toBe(400)
  })

  it('starts a new stay when the device moves beyond the accuracy', () => {
    const stays = groupIntoStays([sighting(100, 0), sighting(200, 20), sighting(300, 600)])

    expect(times(stays)).toEqual([[300], [200, 100]])
  })

  it('keeps a return to an earlier place as a separate stay', () => {
    const stays = groupIntoStays([sighting(100, 0), sighting(200, 600), sighting(300, 10)])

    expect(times(stays)).toEqual([[300], [200], [100]])
  })

  it('sorts unordered points newest first', () => {
    const stays = groupIntoStays([sighting(300, 600), sighting(100, 0), sighting(200, 5)])

    expect(times(stays)).toEqual([[300], [200, 100]])
  })

  it('claims no more precision than the best sighting', () => {
    const [stay] = groupIntoStays([sighting(100, 0, 100), sighting(200, 30, 20)])

    expect(stay.accuracy).toBe(20)
  })

  it('pulls the centre towards the more precise sighting', () => {
    const [stay] = groupIntoStays([sighting(100, 0, 100), sighting(200, 30, 20)])

    expect(distanceInMetres(stay.center, sighting(0, 30))).toBeLessThan(2)
  })

  it('never merges points without an accuracy', () => {
    const stays = groupIntoStays([sighting(100, 0, null), sighting(200, 0)])

    expect(times(stays)).toEqual([[200], [100]])
    expect(stays[1].accuracy).toBeNull()
  })
})
