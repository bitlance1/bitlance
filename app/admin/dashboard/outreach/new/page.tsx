"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { AdminBackLink, AdminPageHeader } from "@/components/organisms/AdminDashboardParts";
import { firebaseDb, firebaseAuth } from "@/lib/firebase";
import { sendUserNotification } from "@/lib/notifications";
import { useAdminDashboardData } from "@/lib/admin-dashboard";
import { Search, Send } from "lucide-react";

export default function AdminOutreachNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { users } = useAdminDashboardData();

  // Pre-fill from query params (e.g. when redirected from termination page)
  const [recipientId, setRecipientId] = useState(searchParams.get("recipientId") || "");
  const [recipientRole, setRecipientRole] = useState(searchParams.get("recipientRole") || "client");
  const [recipientName, setRecipientName] = useState(decodeURIComponent(searchParams.get("recipientName") || ""));
  const [subject, setSubject] = useState(decodeURIComponent(searchParams.get("subject") || ""));
  const [message, setMessage] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return false;
    const q = userSearch.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  }).slice(0, 8);

  const selectUser = (u: typeof users[0]) => {
    setRecipientId(u.id);
    setRecipientName(u.fullName);
    setRecipientRole(u.role);
    setUserSearch("");
  };

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    const trimmedSubject = subject.trim();
    if (!recipientId) { setError("Please select a recipient."); return; }
    if (!trimmedSubject) { setError("Please enter a subject."); return; }
    if (!trimmedMessage) { setError("Please write a message."); return; }

    const admin = firebaseAuth.currentUser;
    if (!admin) { setError("You must be logged in as admin."); return; }

    setIsSending(true);
    setError("");
    try {
      // Create the thread
      const threadRef = await addDoc(collection(firebaseDb, "admin_outreach"), {
        adminId: admin.uid,
        recipientId,
        recipientRole,
        recipientName,
        subject: trimmedSubject,
        lastMessageText: trimmedMessage,
        lastMessageAt: serverTimestamp(),
        status: "open",
        unreadByRecipient: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Add first message
      await addDoc(collection(firebaseDb, "admin_outreach", threadRef.id, "messages"), {
        senderId: admin.uid,
        senderRole: "admin",
        text: trimmedMessage,
        createdAt: serverTimestamp(),
      });

      // Notify recipient
      void sendUserNotification({
        userId: recipientId,
        title: "New message from Bitlance Support",
        body: trimmedMessage.slice(0, 120),
        url: recipientRole === "client"
          ? "/client/dashboard/admin-inbox"
          : "/freelancer/dashboard/admin-inbox",
        tag: `admin-outreach-${threadRef.id}`,
      }).catch(console.error);

      router.push(`/admin/dashboard/outreach/${threadRef.id}`);
    } catch (err) {
      console.error("Send outreach error:", err);
      setError("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <AdminBackLink href="/admin/dashboard/outreach" />
      <AdminPageHeader
        eyebrow="Direct Outreach"
        title="New Message"
        description="Compose a direct message to a client or freelancer. They will receive a push notification and can reply from their dashboard."
      />

      <div className="max-w-2xl space-y-5">
        {/* Recipient picker */}
        <div className="rounded-[8px] border border-[#E7E1D8] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#8f8780] mb-4">Recipient</h2>

          {recipientId ? (
            <div className="flex items-center justify-between rounded-[8px] border border-[#E7E1D8] bg-[#FAF8F5] px-4 py-3">
              <div>
                <p className="font-black text-[#1a1a1a]">{recipientName}</p>
                <p className="text-xs text-[#6b6762] mt-0.5">{recipientRole} · {recipientId}</p>
              </div>
              <button
                type="button"
                onClick={() => { setRecipientId(""); setRecipientName(""); setRecipientRole("client"); }}
                className="text-xs font-black text-[#8C4F00] hover:text-[#5f3500]"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8f8780]" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full rounded-[8px] border border-[#E7E1D8] bg-[#FAF8F5] pl-10 pr-4 py-2.5 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#8C4F00]/20 focus:border-[#8C4F00]"
                />
              </div>
              {filteredUsers.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-[8px] border border-[#E7E1D8] bg-white shadow-lg overflow-hidden">
                  {filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => selectUser(u)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#FFF4E6] transition-colors border-b border-[#EFEAE3] last:border-b-0"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF4E6] text-xs font-black text-[#8C4F00]">
                        {u.fullName[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-[#1a1a1a]">{u.fullName}</p>
                        <p className="text-xs text-[#6b6762]">{u.role} · {u.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Subject + message */}
        <div className="rounded-[8px] border border-[#E7E1D8] bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#8f8780]">Message</h2>
          <div>
            <label className="block text-xs font-black uppercase tracking-[0.1em] text-[#8f8780] mb-1.5">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Re: Contract Termination — Project Alpha"
              className="w-full rounded-[8px] border border-[#E7E1D8] bg-[#FAF8F5] px-4 py-2.5 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#8C4F00]/20 focus:border-[#8C4F00]"
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-[0.1em] text-[#8f8780] mb-1.5">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="Write your message here…"
              className="w-full rounded-[8px] border border-[#E7E1D8] bg-[#FAF8F5] px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#8C4F00]/20 focus:border-[#8C4F00] resize-none"
            />
          </div>

          {error && (
            <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-[8px] border border-[#E7E1D8] bg-white px-5 py-2.5 text-sm font-black text-[#6b6762] hover:bg-[#FAF8F5] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending}
              className="flex items-center gap-2 rounded-[8px] bg-[#1a1a1a] px-5 py-2.5 text-sm font-black text-white hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <><svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Sending…</>
              ) : (
                <><Send className="h-3.5 w-3.5" />Send Message</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
