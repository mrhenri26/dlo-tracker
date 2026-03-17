"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Truck, Delivery } from "@/types";
import { startTracking, stopTracking, isTracking } from "@/lib/gps";
import { openMapsWithDestination } from "@/lib/maps";

export default function DriverPage() {
  const { appUser, loading, logout, firebaseUser } = useAuth();
  const router = useRouter();
  const [truck, setTruck] = useState<Truck | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [tracking, setTracking] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [gpsError, setGpsError] = useState("");

  const resolving = !!firebaseUser && !appUser;
  const effectiveLoading = loading || resolving;

  // Auth guard
  useEffect(() => {
    const redirecting = !effectiveLoading && (!appUser || appUser.role !== "driver");
    if (redirecting) {
      router.replace("/login");
    }
  }, [appUser, loading, effectiveLoading, router]);

  // Listen for network status
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Listen for the driver's assigned truck
  useEffect(() => {
    if (!appUser?.truckId) return;
    const unsub = onSnapshot(doc(getClientDb(), "trucks", appUser.truckId), (snap) => {
      if (snap.exists()) {
        setTruck({ id: snap.id, ...snap.data() } as Truck);
      }
    });
    return () => unsub();
  }, [appUser?.truckId]);

  // Listen for all active deliveries for this driver
  useEffect(() => {
    if (!appUser?.uid) return;
    const q = query(
      collection(getClientDb(), "deliveries"),
      where("driverId", "==", appUser.uid),
      where("status", "in", ["pending", "en_route"])
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Delivery
      );
      setDeliveries(data);
    });
    return () => unsub();
  }, [appUser?.uid]);

  // Current = only the delivery you're actively doing (en_route). Future = all pending, sorted by time.
  const currentDelivery = deliveries.find((d) => d.status === "en_route") ?? null;
  const futureDeliveries = [...deliveries]
    .filter((d) => d.status === "pending")
    .sort((a, b) => {
      const aTime = a.scheduledAt?.toDate?.()?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.scheduledAt?.toDate?.()?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  const deliveryToStart = futureDeliveries[0] ?? null;

  function formatScheduledAt(d: Delivery): string {
    const date = d.scheduledAt?.toDate?.();
    return date
      ? date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
      : "No time set";
  }

  const handleStartTracking = useCallback(async () => {
    if (!truck || !deliveryToStart) return;
    setGpsError("");

    try {
      await updateDoc(doc(getClientDb(), "trucks", truck.id), {
        status: "on_delivery",
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(getClientDb(), "deliveries", deliveryToStart.id), {
        status: "en_route",
        updatedAt: serverTimestamp(),
      });

      startTracking(truck.id);
      setTracking(true);
    } catch (err) {
      console.error("Failed to start tracking:", err);
      setGpsError(
        err instanceof Error ? err.message : "Failed to start GPS tracking"
      );
    }
  }, [truck, deliveryToStart]);

  const handleResumeTracking = useCallback(() => {
    if (!truck || !currentDelivery) return;
    setGpsError("");
    try {
      startTracking(truck.id);
      setTracking(true);
    } catch (err) {
      setGpsError(
        err instanceof Error ? err.message : "Failed to resume GPS tracking"
      );
    }
  }, [truck, currentDelivery]);

  const handlePauseTracking = useCallback(() => {
    stopTracking();
    setTracking(false);
  }, []);

  const handleMarkDelivered = useCallback(async () => {
    if (!truck || !currentDelivery) return;

    stopTracking();
    setTracking(false);

    try {
      await updateDoc(doc(getClientDb(), "trucks", truck.id), {
        status: "idle",
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(getClientDb(), "deliveries", currentDelivery.id), {
        status: "delivered",
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to mark delivered:", err);
    }
  }, [truck, currentDelivery]);

  // Cleanup tracking on unmount
  useEffect(() => {
    return () => {
      if (isTracking()) {
        stopTracking();
      }
    };
  }, []);

  if (effectiveLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Dlo Tracker</h1>
            <p className="text-sm text-gray-500">
              {appUser?.name} &middot; {truck?.name || "No truck assigned"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection indicator */}
            <span
              className={`w-2.5 h-2.5 rounded-full ${online ? "bg-green-500" : "bg-red-500"}`}
              title={online ? "Online" : "Offline"}
            />
            <button
              onClick={logout}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Offline banner */}
      {!online && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800 text-center">
          You are offline. GPS data will sync when connection returns.
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6">
        {/* GPS Error */}
        {gpsError && (
          <div className="w-full max-w-sm p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-center">
            {gpsError}
          </div>
        )}

        {/* Current delivery — one window */}
        {currentDelivery ? (
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-5">
            <h2 className="text-sm font-medium text-gray-500 mb-0.5">
              Current delivery
            </h2>
            <p className="text-xs text-gray-400 mb-2">The one you’re doing right now</p>
            <p className="text-lg font-semibold text-gray-900">
              {currentDelivery.customerName}
            </p>
            <p className="text-gray-600 mt-1">{currentDelivery.deliveryAddress}</p>
            <p className="text-xs text-gray-500 mt-1">
              {formatScheduledAt(currentDelivery)}
            </p>
            <div className="mt-3">
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                En route
              </span>
            </div>
          </div>
        ) : futureDeliveries.length > 0 ? (
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8 text-center">
            <p className="text-gray-400">No current delivery.</p>
            <p className="text-sm text-gray-300 mt-1">
              Start one from the list below when you're ready.
            </p>
          </div>
        ) : (
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8 text-center">
            <p className="text-gray-400">No active delivery assigned.</p>
            <p className="text-sm text-gray-300 mt-1">
              Wait for the boss to assign one.
            </p>
          </div>
        )}

        {/* Future deliveries */}
        {futureDeliveries.length > 0 && (
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-5">
            <h2 className="text-sm font-medium text-gray-500 mb-0.5">
              Future deliveries
            </h2>
            <p className="text-xs text-gray-400 mb-3">Later today</p>
            <ul className="space-y-3">
              {futureDeliveries.map((d) => (
                <li
                  key={d.id}
                  className="border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                >
                  <p className="font-medium text-gray-900">{d.customerName}</p>
                  <p className="text-sm text-gray-600">{d.deliveryAddress}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatScheduledAt(d)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tracking status */}
        {tracking && (
          <div className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-blue-700 font-medium">
              GPS is active &middot; Sending location...
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="w-full max-w-sm space-y-3">
          {(currentDelivery ?? deliveryToStart) && (
            <button
              type="button"
              onClick={() =>
                openMapsWithDestination(
                  (currentDelivery ?? deliveryToStart)!.deliveryAddress
                )
              }
              className="w-full py-3 border-2 border-gray-300 text-gray-600 font-medium rounded-2xl hover:bg-gray-100 transition flex items-center justify-center gap-2"
            >
              Open in Google Maps
            </button>
          )}
          {currentDelivery ? (
            tracking ? (
              <>
                <button
                  onClick={handleMarkDelivered}
                  className="w-full py-5 bg-green-600 text-white text-xl font-bold rounded-2xl hover:bg-green-700 active:bg-green-800 transition shadow-lg"
                >
                  Mark Delivered
                </button>
                <button
                  onClick={handlePauseTracking}
                  className="w-full py-3 border-2 border-gray-300 text-gray-600 font-medium rounded-2xl hover:bg-gray-100 transition"
                >
                  Pause Tracking
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleResumeTracking}
                  className="w-full py-5 bg-blue-600 text-white text-xl font-bold rounded-2xl hover:bg-blue-700 active:bg-blue-800 transition shadow-lg"
                >
                  Resume Tracking
                </button>
                <button
                  onClick={handleMarkDelivered}
                  className="w-full py-3 border-2 border-gray-300 text-gray-600 font-medium rounded-2xl hover:bg-gray-100 transition"
                >
                  Mark Delivered
                </button>
              </>
            )
          ) : deliveryToStart ? (
            <button
              onClick={handleStartTracking}
              className="w-full py-5 bg-blue-600 text-white text-xl font-bold rounded-2xl hover:bg-blue-700 active:bg-blue-800 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
            >
              Start Tracking
            </button>
          ) : null}
        </div>
      </main>
    </div>
  );
}
