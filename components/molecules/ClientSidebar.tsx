"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface ClientSidebarProps {
  active?: string;
  hideMobileToggle?: boolean;
}

const CLIENT_SIDEBAR_ITEMS: SidebarItem[] = [
  {
    label: "Overview",
    href: "/client/dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  // {
  //   label: "Profile",
  //   href: "/client/dashboard/profile",
  //   icon: (
  //     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  //       <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
  //       <circle cx="12" cy="7" r="4" />
  //     </svg>
  //   ),
  // },
  {
    label: "Job Posts",
    href: "/client/dashboard/job-posts",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="16" y2="11" />
        <line x1="8" y1="15" x2="14" y2="15" />
      </svg>
    ),
  },
  {
    label: "Proposals",
    href: "/client/dashboard/proposals",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 8h10M7 12h10M7 16h6" />
      </svg>
    ),
  },
  {
    label: "Contracts",
    href: "/client/dashboard/contracts",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
      </svg>
    ),
  },
  {
    label: "Messages",
    href: "/client/dashboard/messages",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    label: "Payments",
    href: "/client/dashboard/payments",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/client/dashboard/settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.35a1.65 1.65 0 0 0 1.51-1H10a2 2 0 0 1 4 0h.09A1.65 1.65 0 0 0 15.65 4a1.65 1.65 0 0 0 1.82.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 20 8.6a1.65 1.65 0 0 0 1 1.51H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z" />
      </svg>
    ),
  },
  {
    label: "Help",
    href: "/client/dashboard/help",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
];

