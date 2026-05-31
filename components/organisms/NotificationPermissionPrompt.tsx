"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { firebaseAuth } from "@/lib/firebase";
import {
  listenForForegroundNotifications,
  registerNotificationDevice,
} from "@/lib/notifications";

const STORAGE_KEY = "bitlance-notification-prompt-dismissed";

export default function NotificationPermissionPrompt() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "enabled" | "blocked" | "missing">("idle");

  useEffect(() => {
    const unsubscribeAuth = firebaseAuth.onAuthStateChanged((user) => {
      if (!user || typeof window === "undefined" || !("Notification" in window)) {
        setVisible(false);
        return;
      }

      if (Notification.permission === "granted") {
        setStatus("enabled");
        setVisible(false);
        void registerNotificationDevice();
        return;
      }

      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      setVisible(Notification.permission === "default" && dismissed !== "1");
      setStatus(Notification.permission === "denied" ? "blocked" : "idle");
    });

    let unsubscribeForeground: (() => void) | undefined;
    void listenForForegroundNotifications((payload) => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      const notification = new Notification(payload.title, {
        body: payload.body,
        icon: "/favicon.ico",
        tag: payload.url || payload.title,
      });
      notification.onclick = () => {
        window.focus();
        if (payload.url) window.location.href = payload.url;
      };
    }).then((unsubscribe) => {
      unsubscribeForeground = unsubscribe;
    });

    return () => {
      unsubscribeAuth();
      unsubscribeForeground?.();
    };
  }, []);

  if (!visible) return null;

  const enableNotifications = async () => {
    setStatus("saving");
    const result = await registerNotificationDevice();
    if (result.ok) {
      setStatus("enabled");
      setVisible(false);
      return;
    }
    setStatus(result.reason === "missing-vapid-key" ? "missing" : "blocked");
  };

  const dismiss = () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[120] mx-auto max-w-md rounded-[14px] border border-[#EAE7E2] bg-white p-4 shadow-[0_18px_45px_rgba(26,26,26,0.18)] sm:left-auto sm:right-5">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Close notification prompt"
        className="absolute right-3 top-3 rounded-full p-1 text-[#8f8780] hover:bg-[#F7F4F0]"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-3 pr-7">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF4E6] text-[#8C4F00]">
          <Bell className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[13px] font-black text-[#1a1a1a]">Turn on Bitlance notifications</div>
          <p className="mt-1 text-[12px] leading-5 text-[#6b6762]">
            Get alerts for messages, escrow funding, submitted work, approvals, and change requests even when this tab is closed.
          </p>
          {status === "missing" ? (
            <p className="mt-2 text-[11px] text-[#B42318]">
              Add `NEXT_PUBLIC_FIREBASE_VAPID_KEY` to enable browser push.
            </p>
          ) : null}
          {status === "blocked" ? (
            <p className="mt-2 text-[11px] text-[#B42318]">
              Notifications are blocked. Enable them from your browser site settings.
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={enableNotifications}
              disabled={status === "saving"}
              className="rounded-full bg-[#1a2332] px-4 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-white disabled:opacity-60"
            >
              {status === "saving" ? "Enabling..." : "Allow"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-full border border-[#EAE7E2] bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#6b6762]"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
