"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Truck, Delivery } from "@/types";
import dynamic from "next/dynamic";
import DeliveryForm from "@/components/DeliveryForm";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });

export default function BossDashboard() {
  const { appUser, loading, logout } = useAuth();
  const router = useRouter();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!loading && (!appUser || appUser.role !== "boss")) {
      router.replace("/login");
    }
  }, [appUser, loading, router]);

  // Real-time listener for trucks
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "trucks"), (snap) => {
      const data = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Truck
      );
      setTrucks(data);
    });
    return () => unsub();
  }, []);

  // Real-time listener for active deliveries
  useEffect(() => {
    const q = query(
      collection(db, "deliveries"),
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
  }, []);

  function copyTrackingLink(token: string) {
    const url = `${window.location.origin}/track/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  // Build map markers from trucks with location
  const markers = trucks
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
    }));

  if (loading) {
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
                        Tracking
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deliveries.map((d) => {
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
                        </tr>
                      );
                    })}
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
    </div>
  );
}
