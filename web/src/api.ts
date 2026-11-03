export interface Location {
  reported_at: number
  latitude: number | null
  longitude: number | null
  altitude: number | null
  accuracy: number | null
  semantic_name: string | null
  is_own_report: boolean | null
}

export interface PositionedLocation extends Location {
  latitude: number
  longitude: number
}

export interface Device {
  id: string
  name: string
  last_seen: Location | null
  position: PositionedLocation | null
}

export interface PollSchedule {
  last: { ran_at: number; succeeded: boolean } | null
  interval: number | null
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`${path} failed with HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function fetchDevices(): Promise<Device[]> {
  return getJson('/api/devices')
}

export function fetchPollSchedule(): Promise<PollSchedule> {
  return getJson('/api/polls')
}

export async function fetchTrail(deviceId: string, since: number): Promise<PositionedLocation[]> {
  const locations = await getJson<Location[]>(
    `/api/devices/${encodeURIComponent(deviceId)}/locations?since=${since}`,
  )
  return locations.filter(isPositioned)
}

function isPositioned(location: Location): location is PositionedLocation {
  return location.latitude !== null && location.longitude !== null
}
