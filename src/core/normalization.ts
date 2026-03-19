/**
 * Utilities for normalizing coordinates and strings to ensure stable cache keys.
 */

/**
 * Rounds a coordinate to a fixed number of decimal places for stable caching.
 * 5 decimal places = ~1.1 meters at the equator.
 */
export function normalizeCoord(coord: [number, number]): [number, number] {
  return [
    Math.round(coord[0] * 100000) / 100000,
    Math.round(coord[1] * 100000) / 100000
  ];
}

/**
 * Normalizes a string (address, query) for stable caching.
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return str.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(r\.|r)\b/g, 'rua')
    .replace(/\b(av\.|av)\b/g, 'avenida')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates a deterministic key for a set of waypoints.
 * Sorts them if order doesn't matter (e.g., Matrix API).
 */
export function getWaypointsKey(waypoints: [number, number][], sort: boolean = false): string {
  const normalized = waypoints.map(normalizeCoord);
  if (sort) {
    normalized.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  return normalized.map(c => c.join(',')).join(';');
}
/**
 * Generates a stable hash for trip parameters to prevent redundant calculations.
 */
export function hashTripParams(params: {
  origin: { id?: string; coordinates: [number, number] };
  destination: { id?: string; coordinates: [number, number] };
  passengers: { id: string; location: { coordinates: [number, number] } }[];
  kmPerLiter: number;
  fuelPrice: number;
  executionMode?: string;
}): string {
  const parts = [
    params.origin.id || params.origin.coordinates.join(','),
    params.destination.id || params.destination.coordinates.join(','),
    params.passengers.map(p => p.id).sort().join('|'),
    params.kmPerLiter.toString(),
    params.fuelPrice.toString(),
    params.executionMode || 'SHARED'
  ];
  return parts.join('::');
}
