"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

type AuthGuardProps = {
  children: React.ReactNode;
  redirectTo?: string;
  allowedRole?: "client" | "freelancer" | "admin";
};

export default function AuthGuard({
  children,
  redirectTo = "/login",
  allowedRole,
}: AuthGuardProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged((user) => {
      const run = async () => {
        if (!user) {
          setCurrentUserId(null);
          setAllowed(false);
          setChecking(false);
          router.replace(redirectTo);
          return;
        }

        setCurrentUserId(user.uid);

        const onlineUpdate = async () => {
          const isActive = document.visibilityState === "visible" && document.hasFocus();
          try {
            await setDoc(
              doc(firebaseDb, "all_users", user.uid),
              { online: isActive, lastSeen: serverTimestamp() },
              { merge: true }
            );
          } catch {
            // ignore
          }
        };

        if (!allowedRole) {
          setAllowed(true);
          setChecking(false);
          onlineUpdate();
          return;
        }

        try {
          const userSnap = await getDoc(doc(firebaseDb, "all_users", user.uid));
          const userData = userSnap.exists() ? (userSnap.data() as { role?: string }) : {};
          const role = userData.role ?? "";
          if (role === allowedRole) {
            setAllowed(true);
            setChecking(false);
            onlineUpdate();
            return;
          }

          setAllowed(false);
          setChecking(false);
          if (role === "admin") {
            router.replace("/admin/dashboard");
          } else if (role === "client") {
            router.replace("/client/dashboard");
          } else if (role === "freelancer") {
            router.replace("/freelancer/dashboard");
          } else {
            router.replace(redirectTo);
          }
        } catch {
          setAllowed(false);
          setChecking(false);
          router.replace(redirectTo);
        }
      };
      run();
    });

    return () => unsubscribe();
  }, [router, redirectTo, allowedRole]);

  useEffect(() => {
    if (!currentUserId) return;

    const setOnlineStatus = async (online: boolean) => {
      try {
        await updateDoc(doc(firebaseDb, "all_users", currentUserId), {
          online,
          lastSeen: serverTimestamp(),
        });
      } catch {
        // ignore
      }
    };

    const refreshStatus = () => {
      const isActive = document.visibilityState === "visible" && document.hasFocus();
      setOnlineStatus(isActive);
    };

    const handleVisibilityChange = () => refreshStatus();
    const handleFocus = () => refreshStatus();
    const handleBlur = () => setOnlineStatus(false);
    const handleBeforeUnload = () => setOnlineStatus(false);
    const handlePageHide = () => setOnlineStatus(false);

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);

    refreshStatus();
    const interval = window.setInterval(refreshStatus, 30000);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
      window.clearInterval(interval);
      setOnlineStatus(false);
    };
  }, [currentUserId]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FCF9F7] text-[#6b6762] text-sm">
        Checking session...
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}
