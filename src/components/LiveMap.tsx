"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Leaflet must be imported dynamically in Next.js (requires window)
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  status: string;
  updatedAt?: string;
}

interface LiveMapProps {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  className?: string;
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return "Unknown";
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function LiveMap({
  markers,
  center = [18.54, -72.34], // Port-au-Prince, Haiti
  zoom = 12,
  className = "h-[400px] w-full rounded-xl",
}: LiveMapProps) {
  const [mounted, setMounted] = useState(false);
  const [leafletIcon, setLeafletIcon] = useState<{
    idle: L.Icon;
    on_delivery: L.Icon;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    // Create custom icons after mount (requires window)
    import("leaflet").then((L) => {
      const idle = new L.Icon({
        iconUrl:
          "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      const on_delivery = new L.Icon({
        iconUrl:
          "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      setLeafletIcon({ idle, on_delivery });
    });
  }, []);

  if (!mounted) {
    return (
      <div
        className={`${className} bg-gray-100 flex items-center justify-center`}
      >
        <span className="text-gray-400">Loading map...</span>
      </div>
    );
  }

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={className}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={
            leafletIcon
              ? m.status === "on_delivery"
                ? leafletIcon.on_delivery
                : leafletIcon.idle
              : undefined
          }
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{m.label}</p>
              <p className="text-gray-500">
                {m.status === "on_delivery" ? "En route" : "Idle"}
              </p>
              <p className="text-xs text-gray-400">
                Updated: {formatTime(m.updatedAt)}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
