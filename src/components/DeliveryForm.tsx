"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { getClientAuth } from "@/lib/firebase";
import { Truck, AppUser } from "@/types";

interface DeliveryFormProps {
  trucks: Truck[];
  drivers: AppUser[];
  onClose: () => void;
}

export default function DeliveryForm({ trucks, drivers, onClose }: DeliveryFormProps) {
  const [truckId, setTruckId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [placesEnabled, setPlacesEnabled] = useState(false);

  const addressInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let autocomplete: google.maps.places.Autocomplete | null = null;

    async function initPlaces() {
      if (typeof window === "undefined") return;

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return;
      }

      const setupAutocomplete = () => {
        const input = addressInputRef.current;
        const googleObj = (window as any).google;
        if (!input || !googleObj?.maps?.places) return;

        autocomplete = new googleObj.maps.places.Autocomplete(input, {
          types: ["geocode"],
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete!.getPlace();
          const formatted =
            place.formatted_address || place.name || deliveryAddress;
          const loc = place.geometry?.location;

          if (formatted) {
            setDeliveryAddress(formatted);
          }
          if (loc) {
            setDeliveryLocation({
              lat: loc.lat(),
              lng: loc.lng(),
            });
          }

          setPlacesEnabled(true);
        });

        setPlacesEnabled(true);
      };

      const googleObj = (window as any).google;
      if (googleObj?.maps?.places) {
        setupAutocomplete();
        return;
      }

      const existingScript = document.querySelector<
        HTMLScriptElement
      >('script[data-google-maps="true"]');

      if (existingScript) {
        existingScript.addEventListener("load", setupAutocomplete, {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.dataset.googleMaps = "true";
      script.onload = setupAutocomplete;
      document.head.appendChild(script);
    }

    initPlaces();

    return () => {
      // Leaflet/Places cleans up listeners automatically when the input unmounts.
      autocomplete = null;
    };
  }, [deliveryAddress]);

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
      const driver = drivers.find((d) => d.uid === driverId);
      if (!driver) {
        setError("Please select a driver.");
        setSubmitting(false);
        return;
      }

      const user = getClientAuth().currentUser;
      if (!user) {
        setError("You must be signed in to create a delivery.");
        setSubmitting(false);
        return;
      }

      const idToken = await user.getIdToken();
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          truckId: truck.id,
          driverId: driver.uid,
          customerName,
          deliveryAddress,
          location: deliveryLocation
            ? { lat: deliveryLocation.lat, lng: deliveryLocation.lng }
            : undefined,
          scheduledAt: new Date(scheduledAt).toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message =
          data?.error === "Forbidden: boss role required"
            ? "Only bosses can create deliveries."
            : data?.error === "Token expired"
              ? "Session expired. Please sign in again."
              : data?.error || "Failed to create delivery. Try again.";
        setError(message);
        setSubmitting(false);
        return;
      }

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
              onChange={(e) => {
                const id = e.target.value;
                setTruckId(id);
                const truck = trucks.find((t) => t.id === id);
                if (truck?.driverId && drivers.some((d) => d.uid === truck.driverId)) {
                  setDriverId(truck.driverId);
                }
              }}
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
              Driver
            </label>
            <select
              required
              value={driverId}
              onChange={(e) => {
                const id = e.target.value;
                setDriverId(id);
                const driver = drivers.find((d) => d.uid === id);
                if (driver?.truckId && trucks.some((t) => t.id === driver.truckId)) {
                  setTruckId(driver.truckId);
                }
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
            >
              <option value="">Select a driver...</option>
              {drivers.map((d) => (
                <option key={d.uid} value={d.uid}>
                  {d.name || d.email}
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
              onChange={(e) => {
                setDeliveryAddress(e.target.value);
                setDeliveryLocation(null);
              }}
              ref={addressInputRef}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
              placeholder="e.g. Rue Capois, Pétion-Ville"
            />
            {placesEnabled && (
              <p className="mt-1 text-xs text-gray-500">
                Start typing and choose a suggestion to verify the address and
                capture map coordinates.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scheduled date & time
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
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
