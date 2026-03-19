import type { Address, Passenger } from './index';

/**
 * Generates a determinist signature for a trip's routing sequence.
 * This is useful to group the exact same commute over multiple days.
 */
export function generateTripSignature(origin: Address, destination: Address, stops: Passenger[]): string {
  // We use the basic coordinates and order. 
  const points = [
    `${origin.coordinates[0].toFixed(4)},${origin.coordinates[1].toFixed(4)}`, // Orig
    ...stops.map(s => `${s.location.coordinates[0].toFixed(4)},${s.location.coordinates[1].toFixed(4)}`), // Stops
    `${destination.coordinates[0].toFixed(4)},${destination.coordinates[1].toFixed(4)}` // Dest
  ];
  
  // A simple string concatenation hashing since Node crypto isn't available natively on browsers synchronously simply
  // and we just need an exact equality check
  return points.join('|');
}
