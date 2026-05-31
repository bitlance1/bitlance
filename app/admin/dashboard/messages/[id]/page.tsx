"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { AdminBackLink, AdminPageHeader, DetailGrid, JsonPanel, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { firebaseDb } from "@/lib/firebase";
import { formatDateTime } from "@/lib/admin-dashboard";

type ChatMessage = {
  id: string;
  senderId?: string;
  senderRole?: string;
  text?: string;
  messageType?: string;
  attachment?: { name?: string; url?: string; size?: string } | null;
  createdAt?: unknown;
};

export default function AdminMessageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [conversation, setConversation] = useState<Record<string, unknown> | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!id) return;
    const unsubConversation = onSnapshot(doc(firebaseDb, "conversations", id), (snap) => setConversation(snap.exists() ? snap.data() : null));
    const unsubMessages = onSnapshot(query(collection(firebaseDb, "conversations", id, "messages"), orderBy("createdAt", "asc")), (snap) =>
      setMessages(snap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ChatMessage, "id">) })))
    );
    return () => {
      unsubConversation();
      unsubMessages();
    };
  }, [id]);

  const clientId = String(conversation?.clientId || "");
  const freelancerId = String(conversation?.freelancerId || "");
  const jobId = String(conversation?.jobId || "");

  const normalizedMessages = useMemo(
    () =>
      messages.map((message) => ({
        ...message,
        side: message.senderId === clientId ? "client" : message.senderId === freelancerId ? "freelancer" : "system",
      })),
    [messages, clientId, freelancerId]
  );

  if (!conversation) {
    return (
      <>
        <AdminBackLink href="/admin/dashboard/messages" />
        <AdminPageHeader eyebrow="Conversation Detail" title="Conversation not found" description="This conversation is missing or still loading." />
      </>
    );
  }

  return (
    <>
      <AdminBackLink href="/admin/dashboard/messages" />
      <AdminPageHeader eyebrow="Conversation Detail" title={String(conversation.jobTitle || "Conversation")} description="Read the full chat as it happened, with payment/work state and linked job context." />
      <DetailGrid
        items={[
          { label: "Client", value: <Link className="text-[#8C4F00]" href={`/admin/dashboard/users/${clientId}`}>{String(conversation.clientName || clientId || "Client")}</Link> },
          { label: "Freelancer", value: <Link className="text-[#8C4F00]" href={`/admin/dashboard/users/${freelancerId}`}>{String(conversation.freelancerName || freelancerId || "Freelancer")}</Link> },
          { label: "Job", value: jobId ? <Link className="text-[#8C4F00]" href={`/admin/dashboard/jobs/${jobId}`}>{String(conversation.jobTitle || jobId)}</Link> : String(conversation.jobTitle || "-") },
          { label: "Payment", value: <StatusPill status={String(conversation.paymentStatus || "unfunded")} /> },
          { label: "Work", value: <StatusPill status={String(conversation.workStatus || "not_started")} /> },
          { label: "Messages", value: messages.length },
        ]}
      />
      <section className="mt-5 rounded-[8px] border border-[#E7E1D8] bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Chat transcript</h2>
            <p className="mt-1 text-xs text-[#6b6762]">Client messages align left, freelancer messages align right, system events stay centered.</p>
          </div>
          <span className="rounded-full bg-[#FFF4E6] px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#8C4F00]">{messages.length} messages</span>
        </div>
        <div className="flex max-h-[680px] flex-col gap-3 overflow-y-auto rounded-[8px] bg-[#F7F6F3] p-4">
          {normalizedMessages.length ? (
            normalizedMessages.map((message) => {
              const isClient = message.side === "client";
              const isFreelancer = message.side === "freelancer";
              return (
                <div key={message.id} className={`flex ${isClient ? "justify-start" : isFreelancer ? "justify-end" : "justify-center"}`}>
                  <div className={`max-w-[78%] rounded-[8px] border px-4 py-3 shadow-sm ${
                    isClient
                      ? "border-[#E7E1D8] bg-white"
                      : isFreelancer
                        ? "border-[#FFD7A8] bg-[#FFF4E6]"
                        : "border-[#DDE7F7] bg-[#EFF6FF] text-center"
                  }`}>
                    <div className="mb-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#8f8780]">
                      {message.senderRole || message.side} | {formatDateTime(message.createdAt as never)}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-[#1a1a1a]">{message.text || "(empty message)"}</p>
                    {message.attachment?.url ? (
                      <a href={message.attachment.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-black text-[#8C4F00]">
                        Attachment: {message.attachment.name || "file"}
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-[8px] border border-dashed border-[#E7E1D8] bg-white px-4 py-10 text-center text-sm text-[#6b6762]">No messages in this conversation yet.</div>
          )}
        </div>
      </section>
      <div className="mt-5">
        <JsonPanel title="Conversation document" data={conversation} />
      </div>
    </>
  );
}
