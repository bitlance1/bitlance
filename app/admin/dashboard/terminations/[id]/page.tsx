"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  AdminBackLink,
  AdminPageHeader,
  DetailGrid,
  JsonPanel,
  Panel,
  StatusPill,
} from "@/components/organisms/AdminDashboardParts";
import { firebaseDb, firebaseAuth } from "@/lib/firebase";
import { formatDateTime, formatSats, type FirestoreDate } from "@/lib/admin-dashboard";
import { sendUserNotification } from "@/lib/notifications";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  User,
  XCircle,
  Zap,
} from "lucide-react";

type TerminationRequest = {
  id: string;
  contractId: string;
  contractTitle: string;
  clientId: string;
  clientName: string;
  clientLightningAddress: string;
  freelancerId: string;
  freelancerName: string;
  jobId: string;
  reason: string;
  remainingEscrowSats: number;
  escrowFundedTotalSats: number;
  escrowReleasedSats: number;
  status: "pending" | "approved" | "rejected";
  adminNote: string;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
};

type ChatMessage = {
  id: string;
  senderId?: string;
  senderRole?: string;
  text?: string;
  messageType?: string;
  attachment?: { name?: string; url?: string } | null;
  createdAt?: FirestoreDate;
};

export default function AdminTerminationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<TerminationRequest | null>(null);
  const [contract, setContract] = useState<Record<string, unknown> | null>(null);
  const [job, setJob] = useState<Record<string, unknown> | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [adminNote, setAdminNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [refundStatus, setRefundStatus] = useState<"idle" | "processing" | "done" | "error">("idle");

  // Load termination request
  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(firebaseDb, "termination_requests", id), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;
      const rawStatus = String(data.status ?? "pending");
      const status = rawStatus === "approved" ? "approved" : rawStatus === "rejected" ? "rejected" : "pending";
      setRequest({ id: snap.id, ...data, status } as TerminationRequest);
      setAdminNote(data.adminNote || "");
    });
  }, [id]);

  // Load contract once request is known
  useEffect(() => {
    if (!request?.contractId) return;
    return onSnapshot(doc(firebaseDb, "contracts", request.contractId), (snap) => {
      setContract(snap.exists() ? snap.data() : null);
    });
  }, [request?.contractId]);

  // Load job
  useEffect(() => {
    if (!request?.jobId) return;
    getDoc(doc(firebaseDb, "jobs", request.jobId)).then((snap) => {
      setJob(snap.exists() ? snap.data() : null);
    }).catch(() => {});
  }, [request?.jobId]);

  // Load conversation messages
  useEffect(() => {
    if (!request?.contractId) return;
    const conversationId = request.jobId && request.freelancerId
      ? `${request.jobId}_${request.freelancerId}`
      : request.contractId;
    const unsubMessages = onSnapshot(
      query(collection(firebaseDb, "conversations", conversationId, "messages"), orderBy("createdAt", "asc")),
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, "id">) }))),
      () => {}
    );
    return unsubMessages;
  }, [request?.contractId, request?.jobId, request?.freelancerId]);

  const handleApprove = async () => {
    if (!request || isProcessing) return;
    setIsProcessing(true);
    setActionError("");
    setActionSuccess("");
    try {
      const remaining = request.remainingEscrowSats;

      // 1. Update termination request
      await updateDoc(doc(firebaseDb, "termination_requests", id), {
        status: "approved",
        adminNote,
        updatedAt: serverTimestamp(),
      });

      // 2. Update contract
      await setDoc(doc(firebaseDb, "contracts", request.contractId), {
        status: "Terminated",
        terminationStatus: "approved",
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // 3. If there's remaining escrow, create refund record
      if (remaining > 0 && request.clientLightningAddress) {
        setRefundStatus("processing");
        try {
          const res = await fetch("/api/send-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lightningAddress: request.clientLightningAddress,
              amount: remaining,
              memo: `Escrow refund for terminated contract: ${request.contractTitle}`,
            }),
          });
          const data = await res.json() as any;
          if (!res.ok) throw new Error(data?.error || "Payment failed");
          // Record refund
          await setDoc(doc(firebaseDb, "refunds", request.contractId), {
            contractId: request.contractId,
            terminationRequestId: id,
            recipientId: request.clientId,
            recipientRole: "client",
            lightningAddress: request.clientLightningAddress,
            amountSats: remaining,
            status: "released",
            releasedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          });
          setRefundStatus("done");
        } catch (refundErr) {
          console.error("Refund error:", refundErr);
          setRefundStatus("error");
          // Record as pending even if payment call failed
          await setDoc(doc(firebaseDb, "refunds", request.contractId), {
            contractId: request.contractId,
            terminationRequestId: id,
            recipientId: request.clientId,
            recipientRole: "client",
            lightningAddress: request.clientLightningAddress,
            amountSats: remaining,
            status: "pending_release",
            createdAt: serverTimestamp(),
          });
        }
      }

      // 4. Notify both parties
      void sendUserNotification({
        userId: request.clientId,
        title: "Contract termination approved",
        body: `Your request to terminate "${request.contractTitle}" has been approved by admin.${remaining > 0 ? ` A refund of ${remaining.toLocaleString()} sats has been initiated to your Lightning address.` : ""}`,
        url: "/client/dashboard/contracts",
        tag: `termination-approved-${request.contractId}`,
      }).catch(console.error);

      void sendUserNotification({
        userId: request.freelancerId,
        title: "Contract terminated",
        body: `The contract "${request.contractTitle}" has been terminated by admin review. Please check your dashboard for details.`,
        url: "/freelancer/dashboard/contracts",
        tag: `termination-approved-freelancer-${request.contractId}`,
      }).catch(console.error);

      setActionSuccess("Contract termination approved. Both parties have been notified.");
    } catch (err) {
      console.error("Approve termination error:", err);
      setActionError(err instanceof Error ? err.message : "Failed to approve termination. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!request || isProcessing) return;
    setIsProcessing(true);
    setActionError("");
    setActionSuccess("");
    try {
      await updateDoc(doc(firebaseDb, "termination_requests", id), {
        status: "rejected",
        adminNote,
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(firebaseDb, "contracts", request.contractId), {
        terminationStatus: "rejected",
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // Notify client
      void sendUserNotification({
        userId: request.clientId,
        title: "Contract termination request rejected",
        body: `Your request to terminate "${request.contractTitle}" has been reviewed and declined.${adminNote ? ` Admin note: ${adminNote}` : ""}`,
        url: "/client/dashboard/contracts",
        tag: `termination-rejected-${request.contractId}`,
      }).catch(console.error);

      setActionSuccess("Termination request rejected. The client has been notified.");
    } catch (err) {
      console.error("Reject termination error:", err);
      setActionError(err instanceof Error ? err.message : "Failed to reject request. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const openOutreach = (role: "client" | "freelancer") => {
    const userId = role === "client" ? request?.clientId : request?.freelancerId;
    const name = role === "client" ? request?.clientName : request?.freelancerName;
    router.push(
      `/admin/dashboard/outreach/new?recipientId=${userId}&recipientRole=${role}&recipientName=${encodeURIComponent(name ?? "")}&subject=${encodeURIComponent(`Re: Contract Termination — ${request?.contractTitle ?? ""}`)}`
    );
  };

  if (!request) {
    return (
      <>
        <AdminBackLink href="/admin/dashboard/terminations" />
        <AdminPageHeader eyebrow="Termination Detail" title="Loading…" description="Fetching termination request." />
      </>
    );
  }

  const remainingEscrow = request.remainingEscrowSats;
  const conversationId = request.jobId && request.freelancerId
    ? `${request.jobId}_${request.freelancerId}`
    : request.contractId;

  return (
    <>
      <AdminBackLink href="/admin/dashboard/terminations" />
      <AdminPageHeader
        eyebrow="Termination Request"
        title={request.contractTitle}
        description="Review the full request context, contract state, escrow balance, and chat history before taking action."
      />

      {/* Status banner */}
      {request.status !== "pending" && (
        <div className={`mb-5 flex items-center gap-3 rounded-[8px] border px-4 py-3 ${
          request.status === "approved"
            ? "border-green-200 bg-green-50"
            : "border-red-200 bg-red-50"
        }`}>
          {request.status === "approved"
            ? <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            : <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          }
          <p className={`text-sm font-bold ${request.status === "approved" ? "text-green-700" : "text-red-700"}`}>
            This request has been {request.status}.
            {request.adminNote ? ` Admin note: "${request.adminNote}"` : ""}
          </p>
        </div>
      )}

      {/* Key details */}
      <DetailGrid
        items={[
          { label: "Status", value: <StatusPill status={request.status} /> },
          { label: "Contract", value: <Link className="text-[#8C4F00]" href={`/admin/dashboard/contracts/${request.contractId}`}>{request.contractTitle}</Link> },
          { label: "Job", value: request.jobId ? <Link className="text-[#8C4F00]" href={`/admin/dashboard/jobs/${request.jobId}`}>{String(job?.title || request.jobId)}</Link> : "—" },
          { label: "Client", value: <Link className="text-[#8C4F00]" href={`/admin/dashboard/users/${request.clientId}`}>{request.clientName}</Link> },
          { label: "Freelancer", value: <Link className="text-[#8C4F00]" href={`/admin/dashboard/users/${request.freelancerId}`}>{request.freelancerName}</Link> },
          { label: "Escrow Funded", value: formatSats(request.escrowFundedTotalSats) },
          { label: "Escrow Released", value: formatSats(request.escrowReleasedSats) },
          {
            label: "Remaining Escrow",
            value: (
              <span className={remainingEscrow > 0 ? "text-amber-700 font-black" : "text-gray-500"}>
                {formatSats(remainingEscrow)}{remainingEscrow > 0 ? " — refundable to client" : ""}
              </span>
            ),
          },
          {
            label: "Client Lightning Address",
            value: request.clientLightningAddress ? (
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                {request.clientLightningAddress}
              </span>
            ) : <span className="text-red-600 font-bold">Not set — manual refund needed</span>,
          },
          { label: "Requested", value: formatDateTime(request.createdAt) },
        ]}
      />

      {/* Termination reason */}
      <div className="mt-5 rounded-[8px] border border-[#E7E1D8] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Client's Reason</h2>
        <p className="mt-1 text-xs text-[#6b6762]">Provided by the client when submitting the request.</p>
        <div className="mt-4 rounded-[8px] bg-[#FAF8F5] p-4 text-sm text-[#1a1a1a] leading-6 whitespace-pre-wrap">
          {request.reason || "No reason provided."}
        </div>
      </div>

      {/* Contract snapshot */}
      {contract && (
        <div className="mt-5 rounded-[8px] border border-[#E7E1D8] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Contract Snapshot</h2>
          <p className="mt-1 text-xs text-[#6b6762]">Live contract state at the time of review.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {[
              { label: "Status", value: <StatusPill status={String(contract.status || "unknown")} /> },
              { label: "Payment", value: <StatusPill status={String(contract.paymentStatus || "unfunded")} /> },
              { label: "Work", value: <StatusPill status={String(contract.workStatus || "not_started")} /> },
              { label: "Budget", value: String(contract.budget || "—") },
              { label: "Start Date", value: String(contract.startDate || "—") },
              { label: "Due Date", value: String(contract.dueDate || "—") },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-[8px] border border-[#EFEAE3] bg-[#FAF8F5] p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8f8780]">{label}</div>
                <div className="mt-2 break-words text-sm font-bold text-[#1a1a1a]">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat transcript */}
      <div className="mt-5 rounded-[8px] border border-[#E7E1D8] bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Chat Transcript</h2>
            <p className="mt-1 text-xs text-[#6b6762]">Full conversation between client and freelancer for context.</p>
          </div>
          <Link
            href={`/admin/dashboard/messages/${conversationId}`}
            className="flex items-center gap-1.5 rounded-[8px] border border-[#E7E1D8] px-3 py-2 text-xs font-black text-[#8C4F00] hover:bg-[#FFF4E6]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Full Chat
          </Link>
        </div>
        <div className="flex max-h-[400px] flex-col gap-2.5 overflow-y-auto rounded-[8px] bg-[#F7F6F3] p-3">
          {messages.length ? (
            messages.slice(-30).map((msg) => {
              const isClient = msg.senderId === request.clientId;
              const isFreelancer = msg.senderId === request.freelancerId;
              return (
                <div key={msg.id} className={`flex ${isClient ? "justify-start" : isFreelancer ? "justify-end" : "justify-center"}`}>
                  <div className={`max-w-[80%] rounded-[8px] border px-3 py-2.5 shadow-sm ${
                    isClient ? "border-[#E7E1D8] bg-white" : isFreelancer ? "border-[#FFD7A8] bg-[#FFF4E6]" : "border-[#DDE7F7] bg-[#EFF6FF] text-center"
                  }`}>
                    <div className="mb-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#8f8780]">
                      {isClient ? "Client" : isFreelancer ? "Freelancer" : "System"} · {formatDateTime(msg.createdAt as any)}
                    </div>
                    <p className="whitespace-pre-wrap text-xs leading-5 text-[#1a1a1a]">{msg.text || "(empty)"}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-sm text-[#6b6762]">No messages found.</div>
          )}
        </div>
      </div>

      {/* Reach out to parties */}
      <div className="mt-5 rounded-[8px] border border-[#E7E1D8] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Reach Out</h2>
        <p className="mt-1 text-xs text-[#6b6762]">Send a direct message to the client or freelancer before making a decision.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => openOutreach("client")}
            className="flex items-center gap-2 rounded-[8px] border border-[#E7E1D8] bg-white px-4 py-2.5 text-sm font-black text-[#1a1a1a] hover:bg-[#FAF8F5] transition-colors"
          >
            <User className="h-4 w-4 text-[#8C4F00]" />
            Message Client ({request.clientName})
          </button>
          <button
            type="button"
            onClick={() => openOutreach("freelancer")}
            className="flex items-center gap-2 rounded-[8px] border border-[#E7E1D8] bg-white px-4 py-2.5 text-sm font-black text-[#1a1a1a] hover:bg-[#FAF8F5] transition-colors"
          >
            <MessageSquare className="h-4 w-4 text-[#8C4F00]" />
            Message Freelancer ({request.freelancerName})
          </button>
        </div>
      </div>

      {/* Admin action panel */}
      {request.status === "pending" && (
        <div className="mt-5 rounded-[8px] border border-[#E7E1D8] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Admin Decision</h2>
          <p className="mt-1 text-xs text-[#6b6762]">Add an optional note before approving or rejecting this request.</p>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-[0.12em] text-[#8f8780] mb-2">Admin Note (optional)</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={3}
                placeholder="Add context or reasoning. This will be included in the notification to the client."
                className="w-full rounded-[8px] border border-[#E7E1D8] bg-[#FAF8F5] px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#8C4F00]/20 focus:border-[#8C4F00] resize-none"
              />
            </div>

            {remainingEscrow > 0 && (
              <div className="flex items-start gap-3 rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3">
                <Zap className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-amber-700">
                    Approving will trigger an automatic refund of {formatSats(remainingEscrow)} to the client's Lightning address.
                  </p>
                  <p className="mt-1 text-xs text-amber-600">
                    Address: {request.clientLightningAddress || "Not set — refund will be queued for manual processing"}
                  </p>
                </div>
              </div>
            )}

            {actionError && (
              <div className="flex items-center gap-2 rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {actionError}
              </div>
            )}
            {actionSuccess && (
              <div className="flex items-center gap-2 rounded-[8px] border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                {actionSuccess}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleReject}
                disabled={isProcessing}
                className="flex-1 rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? "Processing…" : "Reject Request"}
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isProcessing}
                className="flex-1 rounded-[8px] bg-[#1a1a1a] px-4 py-3 text-sm font-black text-white hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <><svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing…</>
                ) : "Approve & Terminate"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5">
        <JsonPanel title="Termination request document" data={request} />
      </div>
    </>
  );
}