export default function ClientSidebar({ active = "/client/dashboard", hideMobileToggle = false }: ClientSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [displayName, setDisplayName] = useState("Client");
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [hasUnreadContracts, setHasUnreadContracts] = useState(false);
  const [hasUnreadAdminInbox, setHasUnreadAdminInbox] = useState(false);
  const router = useRouter();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribe = firebaseAuth.onAuthStateChanged((user) => {
      if (!user) {
        if (unsubscribeProfile) unsubscribeProfile();
        setDisplayName("Client");
        setAvatarUrl(null);
        setAvatarLoadFailed(false);
        return;
      }

      setDisplayName(user.displayName ?? "Client");
      setAvatarUrl(user.photoURL ?? null);
      setAvatarLoadFailed(false);

      unsubscribeProfile = onSnapshot(
        doc(firebaseDb, "all_users", user.uid),
        async (allUsersSnap) => {
          try {
            const allData = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
            let clientData: any = {};

            try {
              const clientSnap = await getDoc(doc(firebaseDb, "clients", user.uid));
              clientData = clientSnap.exists() ? (clientSnap.data() as any) : {};
            } catch {
              clientData = {};
            }

            setDisplayName(
              clientData.fullName ??
              allData.fullName ??
              user.displayName ??
              "Client"
            );

            const nextAvatarUrl =
              clientData.avatarUrl ??
              allData.avatarUrl ??
              user.photoURL ??
              null;

            setAvatarUrl(nextAvatarUrl);
            setAvatarLoadFailed(false);
          } catch {
            setDisplayName(user.displayName ?? "Client");
            setAvatarUrl(user.photoURL ?? null);
          }
        },
        () => {
          setDisplayName(user.displayName ?? "Client");
          setAvatarUrl(user.photoURL ?? null);
        }
      );
    });

    return () => {
      unsubscribe();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  useEffect(() => {
    let unsubscribeMessages: (() => void) | undefined;
    let unsubscribeContracts: (() => void) | undefined;
    let unsubscribeAdminInbox: (() => void) | undefined;
    const unsubscribeAuth = firebaseAuth.onAuthStateChanged((user) => {
      if (!user) {
        setHasUnreadMessages(false);
        setHasUnreadContracts(false);
        setHasUnreadAdminInbox(false);
        if (unsubscribeMessages) unsubscribeMessages();
        if (unsubscribeContracts) unsubscribeContracts();
        if (unsubscribeAdminInbox) unsubscribeAdminInbox();
        return;
      }

      const conversationsQuery = query(
        collection(firebaseDb, "conversations"),
        where("clientId", "==", user.uid)
      );
      unsubscribeMessages = onSnapshot(conversationsQuery, (snapshot) => {
        const hasUnread = snapshot.docs.some((docSnap) => {
          const data = docSnap.data() as any;
          return (data.unread?.[user.uid] ?? 0) > 0;
        });
        setHasUnreadMessages(hasUnread);
      }, () => {});

      const contractsQuery = query(
        collection(firebaseDb, "contracts"),
        where("clientId", "==", user.uid),
        where("unreadByClient", "==", true)
      );
      unsubscribeContracts = onSnapshot(contractsQuery, (snapshot) => {
        setHasUnreadContracts(!snapshot.empty);
      }, () => {});

      const adminInboxQuery = query(
        collection(firebaseDb, "admin_outreach"),
        where("recipientId", "==", user.uid),
        where("unreadByRecipient", "==", true)
      );
      unsubscribeAdminInbox = onSnapshot(adminInboxQuery, (snapshot) => {
        setHasUnreadAdminInbox(!snapshot.empty);
      }, () => {});
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeMessages) unsubscribeMessages();
      if (unsubscribeContracts) unsubscribeContracts();
      if (unsubscribeAdminInbox) unsubscribeAdminInbox();
    };
  }, []);

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CL";

  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut(firebaseAuth);
      setIsOpen(false);
      router.push("/login");
    } catch {
      setIsSigningOut(false);
    }
  };

  return (
    <>
      {!isOpen && !hideMobileToggle && (
        <button
          onClick={() => setIsOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-[60] p-2 bg-white rounded-xl border border-[#e7e2dc] shadow-sm text-[#8C4F00]"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[50] lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`
        fixed lg:sticky top-0 left-0 z-50 w-[280px] h-[100vh] bg-[#F5F0EB] flex flex-col px-4 py-8 gap-0 rounded-tr-[48px] rounded-br-[48px] transition-transform duration-300 ease-in-out shadow-sm overflow-y-auto
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
      >
        <button
          onClick={() => setIsOpen(false)}
          className="lg:hidden absolute top-4 right-4 z-[60] p-2 bg-white rounded-xl border border-[#e7e2dc] shadow-sm text-[#8C4F00]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <Link href="/client/dashboard/profile" onClick={() => setIsOpen(false)} className="flex flex-col items-start gap-0.5 mb-10 px-1">
          <div className="w-14 h-14 rounded-full bg-[#e8dfd4] flex items-center justify-center mb-3 overflow-hidden border-2 border-white shadow-md">
            {avatarUrl && !avatarLoadFailed ? (
              <img
                src={avatarUrl}
                alt="Client avatar"
                className="w-full h-full object-cover"
                onError={() => setAvatarLoadFailed(true)}
              />
            ) : (
              <div className="font-bold text-[#8C4F00]">{initials}</div>
            )}
          </div>
          <h3 className="text-base font-black text-[#1a1a1a] leading-tight">{displayName}</h3>
          <p className="text-[11px] font-black text-orange-600 uppercase tracking-widest">Client</p>
        </Link>

        <nav className="flex flex-col gap-1.5 flex-1">
          {CLIENT_SIDEBAR_ITEMS.map((item) => {
            const isActive = active === item.href;
            const showDot =
              (item.label === "Messages" && (hasUnreadMessages || hasUnreadAdminInbox)) ||
              (item.label === "Contracts" && hasUnreadContracts);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
                  isActive ? "bg-white text-[#1a1a1a] shadow-sm" : "text-[#6b6560] hover:bg-white/50 hover:text-[#1a1a1a]"
                }`}
              >
                <span className={isActive ? "text-orange-500" : "text-[#9e9690]"}>
                  {item.icon}
                </span>
                <span className="flex items-center gap-2">
                  {item.label}
                  {showDot ? (
                    <span className="inline-flex h-2 w-2 rounded-full bg-[#F7931A]" />
                  ) : null}
                </span>
              </Link>
            );
          })}
        </nav>

        <Link
          href="/client/dashboard/job-posts"
          onClick={() => setIsOpen(false)}
          className="mt-6 w-full mb-8 rounded-full bg-gradient-to-r from-orange-600 to-orange-400 text-white font-black text-sm py-4 tracking-wide hover:shadow-lg hover:shadow-orange-500/20 transition-all active:scale-95 shadow-md text-center"
        >
          Post a Job
        </Link>

        <div className="flex flex-col gap-1 border-t border-orange-100 pt-6">
          <button
            onClick={handleLogout}
            disabled={isSigningOut}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-[#6b6560] hover:bg-white/50 hover:text-[#1a1a1a] transition-all w-full text-left disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#9e9690]">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {isSigningOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </aside>
    </>
  );
}
