"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { appUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!appUser) {
      router.replace("/login");
    } else if (appUser.role === "boss") {
      router.replace("/boss");
    } else if (appUser.role === "driver") {
      router.replace("/driver");
    }
  }, [appUser, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg text-gray-500">Loading...</div>
    </div>
  );
}
