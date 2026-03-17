import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const db = getAdminDb();

    // Step 1: Direct doc read -- no query, no index needed
    const trackingSnap = await db.doc(`tracking/${token}`).get();
    if (!trackingSnap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { deliveryId, truckId } = trackingSnap.data()!;

    // Step 2: Parallel fetch of delivery + truck
    const [deliverySnap, truckSnap] = await Promise.all([
      db.doc(`deliveries/${deliveryId}`).get(),
      db.doc(`trucks/${truckId}`).get(),
    ]);

    if (!deliverySnap.exists || !truckSnap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const delivery = deliverySnap.data()!;
    const truck = truckSnap.data()!;

    // Build location response
    const location = truck.location
      ? {
          lat: truck.location.lat,
          lng: truck.location.lng,
          updatedAt: truck.location.updatedAt?.toDate?.()
            ? truck.location.updatedAt.toDate().toISOString()
            : null,
        }
      : null;

    const deliveryLocation =
      delivery.location &&
      typeof delivery.location.lat === "number" &&
      typeof delivery.location.lng === "number"
        ? { lat: delivery.location.lat, lng: delivery.location.lng }
        : undefined;

    // Step 3: Return combined response with no-store cache header
    return NextResponse.json(
      {
        status: delivery.status,
        customerName: delivery.customerName,
        deliveryAddress: delivery.deliveryAddress,
        location,
        ...(deliveryLocation && { deliveryLocation }),
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("Tracking API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
