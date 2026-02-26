"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, getClientDb } from "./firebase";
import { AppUser } from "@/types";

interface AuthContextType {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  appUser: null,
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      // #region agent log
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[DloAuth] onAuthStateChanged", user ? `user=${user.uid}` : "user=null");
      }
      if (!user) {
        fetch("http://127.0.0.1:7242/ingest/90433ca3-f8b2-48ed-ba4c-cb0cc7fb2fa2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "auth-context.tsx:auth-null",
            message: "onAuthStateChanged fired with user=null",
            data: { hypothesisId: "H1" },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
      // #endregion
      if (user) {
        setLoading(true);
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/90433ca3-f8b2-48ed-ba4c-cb0cc7fb2fa2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "auth-context.tsx:before-getDoc",
            message: "Auth user set, about to getDoc users",
            data: { uid: user.uid, hypothesisId: "H1,H2,H4,H5" },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        let userDocExists = false;
        let role = "";
        try {
          const userDoc = await getDoc(doc(getClientDb(), "users", user.uid));
          userDocExists = userDoc.exists();
          if (userDoc.exists()) {
            role = (userDoc.data() as AppUser)?.role ?? "";
            setAppUser({ uid: user.uid, ...userDoc.data() } as AppUser);
          } else {
            setAppUser(null);
          }
        } catch (err) {
          // #region agent log
          fetch("http://127.0.0.1:7242/ingest/90433ca3-f8b2-48ed-ba4c-cb0cc7fb2fa2", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "auth-context.tsx:getDoc-catch",
              message: "getDoc threw",
              data: { uid: user.uid, err: String(err), hypothesisId: "H2,H4" },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          setAppUser(null);
        }
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/90433ca3-f8b2-48ed-ba4c-cb0cc7fb2fa2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "auth-context.tsx:after-getDoc",
            message: "getDoc done, about to setLoading(false)",
            data: { uid: user.uid, userDocExists, role, hypothesisId: "H1,H2,H4,H5" },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
      } else {
        // Do NOT clear appUser here. Logs show onAuthStateChanged fires with null
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[DloAuth] auth null received; keeping appUser (clear only on logout)");
        }
        // spuriously (e.g. after getClientDb re-init), which was kicking users out.
        // appUser is cleared only on explicit logout().
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
    setAppUser(null);
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
