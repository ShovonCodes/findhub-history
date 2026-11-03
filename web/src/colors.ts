const TRACKER_COLORS = ['#22d3ee', '#f472b6', '#a3e635', '#fb923c', '#a78bfa', '#facc15']

export function trackerColor(index: number): string {
  return TRACKER_COLORS[index % TRACKER_COLORS.length]
}
