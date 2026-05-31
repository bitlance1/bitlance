"use client";

import { AdminPageHeader, AdminTable, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { formatDateTime, useAdminDashboardData } from "@/lib/admin-dashboard";

export default function AdminMessagesPage() {
  const { conversations } = useAdminDashboardData();

  return (
    <>
      <AdminPageHeader
        eyebrow="Communication"
        title="Messages"
        description="Track all client/freelancer conversations, last message activity, payment state, and work state."
      />
      <AdminTable
        columns={["Conversation", "Participants", "Last Message", "Payment", "Work", "Updated"]}
        rows={conversations.map((conversation) => ({
          href: `/admin/dashboard/messages/${conversation.id}`,
          cells: [
            <div key="conversation">
              <div className="font-black group-hover:text-[#8C4F00]">{conversation.jobTitle}</div>
              <code className="mt-1 block text-xs text-[#6b6762]">{conversation.id}</code>
            </div>,
            <div key="participants" className="text-sm">
              <div><span className="font-black">Client:</span> {conversation.clientName}</div>
              <div className="mt-1"><span className="font-black">Freelancer:</span> {conversation.freelancerName}</div>
            </div>,
            <div key="message" className="max-w-md text-xs text-[#6b6762]">
              <div className="truncate font-semibold text-[#1a1a1a]">{conversation.lastMessage.text || "No messages yet"}</div>
              <div className="mt-1">{formatDateTime(conversation.lastMessage.createdAt)}</div>
            </div>,
            <StatusPill key="payment" status={conversation.paymentStatus} />,
            <StatusPill key="work" status={conversation.workStatus} />,
            <span key="updated" className="text-xs text-[#6b6762]">{formatDateTime(conversation.updatedAt)}</span>,
          ],
        }))}
      />
    </>
  );
}
