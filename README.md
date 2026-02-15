# Dlo Tracker - Water Delivery Tracking MVP

Live GPS tracking for water delivery trucks in Haiti. The boss sees all trucks on a map, drivers share their GPS, and customers follow their delivery via a shareable link.

## Tech Stack

- **Next.js 14** (App Router) with TypeScript
- **Firebase Auth** (email/password login)
- **Cloud Firestore** (real-time database with offline support)
- **Leaflet + OpenStreetMap** (free maps, no API key)
- **Tailwind CSS** (styling)

## Quick Start

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Enable **Authentication** > Sign-in method > **Email/Password**.
3. Enable **Cloud Firestore** (start in test mode, then deploy rules below).
4. Go to **Project Settings** > **General** > scroll to "Your apps" > click **Web** (`</>`) > register app > copy the config values.
5. Go to **Project Settings** > **Service accounts** > **Generate new private key** > download the JSON.

### 2. Environment Variables

Copy the example env file and fill in your Firebase credentials:

```bash
cp .env.local.example .env.local
```

Fill in:
- `NEXT_PUBLIC_FIREBASE_*` values from step 4 above
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` from the service account JSON (step 5)

### 3. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Seed Initial Data

Since this is an MVP, users are created manually:

**Create users in Firebase Console > Authentication > Add user:**
- Boss: `boss@dlo.ht` / (your password)
- Driver: `driver1@dlo.ht` / (your password)

**Create user docs in Firestore > `users` collection:**

Document ID = the user's UID from Authentication.

Boss document:
```json
{
  "email": "boss@dlo.ht",
  "name": "Boss",
  "role": "boss",
  "createdAt": (server timestamp)
}
```

Driver document:
```json
{
  "email": "driver1@dlo.ht",
  "name": "Jean",
  "role": "driver",
  "truckId": "truck1",
  "createdAt": (server timestamp)
}
```

**Create a truck in Firestore > `trucks` collection:**

Document ID: `truck1`
```json
{
  "name": "Camion 1",
  "plateNumber": "AA-1234",
  "driverId": "(driver's UID from Authentication)",
  "status": "idle"
}
```

### 5. Deploy Firestore Security Rules

Copy the rules from `firestore.rules` into **Firestore > Rules** in the Firebase Console, then click **Publish**.

### 6. Deploy to Vercel

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com) > New Project > Import your repo.
3. Add the environment variables from `.env.local` in Vercel's project settings.
4. Deploy. Done.

## How It Works

### Boss (`/boss`)
- Sees all trucks on a live map (green = idle, blue = en route)
- Creates deliveries and assigns them to trucks
- Copies tracking links to send to customers via WhatsApp

### Driver (`/driver`)
- Sees their current delivery
- Presses "Start Tracking" to share GPS location
- Location updates every 10 seconds
- Presses "Mark Delivered" when done

### Customer (`/track/[token]`)
- Opens the link from WhatsApp (no login needed)
- Sees truck location on a map
- Sees delivery status and last update time

## Firestore Collections

| Collection | Purpose |
|---|---|
| `users/{uid}` | User profiles with role (boss/driver) |
| `trucks/{truckId}` | Truck info + live GPS location |
| `deliveries/{id}` | Delivery details + status |
| `tracking/{token}` | Maps tracking tokens to delivery + truck IDs |

## Offline & Battery

- Firestore SDK automatically queues writes when offline
- GPS updates are buffered in memory, written to Firestore every 10 seconds
- Customer page polls every 10 seconds and shows "connection lost" banner if offline
