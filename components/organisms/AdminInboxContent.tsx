"use client";

import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseDb, firebaseAuth } from "@/lib/firebase";
import { ChevronRight, Send, ShieldCheck } from "lucide-react";

function formatRelative(value: any): string {
  if (!value) return "";
  const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  if (isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Thread = {
  id: string;
  adminId: string;
  subject: string;
  lastMessageText: string;
  lastMessageAt?: any;
  status: string;
  unreadByRecipient: boolean;
  createdAt?: any;
  updatedAt?: any;
};

type Message = {
  id: string;
  senderId: string;
  senderRole: string;
  text: string;
  createdAt?: any;
};

export default function AdminInboxContent({ role }: { role: "client" | "freelancer" }) {
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      setCurrentUid(user?.uid || null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!currentUid) return;
    setLoading(true);
    const unsubThreads = onSnapshot(
      query(
        collection(firebaseDb, "admin_outreach"),
        where("recipientId", "==", currentUid)
      ),
      (snap) => {
        const items: Thread[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Thread, "id">),
        }));
        items.sort((a, b) => {
          const aMs = a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : 0;
          const bMs = b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : 0;
          return bMs - aMs;
        });
        setThreads(items);
        setLoading(false);
        if (items.length && !selectedThreadId) {
          setSelectedThreadId(items[0].id);
        }
      },
      () => setLoading(false)
    );
    return unsubThreads;
  }, [currentUid]);

  // Load messages for selected thread
  useEffect(() => {
    if (!selectedThreadId) return;
    const unsubMessages = onSnapshot(
      query(
        collection(firebaseDb, "admin_outreach", selectedThreadId, "messages"),
        orderBy("createdAt", "asc")
      ),
      (snap) => {
        setMessages(snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Message, "id">),
        })));
      }
    );
    // Mark as read when thread is opened
    const thread = threads.find((t) => t.id === selectedThreadId);
    if (thread?.unreadByRecipient) {
      updateDoc(doc(firebaseDb, "admin_outreach", selectedThreadId), {
        unreadByRecipient: false,
      }).catch(() => {});
    }
    return unsubMessages;
  }, [selectedThreadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = reply.trim();
    if (!text || !selectedThreadId || !currentUid) return;
    setIsSending(true);
    try {
      await addDoc(collection(firebaseDb, "admin_outreach", selectedThreadId, "messages"), {
        senderId: currentUid,
        senderRole: role,
        text,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(firebaseDb, "admin_outreach", selectedThreadId), {
        lastMessageText: text,
        lastMessageAt: serverTimestamp(),
        unreadByRecipient: false,
        updatedAt: serverTimestamp(),
      });
      setReply("");
    } catch (err) {
      console.error("Reply error:", err);
    } finally {
      setIsSending(false);
    }
  };

  const unreadCount = threads.filter((t) => t.unreadByRecipient).length;

  return (
    <section className="w-full min-h-screen">
      {/* Page header */}
      <div className="border-b border-gray-100 px-4 sm:px-6 py-4 sm:py-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-orange-600 mb-1">Support</p>
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Admin Inbox</h1>
        <p className="text-sm text-gray-500 mt-0.5">Messages from the Bitlance support team.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading messages…</div>
      ) : threads.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center px-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 mb-4">
            <ShieldCheck className="h-6 w-6 text-orange-500" />
          </div>
          <p className="font-black text-gray-800 text-lg">No messages yet</p>
          <p className="text-sm text-gray-400 mt-1">The Bitlance support team will reach out here if needed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4 px-3 sm:px-6 py-4">
          {/* Thread list */}
          <div className="space-y-2">
            {unreadCount > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-orange-500" />
                <p className="text-[12px] font-bold text-orange-700">
                  {unreadCount} unread message{unreadCount !== 1 ? "s" : ""}
                </p>
              </div>
            )}
            {threads.map((thread) => {
              const isSelected = selectedThreadId === thread.id;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`w-full rounded-xl border px-4 py-4 text-left transition-all ${
                    isSelected
                      ? "border-orange-300 bg-orange-50/70 ring-1 ring-orange-200"
                      : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-white">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-[13px] font-black text-gray-900">{thread.subject}</p>
                        {thread.unreadByRecipient && (
                          <span className="flex-shrink-0 inline-flex h-2 w-2 rounded-full bg-orange-500 mt-1.5" />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">Bitlance Support</p>
                      <p className="mt-1.5 text-[12px] text-gray-600 line-clamp-2">{thread.lastMessageText}</p>
                      <p className="mt-1 text-[10px] text-gray-400">{formatRelative(thread.updatedAt)}</p>
                    </div>
                    <ChevronRight className={`h-4 w-4 flex-shrink-0 mt-1 ${isSelected ? "text-orange-500" : "text-gray-300"}`} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Thread detail */}
          {selectedThreadId && (
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm flex flex-col overflow-hidden">
              {/* Header */}
              <div className="border-b border-gray-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-white">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-black text-gray-900 text-[15px]">
                      {threads.find((t) => t.id === selectedThreadId)?.subject}
                    </p>
                    <p className="text-[11px] text-gray-400">Bitlance Support Team</p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[480px] bg-[#FAF8F5] p-4">
                {messages.length ? (
                  messages.map((msg) => {
                    const isAdmin = msg.senderRole === "admin";
                    return (
                      <div key={msg.id} className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
                        {isAdmin && (
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-white mr-2 mt-1">
                            <ShieldCheck className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <div className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                          isAdmin
                            ? "bg-white border border-gray-100 shadow-sm"
                            : "bg-gray-900 text-white"
                        }`}>
                          <p className={`text-[11px] font-bold mb-1 ${isAdmin ? "text-orange-600" : "text-gray-300"}`}>
                            {isAdmin ? "Bitlance Support" : "You"} · {formatRelative(msg.createdAt)}
                          </p>
                          <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${isAdmin ? "text-gray-900" : "text-white"}`}>
                            {msg.text}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex items-center justify-center h-32 text-sm text-gray-400">Loading messages…</div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Reply */}
              <div className="border-t border-gray-100 p-4">
                <div className="flex items-end gap-3">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    rows={3}
                    placeholder="Reply to support… (Enter to send)"
                    className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-900 outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-300"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={isSending || !reply.trim()}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
