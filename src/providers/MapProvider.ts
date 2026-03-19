import type { LocationResult, RouteOption, OptimalRouteResponse, DrivingRouteResponse, DistanceMatrixResponse, MapMatchedResponse } from '../types';

/**
 * Interface that abstraction all mapping, geocoding, and routing logic.
 * Any external service (Mapbox, Google, OSRM, Valhalla) must implement this.
 */
export interface MapProvider {
  /**
   * Search for a location using an autocomplete or geocoding engine.
   * Return ranked results.
   */
  searchLocation(query: string, sessionToken: string, proximity?: [number, number]): Promise<LocationResult[]>;

  /**
   * Get precise coordinates for a previously retrieved autocomplete candidate.
   * Useful when using modern Session-based Search API engines.
   */
  retrieveCoordinates(id: string, sessionToken: string): Promise<[number, number]>;

  /**
   * Gets a direct path bridging sequence of coordinates.
   */
  getDrivingRoute(
    waypoints: [number, number][],
    options?: { departAt?: string; useTraffic?: boolean }
  ): Promise<DrivingRouteResponse>;

  /**
   * Identifies the best permutation/order of `stops` to achieve the shortest route 
   * starting at `origin` and ending at `destination`.
   */
  getOptimalRoute(
    origin: [number, number],
    destination: [number, number],
    stops: { id: string; coordinates: [number, number] }[]
  ): Promise<OptimalRouteResponse>;

  /**
   * Fetches multiple route alternatives for comparison (e.g., fastest vs shortest).
   */
  getRouteAlternatives(
    waypoints: [number, number][],
    kmPerLiter: number,
    fuelPrice: number,
    options?: { departAt?: string }
  ): Promise<RouteOption[]>;
  /**
   * Translates coordinates [lng, lat] into a human-readable address.
   */
  reverseGeocode(coordinates: [number, number]): Promise<LocationResult | null>;

  /**
   * Fetches the distance and duration matrix between multiple points.
   * Crucial for eliminating N-calculations.
   */
  getDistanceMatrix(coordinates: [number, number][]): Promise<DistanceMatrixResponse>;

  /**
   * Snaps raw GPS coordinates to the nearest road network for precision.
   */
  matchMap(coordinates: [number, number][]): Promise<MapMatchedResponse>;

  /**
   * Returns a static map image URL for a given route and stops.
   * Useful for generating PDFs and sharing.
   */
  getStaticMapUrl(
    geometry: any,
    origin: [number, number],
    destination: [number, number],
    stops: [number, number][],
    width?: number,
    height?: number
  ): string;
}
