"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { AdminBackLink, AdminPageHeader, DetailGrid, JsonPanel, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { firebaseDb } from "@/lib/firebase";
import { formatDateTime } from "@/lib/admin-dashboard";

export default function AdminNotificationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [token, setToken] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(firebaseDb, "notification_tokens", id), (snap) => setToken(snap.exists() ? snap.data() : null));
  }, [id]);

  if (!token) {
    return (
      <>
        <AdminBackLink href="/admin/dashboard/notifications" />
        <AdminPageHeader eyebrow="Notification Device" title="Device token not found" description="This notification token is missing or still loading." />
      </>
    );
  }

  return (
    <>
      <AdminBackLink href="/admin/dashboard/notifications" />
      <AdminPageHeader eyebrow="Notification Device" title={String(token.platform || "Web device")} description="Inspect the registered push endpoint metadata for this browser/device." />
      <DetailGrid
        items={[
          { label: "User", value: <Link className="text-[#8C4F00]" href={`/admin/dashboard/users/${token.userId}`}>{String(token.userId || "Unknown user")}</Link> },
          { label: "Permission", value: <StatusPill status={String(token.permission || "unknown")} /> },
          { label: "Platform", value: String(token.platform || "web") },
          { label: "Updated", value: formatDateTime(token.updatedAt as never) },
          { label: "Created", value: formatDateTime(token.createdAt as never) },
          { label: "User agent", value: <span className="text-xs">{String(token.userAgent || "-")}</span> },
        ]}
      />
      <div className="mt-5">
        <JsonPanel title="Notification token document" data={{ ...token, token: token.token ? "[hidden in admin UI]" : undefined }} />
      </div>
    </>
  );
}
