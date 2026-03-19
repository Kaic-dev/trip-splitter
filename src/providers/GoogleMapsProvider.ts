import axios from 'axios';
import type { LocationResult, RouteOption, OptimalRouteResponse, DrivingRouteResponse, DistanceMatrixResponse, MapMatchedResponse } from '../types';
import type { MapProvider } from './MapProvider';
import { routeCache, matrixCache, geocodingCache } from '../core/cache';
import { normalizeCoord, normalizeString, getWaypointsKey } from '../core/normalization';
import { globalRateLimiter, RequestPriority, type RequestPriorityType } from '../core/rateLimiter';

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;

// Resilience Helper: Execute with rate limiting and retry
async function executeWithResilience<T>(priority: RequestPriorityType, fn: () => Promise<T>): Promise<T> {
  return globalRateLimiter.enqueue(fn, priority);
}

export class GoogleMapsProvider implements MapProvider {
  async searchLocation(query: string, sessionToken: string, proximity?: [number, number]): Promise<LocationResult[]> {
    const norm = normalizeString(query);
    const prox = proximity ? `${proximity[1]},${proximity[0]}` : '-22.7562,-47.4145'; // Google uses lat,lng
    const cacheKey = `google-search|${norm}|${sessionToken}|${prox}`;

    return geocodingCache.getOrFetch(cacheKey, async () => {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json`;
      const res = await executeWithResilience(RequestPriority.HIGH, () => axios.get(url, {
        params: { 
          input: query, 
          key: GOOGLE_API_KEY, 
          sessiontoken: sessionToken, 
          language: 'pt-BR', 
          components: 'country:br',
          location: prox,
          radius: 50000 // 50km bias
        }
      }));

      return res.data.predictions.map((p: any): LocationResult => ({
        id: p.place_id,
        name: p.structured_formatting.main_text,
        fullAddress: p.description,
        coordinates: [0, 0], // Needs retrieveCoordinates
        type: 'address',
        source: 'searchbox'
      }));
    });
  }

  async retrieveCoordinates(placeId: string, sessionToken: string): Promise<[number, number]> {
    const cacheKey = `google-retrieve|${placeId}|${sessionToken}`;
    return geocodingCache.getOrFetch(cacheKey, async () => {
      const url = `https://maps.googleapis.com/maps/api/place/details/json`;
      const res = await executeWithResilience(RequestPriority.HIGH, () => axios.get(url, {
        params: { place_id: placeId, key: GOOGLE_API_KEY, sessiontoken: sessionToken, fields: 'geometry' }
      }));
      const loc = res.data.result.geometry.location;
      return [loc.lng, loc.lat];
    });
  }

  async getDrivingRoute(waypoints: [number, number][], options?: { departAt?: string; useTraffic?: boolean }): Promise<DrivingRouteResponse> {
    const wpKey = getWaypointsKey(waypoints);
    const cacheKey = `google-route|${wpKey}|${options?.departAt || 'now'}`;

    return routeCache.getOrFetch(cacheKey, async () => {
      const origin = waypoints[0].join(',');
      const destination = waypoints[waypoints.length - 1].join(',');
      const middle = waypoints.slice(1, -1).map(w => w.join(',')).join('|');

      const url = `https://maps.googleapis.com/maps/api/directions/json`;
      const params: any = {
        origin, destination, waypoints: middle, key: GOOGLE_API_KEY,
        departure_time: options?.departAt ? Math.floor(new Date(options.departAt).getTime() / 1000) : 'now',
        traffic_model: 'best_guess'
      };

      const res = await executeWithResilience(RequestPriority.LOW, () => axios.get(url, { params }));
      const route = res.data.routes[0];

      return {
        distanceKm: route.legs.reduce((s: number, l: any) => s + l.distance.value, 0) / 1000,
        durationMinutes: route.legs.reduce((s: number, l: any) => s + (l.duration_in_traffic?.value || l.duration.value), 0) / 60,
        legDurations: route.legs.map((l: any) => (l.duration_in_traffic?.value || l.duration.value) / 60),
        geometry: route.overview_polyline.points,
      };
    });
  }

