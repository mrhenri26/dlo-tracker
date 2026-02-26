"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Truck, Delivery, DeliveryStatus, TruckStatus } from "@/types";
import dynamic from "next/dynamic";
import DeliveryForm from "@/components/DeliveryForm";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });

export default function BossDashboard() {
  const { appUser, loading, logout, firebaseUser, providerId } = useAuth();
  const router = useRouter();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<
    | { type: "delivery"; delivery: Delivery; newStatus: DeliveryStatus }
    | { type: "truck"; truck: Truck; newStatus: TruckStatus }
    | null
  >(null);
  const [overrideError, setOverrideError] = useState("");
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  // Treat "Firebase user present but app user not yet loaded" as still loading (avoids redirect loop when context lags).
  const resolving = !!firebaseUser && !appUser;
  const effectiveLoading = loading || resolving;

  // Auth guard
  useEffect(() => {
    const redirecting = !effectiveLoading && (!appUser || appUser.role !== "boss");
    if (redirecting) {
      router.replace("/login");
    }
  }, [appUser, loading, effectiveLoading, router]);

  // Real-time listener for trucks (only when boss — rules deny full collection read for drivers)
  useEffect(() => {
    if (appUser?.role !== "boss") return;
    const unsub = onSnapshot(collection(getClientDb(), "trucks"), (snap) => {
      const data = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Truck
      );
      setTrucks(data);
    });
    return () => unsub();
  }, [appUser?.role]);

  // Real-time listener for active deliveries (only when boss)
  useEffect(() => {
    if (appUser?.role !== "boss") return;
    const q = query(
      collection(getClientDb(), "deliveries"),
      where("status", "in", ["pending", "en_route"]),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Delivery
      );
      setDeliveries(data);
    });
    return () => unsub();
  }, [appUser?.role]);

  function copyTrackingLink(token: string) {
    const url = `${window.location.origin}/track/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  // Build map markers from trucks with location
  const truckMarkers = trucks
    .filter((t) => t.location)
    .map((t) => ({
      id: t.id,
      lat: t.location!.lat,
      lng: t.location!.lng,
      label: t.name,
      status: t.status,
      updatedAt: t.location!.updatedAt?.toDate?.()
        ? t.location!.updatedAt.toDate().toISOString()
        : undefined,
      type: "truck" as const,
    }));

  const deliveryMarkers = deliveries
    .filter((d) => d.location)
    .map((d) => ({
      id: `delivery-${d.id}`,
      lat: d.location!.lat,
      lng: d.location!.lng,
      label: d.customerName,
      status: d.status,
      type: "delivery" as const,
      address: d.deliveryAddress,
    }));

  const markers = [...truckMarkers, ...deliveryMarkers];

  const sortedDeliveries = [...deliveries].sort((a, b) => {
    const aTime = a.scheduledAt?.toDate?.()?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bTime = b.scheduledAt?.toDate?.()?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  function formatScheduledAt(d: Delivery): string {
    const date = d.scheduledAt?.toDate?.();
    return date ? date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "—";
  }

  async function handleConfirmOverride() {
    if (!overrideTarget) return;
    setOverrideSubmitting(true);
    setOverrideError("");
    try {
      const db = getClientDb();
      if (overrideTarget.type === "delivery") {
        const ref = doc(db, "deliveries", overrideTarget.delivery.id);
        await updateDoc(ref, {
          status: overrideTarget.newStatus,
          updatedAt: serverTimestamp(),
        });
      } else {
        const ref = doc(db, "trucks", overrideTarget.truck.id);
        await updateDoc(ref, {
          status: overrideTarget.newStatus,
          updatedAt: serverTimestamp(),
        });
      }
      setOverrideTarget(null);
    } catch (err) {
      console.error("Status override failed:", err);
      setOverrideError(
        "Failed to override status. Please try again in a moment."
      );
    } finally {
      setOverrideSubmitting(false);
    }
  }

  if (effectiveLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dlo Tracker</h1>
            <p className="text-sm text-gray-500">Boss Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{appUser?.name}</span>
            <button
              onClick={logout}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Map */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Live Truck Map
          </h2>
          <LiveMap markers={markers} className="h-[450px] w-full rounded-xl shadow-sm border" />
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-green-500 rounded-full inline-block" />
              Idle
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-blue-500 rounded-full inline-block" />
              En Route
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-red-500 rounded-full inline-block" />
              Delivery destination
            </span>
          </div>
        </section>

        {/* Deliveries */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">
              Active Deliveries ({deliveries.length})
            </h2>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              + New Delivery
            </button>
          </div>

          {deliveries.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400 border">
              No active deliveries. Create one to get started.
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">
                        Customer
                      </th>
                      <th className="text-left px-4 py-3 font-medium">
                        Address
                      </th>
                      <th className="text-left px-4 py-3 font-medium">
                        Truck
                      </th>
                      <th className="text-left px-4 py-3 font-medium">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 font-medium">
                        Scheduled
                      </th>
                      <th className="text-left px-4 py-3 font-medium">
                        Tracking
                      </th>
                      <th className="text-left px-4 py-3 font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedDeliveries.map((d) => {
                      const truck = trucks.find((t) => t.id === d.truckId);
                      return (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-900">
                            {d.customerName}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {d.deliveryAddress}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {truck?.name || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                d.status === "en_route"
                                  ? "bg-blue-100 text-blue-700"
                                  : d.status === "delivered"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {d.status === "en_route"
                                ? "En Route"
                                : d.status === "delivered"
                                  ? "Delivered"
                                  : "Pending"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {formatScheduledAt(d)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() =>
                                copyTrackingLink(d.trackingToken)
                              }
                              className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                            >
                              {copied === d.trackingToken
                                ? "Copied!"
                                : "Copy Link"}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {(["pending", "en_route", "delivered"] as DeliveryStatus[]).map(
                                (status) => (
                                  <button
                                    key={status}
                                    type="button"
                                    disabled={status === d.status}
                                    onClick={() =>
                                      setOverrideTarget({
                                        type: "delivery",
                                        delivery: d,
                                        newStatus: status,
                                      })
                                    }
                                    className={`px-2 py-1 rounded text-xs border ${
                                      status === d.status
                                        ? "bg-gray-100 text-gray-400 cursor-default"
                                        : "bg-white text-gray-700 hover:bg-gray-50"
                                    }`}
                                  >
                                    {status === "pending"
                                      ? "Set Pending"
                                      : status === "en_route"
                                        ? "Set En Route"
                                        : "Set Delivered"}
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Truck status override */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Truck Status Override
          </h2>
          {trucks.length === 0 ? (
            <div className="bg-white rounded-xl p-4 text-sm text-gray-400 border">
              No trucks found.
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">
                        Truck
                      </th>
                      <th className="text-left px-4 py-3 font-medium">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trucks.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">
                          {t.name} ({t.plateNumber})
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              t.status === "on_delivery"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {t.status === "on_delivery" ? "On Delivery" : "Idle"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {(["idle", "on_delivery"] as TruckStatus[]).map(
                              (status) => (
                                <button
                                  key={status}
                                  type="button"
                                  disabled={status === t.status}
                                  onClick={() =>
                                    setOverrideTarget({
                                      type: "truck",
                                      truck: t,
                                      newStatus: status,
                                    })
                                  }
                                  className={`px-2 py-1 rounded text-xs border ${
                                    status === t.status
                                      ? "bg-gray-100 text-gray-400 cursor-default"
                                      : "bg-white text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  {status === "idle"
                                    ? "Set Idle"
                                    : "Set On Delivery"}
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* New Delivery Modal */}
      {showForm && (
        <DeliveryForm
          trucks={trucks}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Override confirmation modal */}
      {overrideTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              {overrideTarget.type === "delivery"
                ? "Override delivery status"
                : "Override truck status"}
            </h2>
            <p className="text-sm text-gray-700 mb-4">
              You are overriding the current status. The driver app may still
              show a different state. Are you sure you want to continue?
            </p>
            <p className="text-sm text-gray-700 mb-4">
              <span className="font-semibold">New status:</span>{" "}
              {overrideTarget.type === "delivery"
                ? overrideTarget.newStatus === "en_route"
                  ? "En Route"
                  : overrideTarget.newStatus === "delivered"
                    ? "Delivered"
                    : "Pending"
                : overrideTarget.newStatus === "on_delivery"
                  ? "On Delivery"
                  : "Idle"}
            </p>
            {overrideError && (
              <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-700">
                {overrideError}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={overrideSubmitting}
                onClick={() => setOverrideTarget(null)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={overrideSubmitting}
                onClick={handleConfirmOverride}
                className="flex-1 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {overrideSubmitting ? "Overriding..." : "Override"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
