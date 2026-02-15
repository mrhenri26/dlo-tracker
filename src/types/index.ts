import { Timestamp } from "firebase/firestore";

export type UserRole = "boss" | "driver";

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  truckId?: string; // only for drivers
  createdAt: Timestamp;
}

export type TruckStatus = "idle" | "on_delivery";

export interface TruckLocation {
  lat: number;
  lng: number;
  updatedAt: Timestamp;
}

export interface Truck {
  id: string;
  name: string;
  plateNumber: string;
  driverId: string;
  location?: TruckLocation;
  status: TruckStatus;
}

export type DeliveryStatus = "pending" | "en_route" | "delivered";

export interface Delivery {
  id: string;
  truckId: string;
  driverId: string;
  customerName: string;
  deliveryAddress: string;
  status: DeliveryStatus;
  trackingToken: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TrackingLink {
  deliveryId: string;
  truckId: string;
  createdAt: Timestamp;
}

export interface TrackingResponse {
  status: DeliveryStatus;
  customerName: string;
  deliveryAddress: string;
  location: {
    lat: number;
    lng: number;
    updatedAt: string;
  } | null;
}
