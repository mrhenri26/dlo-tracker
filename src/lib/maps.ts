/**
 * Opens Google Maps (or device map app) with the given destination address.
 * Uses the public Google Maps URL scheme; no API key required.
 */
export function openMapsWithDestination(address: string): void {
  if (!address?.trim()) return;
  const encoded = encodeURIComponent(address.trim());
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`;
  window.open(url, "_blank", "noopener,noreferrer");
}
