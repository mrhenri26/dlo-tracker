"use client";

import { DeliveryStatus } from "@/types";

interface TrackingStatusProps {
  status: DeliveryStatus;
  updatedAt?: string;
}

const statusConfig: Record<
  DeliveryStatus,
  { label: string; color: string; bg: string }
> = {
  pending: {
    label: "Pending",
    color: "text-yellow-700",
    bg: "bg-yellow-100",
  },
  en_route: {
    label: "En Route",
    color: "text-blue-700",
    bg: "bg-blue-100",
  },
  delivered: {
    label: "Delivered",
    color: "text-green-700",
    bg: "bg-green-100",
  },
};

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "Unknown";
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function TrackingStatus({
  status,
  updatedAt,
}: TrackingStatusProps) {
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-3">
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.color}`}
      >
        {config.label}
      </span>
      {updatedAt && (
        <span className="text-xs text-gray-400">
          Last update: {timeAgo(updatedAt)}
        </span>
      )}
    </div>
  );
}
