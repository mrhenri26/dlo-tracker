"use client";

import { useEffect, useState, useCallback, use } from "react";
import { TrackingResponse } from "@/types";
import TrackingStatus from "@/components/TrackingStatus";
import dynamic from "next/dynamic";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });

const POLL_INTERVAL = 10000; // 10 seconds
const ETA_SPEED_KMH = 28; // assumed urban delivery speed

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function estimateEtaMinutes(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number {
  const km = haversineKm(fromLat, fromLng, toLat, toLng);
  const hours = km / ETA_SPEED_KMH;
  return Math.max(1, Math.round(hours * 60));
}

function formatUpdatedAgo(isoDate: string): string {
  const d = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins === 1) return "1 min ago";
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return "1 hour ago";
  return `${diffHours} hours ago`;
}

export default function CustomerTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<TrackingResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const fetchTracking = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/${token}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Tracking link not found or expired.");
        } else {
          setError("Failed to load tracking data.");
        }
        setOffline(false);
        return;
      }
      const json: TrackingResponse = await res.json();
      setData(json);
      setError("");
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial fetch + polling
  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchTracking]);

  // Map markers: truck (vehicle icon) + optional destination
  const markers: { id: string; lat: number; lng: number; label: string; status: string; updatedAt?: string; type?: "truck" | "delivery" | "vehicle"; address?: string }[] = [];
  if (data?.location) {
    markers.push({
      id: "truck",
      lat: data.location.lat,
      lng: data.location.lng,
      label: "Your delivery truck",
      status: data.status === "delivered" ? "idle" : "on_delivery",
      updatedAt: data.location.updatedAt || undefined,
      type: "vehicle",
    });
  }
  if (data?.deliveryLocation) {
    markers.push({
      id: "destination",
      lat: data.deliveryLocation.lat,
      lng: data.deliveryLocation.lng,
      label: "Your delivery",
      status: data.status,
      type: "delivery",
      address: data.deliveryAddress,
    });
  }

  const mapCenter: [number, number] = data?.location
    ? [data.location.lat, data.location.lng]
    : [18.54, -72.34];

  const fitBoundsPoints: [number, number][] =
    data?.location && data?.deliveryLocation
      ? [
          [data.location.lat, data.location.lng],
          [data.deliveryLocation.lat, data.deliveryLocation.lng],
        ]
      : [];

  const routeLine: [number, number][] =
    data?.location && data?.deliveryLocation
      ? [
          [data.location.lat, data.location.lng],
          [data.deliveryLocation.lat, data.deliveryLocation.lng],
        ]
      : [];

  const etaMinutes =
    data?.status === "en_route" &&
    data?.location &&
    data?.deliveryLocation
      ? estimateEtaMinutes(
          data.location.lat,
          data.location.lng,
          data.deliveryLocation.lat,
          data.deliveryLocation.lng
        )
      : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-500 text-lg">
          Loading delivery info...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Tracking Not Found
          </h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Offline banner */}
      {offline && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800 text-center">
          Connection lost. Retrying...
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm border-b px-4 py-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold text-gray-900">Dlo Tracker</h1>
          <p className="text-sm text-gray-500">Water delivery tracking</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Status */}
        {data && (
          <div className="bg-white rounded-2xl shadow-sm border p-5">
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Delivery Status
            </h2>
            <TrackingStatus
              status={data.status}
              updatedAt={data.location?.updatedAt || undefined}
            />
            <div className="mt-4 space-y-1">
              <p className="text-gray-900 font-medium">{data.customerName}</p>
              <p className="text-gray-600 text-sm">{data.deliveryAddress}</p>
            </div>
          </div>
        )}

        {/* ETA (when en route and both locations available) */}
        {etaMinutes != null && (
          <div className="bg-white rounded-2xl shadow-sm border p-4">
            <p className="text-sm font-medium text-gray-500">
              Estimated arrival
            </p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">
              Arriving in about {etaMinutes} {etaMinutes === 1 ? "minute" : "minutes"}
            </p>
            {data?.location?.updatedAt && (
              <p className="text-xs text-gray-400 mt-2">
                Location updated{" "}
                {formatUpdatedAgo(data.location.updatedAt)}
              </p>
            )}
          </div>
        )}

        {/* Map */}
        {data?.location ? (
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Live Location
            </h2>
            <LiveMap
              markers={markers}
              center={mapCenter}
              zoom={14}
              className="h-[350px] w-full rounded-xl shadow-sm border"
              fitBoundsPoints={fitBoundsPoints.length >= 2 ? fitBoundsPoints : undefined}
              routeLine={routeLine.length >= 2 ? routeLine : undefined}
            />
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
            <p className="text-gray-400">
              {data?.status === "pending"
                ? "The truck hasn't started yet. The map will appear once it begins."
                : "No location data available."}
            </p>
          </div>
        )}

        {/* Delivered message */}
        {data?.status === "delivered" && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
            <p className="text-green-800 font-semibold">
              Your water has been delivered!
            </p>
            <p className="text-green-600 text-sm mt-1">
              Thank you for using Dlo Tracker.
            </p>
          </div>
        )}
      </main>

      <footer className="text-center py-6 text-xs text-gray-400">
        Dlo Tracker &middot; Haiti Water Delivery
      </footer>
    </div>
  );
}
