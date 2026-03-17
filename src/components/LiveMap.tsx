"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useMap } from "react-leaflet";

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
const Polyline = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false }
);

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  status: string;
  updatedAt?: string;
  type?: "truck" | "delivery" | "vehicle";
  address?: string;
}

interface LiveMapProps {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  className?: string;
  /** When length >= 2, fit map bounds to show all points with padding */
  fitBoundsPoints?: [number, number][];
  /** Line from first to last point (e.g. truck to destination) */
  routeLine?: [number, number][];
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return "Unknown";
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Top-down car SVG for vehicle marker */
const CAR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28"><path fill="%232563eb" stroke="%231e40af" stroke-width="1.2" d="M5 14l1.5-4.5h11L19 14H5zm2 2a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm10 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM6.5 8L8 4h8l1.5 4H6.5z"/></svg>';

function FitBounds({
  points,
}: {
  points: [number, number][];
}) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      import("leaflet").then((L) => {
        const bounds = L.latLngBounds(points.map((p) => [p[0], p[1]] as [number, number]));
        map.fitBounds(bounds, { padding: [24, 24] });
      });
    }
  }, [map, points]);
  return null;
}

export default function LiveMap({
  markers,
  center = [18.54, -72.34], // Port-au-Prince, Haiti
  zoom = 12,
  className = "h-[400px] w-full rounded-xl",
  fitBoundsPoints,
  routeLine,
}: LiveMapProps) {
  const [mounted, setMounted] = useState(false);
  const [leafletIcon, setLeafletIcon] = useState<{
    idle: L.Icon;
    on_delivery: L.Icon;
    delivery: L.Icon;
    vehicle: L.DivIcon;
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
      const delivery = new L.Icon({
        iconUrl:
          "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      const vehicle = new L.DivIcon({
        html: `<div class="flex items-center justify-center drop-shadow-md">${CAR_SVG}</div>`,
        className: "border-0 bg-transparent",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
      });
      setLeafletIcon({ idle, on_delivery, delivery, vehicle });
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
      {fitBoundsPoints && fitBoundsPoints.length >= 2 && (
        <FitBounds points={fitBoundsPoints} />
      )}
      {routeLine && routeLine.length >= 2 && (
        <Polyline
          positions={routeLine.map((p) => [p[0], p[1]] as [number, number])}
          pathOptions={{
            color: "#2563eb",
            weight: 4,
            opacity: 0.8,
            dashArray: "8, 8",
          }}
        />
      )}
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={
            leafletIcon
              ? m.type === "vehicle"
                ? leafletIcon.vehicle
                : m.type === "delivery"
                  ? leafletIcon.delivery
                  : m.status === "on_delivery"
                    ? leafletIcon.on_delivery
                    : leafletIcon.idle
              : undefined
          }
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{m.label}</p>
              <p className="text-gray-500">
                {m.type === "delivery"
                  ? m.status === "delivered"
                    ? "Delivery destination (delivered)"
                    : "Delivery destination"
                  : m.status === "on_delivery"
                    ? "En route"
                    : "Idle"}
              </p>
              {m.type === "delivery" && m.address && (
                <p className="text-xs text-gray-400 mt-1">{m.address}</p>
              )}
              {m.type !== "delivery" && (
                <p className="text-xs text-gray-400">
                  Updated: {formatTime(m.updatedAt)}
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
