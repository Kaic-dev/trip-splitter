import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { RouteResult } from '../types';
import './RouteMap.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

interface Props {
  routeResult: RouteResult;
  origin: { label: string; coordinates: [number, number] };
  destination: { label: string; coordinates: [number, number] };
}

const STOP_COLORS = ['#63b3ed', '#68d391', '#f6ad55', '#fc8181', '#b794f4', '#76e4f7'];

export default function RouteMap({ routeResult, origin, destination }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Use waypoints from routeResult (which include stops)
    const waypoints = routeResult.waypoints;
    const center = waypoints[Math.floor(waypoints.length / 2)];

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center,
      zoom: 9,
      preserveDrawingBuffer: true,
    });

    const mapInstance = map.current;
    mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right');

    mapInstance.on('load', () => {
      // ── Main route (always the current active route geometry) ──────────────
      const mainGeometry = routeResult.geometry || {
        type: 'LineString',
        coordinates: waypoints,
      };

      console.log(`[RouteMap] Rendering geometry for distance ${routeResult.totalDistanceKm}km. Points: ${mainGeometry.coordinates?.length || 0}`);

      mapInstance.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: mainGeometry },
      });

      // Shadow / glow
      mapInstance.addLayer({
        id: 'route-bg',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#2d3748', 'line-width': 8 },
      });

      // Main route line
      mapInstance.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#63b3ed',
          'line-width': 4,
          'line-opacity': 0.9,
        },
      });

      // ── Markers ──────────────────────────────────────────────────────────
      const allPoints: { coords: [number, number]; label: string; type: string; index?: number }[] = [
        { coords: origin.coordinates, label: origin.label, type: 'origin' },
        ...routeResult.orderedPassengers.map((p, i) => ({
          coords: p.location.coordinates,
          label: p.name,
          type: 'stop',
          index: i,
        })),
        { coords: destination.coordinates, label: destination.label, type: 'destination' },
      ];

      allPoints.forEach((point, i) => {
        const el = document.createElement('div');
        el.className = 'map-marker';

        if (point.type === 'origin') {
          el.innerHTML = '🚗';
          el.style.fontSize = '28px';
        } else if (point.type === 'destination') {
          el.innerHTML = '🏁';
          el.style.fontSize = '28px';
        } else {
          const color = STOP_COLORS[(point.index ?? 0) % STOP_COLORS.length];
          el.style.cssText = `
            width: 32px; height: 32px;
            background: ${color};
            border: 3px solid #0d1117;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-weight: 700; font-size: 13px; color: #0d1117;
          `;
          el.textContent = String(i + 1); // Passageros começam em 1
        }

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat(point.coords)
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(point.label))
          .addTo(mapInstance);

        markersRef.current.push(marker);
      });

      // ── Fit bounds ───────────────────────────────────────────────────────
      // We fit to the waypoints to ensure all stops are visible
      const bounds = waypoints.reduce(
        (b, coord) => b.extend(coord),
        new mapboxgl.LngLatBounds(waypoints[0], waypoints[0])
      );
      mapInstance.fitBounds(bounds, { padding: 70, maxZoom: 13 });
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapInstance.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // key prop in parent handles re-mounting

  return (
    <div className="route-map" ref={mapContainer} />
  );
}
