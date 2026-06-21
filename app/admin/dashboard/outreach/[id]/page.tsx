"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { AdminBackLink, AdminPageHeader, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { firebaseDb, firebaseAuth } from "@/lib/firebase";
import { sendUserNotification } from "@/lib/notifications";
import { formatDateTime } from "@/lib/admin-dashboard";
import { Send } from "lucide-react";

type OutreachMessage = {
  id: string;
  senderId: string;
  senderRole: string;
  text: string;
  createdAt?: unknown;
};

type Thread = {
  id: string;
  adminId: string;
  recipientId: string;
  recipientRole: string;
  recipientName: string;
  subject: string;
  status: string;
  unreadByRecipient: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export default function AdminOutreachThreadPage() {
  const { id } = useParams<{ id: string }>();
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [reply, setReply] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    const unsubThread = onSnapshot(doc(firebaseDb, "admin_outreach", id), (snap) => {
      if (snap.exists()) setThread({ id: snap.id, ...(snap.data() as Omit<Thread, "id">) });
    });
    const unsubMessages = onSnapshot(
      query(collection(firebaseDb, "admin_outreach", id, "messages"), orderBy("createdAt", "asc")),
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OutreachMessage, "id">) })))
    );
    return () => { unsubThread(); unsubMessages(); };
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = reply.trim();
    if (!text || !thread) return;
    const admin = firebaseAuth.currentUser;
    if (!admin) return;
    setIsSending(true);
    setError("");
    try {
      await addDoc(collection(firebaseDb, "admin_outreach", id, "messages"), {
        senderId: admin.uid,
        senderRole: "admin",
        text,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(firebaseDb, "admin_outreach", id), {
        lastMessageText: text,
        lastMessageAt: serverTimestamp(),
        unreadByRecipient: true,
        updatedAt: serverTimestamp(),
      });
      void sendUserNotification({
        userId: thread.recipientId,
        title: "New message from Bitlance Support",
        body: text.slice(0, 120),
        url: thread.recipientRole === "client"
          ? "/client/dashboard/admin-inbox"
          : "/freelancer/dashboard/admin-inbox",
        tag: `admin-outreach-reply-${id}`,
      }).catch(console.error);
      setReply("");
    } catch (err) {
      console.error("Reply error:", err);
      setError("Failed to send reply. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  if (!thread) {
    return (
      <>
        <AdminBackLink href="/admin/dashboard/outreach" />
        <AdminPageHeader eyebrow="Direct Outreach" title="Loading…" description="Fetching thread." />
      </>
    );
  }

  return (
    <>
      <AdminBackLink href="/admin/dashboard/outreach" />
      <AdminPageHeader
        eyebrow="Direct Outreach"
        title={thread.subject}
        description={`Thread with ${thread.recipientName} (${thread.recipientRole})`}
      />

      {/* Thread meta */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <StatusPill status={thread.status} />
        <StatusPill status={thread.recipientRole} />
        <span className="text-xs text-[#6b6762]">To: <strong>{thread.recipientName}</strong></span>
        <span className="text-xs text-[#6b6762]">Started: {formatDateTime(thread.createdAt)}</span>
      </div>

      {/* Messages */}
      <div className="flex max-h-[520px] flex-col gap-3 overflow-y-auto rounded-[8px] border border-[#E7E1D8] bg-[#F7F6F3] p-4 shadow-sm mb-4">
        {messages.length ? (
          messages.map((msg) => {
            const isAdmin = msg.senderRole === "admin";
            return (
              <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-[8px] border px-4 py-3 shadow-sm ${
                  isAdmin ? "border-[#FFD7A8] bg-[#FFF4E6]" : "border-[#E7E1D8] bg-white"
                }`}>
                  <div className="mb-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#8f8780]">
                    {isAdmin ? "Admin" : thread.recipientName} · {formatDateTime(msg.createdAt as any)}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-[#1a1a1a]">{msg.text}</p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-sm text-[#6b6762]">No messages yet.</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      <div className="rounded-[8px] border border-[#E7E1D8] bg-white p-4 shadow-sm">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
          rows={4}
          placeholder="Type a reply… (Enter to send, Shift+Enter for new line)"
          className="w-full rounded-[8px] border border-[#E7E1D8] bg-[#FAF8F5] px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#8C4F00]/20 focus:border-[#8C4F00] resize-none"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || !reply.trim()}
            className="flex items-center gap-2 rounded-[8px] bg-[#1a1a1a] px-5 py-2.5 text-sm font-black text-white hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? "Sending…" : <><Send className="h-3.5 w-3.5" /> Send Reply</>}
          </button>
        </div>
      </div>
    </>
  );
}