  async getOptimalRoute(origin: [number, number], destination: [number, number], stops: { id: string; coordinates: [number, number] }[]): Promise<OptimalRouteResponse> {
    const wpKey = getWaypointsKey([origin, ...stops.map(s => s.coordinates), destination]);
    const cacheKey = `google-opt|${wpKey}`;

    return routeCache.getOrFetch(cacheKey, async () => {
      const url = `https://maps.googleapis.com/maps/api/directions/json`;
      const stopCoords = stops.map(s => s.coordinates.join(',')).join('|');
      
      const res = await executeWithResilience(RequestPriority.LOW, () => axios.get(url, {
        params: {
          origin: origin.join(','),
          destination: destination.join(','),
          waypoints: `optimize:true|${stopCoords}`,
          key: GOOGLE_API_KEY
        }
      }));

      const route = res.data.routes[0];
      const order = route.waypoint_order; 
      const orderedStopIds = order.map((idx: number) => stops[idx].id);
      const orderedWaypoints = [origin, ...order.map((idx: number) => stops[idx].coordinates), destination];

      return {
        orderedStopIds,
        totalDistanceKm: route.legs.reduce((s: number, l: any) => s + l.distance.value, 0) / 1000,
        orderedWaypoints,
        geometry: route.overview_polyline.points
      };
    });
  }

  async getDistanceMatrix(coordinates: [number, number][]): Promise<DistanceMatrixResponse> {
    const matrixKey = getWaypointsKey(coordinates, true);
    const cacheKey = `google-matrix|${matrixKey}`;

    return matrixCache.getOrFetch(cacheKey, async () => {
      const points = coordinates.map(c => c.join(',')).join('|');
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json`;
      const res = await executeWithResilience(RequestPriority.LOW, () => axios.get(url, {
        params: { origins: points, destinations: points, key: GOOGLE_API_KEY, departure_time: 'now' }
      }));

      const distances = res.data.rows.map((row: any) => row.elements.map((el: any) => el.distance.value));
      const durations = res.data.rows.map((row: any) => row.elements.map((el: any) => el.duration.value));

      return { distances, durations, waypoints: coordinates.map(c => ({ lat: c[1], lng: c[0] })) };
    });
  }

  async reverseGeocode(coordinates: [number, number]): Promise<LocationResult | null> {
    const [ln, lt] = normalizeCoord(coordinates);
    const cacheKey = `google-revgeo|${ln},${lt}`;

    return geocodingCache.getOrFetch(cacheKey, async () => {
      const url = `https://maps.googleapis.com/maps/api/geocode/json`;
      const res = await executeWithResilience(RequestPriority.HIGH, () => axios.get(url, { params: { latlng: `${lt},${ln}`, key: GOOGLE_API_KEY } }));
      const r = res.data.results[0];
      if (!r) return null;
      return { id: r.place_id, name: r.formatted_address.split(',')[0], fullAddress: r.formatted_address, coordinates: [ln, lt], type: 'address', source: 'geocoding' };
    });
  }

  async matchMap(coordinates: [number, number][]): Promise<MapMatchedResponse> {
    return { coordinates, confidence: 1 };
  }

  getStaticMapUrl(_geometry: any, origin: [number, number], destination: [number, number], stops: [number, number][], width: number = 600, height: number = 400): string {
    const markers = [`color:green|label:A|${origin[1]},${origin[0]}`, `color:red|label:B|${destination[1]},${destination[0]}`, ...stops.map((s, i) => `color:blue|label:${i+1}|${s[1]},${s[0]}`)];
    const markerStr = markers.map(m => `markers=${m}`).join('&');
    return `https://maps.googleapis.com/maps/api/staticmap?size=${width}x${height}&${markerStr}&key=${GOOGLE_API_KEY}`;
  }

  async getRouteAlternatives(waypoints: [number, number][], kmPerLiter: number, fuelPrice: number): Promise<RouteOption[]> {
    const origin = waypoints[0].join(',');
    const destination = waypoints[waypoints.length - 1].join(',');
    const url = `https://maps.googleapis.com/maps/api/directions/json`;
    const res = await executeWithResilience(RequestPriority.LOW, () => axios.get(url, { params: { origin, destination, alternatives: true, key: GOOGLE_API_KEY } }));

    return res.data.routes.map((r: any, i: number) => {
      const dist = r.legs[0].distance.value / 1000;
      return { id: `google-alt-${i}`, distanceKm: dist, durationMinutes: r.legs[0].duration.value / 60, fuelCost: (dist / kmPerLiter) * fuelPrice, geometry: r.overview_polyline.points };
    });
  }
}
