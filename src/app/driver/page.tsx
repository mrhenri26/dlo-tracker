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

export default function DriverPage() {
  const { appUser, loading, logout } = useAuth();
  const router = useRouter();
  const [truck, setTruck] = useState<Truck | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [tracking, setTracking] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [gpsError, setGpsError] = useState("");

  // Auth guard
  useEffect(() => {
    const redirecting = !loading && (!appUser || appUser.role !== "driver");
    // #region agent log
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[DloAuth] driver guard", { loading, hasAppUser: !!appUser, role: appUser?.role, redirecting });
    }
    fetch("http://127.0.0.1:7242/ingest/90433ca3-f8b2-48ed-ba4c-cb0cc7fb2fa2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "driver/page.tsx:guard",
        message: "Guard run",
        data: { loading, appUserRole: appUser?.role ?? null, hasAppUser: !!appUser, redirecting, hypothesisId: "H1,H3,H5" },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (redirecting) {
      router.replace("/login");
    }
  }, [appUser, loading, router]);

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

  // Listen for current active delivery for this driver
  useEffect(() => {
    if (!appUser?.uid) return;
    const q = query(
      collection(getClientDb(), "deliveries"),
      where("driverId", "==", appUser.uid),
      where("status", "in", ["pending", "en_route"])
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        setDelivery({ id: d.id, ...d.data() } as Delivery);
      } else {
        setDelivery(null);
      }
    });
    return () => unsub();
  }, [appUser?.uid]);

  const handleStartTracking = useCallback(async () => {
    if (!truck || !delivery) return;
    setGpsError("");

    try {
      // Update truck and delivery status
      await updateDoc(doc(getClientDb(), "trucks", truck.id), {
        status: "on_delivery",
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(getClientDb(), "deliveries", delivery.id), {
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
  }, [truck, delivery]);

  const handleStopTracking = useCallback(() => {
    stopTracking();
    setTracking(false);
  }, []);

  const handleMarkDelivered = useCallback(async () => {
    if (!truck || !delivery) return;

    stopTracking();
    setTracking(false);

    try {
      await updateDoc(doc(getClientDb(), "trucks", truck.id), {
        status: "idle",
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(getClientDb(), "deliveries", delivery.id), {
        status: "delivered",
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to mark delivered:", err);
    }
  }, [truck, delivery]);

  // Cleanup tracking on unmount
  useEffect(() => {
    return () => {
      if (isTracking()) {
        stopTracking();
      }
    };
  }, []);

  if (loading) {
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

        {/* Delivery info card */}
        {delivery ? (
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-5">
            <h2 className="text-sm font-medium text-gray-500 mb-1">
              Current Delivery
            </h2>
            <p className="text-lg font-semibold text-gray-900">
              {delivery.customerName}
            </p>
            <p className="text-gray-600 mt-1">{delivery.deliveryAddress}</p>
            <div className="mt-3">
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  delivery.status === "en_route"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {delivery.status === "en_route" ? "En Route" : "Pending"}
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8 text-center">
            <p className="text-gray-400">No active delivery assigned.</p>
            <p className="text-sm text-gray-300 mt-1">
              Wait for the boss to assign one.
            </p>
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
          {!tracking ? (
            <button
              onClick={handleStartTracking}
              disabled={!delivery || delivery.status === "delivered"}
              className="w-full py-5 bg-blue-600 text-white text-xl font-bold rounded-2xl hover:bg-blue-700 active:bg-blue-800 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
            >
              Start Tracking
            </button>
          ) : (
            <>
              <button
                onClick={handleMarkDelivered}
                className="w-full py-5 bg-green-600 text-white text-xl font-bold rounded-2xl hover:bg-green-700 active:bg-green-800 transition shadow-lg"
              >
                Mark Delivered
              </button>
              <button
                onClick={handleStopTracking}
                className="w-full py-3 border-2 border-gray-300 text-gray-600 font-medium rounded-2xl hover:bg-gray-100 transition"
              >
                Stop Tracking
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
