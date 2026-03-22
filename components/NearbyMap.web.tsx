import { useEffect, useRef } from 'react';
import { NearbyEntry } from '@/lib/api';
import { getSizeTier } from '@/constants/theme';

interface Props {
  center: { lat: number; lng: number };
  entries: NearbyEntry[];
  mySize: number;
  radiusMiles: number;
  onPinPress?: (entry: NearbyEntry) => void;
}

const MAPTILER_KEY = '95p2HRJPZMhEYY2ys1kt';
const MILES_TO_KM = 1.60934;

function tierHex(inches: number): string {
  const tier = getSizeTier(inches);
  const map: Record<string, string> = {
    '#6B7280': '#6B7280',
    '#C9A84C': '#C9A84C',
    '#BF5AF2': '#BF5AF2',
    '#F87171': '#F87171',
    '#60A5FA': '#60A5FA',
    '#34D399': '#34D399',
  };
  return map[tier.color] ?? tier.color ?? '#C9A84C';
}

// Build a GeoJSON circle polygon (approximation via bearing offsets)
function makeCircleGeoJSON(lat: number, lng: number, radiusMiles: number) {
  const points = 64;
  const radiusKm = radiusMiles * MILES_TO_KM;
  const coords: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dLat = (radiusKm / 111.32) * Math.cos(angle);
    const dLng = (radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
    coords.push([lng + dLng, lat + dLat]);
  }
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [coords] },
        properties: {},
      },
    ],
  };
}

export default function NearbyMap({ center, entries, mySize, radiusMiles, onPinPress }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  // Inject MapLibre CSS once
  useEffect(() => {
    if (document.getElementById('maplibre-css')) return;
    const link = document.createElement('link');
    link.id = 'maplibre-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
    document.head.appendChild(link);

    // Custom popup + pin styles
    const style = document.createElement('style');
    style.innerHTML = `
      .size-popup .maplibregl-popup-content {
        background: #111; border: 1px solid #333; border-radius: 10px;
        color: #fff; font-size: 13px; padding: 10px 14px; line-height: 1.6;
        box-shadow: 0 4px 20px rgba(0,0,0,0.8);
      }
      .size-popup .maplibregl-popup-tip { border-top-color: #333 !important; }
      .size-pin { cursor: pointer; transition: transform 0.15s; }
      .size-pin:hover { transform: scale(1.3); }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import('maplibre-gl').then((mlgl) => {
      const maplibregl = mlgl.default ?? mlgl;

      const map = new maplibregl.Map({
        container: containerRef.current!,
        style: `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`,
        center: [center.lng, center.lat],
        zoom: radiusMiles <= 5 ? 13 : radiusMiles <= 25 ? 11 : 9,
        attributionControl: false,
      });
      mapRef.current = map;

      map.on('load', () => {
        // ── SIZE brand paint overrides ──────────────────────────────────────
        const layers = map.getStyle()?.layers ?? [];

        layers.forEach((layer: any) => {
          const id: string = layer.id ?? '';
          const type: string = layer.type ?? '';

          // Roads — orange/gold gradient by road class
          if (
            type === 'line' &&
            (id.includes('road') || id.includes('street') || id.includes('path') || id.includes('highway') || id.includes('motorway') || id.includes('trunk') || id.includes('primary') || id.includes('secondary') || id.includes('residential'))
          ) {
            try {
              const isHighway = id.includes('motorway') || id.includes('trunk') || id.includes('highway');
              const isPrimary = id.includes('primary');
              map.setPaintProperty(id, 'line-color', isHighway ? '#E8500A' : isPrimary ? '#C9A84C' : '#8B6914');
              if (isHighway) map.setPaintProperty(id, 'line-opacity', 0.9);
            } catch {}
          }

          // Road casings
          if (type === 'line' && (id.includes('casing') || id.includes('outline'))) {
            try { map.setPaintProperty(id, 'line-color', '#1a1008'); } catch {}
          }

          // Country & state boundaries
          if (type === 'line' && (id.includes('border') || id.includes('boundary') || id.includes('admin'))) {
            try {
              map.setPaintProperty(id, 'line-color', '#E8500A');
              map.setPaintProperty(id, 'line-opacity', 0.5);
            } catch {}
          }

          // Water — near-black
          if (type === 'fill' && (id.includes('water') || id.includes('ocean') || id.includes('lake'))) {
            try { map.setPaintProperty(id, 'fill-color', '#070B10'); } catch {}
          }

          // Land background
          if (type === 'background') {
            try { map.setPaintProperty(id, 'background-color', '#0A0A0A'); } catch {}
          }

          // Land fill
          if (type === 'fill' && (id.includes('land') || id === 'landuse' || id.includes('grass') || id.includes('park') || id.includes('residential-area'))) {
            try { map.setPaintProperty(id, 'fill-color', '#0F0F0F'); } catch {}
          }

          // Labels — muted gold
          if (type === 'symbol') {
            try {
              map.setPaintProperty(id, 'text-color', '#8B7355');
              map.setPaintProperty(id, 'text-halo-color', '#0A0A0A');
            } catch {}
          }
        });

        // ── Radius circle ───────────────────────────────────────────────────
        map.addSource('radius', { type: 'geojson', data: makeCircleGeoJSON(center.lat, center.lng, radiusMiles) });
        map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': '#C9A84C', 'fill-opacity': 0.06 } });
        map.addLayer({ id: 'radius-line', type: 'line', source: 'radius', paint: { 'line-color': '#C9A84C', 'line-width': 1.5, 'line-dasharray': [6, 4] } });

        // ── "You" marker ────────────────────────────────────────────────────
        const myColor = tierHex(mySize);
        const meEl = document.createElement('div');
        meEl.className = 'size-pin';
        meEl.style.cssText = `width:18px;height:18px;border-radius:50%;background:${myColor};border:3px solid #fff;box-shadow:0 0 14px rgba(255,255,255,0.55),0 0 6px ${myColor};`;

        const mePopup = new maplibregl.Popup({ className: 'size-popup', offset: 14 }).setHTML(
          `<b style="color:#C9A84C">You</b><br>${mySize.toFixed(1)}"`,
        );
        new maplibregl.Marker({ element: meEl })
          .setLngLat([center.lng, center.lat])
          .setPopup(mePopup)
          .addTo(map);

        // ── Nearby user pins ─────────────────────────────────────────────────
        entries.forEach((e) => {
          if (e.lat == null || e.lng == null) return;
          const color = tierHex(e.size_inches);
          const tier = getSizeTier(e.size_inches);

          const el = document.createElement('div');
          el.className = 'size-pin';
          el.style.cssText = `width:13px;height:13px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.45);box-shadow:0 2px 8px rgba(0,0,0,0.6);`;

          const popup = new maplibregl.Popup({ className: 'size-popup', offset: 12 }).setHTML(
            `<b style="color:${color}">@${e.username}</b><br>${tier.emoji} ${tier.label}<br><small style="color:#888">${e.distance_miles.toFixed(1)} mi away &middot; #${e.rank} local</small>`,
          );

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([e.lng, e.lat])
            .setPopup(popup)
            .addTo(map);

          if (onPinPress) el.addEventListener('click', () => onPinPress(e));
        });
      });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden', background: '#0A0A0A' }}
    />
  );
}
