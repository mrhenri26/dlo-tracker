"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, getClientDb } from "./firebase";
import { AppUser } from "@/types";

interface AuthContextType {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  providerId: string;
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  appUser: null,
  loading: true,
  logout: async () => {},
  providerId: "",
});

const AUTH_NULL_DELAY_MS = 250;

export function AuthProvider({ children }: { children: ReactNode }) {
  const providerId = useId();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const justLoggedOutRef = useRef(false);
  const hasSeenUserThisMountRef = useRef(false);
  const nullTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (user) {
        // Cancel any pending null-state timeout so it can't set loading=false
        // while we're still awaiting the Firestore user doc fetch.
        if (nullTimeoutRef.current) {
          clearTimeout(nullTimeoutRef.current);
          nullTimeoutRef.current = null;
        }
        try {
          const userDoc = await getDoc(doc(getClientDb(), "users", user.uid));
          if (userDoc.exists()) {
            setAppUser({ uid: user.uid, ...userDoc.data() } as AppUser);
          } else {
            setAppUser((prev) => (prev?.uid === user.uid ? prev : null));
          }
        } catch (err) {
          setAppUser((prev) => (prev?.uid === user.uid ? prev : null));
        }
      } else {
        // Do NOT clear appUser here. Logs show onAuthStateChanged fires with null
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[DloAuth] auth null received; keeping appUser (clear only on logout)");
        }
        // spuriously (e.g. after getClientDb re-init), which was kicking users out.
        // appUser is cleared only on explicit logout().
        // Explicit logout: set loading false immediately so user sees login right away.
        if (justLoggedOutRef.current) {
          justLoggedOutRef.current = false;
          setLoading(false);
          return;
        }
        // Defer setLoading(false) so persistence can restore user before we show "logged out".
        nullTimeoutRef.current = setTimeout(() => {
          setLoading(false);
          nullTimeoutRef.current = null;
        }, AUTH_NULL_DELAY_MS);
        return;
      }

      setLoading(false);
    });

    return () => {
      if (nullTimeoutRef.current) {
        clearTimeout(nullTimeoutRef.current);
        nullTimeoutRef.current = null;
      }
      unsubscribe();
    };
  }, []);

  const logout = async () => {
    justLoggedOutRef.current = true;
    setAppUser(null);
    await signOut(auth);
    // Don't wait for onAuthStateChanged(null): clear UI state so login shows immediately.
    // The null callback may fire later; setting again is idempotent.
    setFirebaseUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, loading, logout, providerId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
