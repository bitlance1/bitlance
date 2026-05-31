"use client";

import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseApp, firebaseAuth, firebaseDb } from "@/lib/firebase";

export type PushNotificationPayload = {
  userId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

const getTokenDocId = (uid: string, token: string) =>
  `${uid}_${token.slice(0, 18).replace(/[^a-zA-Z0-9_-]/g, "")}`;

export async function registerNotificationDevice() {
  if (typeof window === "undefined") return { ok: false, reason: "server" };
  if (!("Notification" in window)) return { ok: false, reason: "unsupported" };
  if (!("serviceWorker" in navigator)) return { ok: false, reason: "no-service-worker" };
  if (!VAPID_KEY) return { ok: false, reason: "missing-vapid-key" };

  const user = firebaseAuth.currentUser;
  if (!user) return { ok: false, reason: "signed-out" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: permission };

  const supported = await isSupported();
  if (!supported) return { ok: false, reason: "unsupported" };

  await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const registration = await navigator.serviceWorker.ready;
  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) return { ok: false, reason: "no-token" };

  await setDoc(
    doc(firebaseDb, "notification_tokens", getTokenDocId(user.uid, token)),
    {
      userId: user.uid,
      token,
      userAgent: navigator.userAgent,
      permission: "granted",
      platform: "web",
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true, token };
}

export async function unregisterNotificationDevice() {
  const supported = typeof window !== "undefined" ? await isSupported() : false;
  if (!supported) return;
  const messaging = getMessaging(firebaseApp);
  await deleteToken(messaging).catch(() => {});
}

export async function sendUserNotification(payload: PushNotificationPayload) {
  if (!payload.userId) return false;
  const idToken = await firebaseAuth.currentUser?.getIdToken().catch(() => null);
  if (!idToken) return false;

  const response = await fetch("/api/notifications/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    if (process.env.NODE_ENV !== "production") {
      console.warn(data?.error || "Unable to send notification.");
    }
    return false;
  }
  return true;
}

export async function listenForForegroundNotifications(
  onReceive: (payload: { title: string; body: string; url?: string }) => void
) {
  const supported = typeof window !== "undefined" ? await isSupported() : false;
  if (!supported) return () => {};
  const messaging = getMessaging(firebaseApp);
  return onMessage(messaging, (payload) => {
    onReceive({
      title: payload.notification?.title || payload.data?.title || "Bitlance",
      body: payload.notification?.body || payload.data?.body || "You have a new update.",
      url: payload.data?.url,
    });
  });
}
