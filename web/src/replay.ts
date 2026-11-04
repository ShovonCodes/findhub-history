export const REPLAY_SPEEDS = [0.5, 1, 2, 3, 5] as const
export const REPLAY_STEP_MS = 1000

export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number]

export interface Replay {
  at: number
  playing: boolean
}

export function startReplay(times: number[], replay: Replay | null): Replay | null {
  if (times.length === 0) return null
  if (replay && times.some((time) => time > replay.at)) return { at: replay.at, playing: true }
  return { at: times[0], playing: true }
}

export function stepReplay(times: number[], replay: Replay): Replay {
  const next = times.find((time) => time > replay.at)
  return next === undefined ? { ...replay, playing: false } : { at: next, playing: true }
}
