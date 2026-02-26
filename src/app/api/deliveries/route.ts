import { NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    if (!idToken) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const db = getAdminDb();
    const userSnap = await db.doc(`users/${uid}`).get();
    const role = userSnap.exists ? userSnap.data()?.role : null;
    if (role !== "boss") {
      return NextResponse.json(
        { error: "Forbidden: boss role required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      truckId,
      driverId,
      customerName,
      deliveryAddress,
      location,
      latitude,
      longitude,
      scheduledAt: scheduledAtInput,
    } = body;
    if (
      !truckId ||
      !driverId ||
      typeof customerName !== "string" ||
      typeof deliveryAddress !== "string"
    ) {
      return NextResponse.json(
        { error: "Missing or invalid truckId, driverId, customerName, or deliveryAddress" },
        { status: 400 }
      );
    }

    const trackingToken = uuidv4();
    const deliveryRef = db.collection("deliveries").doc();
    const trackingRef = db.doc(`tracking/${trackingToken}`);
    const now = FieldValue.serverTimestamp();

    const batch = db.batch();

    let deliveryLocation: { lat: number; lng: number } | null = null;
    if (
      location &&
      typeof location.lat === "number" &&
      typeof location.lng === "number"
    ) {
      deliveryLocation = {
        lat: location.lat,
        lng: location.lng,
      };
    } else if (
      typeof latitude === "number" &&
      typeof longitude === "number"
    ) {
      deliveryLocation = {
        lat: latitude,
        lng: longitude,
      };
    }

    const deliveryData: Record<string, unknown> = {
      truckId,
      driverId,
      customerName: customerName.trim(),
      deliveryAddress: deliveryAddress.trim(),
      status: "pending",
      trackingToken,
      createdAt: now,
      updatedAt: now,
    };

    if (deliveryLocation) {
      deliveryData.location = deliveryLocation;
    }

    if (scheduledAtInput != null) {
      let scheduledAt: Timestamp | null = null;
      if (typeof scheduledAtInput === "string") {
        const d = new Date(scheduledAtInput);
        if (!Number.isNaN(d.getTime())) {
          scheduledAt = Timestamp.fromDate(d);
        }
      } else if (typeof scheduledAtInput === "number" && scheduledAtInput > 0) {
        scheduledAt = Timestamp.fromMillis(scheduledAtInput);
      }
      if (scheduledAt) {
        deliveryData.scheduledAt = scheduledAt;
      }
    }

    batch.set(deliveryRef, deliveryData);
    batch.set(trackingRef, {
      deliveryId: deliveryRef.id,
      truckId,
      createdAt: now,
    });

    await batch.commit();

    return NextResponse.json(
      { deliveryId: deliveryRef.id, trackingToken },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "auth/id-token-expired") {
      return NextResponse.json({ error: "Token expired" }, { status: 401 });
    }
    console.error("Create delivery API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
