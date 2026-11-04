import { describe, expect, it } from 'vitest'
import { clampToSpan, windowBetween, withinWindow } from './timeWindow'

const SPAN = { start: 1000, end: 2000 }

function readings(...times: number[]) {
  return times.map((reported_at) => ({ reported_at }))
}

function times(points: { reported_at: number }[]) {
  return points.map((point) => point.reported_at)
}

describe('withinWindow', () => {
  it('keeps every reading when there is no window', () => {
    expect(times(withinWindow(readings(1100, 1500, 1900), null))).toEqual([1100, 1500, 1900])
  })

  it('keeps only the readings inside the window, edges included', () => {
    const points = readings(1100, 1200, 1500, 1800, 1900)

    expect(times(withinWindow(points, { from: 1200, to: 1800 }))).toEqual([1200, 1500, 1800])
  })

  it('keeps readings past an open edge', () => {
    const points = readings(1100, 1500, 2100)

    expect(times(withinWindow(points, { from: 1400, to: Infinity }))).toEqual([1500, 2100])
  })
})

describe('windowBetween', () => {
  it('is no window at all when it covers the whole span', () => {
    expect(windowBetween(SPAN.start, SPAN.end, SPAN)).toBeNull()
  })

  it('leaves an edge at the end of the span open, so new readings still fall inside', () => {
    expect(windowBetween(1500, SPAN.end, SPAN)).toEqual({ from: 1500, to: Infinity })
  })

  it('leaves an edge at the start of the span open', () => {
    expect(windowBetween(SPAN.start - 10, 1500, SPAN)).toEqual({ from: -Infinity, to: 1500 })
  })

  it('keeps both edges inside the span', () => {
    expect(windowBetween(1200, 1800, SPAN)).toEqual({ from: 1200, to: 1800 })
  })
})

describe('clampToSpan', () => {
  it('shows open edges at the ends of the span', () => {
    expect(clampToSpan({ from: -Infinity, to: 1500 }, SPAN)).toEqual({ from: 1000, to: 1500 })
    expect(clampToSpan(null, SPAN)).toEqual({ from: 1000, to: 2000 })
  })
})
