"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminPageHeader, AdminTable, Metric, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { formatDateTime, useAdminDashboardData } from "@/lib/admin-dashboard";
import { MessageSquare, Send, User } from "lucide-react";

export default function AdminOutreachPage() {
  const { outreachThreads, users } = useAdminDashboardData();
  const router = useRouter();

  const open = outreachThreads.filter((t) => t.status === "open");
  const unread = outreachThreads.filter((t) => t.unreadByRecipient);

  return (
    <>
      <AdminPageHeader
        eyebrow="Communication"
        title="Direct Outreach"
        description="Send and manage direct admin messages to clients and freelancers. All threads are tracked here."
        action={
          <button
            type="button"
            onClick={() => router.push("/admin/dashboard/outreach/new")}
            className="flex items-center gap-2 rounded-[8px] bg-[#1a1a1a] px-4 py-2.5 text-sm font-black text-white hover:bg-black transition-colors"
          >
            <Send className="h-4 w-4" />
            New Message
          </button>
        }
      />
      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric icon={<MessageSquare />} label="Total Threads" value={outreachThreads.length} detail="All time" />
        <Metric icon={<Send />} label="Open" value={open.length} detail="Active conversations" />
        <Metric icon={<User />} label="Awaiting Reply" value={unread.length} detail="Unread by recipient" />
      </section>

      <AdminTable
        columns={["Recipient", "Role", "Subject", "Last Message", "Status", "Updated"]}
        empty="No outreach threads yet. Click 'New Message' to start one."
        rows={outreachThreads
          .sort((a, b) => {
            const at = a.updatedAt as any;
            const bt = b.updatedAt as any;
            const aMs = at?.seconds ? at.seconds * 1000 : at ? new Date(at).getTime() : 0;
            const bMs = bt?.seconds ? bt.seconds * 1000 : bt ? new Date(bt).getTime() : 0;
            return bMs - aMs;
          })
          .map((thread) => ({
            href: `/admin/dashboard/outreach/${thread.id}`,
            cells: [
              <div key="recipient">
                <div className="font-black group-hover:text-[#8C4F00]">{thread.recipientName}</div>
                <code className="mt-1 block text-xs text-[#6b6762]">{thread.recipientId}</code>
              </div>,
              <StatusPill key="role" status={thread.recipientRole} />,
              <div key="subject" className="font-semibold text-sm">{thread.subject}</div>,
              <div key="last" className="max-w-xs text-xs text-[#6b6762] truncate">
                {thread.lastMessageText || "No messages yet"}
              </div>,
              <div key="status" className="flex items-center gap-2">
                <StatusPill status={thread.status} />
                {thread.unreadByRecipient && (
                  <span className="inline-flex h-2 w-2 rounded-full bg-orange-500" title="Unread by recipient" />
                )}
              </div>,
              <span key="updated" className="text-xs text-[#6b6762]">{formatDateTime(thread.updatedAt)}</span>,
            ],
          }))}
      />
    </>
  );
}
