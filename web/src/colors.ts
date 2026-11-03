const TRACKER_COLORS = ['#2563eb', '#db2777', '#16a34a', '#ea580c', '#7c3aed', '#0891b2']

export function trackerColor(index: number): string {
  return TRACKER_COLORS[index % TRACKER_COLORS.length]
}
