"use client";

import { firebaseAuth } from "@/lib/firebase";

export type NotificationPayload = {
  userId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function sendUserNotification(payload: NotificationPayload): Promise<boolean> {
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
      console.warn(data?.error || "Unable to send email notification.");
    }
    return false;
  }

  return true;
}
