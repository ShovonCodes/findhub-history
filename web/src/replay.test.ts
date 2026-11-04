import { describe, expect, it } from 'vitest'
import { startReplay, stepReplay } from './replay'

const TIMES = [100, 200, 300]

describe('startReplay', () => {
  it('starts at the oldest reading', () => {
    expect(startReplay(TIMES, null)).toEqual({ at: 100, playing: true })
  })

  it('resumes where it was paused', () => {
    expect(startReplay(TIMES, { at: 200, playing: false })).toEqual({ at: 200, playing: true })
  })

  it('starts over once it has reached the newest reading', () => {
    expect(startReplay(TIMES, { at: 300, playing: false })).toEqual({ at: 100, playing: true })
  })

  it('has nothing to play without readings', () => {
    expect(startReplay([], null)).toBeNull()
  })
})

describe('stepReplay', () => {
  it('moves to the next newer reading', () => {
    expect(stepReplay(TIMES, { at: 100, playing: true })).toEqual({ at: 200, playing: true })
  })

  it('stops on the newest reading', () => {
    expect(stepReplay(TIMES, { at: 300, playing: true })).toEqual({ at: 300, playing: false })
  })

  it('carries on from the next reading when the one it was on has gone', () => {
    expect(stepReplay(TIMES, { at: 150, playing: true })).toEqual({ at: 200, playing: true })
  })
})
