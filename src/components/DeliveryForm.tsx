"use client";

import { useState, FormEvent } from "react";
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/firebase";
import { Truck } from "@/types";

interface DeliveryFormProps {
  trucks: Truck[];
  onClose: () => void;
}

export default function DeliveryForm({ trucks, onClose }: DeliveryFormProps) {
  const [truckId, setTruckId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const truck = trucks.find((t) => t.id === truckId);
      if (!truck) {
        setError("Please select a truck.");
        setSubmitting(false);
        return;
      }

      const trackingToken = uuidv4();
      const deliveryRef = doc(collection(db, "deliveries"));
      const trackingRef = doc(db, "tracking", trackingToken);

      // Batched write: create both delivery and tracking docs atomically
      const batch = writeBatch(db);

      batch.set(deliveryRef, {
        truckId: truck.id,
        driverId: truck.driverId,
        customerName,
        deliveryAddress,
        status: "pending",
        trackingToken,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(trackingRef, {
        deliveryId: deliveryRef.id,
        truckId: truck.id,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      onClose();
    } catch (err) {
      console.error("Error creating delivery:", err);
      setError("Failed to create delivery. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">New Delivery</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Truck
            </label>
            <select
              required
              value={truckId}
              onChange={(e) => setTruckId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
            >
              <option value="">Select a truck...</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.plateNumber})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Name
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
              placeholder="e.g. Jean-Pierre"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery Address
            </label>
            <input
              type="text"
              required
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
              placeholder="e.g. Rue Capois, Pétion-Ville"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Delivery"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
