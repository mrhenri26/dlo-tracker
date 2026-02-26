#!/usr/bin/env node
/**
 * Verifies that .env.local Firebase config points to one consistent project.
 * Does not print any secret values.
 */
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");

if (!fs.existsSync(envPath)) {
  console.error("❌ .env.local not found. Create it from .env.local.example and add your Firebase credentials.");
  process.exit(1);
}

const raw = fs.readFileSync(envPath, "utf8");
const vars = {};
for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim();
  if (value) vars[key] = value;
}

const clientProjectId = vars.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const adminProjectId = vars.FIREBASE_PROJECT_ID;

const requiredClient = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];
const requiredAdmin = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];

const missingClient = requiredClient.filter((k) => !vars[k]);
const missingAdmin = requiredAdmin.filter((k) => !vars[k]);

if (missingClient.length) {
  console.error("❌ Missing client env vars:", missingClient.join(", "));
}
if (missingAdmin.length) {
  console.error("❌ Missing admin env vars:", missingAdmin.join(", "));
}
if (missingClient.length || missingAdmin.length) {
  process.exit(1);
}

if (clientProjectId !== adminProjectId) {
  console.error("❌ Project ID mismatch:");
  console.error("   NEXT_PUBLIC_FIREBASE_PROJECT_ID and FIREBASE_PROJECT_ID must be the same.");
  console.error("   Your dev server and API routes must use the same Firebase project you seeded.");
  process.exit(1);
}

console.log("✅ Firebase project check passed:");
console.log("   Client and Admin config both use the same project ID.");
console.log("   Make sure this is the project where you created users and seeded data (Firebase Console).");
process.exit(0);
