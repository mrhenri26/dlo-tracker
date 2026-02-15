import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

let watchId: number | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let lastPosition: { lat: number; lng: number } | null = null;

export function startTracking(truckId: string): void {
  if (watchId !== null) return; // Already tracking

  if (!navigator.geolocation) {
    throw new Error("Geolocation is not supported by this browser.");
  }

  // Watch GPS position - browser decides when to fire (usually every 1-3s)
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      lastPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
    },
    (error) => {
      console.error("GPS error:", error.message);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000, // Accept cached position up to 5s old
      timeout: 15000,
    }
  );

  // Write to Firestore every 10 seconds (not on every GPS event)
  const truckRef = doc(db, "trucks", truckId);
  intervalId = setInterval(async () => {
    if (!lastPosition) return;

    try {
      await updateDoc(truckRef, {
        location: {
          lat: lastPosition.lat,
          lng: lastPosition.lng,
          updatedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      // Firestore SDK queues writes when offline automatically
      console.warn("Location write queued (offline?):", err);
    }
  }, 10000);
}

export function stopTracking(): void {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  lastPosition = null;
}

export function isTracking(): boolean {
  return watchId !== null;
}

export function getLastPosition(): { lat: number; lng: number } | null {
  return lastPosition;
}
