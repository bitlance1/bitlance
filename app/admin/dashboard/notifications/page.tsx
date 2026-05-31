"use client";

import { AdminPageHeader, AdminTable, Metric, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { formatDateTime, useAdminDashboardData } from "@/lib/admin-dashboard";
import { Bell, CheckCircle2, MonitorSmartphone } from "lucide-react";

export default function AdminNotificationsPage() {
  const { tokens } = useAdminDashboardData();
  const granted = tokens.filter((token) => token.permission === "granted").length;

  return (
    <>
      <AdminPageHeader
        eyebrow="Push"
        title="Notifications"
        description="See registered web push devices. A user can only receive notifications after a device token exists here."
      />
      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric icon={<Bell />} label="Tokens" value={tokens.length} detail="Registered push endpoints" />
        <Metric icon={<CheckCircle2 />} label="Granted" value={granted} detail="Devices with notification permission" />
        <Metric icon={<MonitorSmartphone />} label="Platforms" value={new Set(tokens.map((token) => token.platform)).size} detail="Unique platforms" />
      </section>
      <AdminTable
        columns={["Device Token Doc", "User", "Platform", "Permission", "Updated"]}
        rows={tokens.map((token) => ({
          href: `/admin/dashboard/notifications/${token.id}`,
          cells: [
            <code key="id" className="text-xs text-[#6b6762]">{token.id}</code>,
            <code key="user" className="text-xs text-[#6b6762]">{token.userId}</code>,
            <span key="platform" className="font-bold">{token.platform}</span>,
            <StatusPill key="permission" status={token.permission} />,
            <span key="updated" className="text-xs text-[#6b6762]">{formatDateTime(token.updatedAt)}</span>,
          ],
        }))}
      />
    </>
  );
}
