"use client";

import { useState, FormEvent, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, getClientDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { AppUser } from "@/types";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<"/boss" | "/driver" | null>(null);
  const router = useRouter();
  const { firebaseUser } = useAuth();

  // Navigate once auth state has the signed-in user (firebaseUser). We already validated
  // the user doc on this page; auth context will load appUser after we land.
  useEffect(() => {
    if (typeof console !== "undefined" && console.warn && pendingRedirect) {
      console.warn("[DloAuth] login redirect effect", { pendingRedirect, hasFirebaseUser: !!firebaseUser?.uid });
    }
    if (!pendingRedirect || !firebaseUser?.uid) return;
    setPendingRedirect(null);
    router.push(pendingRedirect);
  }, [pendingRedirect, firebaseUser?.uid, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setPendingRedirect(null);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(getClientDb(), "users", cred.user.uid));

      if (!userDoc.exists()) {
        setError("Account not found. Contact your administrator.");
        setLoading(false);
        return;
      }

      const userData = userDoc.data() as AppUser;

      // #region agent log
      const path = userData.role === "boss" ? "/boss" : userData.role === "driver" ? "/driver" : "";
      fetch("http://127.0.0.1:7242/ingest/90433ca3-f8b2-48ed-ba4c-cb0cc7fb2fa2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "login/page.tsx:before-push",
          message: "Login success, waiting for auth context",
          data: { role: userData.role, path, hypothesisId: "H5" },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      if (userData.role === "boss") {
        setPendingRedirect("/boss");
      } else if (userData.role === "driver") {
        setPendingRedirect("/driver");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login failed. Try again.";
      if (message.includes("wrong-password") || message.includes("not-found")) {
        setError("Invalid email or password.");
      } else if (message.includes("too-many-requests")) {
        setError("Too many attempts. Please wait and try again.");
      } else {
        setError("Login failed. Check your credentials.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Dlo Tracker</h1>
            <p className="text-gray-500 mt-1">Water delivery tracking</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Dlo Tracker &middot; Haiti Water Delivery
        </p>
      </div>
    </div>
  );
}
