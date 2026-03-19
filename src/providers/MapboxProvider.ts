import axios from 'axios';
import type { LocationResult, LocationType, RouteOption, OptimalRouteResponse, DrivingRouteResponse, DistanceMatrixResponse, MapMatchedResponse } from '../types';
import type { MapProvider } from './MapProvider';
import { routeCache, matrixCache, geocodingCache } from '../core/cache';
import { normalizeCoord, normalizeString, getWaypointsKey } from '../core/normalization';
import { globalRateLimiter, RequestPriority, type RequestPriorityType } from '../core/rateLimiter';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

// Resilience Helper: Execute with rate limiting and retry
async function executeWithResilience<T>(priority: RequestPriorityType, fn: () => Promise<T>): Promise<T> {
  return globalRateLimiter.enqueue(fn, priority);
}

export class MapboxProvider implements MapProvider {
  async searchLocation(query: string, sessionToken: string, proximity?: [number, number]): Promise<LocationResult[]> {
    if (!query || query.trim().length < 2) return [];
    
    const normalizedQuery = normalizeString(query);
    const proximityStr = proximity ? `${proximity[0]},${proximity[1]}` : '-47.4145,-22.7562';
    const cacheKey = `search|${normalizedQuery}|${sessionToken}|${proximityStr}`;

    return geocodingCache.getOrFetch(cacheKey, async () => {
      const [geoRes, searchRes] = await Promise.allSettled([
        executeWithResilience(RequestPriority.HIGH, () => axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalizedQuery)}.json`, {
          params: { access_token: MAPBOX_TOKEN, autocomplete: true, limit: 10, language: 'pt', country: 'br', proximity: proximityStr, types: 'country,region,place,district,locality,address,poi,neighborhood' },
        })),
        executeWithResilience(RequestPriority.HIGH, () => axios.get(`https://api.mapbox.com/search/searchbox/v1/suggest`, {
          params: { q: normalizedQuery, access_token: MAPBOX_TOKEN, session_token: sessionToken, language: 'pt', limit: 10, country: 'br', proximity: proximityStr, types: 'country,region,place,district,locality,address,poi,neighborhood' },
        }))
      ]);

      const candidates: LocationResult[] = [];
      if (geoRes.status === 'fulfilled') {
        candidates.push(...geoRes.value.data.features.map((f: any): LocationResult => ({
          id: f.id, name: f.text, fullAddress: f.place_name, coordinates: f.center as [number, number],
          type: f.place_type[0] as LocationType, source: 'geocoding', relevance: f.relevance || 0,
        })));
      }
      if (searchRes.status === 'fulfilled') {
        candidates.push(...searchRes.value.data.suggestions.map((s: any): LocationResult => ({
          id: s.mapbox_id, name: s.name, fullAddress: s.full_address || s.place_name || s.name,
          coordinates: s.coordinates ? [s.coordinates.longitude, s.coordinates.latitude] : [0, 0],
          type: s.feature_type as LocationType, source: 'searchbox', relevance: 0.8,
        })));
      }
      return candidates;
    });
  }

  async retrieveCoordinates(mapboxId: string, sessionToken: string): Promise<[number, number]> {
    const cacheKey = `retrieve|${mapboxId}|${sessionToken}`;
    return geocodingCache.getOrFetch(cacheKey, async () => {
      const url = `https://api.mapbox.com/search/searchbox/v1/retrieve/${mapboxId}`;
      const res = await executeWithResilience(RequestPriority.HIGH, () => axios.get(url, { params: { access_token: MAPBOX_TOKEN, session_token: sessionToken } }));
      return res.data.features[0].geometry.coordinates as [number, number];
    });
  }

  async getDrivingRoute(waypoints: [number, number][], options?: { departAt?: string; useTraffic?: boolean }): Promise<DrivingRouteResponse> {
    const wpKey = getWaypointsKey(waypoints);
    const profile = (options?.useTraffic && options?.departAt) ? 'driving-traffic' : 'driving';
    const cacheKey = `route|${profile}|${wpKey}|${options?.departAt || 'now'}`;

    return routeCache.getOrFetch(cacheKey, async () => {
      const coords = waypoints.map(c => c.join(',')).join(';');
      const params: any = { access_token: MAPBOX_TOKEN, overview: 'full', geometries: 'geojson' };
      if (profile === 'driving-traffic' && options?.departAt) {
        params.depart_at = options.departAt;
        params.annotations = 'duration,distance,speed';
      }

      const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}`;
      const res = await executeWithResilience(RequestPriority.LOW, () => axios.get(url, { params }));
      const route = res.data.routes[0];
      
      return {
        distanceKm: route.distance / 1000,
        durationMinutes: route.duration / 60,
        legDurations: (route.legs as any[] || []).map((l: any) => l.duration / 60),
        geometry: route.geometry,
      };
    });
  }

  async getOptimalRoute(origin: [number, number], destination: [number, number], stops: { id: string; coordinates: [number, number] }[]): Promise<OptimalRouteResponse> {
    const wpKey = getWaypointsKey([origin, ...stops.map(s => s.coordinates), destination]);
    const cacheKey = `opt|${wpKey}`;

    return routeCache.getOrFetch(cacheKey, async () => {
      if (stops.length === 0) {
        const { distanceKm, geometry } = await this.getDrivingRoute([origin, destination]);
        return { orderedStopIds: [], totalDistanceKm: distanceKm, orderedWaypoints: [origin, destination], geometry };
      }

      const coordStr = [origin, ...stops.map(s => s.coordinates), destination].map(c => c.join(',')).join(';');
      const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordStr}`;
      const res = await executeWithResilience(RequestPriority.LOW, () => axios.get(url, { params: { access_token: MAPBOX_TOKEN, source: 'first', destination: 'last', roundtrip: false, overview: 'full', geometries: 'geojson' } }));

      const waypointsData: any[] = res.data.waypoints;
      const stopWaypoints = waypointsData
        .map((w, i) => ({ ...w, original_index: w.original_index !== undefined ? w.original_index : i }))
        .filter(w => w.original_index > 0 && w.original_index <= stops.length);
      stopWaypoints.sort((a, b) => a.waypoint_index - b.waypoint_index);

      const orderedStopIds = stopWaypoints.map(w => stops[w.original_index - 1].id);
      const orderedCoords = stopWaypoints.map(w => stops[w.original_index - 1].coordinates);
      const { geometry, distanceKm } = await this.getDrivingRoute([origin, ...orderedCoords, destination]);

      return { orderedStopIds, totalDistanceKm: distanceKm, orderedWaypoints: [origin, ...orderedCoords, destination], geometry };
    });
  }

  async getDistanceMatrix(coordinates: [number, number][]): Promise<DistanceMatrixResponse> {
    const matrixKey = getWaypointsKey(coordinates, true);
    const cacheKey = `matrix|${matrixKey}`;

    return matrixCache.getOrFetch(cacheKey, async () => {
      const coordStr = coordinates.map(c => c.join(',')).join(';');
      const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coordStr}`;
      const res = await axios.get(url, { params: { access_token: MAPBOX_TOKEN, annotations: 'distance,duration' } });

      return {
        distances: res.data.distances,
        durations: res.data.durations,
        waypoints: res.data.destinations.map((d: any) => ({ lat: d.location[1], lng: d.location[0] }))
      };
    });
  }

  async reverseGeocode(coordinates: [number, number]): Promise<LocationResult | null> {
    const [ln, lt] = normalizeCoord(coordinates);
    const cacheKey = `revgeo|${ln},${lt}`;

    return geocodingCache.getOrFetch(cacheKey, async () => {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${ln},${lt}.json`;
      const res = await axios.get(url, { params: { access_token: MAPBOX_TOKEN, limit: 1, language: 'pt-BR', types: 'address,poi,neighborhood' } });
      const f = res.data.features?.[0];
      if (!f) return null;
      return { id: f.id, name: f.text, fullAddress: f.place_name, coordinates: f.center as [number, number], type: f.place_type[0] as LocationType, source: 'geocoding', relevance: 1 };
    });
  }

  async matchMap(coordinates: [number, number][]): Promise<MapMatchedResponse> {
    const wpKey = getWaypointsKey(coordinates);
    const cacheKey = `match|${wpKey}`;
    return routeCache.getOrFetch(cacheKey, async () => {
      const coordsStr = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
      const res = await axios.get(`https://api.mapbox.com/matching/v5/mapbox/driving/${coordsStr}`, { params: { access_token: MAPBOX_TOKEN, geometries: 'geojson', overview: 'full' } });
      if (!res.data.matchings?.length) throw new Error('No matchings');
      const match = res.data.matchings[0];
      return { distanceKm: match.distance / 1000, durationMinutes: match.duration / 60, geometry: match.geometry, confidence: match.confidence };
    });
  }

  getStaticMapUrl(_geometry: any, origin: [number, number], destination: [number, number], stops: [number, number][], width: number = 600, height: number = 400): string {
    const markers = [`pin-s-a+48bb78(${origin[0]},${origin[1]})`, `pin-s-b+fc8181(${destination[0]},${destination[1]})`, ...stops.map((s, i) => `pin-s-${i+1}+63b3ed(${s[0]},${s[1]})`)];
    return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${markers.join(',')}/auto/${width}x${height}?padding=50&access_token=${MAPBOX_TOKEN}`;
  }

  async getRouteAlternatives(waypoints: [number, number][], kmPerLiter: number, fuelPrice: number, options?: { departAt?: string }): Promise<RouteOption[]> {
    const wpKey = getWaypointsKey(waypoints);
    const cacheKey = `alts|${wpKey}|${options?.departAt || 'now'}`;
    
    return routeCache.getOrFetch(cacheKey, async () => {
      const coords = waypoints.map(c => c.join(',')).join(';');
      const res = await axios.get(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}`, {
        params: { access_token: MAPBOX_TOKEN, alternatives: true, overview: 'full', geometries: 'geojson' },
      });
      return (res.data.routes || []).map((r: any, i: number) => {
        const dist = r.distance / 1000;
        return {
          id: `alt-${i}`, distanceKm: dist, durationMinutes: r.duration / 60,
          fuelCost: (dist / kmPerLiter) * fuelPrice, geometry: r.geometry,
        };
      });
    });
  }
}
