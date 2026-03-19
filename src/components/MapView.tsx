import { useEffect, useRef, useCallback, memo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { RouteResult } from '../types';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

interface Props {
  routeResult?: RouteResult;
  baseGeometry?: any;
  origin?: { label: string; coordinates: [number, number] };
  destination?: { label: string; coordinates: [number, number] };
  onMapClick?: (coords: [number, number]) => void;
}

const STOP_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const MapView: React.FC<Props> = ({ routeResult, baseGeometry, origin, destination, onMapClick }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  // Store latest geometry in refs so the 'load' callback always has access
  const latestBaseGeom = useRef<any>(null);
  const latestRouteGeom = useRef<any>(null);

  // Apply route data to sources — called both after style loads and on prop change
  const applyRouteData = useCallback(() => {
    const m = map.current;
    if (!m || !m.isStyleLoaded()) return;

    const baseSource = m.getSource('route-base') as mapboxgl.GeoJSONSource;
    if (baseSource) {
      baseSource.setData({
        type: 'Feature', properties: {},
        geometry: latestBaseGeom.current || { type: 'LineString', coordinates: [] }
      });
    }

    const activeSource = m.getSource('route-active') as mapboxgl.GeoJSONSource;
    if (activeSource) {
      activeSource.setData({
        type: 'Feature', properties: {},
        geometry: latestRouteGeom.current || { type: 'LineString', coordinates: [] }
      });
    }
  }, []);

  // 1. Initialize Map once
  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-47.4145, -22.7562],
      zoom: 12,
      attributionControl: false,
    });

    const m = map.current;
    m.addControl(new mapboxgl.NavigationControl(), 'top-right');

    m.on('load', () => {
      m.addSource('route-base', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} } });
      m.addSource('route-active', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} } });

      m.addLayer({
        id: 'route-base-layer', type: 'line', source: 'route-base',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#94a3b8', 'line-width': 3, 'line-dasharray': [2, 2], 'line-opacity': 0.6 }
      });
      m.addLayer({
        id: 'route-active-layer', type: 'line', source: 'route-active',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#6366f1', 'line-width': 5 }
      });

      // Apply any data that arrived before the style finished loading
      applyRouteData();
    });

    if (onMapClick) {
      m.on('click', (e) => onMapClick([e.lngLat.lng, e.lngLat.lat]));
    }

    return () => m.remove();
  }, [onMapClick, applyRouteData]);

  // 2. Update route on prop changes — store in ref and call applyRouteData
  useEffect(() => {
    latestBaseGeom.current = baseGeometry || null;
    latestRouteGeom.current = routeResult?.geometry || null;
    applyRouteData();

    const m = map.current;
    if (m && routeResult?.waypoints && routeResult.waypoints.length > 0) {
      const bounds = routeResult.waypoints.reduce(
        (b, coord) => b.extend(coord),
        new mapboxgl.LngLatBounds(routeResult.waypoints[0], routeResult.waypoints[0])
      );
      m.fitBounds(bounds, { padding: 80, maxZoom: 14 });
    }
  }, [routeResult, baseGeometry, applyRouteData]);

  // 3. Update markers
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    markersRef.current.forEach(mk => mk.remove());
    markersRef.current = [];

    const points: { coords: [number, number]; label: string; type: 'origin' | 'stop' | 'destination'; index?: number }[] = [];

    if (origin) points.push({ coords: origin.coordinates, label: origin.label, type: 'origin' });

    if (routeResult?.orderedPassengers) {
      routeResult.orderedPassengers.forEach((p, i) => {
        points.push({ coords: p.location.coordinates, label: p.name, type: 'stop', index: i });
      });
    }

    if (destination) points.push({ coords: destination.coordinates, label: destination.label, type: 'destination' });

    points.forEach((p) => {
      const el = document.createElement('div');
      if (p.type === 'origin') {
        el.innerHTML = '<div style="font-size:24px">📍</div>';
      } else if (p.type === 'destination') {
        el.innerHTML = '<div style="font-size:24px">🏁</div>';
      } else {
        const color = STOP_COLORS[(p.index || 0) % STOP_COLORS.length];
        el.innerHTML = `<div style="width:28px;height:28px;background:${color};color:white;border:3px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.4)">${(p.index || 0) + 1}</div>`;
      }
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(p.coords)
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(p.label))
        .addTo(m);
      markersRef.current.push(marker);
    });
  }, [origin, destination, routeResult]);

  return <div className="map-background" ref={mapContainer} style={{ background: '#1a1a2e' }} />;
};

export default memo(MapView);
