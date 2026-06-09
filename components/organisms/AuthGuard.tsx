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
          // Parallelize the queries to Firestore based on the allowedRole to save a network roundtrip
          const roleCollection = allowedRole === "freelancer" ? "freelancers" : allowedRole === "client" ? "clients" : null;
          
          let userSnap, roleSnap;
          if (roleCollection) {
            const [uSnap, rSnap] = await Promise.all([
              getDoc(doc(firebaseDb, "all_users", user.uid)),
              getDoc(doc(firebaseDb, roleCollection, user.uid))
            ]);
            userSnap = uSnap;
            roleSnap = rSnap;
          } else {
            userSnap = await getDoc(doc(firebaseDb, "all_users", user.uid));
          }

          const userData = userSnap.exists() ? (userSnap.data() as { role?: string }) : {};
          const role = userData.role ?? "";
          
          if (role === allowedRole) {
            if (roleCollection && roleSnap) {
              const roleData = roleSnap.exists() ? (roleSnap.data() as Record<string, any>) : {};

              // Determine if this is a genuinely new account with no profile filled in yet.
              const hasProfileData =
                roleData.onboardingComplete === true ||
                !!roleData.title ||
                !!roleData.bio ||
                !!roleData.companyName ||
                !!roleData.roleTitle ||
                !!roleData.location ||
                (Array.isArray(roleData.skills) && roleData.skills.length > 0);

              if (!hasProfileData) {
                setAllowed(false);
                setChecking(false);
                router.replace(`/${role}/onboarding`);
                return;
              }

              // Existing user — silently backfill the flag so this check is instant next time
              if (!roleData.onboardingComplete) {
                updateDoc(doc(firebaseDb, roleCollection, user.uid), {
                  onboardingComplete: true,
                }).catch(() => undefined);
              }
            }
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FCF9F7]">
        {/* Modern Premium Glassmorphic Loading Card */}
        <div className="relative flex flex-col items-center p-8    max-w-sm w-full mx-4 transition-all duration-300">
          {/* Outer glowing pulsing aura */}
          <div className="absolute inset-0 -z-10  filter blur-xl animate-pulse" />
          
          {/* Custom Modern Gradient Spinner */}
          <div className="relative w-[30px] h-[30px] mb-5">
            {/* Background track */}
            <div className="absolute inset-0 rounded-full border-4 border-[#FF7A50]/10" />
            {/* Spinning active ring */}
            <div className="absolute inset-0 rounded-full border-4 border-t-[#FF7A50] border-r-transparent border-b-transparent border-l-transparent animate-spin duration-700" />
            {/* Inner pulsing core */}
            <div className="absolute inset-2.5 rounded-full bg-gradient-to-tr from-[#FF7A50] to-[#FF9E7D] opacity-10 animate-ping" />
          </div>

          {/* <h3 className="text-[#3d3a37] font-semibold text-base mb-1 tracking-tight">Securing Session</h3>
          <p className="text-[#8c857f] text-xs text-center animate-pulse">Initializing direct connection...</p> */}
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}
