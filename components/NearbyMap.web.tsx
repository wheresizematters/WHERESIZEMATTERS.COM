'use client';
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

// Tier colour → hex for Leaflet marker
function tierHex(inches: number): string {
  const tier = getSizeTier(inches);
  // Convert any CSS color name to a usable hex
  const map: Record<string, string> = {
    '#6B7280': '#6B7280', // muted / average
    '#C9A84C': '#C9A84C', // gold
    '#BF5AF2': '#BF5AF2', // purple
    '#F87171': '#F87171', // red / micro
    '#60A5FA': '#60A5FA', // blue
    '#34D399': '#34D399', // green
  };
  return map[tier.color] ?? tier.color ?? '#C9A84C';
}

function makeIcon(L: any, color: string, isMe: boolean) {
  const size = isMe ? 18 : 13;
  const border = isMe ? '3px solid #fff' : '2px solid rgba(255,255,255,0.5)';
  const shadow = isMe ? '0 0 12px rgba(255,255,255,0.6)' : '0 2px 6px rgba(0,0,0,0.5)';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:${border};
      box-shadow:${shadow};
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Miles → approx metres for Leaflet circle
const MILES_TO_M = 1609.34;

export default function NearbyMap({ center, entries, mySize, radiusMiles, onPinPress }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Dynamically import leaflet so it only runs in browser
    import('leaflet').then(L => {
      // Fix default icon paths broken by bundlers
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, {
        center: [center.lat, center.lng],
        zoom: radiusMiles <= 5 ? 13 : radiusMiles <= 25 ? 11 : 9,
        zoomControl: true,
        attributionControl: false,
      });
      mapRef.current = map;

      // Dark tile layer (Carto Dark Matter — free, no API key)
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { maxZoom: 19 },
      ).addTo(map);

      // Radius circle
      L.circle([center.lat, center.lng], {
        radius: radiusMiles * MILES_TO_M,
        color: '#C9A84C',
        fillColor: '#C9A84C',
        fillOpacity: 0.06,
        weight: 1.5,
        dashArray: '6 4',
      }).addTo(map);

      // "You" marker
      const myTierColor = tierHex(mySize);
      L.marker([center.lat, center.lng], { icon: makeIcon(L, myTierColor, true) })
        .addTo(map)
        .bindPopup(`<b style="color:#C9A84C">You</b><br>${mySize.toFixed(1)}"`, { className: 'size-popup' });

      // Nearby user pins
      entries.forEach(e => {
        if (e.lat == null || e.lng == null) return;
        const color = tierHex(e.size_inches);
        const tier = getSizeTier(e.size_inches);
        const marker = L.marker([e.lat, e.lng], { icon: makeIcon(L, color, false) })
          .addTo(map)
          .bindPopup(
            `<b style="color:${color}">@${e.username}</b><br>${tier.emoji} ${tier.label}<br><small style="color:#888">${e.distance_miles.toFixed(1)} mi away · #${e.rank} local</small>`,
            { className: 'size-popup' },
          );
        if (onPinPress) marker.on('click', () => onPinPress(e));
      });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Inject Leaflet CSS + popup styles once
  useEffect(() => {
    if (document.getElementById('leaflet-css')) return;
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.innerHTML = `
      .size-popup .leaflet-popup-content-wrapper {
        background: #1a1a1a; border: 1px solid #333; border-radius: 10px; color: #fff; font-size: 13px;
      }
      .size-popup .leaflet-popup-tip { background: #1a1a1a; }
      .size-popup .leaflet-popup-content { margin: 10px 14px; line-height: 1.6; }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden', background: '#111' }}
    />
  );
}
