"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronRight, MessageSquare, MoreVertical, CheckCircle2, SortDesc, Shield, AlertCircle, Clock, Calendar, ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/atoms/Button";
import { KebabDropdown, KebabMenuItem } from '@/components/ui/dropdown-menu';
import DisputeFormModal from '@/components/organisms/DisputeFormModal';
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { sendUserNotification } from "@/lib/notifications";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

type ContractStatus = "Active" | "Review" | "Completed" | "Terminated";

type Contract = {
  id: string;
  title: string;
  freelancer: string;
  freelancerId?: string;
  clientId?: string;
  clientName?: string;
  jobId?: string;
  contractType?: "Fixed Price" | "Hourly";
  progress: number;
  nextMilestone: string;
  status: ContractStatus;
  budget: string;
  startDate: string;
  dueDate: string;
  description: string;
  paymentStatus?: "unfunded" | "invoice_created" | "funded" | "released" | "expired";
  paymentInstallments?: number;
  paymentCurrentInstallment?: number;
  paymentReleasedInstallments?: number;
  paymentTotalAmountSats?: number;
  paymentTotalChargedSats?: number;
  paymentPaidAmountSats?: number;
  platformFeeSats?: number;
  platformFeePercent?: number;
  escrowFundedTotalSats?: number;
  escrowReleasedSats?: number;
  workStatus?: "not_started" | "in_progress" | "submitted" | "changes_requested" | "approved" | "completed";
  submissionMessage?: string;
  submissionLink?: string;
  submissionAttachment?: { name?: string; url?: string } | null;
  submissionReviewDueAt?: any;
  revisionMessage?: string;
  scopeItems?: string[];
  milestones?: Array<{
    index?: number;
    name: string;
    title?: string;
    amount: string;
    freelancerAmountSats?: number;
    platformFeeSats?: number;
    totalClientPaysSats?: number;
    fundedSats?: number;
    releasedSats?: number;
    deadline: string;
    status: "Pending" | "In Progress" | "Approved" | "pending" | "funded" | "submitted" | "approved" | "released";
  }>;
  createdAt?: any;
  updatedAt?: any;
  companyLogo?: string;
  terminationStatus?: "none" | "pending_review" | "approved" | "rejected";
  terminationRequestId?: string;
};

type SubmittedJob = {
  id: string;
  contractId: string;
  description: string;
  link?: string;
  attachment?: { name: string; url: string };
  submittedAt: Date;
  status: "pending" | "approved" | "rejected";
  revisionMessage?: string;
  milestoneIndex?: number;
  milestoneTitle?: string;
};

const formatDate = (value: any) => {
  if (!value) return "-";
  if (typeof value === "string") return value;
  const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const formatSats = (value: string) => {
  const safeValue = String(value ?? "").trim();
  if (!safeValue) return "0 sats";
  return safeValue.toLowerCase().includes("sats") ? safeValue : `${safeValue} sats`;
};

const parseSats = (value: string) => {
  const cleaned = String(value ?? "").replace(/[^0-9.]/g, "");
  return cleaned ? Number(cleaned) : 0;
};

const numberField = (value: unknown) => Number(value ?? 0);

const hasFundedEscrow = (data: Record<string, unknown>) => {
  const fundedTotal = Number(data.escrowFundedTotalSats ?? data.paymentPaidAmountSats ?? 0);
  const releasedTotal = Number(data.escrowReleasedSats ?? 0);
  const hasFundedMilestone = Array.isArray(data.milestones)
    ? data.milestones.some((milestone) => {
      const item = milestone as Record<string, unknown>;
      return numberField(item.fundedSats) > numberField(item.releasedSats);
    })
    : false;
  return fundedTotal > releasedTotal || hasFundedMilestone;
};

const normalizePaymentStatus = (data: Record<string, unknown>): Contract["paymentStatus"] => {
  const status = typeof data.paymentStatus === "string" ? data.paymentStatus : "unfunded";
  if (!["unfunded", "invoice_created", "funded", "released", "expired"].includes(status)) return "unfunded";
  if ((status === "funded" || status === "released") && !hasFundedEscrow(data)) return "unfunded";
  if (status === "invoice_created" && !data.paymentRequest) return "unfunded";
  return status as Contract["paymentStatus"];
};

const normalizeWorkStatus = (data: Record<string, unknown>): Contract["workStatus"] => {
  const status = typeof data.workStatus === "string" ? data.workStatus : "not_started";
  if (!["not_started", "in_progress", "submitted", "changes_requested", "approved", "completed"].includes(status)) return "not_started";
  if (status === "in_progress" && !hasFundedEscrow(data)) return "not_started";
  return status as Contract["workStatus"];
};

const calculateInstallmentAmount = (total: number, installments: number, installment: number) => {
  const safeTotal = Math.max(0, Math.trunc(total));
  const safeInstallments = Math.max(1, Math.trunc(installments));
  const safeInstallment = Math.max(1, Math.min(safeInstallments, Math.trunc(installment)));
  const base = Math.floor(safeTotal / safeInstallments);
  const remainder = safeTotal % safeInstallments;
  return base + (safeInstallment <= remainder ? 1 : 0);
};

// ── Avatar ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-purple-600", "bg-blue-600", "bg-emerald-600", "bg-orange-500", "bg-rose-600", "bg-indigo-600", "bg-teal-600", "bg-amber-600",
];
const getAvatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
const getInitials = (name: string) =>
  (name ?? "F").split(" ").filter(Boolean).slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join("");

function Avatar({ name, size = "md", imageUrl }: { name: string; size?: "sm" | "md" | "lg"; imageUrl?: string }) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-[11px]" : size === "lg" ? "h-11 w-11 text-[14px]" : "h-9 w-9 text-[12px]";
  const [imgError, setImgError] = useState(false);

  return (
    <div className={`flex-shrink-0 flex items-center justify-center rounded-full font-black text-white overflow-hidden ${sizeClass} ${getAvatarColor(name)}`}>
      {imageUrl && !imgError ? (
        <img
          src={imageUrl}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : getInitials(name)}
    </div>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ label }: { label: string }) {
  const map: Record<string, string> = {
    "Needs Review": "bg-orange-50 text-orange-700 border border-orange-200",
    "Revision Requested": "bg-red-50 text-red-700 border border-red-200",
    "Active": "bg-blue-50 text-blue-700 border border-blue-200",
    "Completed": "bg-green-50 text-green-700 border border-green-200",
    "In Progress": "bg-blue-50 text-blue-700 border border-blue-200",
    "Finished": "bg-green-50 text-green-700 border border-green-200",
    "Awaiting Review": "bg-orange-50 text-orange-700 border border-orange-200",
    "Pending Review": "bg-orange-50 text-orange-700 border border-orange-200",
    "Changes Requested": "bg-red-50 text-red-700 border border-red-200",
    "Approved": "bg-green-50 text-green-700 border border-green-200",
    "Pending": "bg-orange-50 text-orange-600 border border-orange-100",
    "Scheduled": "bg-gray-50 text-gray-500 border border-gray-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[label] ?? "bg-gray-50 text-gray-600 border border-gray-200"}`}>
      {label}
    </span>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ percent, color = "blue" }: { percent: number; color?: "blue" | "green" | "orange" | "red" }) {
  const c = { blue: "bg-blue-500", green: "bg-green-500", orange: "bg-orange-500", red: "bg-red-400" };
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100">
      <div className={`h-1.5 rounded-full transition-all ${c[color]}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

type MilestoneState = "approved" | "review" | "revision" | "active" | "pending";

const getMilestoneCount = (contract: Contract) => contract.milestones?.length || contract.paymentInstallments || 0;

const getMilestoneState = (contract: Contract, milestone: NonNullable<Contract["milestones"]>[number], index: number): MilestoneState => {
  const releasedCount = contract.paymentReleasedInstallments ?? 0;
  const status = String(milestone.status ?? "").toLowerCase();
  const currentIndex = Math.min(Math.max(releasedCount, 0), Math.max(getMilestoneCount(contract) - 1, 0));

  if (status === "released" || status === "approved" || index < releasedCount) return "approved";
  if (index === currentIndex && contract.workStatus === "submitted") return "review";
  if (index === currentIndex && contract.workStatus === "changes_requested") return "revision";
  if (index === currentIndex && !["approved", "completed"].includes(String(contract.workStatus))) return "active";
  return "pending";
};

const getMilestoneLabel = (state: MilestoneState) => {
  const labels: Record<MilestoneState, string> = {
    approved: "Approved",
    review: "Awaiting Review",
    revision: "Revision Requested",
    active: "In Progress",
    pending: "Pending",
  };
  return labels[state];
};

const getMilestoneProgressPercent = (contract: Contract) => {
  const total = getMilestoneCount(contract);
  if (!total) return contract.progress;
  if (contract.status === "Completed" || contract.paymentStatus === "released" || contract.workStatus === "approved" || contract.workStatus === "completed") return 100;
  const currentMilestone = Math.min(total, (contract.paymentReleasedInstallments ?? 0) + 1);
  return Math.round((currentMilestone / total) * 100);
};

const getDueLabel = (dueDate: string) => {
  const parsed = Date.parse(dueDate);
  if (Number.isNaN(parsed)) return `Due ${dueDate}`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(parsed);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "Due today";
  if (diffDays > 0) return `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
  const overdueDays = Math.abs(diffDays);
  return `Overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}`;
};

function MilestoneDot({ state, index, size = "sm" }: { state: MilestoneState; index: number; size?: "sm" | "md" }) {
  const sizeClass = size === "md" ? "h-6 w-6 text-[9px]" : "h-4 w-4 text-[7px]";
  const className = {
    approved: "border-green-500 bg-green-500 text-white",
    review: "border-orange-400 bg-orange-400 text-white",
    revision: "border-red-400 bg-red-400 text-white",
    active: "border-blue-500 bg-white text-blue-600",
    pending: "border-gray-200 bg-white text-gray-300",
  }[state];

  return (
    <span className={`relative z-10 flex flex-shrink-0 items-center justify-center rounded-full border-2 font-black ${sizeClass} ${className}`}>
      {state === "approved" ? <CheckCircle2 className={size === "md" ? "h-3.5 w-3.5" : "h-2.5 w-2.5"} /> : index + 1}
    </span>
  );
}

function CompactMilestoneList({ contract }: { contract: Contract }) {
  const milestones = contract.milestones ?? [];
  if (!milestones.length) return <span className="text-[11px] text-gray-400">No milestones</span>;

  return (
    <div className="space-y-1.5">
      {milestones.slice(0, 5).map((milestone, index) => {
        const state = getMilestoneState(contract, milestone, index);
        const textColor = {
          approved: "text-green-600",
          review: "text-orange-600",
          revision: "text-red-600",
          active: "text-blue-600",
          pending: "text-gray-400",
        }[state];

        return (
          <div key={index} className="grid grid-cols-[1rem_minmax(0,1fr)_5.2rem] items-center gap-2">
            <MilestoneDot state={state} index={index} />
            <span className={`truncate text-[10px] font-semibold ${textColor}`}>
              {milestone.title || milestone.name || `Milestone ${index + 1}`}
            </span>
            <span className={`text-right text-[9px] font-medium ${textColor}`}>{getMilestoneLabel(state)}</span>
          </div>
        );
      })}
      {milestones.length > 5 && <p className="pl-6 text-[9px] font-medium text-gray-400">+{milestones.length - 5} more milestones</p>}
    </div>
  );
}

function MilestoneTimeline({ contract }: { contract: Contract }) {
  const milestones = contract.milestones ?? [];
  if (!milestones.length) return <div className="text-[12px] text-gray-400">No milestone tracker yet</div>;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold text-gray-700">Milestone Progress</span>
        <span className="text-[11px] font-black text-gray-700">{Math.min((contract.paymentReleasedInstallments ?? 0) + 1, milestones.length)} / {milestones.length}</span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${milestones.length}, minmax(0, 1fr))` }}>
        {milestones.map((milestone, index) => {
          const state = getMilestoneState(contract, milestone, index);
          const previousState = index > 0 ? getMilestoneState(contract, milestones[index - 1], index - 1) : state;
          const lineColor = previousState === "approved" || state === "approved" || state === "active" || state === "review" ? "bg-blue-500" : "bg-gray-200";
          const textColor = {
            approved: "text-green-600",
            review: "text-orange-600",
            revision: "text-red-600",
            active: "text-blue-700",
            pending: "text-gray-400",
          }[state];

          return (
            <div key={index} className="flex min-w-0 flex-col items-center">
              <div className="relative flex h-7 w-full items-center justify-center">
                {index > 0 && <div className={`absolute right-1/2 top-1/2 h-0.5 w-full -translate-y-1/2 ${lineColor}`} />}
                <MilestoneDot state={state} index={index} size="md" />
              </div>
              <span className={`mt-1 text-[10px] font-black ${textColor}`}>M{index + 1}</span>
              <span className={`mt-0.5 max-w-[72px] text-center text-[10px] leading-tight ${textColor}`}>{getMilestoneLabel(state)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ClientContractsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"all" | "ongoing" | "finished">("all");
  const [selectedId, setSelectedId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasOpenedFromParam, setHasOpenedFromParam] = useState(false);
  const [activeTab, setActiveTab] = useState<"contracts" | "submitted">("contracts");
  const [submittedJobs, setSubmittedJobs] = useState<SubmittedJob[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [disputeContract, setDisputeContract] = useState<{ id: string; title: string } | null>(null);

  const openDispute = (contractId: string, contractTitle: string) => {
    setDisputeContract({ id: contractId, title: contractTitle });
    setIsDisputeModalOpen(true);
  };
  const [pendingApprovalJobId, setPendingApprovalJobId] = useState<string | null>(null);
  const [approvalErrorMessage, setApprovalErrorMessage] = useState<string>("");
  const [isApproving, setIsApproving] = useState(false);
  const isApprovingRef = useRef(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [pendingChangeJobId, setPendingChangeJobId] = useState<string | null>(null);
  const [changeRequestNote, setChangeRequestNote] = useState("");
  const [changeRequestError, setChangeRequestError] = useState("");
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const [freelancerData, setFreelancerData] = useState<any>(null);
  const [loadingFreelancer, setLoadingFreelancer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Termination state ────────────────────────────────────────────────────
  const [isTerminationModalOpen, setIsTerminationModalOpen] = useState(false);
  const [terminationContract, setTerminationContract] = useState<Contract | null>(null);
  const [terminationReason, setTerminationReason] = useState("");
  const [terminationError, setTerminationError] = useState("");
  const [isSubmittingTermination, setIsSubmittingTermination] = useState(false);

  const openTermination = (contract: Contract) => {
    setTerminationContract(contract);
    setTerminationReason("");
    setTerminationError("");
    setIsTerminationModalOpen(true);
  };

  const handleSubmitTermination = async () => {
    if (!terminationContract) return;
    const reason = terminationReason.trim();
    if (!reason) { setTerminationError("Please provide a reason for termination."); return; }
    const user = firebaseAuth.currentUser;
    if (!user) { setTerminationError("You must be logged in."); return; }
    setIsSubmittingTermination(true);
    setTerminationError("");
    try {
      const c = terminationContract;
      const remainingEscrowSats = Math.max(0, (c.escrowFundedTotalSats ?? 0) - (c.escrowReleasedSats ?? 0));
      // Fetch client Lightning address for refund
      let clientLightningAddress = "";
      try {
        const clientSnap = await getDoc(doc(firebaseDb, "clients", user.uid));
        if (clientSnap.exists()) {
          const d = clientSnap.data() as any;
          clientLightningAddress = d.lightningAddress || d.settings?.payment?.lightningAddress || "";
        }
      } catch { /* non-fatal */ }
      // Fetch client name
      let clientName = c.clientName || "";
      if (!clientName) {
        try {
          const snap = await getDoc(doc(firebaseDb, "all_users", user.uid));
          if (snap.exists()) clientName = (snap.data() as any).fullName || (snap.data() as any).name || "";
        } catch { /* non-fatal */ }
      }
      const reqRef = await addDoc(collection(firebaseDb, "termination_requests"), {
        contractId: c.id,
        contractTitle: c.title,
        clientId: c.clientId,
        clientName: clientName || "Client",
        clientLightningAddress,
        freelancerId: c.freelancerId,
        freelancerName: c.freelancer,
        jobId: c.jobId || "",
        reason,
        remainingEscrowSats,
        escrowFundedTotalSats: c.escrowFundedTotalSats ?? 0,
        escrowReleasedSats: c.escrowReleasedSats ?? 0,
        status: "pending",
        adminNote: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(firebaseDb, "contracts", c.id), {
        terminationStatus: "pending_review",
        terminationRequestId: reqRef.id,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      // Notify freelancer
      void sendUserNotification({
        userId: c.freelancerId || "",
        title: "Contract termination requested",
        body: `The client has requested to terminate the contract "${c.title}". This is under admin review.`,
        url: "/freelancer/dashboard/contracts",
        tag: `termination-${c.id}`,
      }).catch(console.error);
      // Notify admin via generic notification — use a placeholder admin notification
      // (Real admin push handled separately; this logs it for admin inbox)
      setIsTerminationModalOpen(false);
      setTerminationContract(null);
      setTerminationReason("");
    } catch (err) {
      console.error("Termination request error:", err);
      setTerminationError("Failed to submit termination request. Please try again.");
    } finally {
      setIsSubmittingTermination(false);
    }
  };

  const createConversationId = (jobId: string, freelancerId: string) => `${jobId}_${freelancerId}`;
  const freelancerNameCache = useRef<Record<string, string>>({});
  const companyLogoCache = useRef<Record<string, string>>({});

  const resolveFreelancerName = async (freelancerId: string, fallbackName: string) => {
    const initialFallback = fallbackName?.trim() || "";
    if (!freelancerId) return initialFallback || "Freelancer";
    if (freelancerNameCache.current[freelancerId]) return freelancerNameCache.current[freelancerId];
    let resolvedName = initialFallback;
    try {
      const snap = await getDoc(doc(firebaseDb, "all_users", freelancerId));
      if (snap.exists()) {
        const d = snap.data() as any;
        resolvedName = d.fullName ?? d.name ?? d.email ?? resolvedName;
      }
    } catch { }
    if (!resolvedName) {
      try {
        const snap = await getDoc(doc(firebaseDb, "freelancers", freelancerId));
        if (snap.exists()) {
          const d = snap.data() as any;
          resolvedName = d.fullName || `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || d.name || resolvedName;
        }
      } catch { }
    }
    if (!resolvedName) {
      try {
        const q = query(collection(firebaseDb, "freelancers"), where("uid", "==", freelancerId), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0].data() as any;
          resolvedName = d.fullName || `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || d.name || resolvedName;
        }
      } catch { }
    }
    freelancerNameCache.current[freelancerId] = resolvedName || "Freelancer";
    return freelancerNameCache.current[freelancerId];
  };

  const getConversationForContract = async (contract: Contract) => {
    if (!contract.jobId || !contract.freelancerId) return null;
    const q = query(collection(firebaseDb, "conversations"), where("jobId", "==", contract.jobId), where("freelancerId", "==", contract.freelancerId), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0];
  };

  useEffect(() => {
    let unsubContracts: (() => void) | undefined;
    let unsubSubmitted: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) { unsubContracts?.(); unsubSubmitted?.(); return; }
      setLoading(true); setErrorMessage("");

      unsubContracts = onSnapshot(
        query(collection(firebaseDb, "contracts"), where("clientId", "==", user.uid)),
        (snapshot) => {
          const items: Contract[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as any;
            return {
              id: docSnap.id,
              title: data.title ?? "Contract",
              freelancer: data.freelancer ?? "",
              freelancerId: data.freelancerId ?? "",
              clientId: data.clientId ?? "",
              clientName: data.clientName ?? "",
              jobId: data.jobId ?? "",
              contractType: data.contractType ?? data.jobType ?? "Fixed Price",
              status: (data.status as ContractStatus) ?? "Active",
              budget: formatSats(data.budget ?? "0"),
              progress: typeof data.progress === "number" ? data.progress : 0,
              nextMilestone: data.nextMilestone ?? "-",
              startDate: formatDate(data.startDate),
              dueDate: formatDate(data.dueDate),
              description: data.description ?? "-",
              paymentStatus: normalizePaymentStatus(data),
              paymentInstallments: Number(data.paymentInstallments ?? 1),
              paymentCurrentInstallment: Number(data.paymentCurrentInstallment ?? 1),
              paymentReleasedInstallments: Number(data.paymentReleasedInstallments ?? 0),
              paymentTotalAmountSats: Number(data.paymentTotalAmountSats ?? parseSats(data.budget) ?? 0),
              paymentTotalChargedSats: Number(data.paymentTotalChargedSats ?? 0),
              paymentPaidAmountSats: Number(data.paymentPaidAmountSats ?? 0),
              platformFeeSats: Number(data.platformFeeSats ?? 0),
              platformFeePercent: Number(data.platformFeePercent ?? 5),
              escrowFundedTotalSats: Number(data.escrowFundedTotalSats ?? 0),
              escrowReleasedSats: Number(data.escrowReleasedSats ?? 0),
              workStatus: normalizeWorkStatus(data),
              submissionMessage: data.submissionMessage ?? "",
              submissionLink: data.submissionLink ?? "",
              submissionAttachment: data.submissionAttachment ?? null,
              submissionReviewDueAt: data.submissionReviewDueAt,
              revisionMessage: data.revisionMessage ?? "",
              scopeItems: Array.isArray(data.scopeItems) ? data.scopeItems : [],
              milestones: Array.isArray(data.milestones) ? data.milestones : [],
              terminationStatus: (data.terminationStatus as Contract["terminationStatus"]) ?? "none",
              terminationRequestId: data.terminationRequestId ?? "",
            };
          });
          (async () => {
            const hydrated = await Promise.all(items.map(async (c) => {
              const freelancer = await resolveFreelancerName(c.freelancerId ?? "", c.freelancer ?? "");
              let companyLogo = "";
              if (c.jobId) {
                if (companyLogoCache.current[c.jobId]) {
                  companyLogo = companyLogoCache.current[c.jobId];
                } else {
                  try {
                    const jobSnap = await getDoc(doc(firebaseDb, "jobs", c.jobId));
                    if (jobSnap.exists()) {
                      companyLogo = (jobSnap.data() as any).companyLogo || "";
                      companyLogoCache.current[c.jobId] = companyLogo;
                    }
                  } catch { }
                }
              }
              return { ...c, freelancer, companyLogo };
            }));
            hydrated.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
            setContracts(hydrated);
            setLoading(false);
            if (!selectedId && hydrated.length) setSelectedId(hydrated[0].id);
          })();
        },
        () => { setLoading(false); setErrorMessage("Unable to load contracts."); }
      );

      unsubSubmitted = onSnapshot(
        query(collection(firebaseDb, "submitted_jobs"), where("clientId", "==", user.uid)),
        (snapshot) => {
          const items: SubmittedJob[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as any;
            const rawStatus = String(data.status ?? "pending").toLowerCase();
            const status = rawStatus === "approved" ? "approved" : rawStatus === "rejected" ? "rejected" : "pending";
            return {
              id: docSnap.id,
              contractId: data.contractId ?? "",
              description: data.description ?? "",
              link: data.link ?? "",
              attachment: data.attachment ?? null,
              submittedAt: data.submittedAt?.toDate() ?? new Date(),
              status,
              revisionMessage: data.revisionMessage ?? "",
              milestoneIndex: data.milestoneIndex,
              milestoneTitle: data.milestoneTitle ?? "",
            };
          });
          items.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
          setSubmittedJobs(items);
        },
        () => { }
      );
    });
    return () => { unsubAuth(); unsubContracts?.(); unsubSubmitted?.(); };
  }, [selectedId]);

  const isFinishedContract = (c: Contract) =>
    c.status === "Completed" || c.paymentStatus === "released" || c.workStatus === "approved" || c.workStatus === "completed";

  const isEscrowContract = (c: Contract) =>
    !isFinishedContract(c) && (c.paymentStatus === "funded" || (c.escrowFundedTotalSats ?? 0) > 0 || c.workStatus === "in_progress" || c.workStatus === "submitted" || c.workStatus === "changes_requested");

  const ongoingContracts = useMemo(() => contracts.filter(isEscrowContract), [contracts]);
  const finishedContracts = useMemo(() => contracts.filter(isFinishedContract), [contracts]);
  const needsAttentionCount = submittedJobs.filter((j) => j.status === "pending").length;
  const reviewDetailRef = useRef<HTMLDivElement | null>(null);
  const [reviewListHeight, setReviewListHeight] = useState<number | null>(null);

  const visibleContracts = useMemo(() => {
    const base = view === "all" ? contracts : view === "ongoing" ? ongoingContracts : finishedContracts;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.freelancer.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
    );
  }, [view, contracts, ongoingContracts, finishedContracts, searchQuery]);

  const filteredSubmittedJobs = useMemo(() => {
    if (!searchQuery.trim()) return submittedJobs;
    const q = searchQuery.toLowerCase();
    return submittedJobs.filter((job) => {
      const contract = contracts.find((c) => c.id === job.contractId);
      return (
        (contract?.title ?? "").toLowerCase().includes(q) ||
        (contract?.freelancer ?? "").toLowerCase().includes(q) ||
        (job.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [submittedJobs, contracts, searchQuery]);

  const submittedJobsForReview = filteredSubmittedJobs;

  const selectedContract = contracts.find((c) => c.id === selectedId) ?? visibleContracts[0];
  const selectedSubmission = selectedSubmissionId ? submittedJobs.find((j) => j.id === selectedSubmissionId) ?? null : null;
  const selectedSubmissionContract = selectedSubmission ? contracts.find((c) => c.id === selectedSubmission.contractId) ?? null : null;
  const pendingChangeJob = pendingChangeJobId ? submittedJobs.find((j) => j.id === pendingChangeJobId) ?? null : null;
  const pendingChangeContract = pendingChangeJob ? contracts.find((c) => c.id === pendingChangeJob.contractId) ?? null : null;

  useEffect(() => {
    if (activeTab !== "submitted") return;
    const node = reviewDetailRef.current;
    if (!node) return;

    const updateHeight = () => setReviewListHeight(Math.ceil(node.getBoundingClientRect().height));
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    window.addEventListener("resize", updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [activeTab, selectedSubmissionId, submittedJobsForReview.length, contracts.length]);

  useEffect(() => {
    if (hasOpenedFromParam || loading) return;
    const contractId = searchParams.get("contract");
    if (!contractId) return;
    const contract = contracts.find((item) => item.id === contractId);
    if (!contract) return;
    setSelectedId(contract.id);
    setActiveTab("contracts");
    setIsModalOpen(true);
    setHasOpenedFromParam(true);
  }, [contracts, hasOpenedFromParam, loading, searchParams]);

  const handleApproveSubmission = async (jobId: string) => {
    setApprovalErrorMessage("");
    setPendingApprovalJobId(jobId);
    setShowPaymentModal(true);
  };

  const confirmApproveWithPayment = async () => {
    if (!pendingApprovalJobId || isApprovingRef.current) return;

    isApprovingRef.current = true;
    setIsApproving(true);

    try {
      const job = submittedJobs.find((j) => j.id === pendingApprovalJobId);
      const contract = job ? contracts.find((c) => c.id === job.contractId) : null;
      if (!job || !contract) {
        setApprovalErrorMessage("Unable to find the contract for this submission.");
        isApprovingRef.current = false;
        setIsApproving(false);
        return;
      }
      const paymentStatus = contract.paymentStatus ?? "unfunded";
      const fundedInstallments = contract.paymentCurrentInstallment ?? 0;
      const totalInstallments = contract.paymentInstallments ?? 1;
      const releasedInstallments = contract.paymentReleasedInstallments ?? 0;
      const nextMilestoneIndex = releasedInstallments + 1;
      const milestone = contract.milestones?.find((item: any, index) => Number(item.index ?? index + 1) === nextMilestoneIndex);
      const totalAmount = contract.paymentTotalAmountSats || parseSats(contract.budget) || 0;
      const milestoneAmount = Number((milestone as any)?.freelancerAmountSats ?? calculateInstallmentAmount(totalAmount, totalInstallments, nextMilestoneIndex));
      const milestoneFundedSats = milestone ? Number((milestone as any).fundedSats ?? 0) : milestoneAmount;
      const milestoneReleasedSats = milestone ? Number((milestone as any).releasedSats ?? 0) : 0;
      const remainingMilestoneEscrow = Math.max(0, milestoneFundedSats - milestoneReleasedSats);

      // Strict Guards to prevent overpaying beyond job total or index limits
      if (nextMilestoneIndex > totalInstallments) {
        setApprovalErrorMessage("All milestones for this contract have already been approved and paid.");
        isApprovingRef.current = false;
        setIsApproving(false);
        return;
      }

      if ((contract.escrowReleasedSats ?? 0) + milestoneAmount > totalAmount) {
        setApprovalErrorMessage(`Releasing ${milestoneAmount.toLocaleString()} sats would exceed the total contract budget of ${totalAmount.toLocaleString()} sats.`);
        isApprovingRef.current = false;
        setIsApproving(false);
        return;
      }

      if ((contract.escrowReleasedSats ?? 0) + milestoneAmount > (contract.escrowFundedTotalSats ?? 0)) {
        setApprovalErrorMessage(`Releasing ${milestoneAmount.toLocaleString()} sats would exceed the funded escrow balance.`);
        isApprovingRef.current = false;
        setIsApproving(false);
        return;
      }

      const canRelease = fundedInstallments >= nextMilestoneIndex && (paymentStatus === "funded" || paymentStatus === "released") && remainingMilestoneEscrow >= milestoneAmount;
      if (!canRelease) {
        const shortfall = Math.max(0, milestoneAmount - remainingMilestoneEscrow);
        setApprovalErrorMessage(shortfall > 0 ? `You need to fund ${shortfall.toLocaleString()} sats more in escrow before approving this milestone.` : "This milestone is not funded yet. Fund escrow before approving work.");
        isApprovingRef.current = false;
        setIsApproving(false);
        return;
      }

      const lightningAddress =
        freelancerData?.settings?.payment?.lightningAddress ||
        freelancerData?.lightningAddress ||
        freelancerData?.settings?.lightningAddress;

      if (!lightningAddress) {
        setApprovalErrorMessage("Freelancer has not set up a Lightning address. Payment cannot be processed.");
        isApprovingRef.current = false;
        setIsApproving(false);
        return;
      }

      if (milestoneAmount <= 0) {
        setApprovalErrorMessage("Unable to calculate milestone amount.");
        isApprovingRef.current = false;
        setIsApproving(false);
        return;
      }

      const paymentResponse = await fetch("/api/send-payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lightningAddress, amount: milestoneAmount, memo: `Milestone ${nextMilestoneIndex} payment for contract: ${contract.title}` }) });
      const rawPaymentResponse = await paymentResponse.text();
      let paymentData: any = null;
      try { paymentData = rawPaymentResponse ? JSON.parse(rawPaymentResponse) : null; } catch { throw new Error(`Failed to parse payment response: ${rawPaymentResponse}`); }
      if (!paymentResponse.ok) throw new Error(paymentData?.error ?? `Failed to send payment to freelancer: ${rawPaymentResponse}`);
      await updateDoc(doc(firebaseDb, "submitted_jobs", pendingApprovalJobId), { status: "approved", updatedAt: serverTimestamp() });
      const nextReleasedCount = releasedInstallments + 1;
      const isFinalRelease = nextReleasedCount >= totalInstallments;
      const updatedMilestones = (contract.milestones ?? []).map((item, index) => {
        const itemIndex = Number(item.index ?? index + 1);
        if (itemIndex !== nextMilestoneIndex) return item;
        return { ...item, releasedSats: Number(item.releasedSats ?? 0) + milestoneAmount, status: "released", releasedAt: new Date().toISOString() };
      });
      const contractUpdate = { workStatus: isFinalRelease ? "approved" : "in_progress", paymentReleasedInstallments: nextReleasedCount, escrowReleasedSats: (contract.escrowReleasedSats ?? 0) + milestoneAmount, milestones: updatedMilestones, paymentStatus: isFinalRelease ? "released" : "funded", updatedAt: serverTimestamp() };
      await setDoc(doc(firebaseDb, "contracts", job.contractId), contractUpdate, { merge: true });
      await setDoc(doc(firebaseDb, "escrows", job.contractId), { totalReleasedToFreelancerSats: contractUpdate.escrowReleasedSats, releasedMilestoneCount: nextReleasedCount, milestones: updatedMilestones, status: isFinalRelease ? "released" : "funded", updatedAt: serverTimestamp() }, { merge: true });
      try {
        const conversationDoc = await getConversationForContract(contract);
        const approvalMessage = `Milestone ${nextMilestoneIndex}${milestone?.title || milestone?.name ? `: ${milestone?.title || milestone?.name}` : ""} approved and payment of ${milestoneAmount} sats sent to freelancer.`;
        if (conversationDoc) {
          await updateDoc(conversationDoc.ref, { workStatus: contractUpdate.workStatus, paymentStatus: contractUpdate.paymentStatus, escrowReleasedSats: contractUpdate.escrowReleasedSats, milestones: updatedMilestones, updatedAt: serverTimestamp(), "lastMessage.text": approvalMessage, "lastMessage.senderId": "system", "lastMessage.createdAt": serverTimestamp(), [`unread.${contract.freelancerId}`]: increment(1) });
        }
        void sendUserNotification({ userId: contract.freelancerId || "", title: "Milestone approved", body: approvalMessage, url: "/freelancer/dashboard/contracts", tag: `approval-${contract.id}-${nextMilestoneIndex}` }).catch(console.error);
      } catch (e) { console.error("Error updating conversation:", e); }
      setShowPaymentModal(false); setPendingApprovalJobId(null); setApprovalErrorMessage("");
    } catch (error) {
      console.error("Error approving submission:", error);
      setApprovalErrorMessage(error instanceof Error ? error.message : "Failed to approve the submission and send payment. Please try again.");
    } finally {
      isApprovingRef.current = false;
      setIsApproving(false);
    }
  };

  const openChangeRequest = (jobId: string) => {
    const job = submittedJobs.find((item) => item.id === jobId);
    const contract = job ? contracts.find((item) => item.id === job.contractId) : null;
    setPendingChangeJobId(jobId);
    setChangeRequestNote(job?.revisionMessage || contract?.revisionMessage || "");
    setChangeRequestError("");
  };

  const handleRejectSubmission = async () => {
    if (!pendingChangeJobId) return;
    const note = changeRequestNote.trim();
    if (!note) { setChangeRequestError("Write a short note so the freelancer knows what to adjust."); return; }
    const job = submittedJobs.find((item) => item.id === pendingChangeJobId);
    const contract = job ? contracts.find((item) => item.id === job.contractId) : null;
    if (!job || !contract) { setChangeRequestError("Unable to find this submitted work."); return; }
    setIsRequestingChanges(true); setChangeRequestError("");
    try {
      const nextMilestoneIndex = (contract.paymentReleasedInstallments ?? 0) + 1;
      const updatedMilestones = (contract.milestones ?? []).map((item: any, index) => {
        const itemIndex = Number(item.index ?? index + 1);
        if (itemIndex !== nextMilestoneIndex) return item;
        return { ...item, status: "funded", revisionMessage: note, changesRequestedAt: new Date().toISOString() };
      });
      const messageText = `Work returned for adjustments on "${contract.title}". Note: ${note}`;
      const conversationId = contract.jobId && contract.freelancerId ? createConversationId(contract.jobId, contract.freelancerId) : contract.id;
      await Promise.all([
        updateDoc(doc(firebaseDb, "submitted_jobs", pendingChangeJobId), { status: "rejected", revisionMessage: note, reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() }),
        setDoc(doc(firebaseDb, "contracts", job.contractId), { workStatus: "changes_requested", revisionMessage: note, milestones: updatedMilestones, unreadByFreelancer: true, updatedAt: serverTimestamp() }, { merge: true }),
        setDoc(doc(firebaseDb, "conversations", conversationId), { workStatus: "changes_requested", revisionMessage: note, milestones: updatedMilestones, "lastMessage.text": messageText, "lastMessage.senderId": "system", "lastMessage.createdAt": serverTimestamp(), [`unread.${contract.freelancerId}`]: increment(1), updatedAt: serverTimestamp() }, { merge: true }),
        addDoc(collection(firebaseDb, "conversations", conversationId, "messages"), { senderId: "system", senderRole: "system", text: messageText, messageType: "changes_requested", createdAt: serverTimestamp() }),
      ]);
      void sendUserNotification({ userId: contract.freelancerId || "", title: "Changes requested", body: messageText, url: "/freelancer/dashboard/contracts", tag: `changes-${contract.id}-${nextMilestoneIndex}` }).catch(console.error);
      setPendingChangeJobId(null); setChangeRequestNote(""); setSelectedSubmissionId(pendingChangeJobId);
    } catch (error) {
      console.error("Error rejecting submission:", error);
      setChangeRequestError("Unable to send the adjustment request. Please try again.");
    } finally { setIsRequestingChanges(false); }
  };

  useEffect(() => {
    const fetchFreelancerPaymentData = async () => {
      if (!pendingApprovalJobId) { setFreelancerData(null); setLoadingFreelancer(false); return; }
      const job = submittedJobs.find((j) => j.id === pendingApprovalJobId);
      const contract = job ? contracts.find((c) => c.id === job.contractId) : null;
      let freelancerId = contract?.freelancerId;
      // if (!freelancerId && contract?.id) {
      //   try {
      //     const snap = await getDoc(doc(firebaseDb, "contracts", contract.id));
      //     if (snap.exists()) freelancerId = (snap.data() as any).freelancerId;
      //   } catch (e) { console.error(e); }
      // }
      // if (!freelancerId) { setFreelancerData(null); setLoadingFreelancer(false); return; }
      // setLoadingFreelancer(true);
      // try {
      //   const snap = await getDoc(doc(firebaseDb, "freelancers", freelancerId));
      //   if (snap.exists()) {
      //     setFreelancerData(snap.data());
      //   } else {
      //     const q = query(collection(firebaseDb, "freelancers"), where("uid", "==", freelancerId), limit(1));
      //     const qSnap = await getDocs(q);
      //     setFreelancerData(qSnap.empty ? null : qSnap.docs[0].data());
      //   }
      // } catch (e) { console.error(e); setFreelancerData(null); }
      // finally { setLoadingFreelancer(false); }
      if (!freelancerId && contract?.id) {
        try {
          const snap = await getDoc(doc(firebaseDb, "contracts", contract.id));
          if (snap.exists()) {
            const d = snap.data() as any;
            freelancerId = d.freelancerId || d.freelancerUid || d.freelancer_id;
          }
        } catch (e) { console.error(e); }
      }
      if (!freelancerId) { setFreelancerData(null); setLoadingFreelancer(false); return; }
      setLoadingFreelancer(true);
      try {
        // 1. Try freelancers/{freelancerId} by doc ID
        const snap = await getDoc(doc(firebaseDb, "freelancers", freelancerId));
        if (snap.exists()) {
          setFreelancerData(snap.data());
          return;
        }
        // 2. Try querying freelancers by uid field (doc ID may differ from uid)
        const q = query(collection(firebaseDb, "freelancers"), where("uid", "==", freelancerId), limit(1));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          setFreelancerData(qSnap.docs[0].data());
          return;
        }
        // 3. Final fallback: all_users — older users may only have data here
        const allUsersSnap = await getDoc(doc(firebaseDb, "all_users", freelancerId));
        if (allUsersSnap.exists()) {
          setFreelancerData(allUsersSnap.data());
          return;
        }
        setFreelancerData(null);
      } catch (e) {
        console.error("fetchFreelancerPaymentData error:", e);
        setFreelancerData(null);
      } finally {
        setLoadingFreelancer(false);
      }
    };
    fetchFreelancerPaymentData();
  }, [pendingApprovalJobId, submittedJobs, contracts]);

  const getContractDisplayStatus = (c: Contract) => {
    if (isFinishedContract(c)) return "Completed";
    if (c.workStatus === "submitted") return "Needs Review";
    if (c.workStatus === "changes_requested") return "Revision Requested";
    return "Active";
  };

  const getProgressColor = (c: Contract): "blue" | "green" | "orange" | "red" => {
    if (isFinishedContract(c)) return "green";
    if (c.workStatus === "submitted") return "orange";
    if (c.workStatus === "changes_requested") return "red";
    return "blue";
  };

  // ── TABS ─────────────────────────────────────────────────────────────────
  const TABS = [
    { id: "all", label: "All", count: contracts.length },
    { id: "ongoing", label: "Active", count: ongoingContracts.length },
    { id: "submitted", label: "Submitted Jobs", count: submittedJobsForReview.length, alert: needsAttentionCount > 0 },
    { id: "finished", label: "Completed", count: finishedContracts.length },
  ] as const;

  return (
    <section className="w-full min-h-screen ">
      {/* PAGE HEADER */}
      <div className="bg- border-b border-gray-100 px-4 sm:px-6 py-4 sm:py-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-orange-600 mb-1">Contracts</p>
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Your Contracts</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track your projects, review submissions, and manage payments.</p>
      </div>

      {/* TABS */}
      <div className="bg-white border-b rounded-[8px] border-gray-100 px-3 sm:px-6">
        {/* Search + Filter row — mobile only, shown above tabs */}
        <div className="flex sm:hidden items-center gap-2 py-3 border-b border-gray-100">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === "submitted" ? "Search submitted work..." : "Search contracts..."}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-[13px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-300"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          {/* Tabs — horizontally scrollable on mobile */}
          <div className="flex items-center overflow-x-auto -mb-px" style={{ scrollbarWidth: "none" }}>
            {TABS.map((tab) => {
              const isActive = tab.id === "submitted"
                ? activeTab === "submitted"
                : activeTab === "contracts" && view === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (tab.id === "submitted") { setActiveTab("submitted"); }
                    else { setActiveTab("contracts"); setView(tab.id as "all" | "ongoing" | "finished"); }
                    setSearchQuery("");
                  }}
                  className={`relative flex flex-shrink-0 items-center gap-1.5 px-3 sm:px-4 py-4 text-[12px] sm:text-[13px] font-semibold transition-colors ${isActive ? "text-gray-900 border-b-2 border-gray-900" : "text-gray-500 hover:text-gray-700 border-b-2 border-transparent"}`}
                >
                  {tab.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>
                    {tab.count}
                  </span>
                  {"alert" in tab && tab.alert && <span className="absolute right-1 top-3 h-2 w-2 rounded-full bg-orange-500" />}
                </button>
              );
            })}
          </div>
          {/* Search + Filter — hidden on mobile (shown above), visible on sm+ */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0 pl-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === "submitted" ? "Search submitted work..." : "Search contracts..."}
                className="rounded-lg border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-[13px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-300 w-44 lg:w-52"
              />
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="px-3 sm:px-6 py-4 sm:py-5">

        {/* ALL CONTRACTS VIEW */}
        {activeTab === "contracts" && view === "all" && (
          <>
            {loading ? (
              <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading contracts…</div>
            ) : errorMessage ? (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{errorMessage}</div>
            ) : visibleContracts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Search className="h-10 w-10 text-orange-300 mb-3" />
                <p className="font-bold text-gray-800">No contracts found</p>
                <p className="text-sm text-gray-400 mt-1">{searchQuery ? "No contracts match your search" : "You don't have any contracts yet"}</p>
              </div>
            ) : (
              <>
                {/* Desktop table header — hidden below lg */}
                <div className="hidden lg:grid mb-2 grid-cols-[1.7fr_1fr_1.55fr_0.85fr_0.95fr_0.8fr_1.05fr] items-center gap-0 rounded-t-xl border border-b-0 border-gray-100 bg-gray-50 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-500">
                  <span>Contract</span>
                  <span>Status</span>
                  <span>Milestones</span>
                  <span>Budget</span>
                  <span>Dates</span>
                  <span>Progress</span>
                  <span className="text-right">Actions</span>
                </div>
                <div className="space-y-3">
                  {visibleContracts.map((contract) => {
                    const statusLabel = getContractDisplayStatus(contract);
                    const progressColor = getProgressColor(contract);
                    const releasedCount = contract.paymentReleasedInstallments ?? 0;
                    const totalMs = contract.milestones?.length ?? 0;
                    const perMs = totalMs > 0 ? Math.round((contract.paymentTotalAmountSats ?? 0) / totalMs) : 0;
                    return (
                      <div key={contract.id} className="rounded-xl bg-white border border-gray-100 shadow-[0_1px_6px_rgba(15,23,42,0.04)] transition-all hover:border-gray-200 hover:shadow-md overflow-hidden">
                        {/* ── Mobile card layout (< lg) ── */}
                        <div className="lg:hidden px-4 py-4 space-y-3">
                          {/* Header row */}
                          <div className="flex items-start gap-3">
                            <Avatar name={contract.freelancer} imageUrl={contract.companyLogo} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-black leading-snug text-gray-900 break-words">{contract.title}</p>
                              <p className="text-[12px] text-gray-400 mt-0.5 truncate">with {contract.freelancer}</p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <StatusBadge label={statusLabel} />
                                {contract.terminationStatus === "pending_review" && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                    <Clock className="h-2.5 w-2.5" /> Termination Pending
                                  </span>
                                )}
                                {contract.terminationStatus === "rejected" && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                                    Termination Rejected
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Stats grid */}
                          <div className="grid grid-cols-2 gap-2 text-[12px]">
                            <div className="rounded-lg bg-gray-50 px-3 py-2">
                              <p className="text-[10px] text-gray-400 font-medium">Budget</p>
                              <p className="font-black text-gray-900">{contract.paymentTotalAmountSats ? `${contract.paymentTotalAmountSats.toLocaleString()} sats` : contract.budget}</p>
                            </div>
                            <div className="rounded-lg bg-gray-50 px-3 py-2">
                              <p className="text-[10px] text-gray-400 font-medium">Due Date</p>
                              <p className="font-semibold text-gray-900">{contract.dueDate}</p>
                              {statusLabel !== "Completed" && <p className="text-[10px] text-orange-500 font-bold">{getDueLabel(contract.dueDate)}</p>}
                            </div>
                          </div>
                          {/* Progress */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-semibold text-gray-500">Progress</span>
                              <span className="text-[11px] font-black text-gray-900">{getMilestoneProgressPercent(contract)}%</span>
                            </div>
                            <ProgressBar percent={getMilestoneProgressPercent(contract)} color={progressColor} />
                            {totalMs > 0 && <p className="text-[10px] text-gray-400 mt-0.5">Milestone {Math.min(releasedCount + 1, totalMs)} of {totalMs}</p>}
                          </div>
                          {/* Action buttons */}
                          <div className="flex gap-2 pt-1 items-center">
                            {statusLabel === "Needs Review" && (
                              <button type="button" onClick={() => { const job = submittedJobs.find((j) => j.contractId === contract.id && j.status === "pending"); if (job) handleApproveSubmission(job.id); }} className="flex-1 rounded-lg bg-gray-900 px-3 py-2.5 text-[12px] font-black text-white hover:bg-gray-800">
                                Review Submission
                              </button>
                            )}
                            {statusLabel === "Revision Requested" && (
                              <button type="button" onClick={() => { setSelectedId(contract.id); setIsModalOpen(true); }} className="flex-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-black text-red-600 hover:bg-red-100">
                                Review Revision
                              </button>
                            )}
                            <button type="button" onClick={() => { setSelectedId(contract.id); setIsModalOpen(true); }} className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[12px] font-black text-gray-700 hover:bg-gray-50">
                              View Details <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => { if (!contract.jobId || !contract.freelancerId) return; router.push(`/client/dashboard/messages?chat=${createConversationId(contract.jobId, contract.freelancerId)}`); }} className="rounded-lg border border-gray-200 bg-white p-2.5 text-gray-500 hover:bg-gray-50">
                              <MessageSquare className="h-4 w-4" />
                            </button>
                            <KebabDropdown>
                              <KebabMenuItem onSelect={() => openDispute(contract.id, contract.title)}>Raise Dispute</KebabMenuItem>
                              {!isFinishedContract(contract) && contract.terminationStatus !== "pending_review" && contract.terminationStatus !== "approved" && (
                                <KebabMenuItem onSelect={() => openTermination(contract)}>Request Termination</KebabMenuItem>
                              )}
                            </KebabDropdown>
                          </div>
                        </div>

                        {/* ── Desktop table row layout (lg+) ── */}
                        <div className="hidden lg:grid min-h-[104px] grid-cols-[1.7fr_1fr_1.55fr_0.85fr_0.95fr_0.8fr_1.05fr] items-center gap-0 px-4 py-4">
                          <div className="flex min-w-0 items-center gap-3 pr-4">
                            <Avatar name={contract.freelancer} imageUrl={contract.companyLogo} />
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-black leading-snug text-gray-900">{contract.title}</p>
                              <p className="text-[11px] text-gray-400 truncate">Freelancer: {contract.freelancer}</p>
                            </div>
                          </div>
                          <div className="border-l border-gray-100 px-4">
                            <StatusBadge label={statusLabel} />
                            {totalMs > 0 && <p className="mt-2 text-[10px] font-bold text-gray-700">Milestone {Math.min(releasedCount + 1, totalMs)} of {totalMs}</p>}
                            <p className="mt-0.5 text-[10px] text-gray-400">{statusLabel === "Completed" ? `Completed ${contract.dueDate}` : statusLabel === "Needs Review" ? "Submitted for review" : `Started ${contract.startDate}`}</p>
                            {contract.terminationStatus === "pending_review" && (
                              <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                <Clock className="h-2.5 w-2.5" /> Termination Pending
                              </div>
                            )}
                            {contract.terminationStatus === "rejected" && (
                              <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                                Termination Rejected
                              </div>
                            )}
                          </div>
                          <div className="border-l border-gray-100 px-4">
                            <CompactMilestoneList contract={contract} />
                          </div>
                          <div className="border-l border-gray-100 px-4">
                            <p className="font-bold text-[13px] text-gray-900">{contract.paymentTotalAmountSats ? `${contract.paymentTotalAmountSats.toLocaleString()} sats` : contract.budget}</p>
                            {perMs > 0 && <p className="text-[10px] text-gray-400">{perMs.toLocaleString()} sats<br />per milestone</p>}
                          </div>
                          <div className="border-l border-gray-100 px-4 text-[11px]">
                            <p className="font-semibold text-gray-700">{contract.startDate} -</p>
                            <p className="text-gray-500">{contract.dueDate}</p>
                            {statusLabel !== "Completed" && <p className="mt-1 text-[10px] font-bold text-orange-500">{getDueLabel(contract.dueDate)}</p>}
                          </div>
                          <div className="border-l border-gray-100 px-4">
                            <span className="text-[12px] font-black text-gray-900">{getMilestoneProgressPercent(contract)}%</span>
                            <ProgressBar percent={getMilestoneProgressPercent(contract)} color={progressColor} />
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2 border-l border-gray-100 pl-4">
                            {statusLabel === "Needs Review" && (
                              <button type="button" onClick={() => { const job = submittedJobs.find((j) => j.contractId === contract.id && j.status === "pending"); if (job) handleApproveSubmission(job.id); }} className="w-full rounded-lg bg-gray-900 px-3 py-2 text-[11px] font-black text-white transition-colors hover:bg-gray-800">
                                Review Submission
                              </button>
                            )}
                            {statusLabel === "Revision Requested" && (
                              <button type="button" onClick={() => { setSelectedId(contract.id); setIsModalOpen(true); }} className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-black text-red-600 hover:bg-red-100">
                                Review Revision
                              </button>
                            )}
                            <button type="button" onClick={() => { setSelectedId(contract.id); setIsModalOpen(true); }} className="flex min-w-[116px] items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] font-black text-gray-700 hover:bg-gray-50">
                              View Details <ChevronRight className="h-3 w-3" />
                            </button>
                            <button type="button" onClick={() => { if (!contract.jobId || !contract.freelancerId) return; router.push(`/client/dashboard/messages?chat=${createConversationId(contract.jobId, contract.freelancerId)}`); }} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50">
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                            <KebabDropdown>
                              <KebabMenuItem onSelect={() => openDispute(contract.id, contract.title)}>Raise Dispute</KebabMenuItem>
                              {!isFinishedContract(contract) && contract.terminationStatus !== "pending_review" && contract.terminationStatus !== "approved" && (
                                <KebabMenuItem onSelect={() => openTermination(contract)}>Request Termination</KebabMenuItem>
                              )}
                            </KebabDropdown>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                        <AlertCircle className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[12px] font-black text-blue-700">Need help?</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-blue-500">You can request revisions if the work needs changes before approving and releasing payment.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-[12px] text-gray-400">Showing {visibleContracts.length} of {contracts.length} contracts</p>
              </>
            )}
          </>
        )}

        {/* ACTIVE CONTRACTS — milestone progress view */}
        {activeTab === "contracts" && view === "ongoing" && (
          <>
            {loading ? (
              <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
            ) : visibleContracts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-300 mb-3" />
                <p className="font-bold text-gray-800">{searchQuery ? "No results found" : "No active contracts"}</p>
                <p className="text-sm text-gray-400 mt-1">{searchQuery ? "Try a different search term" : "All caught up!"}</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-[0_1px_6px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                      <SortDesc className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-900">Active Contracts ({visibleContracts.length})</h2>
                      <p className="text-[12px] text-gray-400">Projects currently in progress.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {visibleContracts.map((contract) => {
                    const totalMs = contract.milestones?.length ?? 0;
                    const perMs = totalMs > 0 ? Math.round((contract.paymentTotalAmountSats ?? 0) / totalMs) : 0;
                    return (
                      <div key={contract.id} className="rounded-xl bg-white border border-gray-100 shadow-[0_1px_8px_rgba(15,23,42,0.05)] transition-all hover:border-gray-200 hover:shadow-md overflow-hidden">
                        {/* Mobile card (< lg) */}
                        <div className="lg:hidden px-4 py-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <Avatar name={contract.freelancer} imageUrl={contract.companyLogo} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-black leading-snug text-gray-900 break-words">{contract.title}</p>
                              <p className="text-[12px] text-gray-400 mt-0.5 truncate">with {contract.freelancer}</p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <StatusBadge label="In Progress" />
                                {contract.terminationStatus === "pending_review" && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                    <Clock className="h-2.5 w-2.5" /> Termination Pending
                                  </span>
                                )}
                                <span className="text-[10px] font-semibold text-gray-500">Started {contract.startDate}</span>
                              </div>
                            </div>
                          </div>
                          <MilestoneTimeline contract={contract} />
                          <div className="grid grid-cols-2 gap-2 text-[12px]">
                            <div className="rounded-lg bg-gray-50 px-3 py-2">
                              <p className="text-[10px] text-gray-400 font-medium">Budget</p>
                              <p className="font-black text-gray-900">{contract.paymentTotalAmountSats ? `${contract.paymentTotalAmountSats.toLocaleString()} sats` : contract.budget}</p>
                              {perMs > 0 && <p className="text-[10px] text-gray-400">{perMs.toLocaleString()} sats/milestone</p>}
                            </div>
                            <div className="rounded-lg bg-gray-50 px-3 py-2">
                              <p className="text-[10px] text-gray-400 font-medium">Due</p>
                              <p className="font-semibold text-gray-900">{contract.dueDate}</p>
                              <p className="text-[10px] text-orange-500 font-bold">{getDueLabel(contract.dueDate)}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 items-center">
                            <button type="button" onClick={() => { setSelectedId(contract.id); setIsModalOpen(true); }} className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[12px] font-black text-gray-700 hover:bg-gray-50">
                              View Details <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => { if (!contract.jobId || !contract.freelancerId) return; router.push(`/client/dashboard/messages?chat=${createConversationId(contract.jobId, contract.freelancerId)}`); }} className="rounded-lg border border-gray-200 bg-white p-2.5 text-gray-500 hover:bg-gray-50">
                              <MessageSquare className="h-4 w-4" />
                            </button>
                            <KebabDropdown>
                              <KebabMenuItem onSelect={() => openDispute(contract.id, contract.title)}>Raise Dispute</KebabMenuItem>
                              {contract.terminationStatus !== "pending_review" && contract.terminationStatus !== "approved" && (
                                <KebabMenuItem onSelect={() => openTermination(contract)}>Request Termination</KebabMenuItem>
                              )}
                            </KebabDropdown>
                          </div>
                        </div>

                        {/* Desktop layout (lg+) */}
                        <div className="hidden lg:grid grid-cols-[1.25fr_1.8fr_0.65fr_0.75fr_0.75fr] items-center gap-5 px-5 py-4">
                          <div className="flex min-w-0 items-center gap-4 border-r border-gray-100 pr-4">
                            <Avatar name={contract.freelancer} imageUrl={contract.companyLogo} />
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-black leading-snug text-gray-900">{contract.title}</p>
                              <p className="mt-0.5 truncate text-[11px] text-gray-400">Freelancer: {contract.freelancer}</p>
                              <div className="mt-3 flex flex-wrap items-center gap-3">
                                <StatusBadge label="In Progress" />
                                {contract.terminationStatus === "pending_review" && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                    <Clock className="h-2.5 w-2.5" /> Termination Pending
                                  </span>
                                )}
                                <span className="text-[10px] font-semibold text-gray-500">Started {contract.startDate}</span>
                              </div>
                            </div>
                          </div>
                          <div className="min-w-0 border-r border-gray-100 pr-4">
                            <MilestoneTimeline contract={contract} />
                          </div>
                          <div className="border-r border-gray-100 pr-4">
                            <p className="text-[10px] text-gray-400">Budget</p>
                            <p className="mt-1 text-[14px] font-black text-gray-900">{contract.paymentTotalAmountSats ? `${contract.paymentTotalAmountSats.toLocaleString()} sats` : contract.budget}</p>
                            {perMs > 0 && <p className="text-[10px] text-gray-400">{perMs.toLocaleString()} sats per milestone</p>}
                          </div>
                          <div className="border-r border-gray-100 pr-4">
                            <p className="text-[10px] text-gray-400">Dates</p>
                            <p className="mt-1 text-[12px] font-bold text-gray-800">{contract.startDate} -</p>
                            <p className="text-[12px] font-bold text-gray-800">{contract.dueDate}</p>
                            <p className="mt-1 text-[11px] font-semibold text-orange-500">{getDueLabel(contract.dueDate)}</p>
                          </div>
                          <div className="flex flex-col items-stretch gap-2">
                            <button type="button" onClick={() => { setSelectedId(contract.id); setIsModalOpen(true); }} className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] font-black text-gray-700 hover:bg-gray-50">
                              View Details <ChevronRight className="h-3 w-3" />
                            </button>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => { if (!contract.jobId || !contract.freelancerId) return; router.push(`/client/dashboard/messages?chat=${createConversationId(contract.jobId, contract.freelancerId)}`); }} className="flex-1 flex items-center justify-center rounded-lg border border-gray-200 bg-white py-2 text-gray-500 hover:bg-gray-50">
                                <MessageSquare className="h-3.5 w-3.5" />
                              </button>
                              <KebabDropdown>
                                <KebabMenuItem onSelect={() => openDispute(contract.id, contract.title)}>Raise Dispute</KebabMenuItem>
                                {contract.terminationStatus !== "pending_review" && contract.terminationStatus !== "approved" && (
                                  <KebabMenuItem onSelect={() => openTermination(contract)}>Request Termination</KebabMenuItem>
                                )}
                              </KebabDropdown>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* SUBMITTED JOBS - split panel view */}
        {activeTab === "submitted" && (
          <>
            {submittedJobsForReview.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-300 mb-3" />
                <p className="font-bold text-gray-800">No submitted jobs</p>
                <p className="text-sm text-gray-400 mt-1">You don't have any submitted work yet</p>
              </div>
            ) : (
              <div className="w-full max-w-full min-w-0 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
                {/* Left: list */}
                <div className="w-full max-w-full min-w-0 flex min-h-0 flex-col space-y-3 xl:max-h-[var(--review-list-height)] xl:overflow-hidden" style={reviewListHeight ? ({ "--review-list-height": `${reviewListHeight}px` } as any) : undefined}>
                  <div className="w-full max-w-full min-w-0 rounded-xl border border-gray-100 bg-white px-4 py-4 shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
                    <h2 className="font-black text-gray-900">Submitted Jobs ({submittedJobsForReview.length})</h2>
                    <p className="text-[12px] text-gray-400">All work submitted by freelancers for this client account.</p>
                  </div>
                  <div className="w-full max-w-full min-w-0 min-h-0 flex-1 space-y-3 xl:overflow-y-auto xl:pr-1">
                    {submittedJobsForReview.map((job) => {
                      const contract = contracts.find((c) => c.id === job.contractId);
                      const isSelected = selectedSubmissionId === job.id || (!selectedSubmissionId && submittedJobsForReview[0]?.id === job.id);
                      const total = contract?.paymentTotalAmountSats ?? 0;
                      const releasedCount = contract?.paymentReleasedInstallments ?? 0;
                      const totalMs = contract?.milestones?.length ?? contract?.paymentInstallments ?? 0;
                      const currentMilestone = job.milestoneIndex ?? Math.min(releasedCount + 1, totalMs || releasedCount + 1);
                      const progress = totalMs > 0 ? Math.round((currentMilestone / totalMs) * 100) : contract?.progress ?? 0;
                      const jobStatusLabel = job.status === "approved" ? "Approved" : job.status === "rejected" ? "Return for adjustment" : "Awaiting review";
                      const jobStatusColor = job.status === "approved" ? "text-green-600" : job.status === "rejected" ? "text-red-600" : "text-orange-600";
                      return (
                        <button key={job.id} type="button" onClick={() => { setSelectedSubmissionId(job.id); if (typeof window !== "undefined" && window.innerWidth < 1280) setIsSubmissionModalOpen(true); }}
                          className={`w-full max-w-full min-w-0 rounded-xl border px-4 py-4 text-left shadow-[0_1px_8px_rgba(15,23,42,0.04)] transition-all ${isSelected ? "border-orange-300 bg-orange-50/70 ring-1 ring-orange-200" : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-md"}`}>
                          <div className="flex items-start gap-3">
                            <Avatar name={contract?.freelancer ?? "F"} size="sm" imageUrl={contract?.companyLogo} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="truncate text-[13px] font-black leading-snug text-gray-900">{contract?.title ?? "Contract"}</p>
                                <span className="flex-shrink-0 rounded-lg bg-orange-100 px-2 py-1 text-[10px] font-black text-orange-700">
                                  Milestone {currentMilestone} / {totalMs || "?"}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-0.5 truncate">Freelancer: {contract?.freelancer}</p>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-[1fr_auto_18px] items-center gap-3">
                            <div className={`flex items-center gap-1 text-[10px] ${jobStatusColor} min-w-0`}>
                              <Clock className="h-3 w-3 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-black truncate">{jobStatusLabel}</p>
                                <p className="mt-0.5 text-gray-400 truncate">Submitted: {job.submittedAt.toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="border-l border-gray-100 pl-3 flex-shrink-0">
                              <p className="text-[10px] text-gray-400">Budget</p>
                              <p className="text-[11px] font-black text-gray-800">{total > 0 ? `${total.toLocaleString()} sats` : contract?.budget}</p>
                            </div>
                            <ChevronRight className={`h-4 w-4 flex-shrink-0 ${isSelected ? "text-orange-500" : "text-gray-300"}`} />
                          </div>
                          <div className="mt-2">
                            <ProgressBar percent={progress} color="orange" />
                            <p className="text-right text-[10px] text-gray-400 mt-0.5">{progress}% Complete</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right: detail panel */}
                {(() => {
                  const job = selectedSubmissionId ? submittedJobsForReview.find((j) => j.id === selectedSubmissionId) ?? submittedJobsForReview[0] : submittedJobsForReview[0];
                  const contract = job ? contracts.find((c) => c.id === job.contractId) : null;
                  if (!job || !contract) return null;
                  const total = contract.paymentTotalAmountSats ?? 0;
                  const totalMs = contract.milestones?.length ?? 0;
                  const perMs = totalMs > 0 ? Math.round(total / totalMs) : 0;
                  const releasedCount = contract.paymentReleasedInstallments ?? 0;
                  const currentMilestone = job.milestoneIndex ?? Math.min(releasedCount + 1, totalMs || releasedCount + 1);
                  const reviewProgress = totalMs > 0 ? Math.round((currentMilestone / totalMs) * 100) : contract.progress;
                  const detailStatusLabel = job.status === "approved" ? "Approved" : job.status === "rejected" ? "Return for adjustment" : "Awaiting review";
                  return (
                    <div ref={reviewDetailRef} className="hidden overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_1px_10px_rgba(15,23,42,0.05)] xl:block">
                      <div className="px-6 py-5 border-b border-gray-100">
                        <div className="flex items-start gap-4">
                          <Avatar name={contract.freelancer} size="lg" imageUrl={contract.companyLogo} />
                          <div className="flex-1 min-w-0">
                            <h2 className="text-[18px] font-black text-gray-900">{contract.title}</h2>
                            <p className="text-[12px] text-gray-400 mt-0.5">Freelancer: {contract.freelancer}</p>
                          </div>
                          <div className="text-right">
                            <StatusBadge label={detailStatusLabel} />
                            <p className="mt-1 text-[11px] font-bold text-gray-500">Milestone {currentMilestone} of {totalMs}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-0 mt-5 pt-4 border-t border-gray-100">
                          {[
                            { label: "Total Budget", value: total > 0 ? `${total.toLocaleString()} sats` : contract.budget },
                            { label: "Start Date", value: contract.startDate },
                            { label: "Due Date", value: contract.dueDate, accent: true },
                            { label: "Progress", value: `${reviewProgress}%` },
                          ].map(({ label, value, accent }) => (
                            <div key={label} className="border-r border-gray-100 px-4 first:pl-0 last:border-r-0">
                              <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> {label}
                              </p>
                              <p className={`text-[13px] font-bold ${accent ? "text-orange-500" : "text-gray-900"}`}>{value}</p>
                              {label === "Progress" && <div className="mt-2"><ProgressBar percent={reviewProgress} color="orange" /></div>}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Milestones */}
                      <div className="px-6 py-4">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">Milestones</p>
                        <div className="overflow-hidden rounded-xl border border-gray-100">
                          {contract.milestones?.map((ms, i) => {
                            const isReleased = ms.status === "released" || ms.status === "approved" || ms.status === "Approved";
                            const isCurrent = i === currentMilestone - 1;
                            const isAwaitingReview = isCurrent && job.status === "pending";
                            const msAmount = ms.freelancerAmountSats ?? perMs;
                            return (
                              <details key={i} open={isAwaitingReview} className={`border-b last:border-b-0 ${isAwaitingReview ? "border-orange-100 bg-orange-50/65" : "border-gray-100 bg-white"}`}>
                                <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none">
                                  <MilestoneDot state={isReleased ? "approved" : isAwaitingReview ? "review" : isCurrent ? "active" : "pending"} index={i} size="md" />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[13px] text-gray-900">{ms.title || ms.name || `Milestone ${i + 1}`}</p>
                                    <p className="text-[11px] text-gray-400">{isReleased ? `Submitted: ${job.submittedAt.toLocaleDateString()} - Approved ${ms.deadline || contract.dueDate}` : isAwaitingReview ? `Submitted: ${job.submittedAt.toLocaleDateString()}` : ms.deadline ? `Due ${ms.deadline}` : "Pending"}</p>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <StatusBadge label={isReleased ? "Approved" : isAwaitingReview ? "Awaiting Review" : isCurrent ? "In Progress" : "Pending"} />
                                    <span className="text-[12px] font-bold text-gray-700">{msAmount ? `${Number(msAmount).toLocaleString()} sats` : ms.amount}</span>
                                    <ChevronRight className="h-4 w-4 text-gray-300" />
                                  </div>
                                </summary>
                                {isAwaitingReview && (
                                  <div className="px-4 pb-4 border-t border-orange-100">
                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mt-3 mb-2">Freelancer's note</p>
                                    <p className="text-[13px] text-gray-700 bg-white rounded-lg border border-gray-100 px-3 py-2.5">
                                      {job.description || "Work submitted for review."}
                                    </p>
                                    {job.link && (
                                      <a href={job.link} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1.5 text-[12px] text-blue-600 hover:underline">
                                        <ArrowRight className="h-3 w-3" /> {job.link}
                                      </a>
                                    )}
                                    {job.attachment && (
                                      <a href={job.attachment.url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
                                        📎 {job.attachment.name}
                                        <span className="ml-auto text-[10px] text-gray-400">Download</span>
                                      </a>
                                    )}
                                  </div>
                                )}
                              </details>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
                        {job.status === "pending" && (
                          <button type="button" onClick={() => openChangeRequest(job.id)} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-[13px] font-bold text-gray-700 transition-colors hover:bg-gray-50">
                            <MessageSquare className="h-4 w-4" /> Request Revision
                          </button>
                        )}
                        <button type="button" onClick={() => { if (!contract.jobId || !contract.freelancerId) return; router.push(`/client/dashboard/messages?chat=${createConversationId(contract.jobId, contract.freelancerId)}`); }} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-[13px] font-bold text-gray-700 transition-colors hover:bg-gray-50">
                          <MessageSquare className="h-4 w-4" /> Message Freelancer
                        </button>
                        {job.status === "pending" && (
                          <button type="button" onClick={() => handleApproveSubmission(job.id)} className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-[13px] font-bold text-white transition-colors hover:bg-gray-800">
                            <CheckCircle2 className="h-4 w-4" /> Approve & Release Payment
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}

        {/* COMPLETED CONTRACTS */}
        {activeTab === "contracts" && view === "finished" && (
          <>
            {visibleContracts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-300 mb-3" />
                <p className="font-bold text-gray-800">{searchQuery ? "No results found" : "No completed contracts"}</p>
                <p className="text-sm text-gray-400 mt-1">{searchQuery ? "Try a different search term" : "Completed projects will appear here"}</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-green-100 bg-green-50/40 px-4 py-3.5 shadow-[0_1px_10px_rgba(15,23,42,0.04)]">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-black text-gray-900">Completed Contracts ({visibleContracts.length})</h2>
                    <p className="text-[12px] text-gray-400">Successfully completed projects.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {visibleContracts.map((contract) => {
                    const total = contract.paymentTotalAmountSats ?? 0;
                    const totalMs = contract.milestones?.length || contract.paymentInstallments || 0;
                    return (
                      <div key={contract.id} className="rounded-2xl border border-l-4 border-gray-100 border-l-green-500 bg-white shadow-[0_1px_10px_rgba(15,23,42,0.05)] transition-all hover:shadow-md overflow-hidden">
                        {/* Mobile card (< lg) */}
                        <div className="lg:hidden px-4 py-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <Avatar name={contract.freelancer} imageUrl={contract.companyLogo} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-black leading-snug text-gray-900 break-words">{contract.title}</p>
                              <p className="text-[12px] text-gray-400 mt-0.5 truncate">with {contract.freelancer}</p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <StatusBadge label="Completed" />
                                <span className="text-[10px] font-semibold text-gray-500">{contract.startDate} – {contract.dueDate}</span>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[12px]">
                            <div className="rounded-lg bg-gray-50 px-3 py-2">
                              <p className="text-[10px] text-gray-400 font-medium">Total Budget</p>
                              <p className="font-black text-gray-900">{total > 0 ? `${total.toLocaleString()} sats` : contract.budget}</p>
                            </div>
                            <div className="rounded-lg bg-gray-50 px-3 py-2">
                              <p className="text-[10px] text-gray-400 font-medium">Milestones</p>
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                <span className="font-bold text-gray-900">{totalMs}/{totalMs} done</span>
                              </div>
                            </div>
                          </div>
                          <ProgressBar percent={100} color="green" />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { setSelectedId(contract.id); setIsModalOpen(true); }} className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[12px] font-black text-gray-700 hover:bg-gray-50">
                              View Contract <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => { if (!contract.jobId || !contract.freelancerId) return; router.push(`/client/dashboard/messages?chat=${createConversationId(contract.jobId, contract.freelancerId)}`); }} className="rounded-lg border border-gray-200 bg-white p-2.5 text-gray-500 hover:bg-gray-50">
                              <MessageSquare className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Desktop layout (lg+) */}
                        <div className="hidden lg:grid min-h-[116px] grid-cols-[1.45fr_1.05fr_1.35fr_0.85fr] items-center gap-5 px-5 py-4">
                          <div className="flex min-w-0 items-center gap-4 border-r border-gray-100 pr-4">
                            <Avatar name={contract.freelancer} imageUrl={contract.companyLogo} />
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-black leading-snug text-gray-900">{contract.title}</p>
                              <p className="mt-0.5 truncate text-[11px] text-gray-400">Freelancer: {contract.freelancer}</p>
                              <div className="mt-4 flex flex-wrap items-center gap-3">
                                <StatusBadge label="Completed" />
                                <span className="text-[10px] font-semibold text-gray-500">Completed: {contract.dueDate}</span>
                              </div>
                            </div>
                          </div>
                          <div className="border-r border-gray-100 pr-4">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-[11px] text-gray-500">Total Budget</span>
                            </div>
                            <p className="mt-1 font-black text-[14px] text-gray-900">{total > 0 ? `${total.toLocaleString()} sats` : contract.budget}</p>
                            <div className="mt-3 flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-[11px] text-gray-500">Duration</span>
                            </div>
                            <p className="text-[12px] font-semibold text-gray-700">{contract.startDate} - {contract.dueDate}</p>
                          </div>
                          <div className="border-r border-gray-100 pr-4">
                            <p className="mb-1 text-[11px] font-bold text-gray-700">Milestones</p>
                            <div className="flex items-center gap-1 mb-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              <span className="text-[12px] font-semibold text-gray-700">{totalMs} / {totalMs} Completed</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1"><ProgressBar percent={100} color="green" /></div>
                              <span className="text-[10px] font-bold text-gray-500">100%</span>
                            </div>
                            <div className="mt-1 space-y-0.5">
                              <div className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /><span className="text-[10px] text-green-600">All payments released</span></div>
                              <div className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /><span className="text-[10px] text-green-600">Contract closed</span></div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button type="button" onClick={() => { setSelectedId(contract.id); setIsModalOpen(true); }} className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[12px] font-black text-gray-700 shadow-sm hover:bg-gray-50">
                              View Contract <ChevronRight className="h-3 w-3" />
                            </button>
                            <button type="button" onClick={() => { if (!contract.jobId || !contract.freelancerId) return; router.push(`/client/dashboard/messages?chat=${createConversationId(contract.jobId, contract.freelancerId)}`); }} className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[12px] font-bold text-gray-600 shadow-sm hover:bg-gray-50">
                              <MessageSquare className="h-3.5 w-3.5" /> Message Freelancer
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* CONTRACT DETAIL MODAL */}
      {isModalOpen && selectedContract && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center px-2 py-2 sm:items-center sm:px-5 sm:py-5">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative z-[81] max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl md:max-w-3xl lg:max-w-5xl">
            <div className="border-b border-gray-100 px-6 pb-4 pt-5">
              <button type="button" onClick={() => setIsModalOpen(false)} className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-lg">✕</button>
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge label={isFinishedContract(selectedContract) ? "Completed" : isEscrowContract(selectedContract) ? "In Progress" : "Active"} />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Contract #{selectedContract.id.slice(-6).toUpperCase()}</span>
              </div>
              <h2 className="text-[22px] font-black text-gray-900 leading-tight">{selectedContract.title}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <Avatar name={selectedContract.freelancer} size="sm" imageUrl={selectedContract.companyLogo} />
                <span className="text-[13px] text-gray-500">Freelancer: <strong className="text-gray-800">{selectedContract.freelancer}</strong></span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-b border-gray-50 px-6 py-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Total Contract Value</p>
                <p className="text-[18px] font-black text-orange-500">
                  {(() => { const sats = selectedContract.paymentTotalAmountSats || parseSats(selectedContract.budget) || 0; return sats > 0 ? `${sats.toLocaleString()} sats` : selectedContract.budget; })()}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Escrow Status</p>
                <div className="flex items-center gap-1.5">
                  <Shield className={`h-4 w-4 ${selectedContract.paymentStatus === "funded" || selectedContract.paymentStatus === "released" ? "text-blue-500" : "text-gray-300"}`} />
                  <span className="text-[14px] font-bold text-gray-900">
                    {selectedContract.paymentStatus === "funded" ? "Funds Secured" : selectedContract.paymentStatus === "released" ? "Released" : selectedContract.paymentStatus === "invoice_created" ? "Invoice Sent" : "Not Funded"}
                  </span>
                </div>
              </div>
            </div>
            <div className="border-b border-gray-50 px-6 py-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-3">Contract Overview</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[{ label: "Contract Type", value: selectedContract.contractType ?? "Fixed Price" }, { label: "Work Status", value: selectedContract.workStatus?.replace(/_/g, " ") ?? "Not started" }, { label: "Start Date", value: selectedContract.startDate }, { label: "Due Date", value: selectedContract.dueDate }, { label: "Progress", value: `${selectedContract.progress}%` }, { label: "Next Milestone", value: selectedContract.nextMilestone }].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
                    <div className="mt-0.5 font-bold text-[13px] text-gray-900 capitalize truncate">{value}</div>
                  </div>
                ))}
              </div>
            </div>
            {selectedContract.description && selectedContract.description !== "-" && (
              <div className="border-b border-gray-50 px-6 py-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-2">Description</p>
                <p className="text-[13px] text-gray-600 leading-relaxed">{selectedContract.description}</p>
              </div>
            )}
            {selectedContract.scopeItems && selectedContract.scopeItems.length > 0 && (
              <div className="border-b border-gray-50 px-6 py-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-3">Scope of Work</p>
                <ul className="space-y-1.5">{selectedContract.scopeItems.map((item) => <li key={item} className="flex items-start gap-2 text-[13px] text-gray-600"><span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orange-400" /><span>{item}</span></li>)}</ul>
              </div>
            )}
            {selectedContract.milestones && selectedContract.milestones.length > 0 && (
              <div className="border-b border-gray-50 px-6 py-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-3">Milestones</p>
                <div className="relative">
                  <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-gray-100" />
                  <div className="space-y-4">
                    {selectedContract.milestones.map((ms, i) => {
                      const isReleased = ms.status === "released";
                      const isCurrent = !isReleased && i === (selectedContract.paymentReleasedInstallments ?? 0);
                      const msAmount = ms.freelancerAmountSats ? `${ms.freelancerAmountSats.toLocaleString()} sats` : ms.amount ?? "—";
                      const msStatusLabel = isReleased ? "Paid" : ms.status === "funded" || ms.status === "submitted" ? "Pending" : "Scheduled";
                      return (
                        <div key={i} className="flex items-start gap-4 pl-6 relative">
                          <div className={`absolute left-0 top-1 h-4 w-4 rounded-full border-2 flex items-center justify-center ${isReleased ? "border-green-500 bg-green-500" : isCurrent ? "border-orange-400 bg-orange-400" : "border-gray-200 bg-white"}`}>
                            {isReleased && <span className="text-[8px] text-white font-black">✓</span>}
                          </div>
                          <div className="flex-1 flex items-start justify-between gap-2">
                            <div>
                              <p className={`text-[13px] font-bold ${isReleased ? "text-gray-400" : "text-gray-900"}`}>{ms.title || ms.name || `Milestone ${i + 1}`}</p>
                              {ms.deadline && <p className="text-[11px] text-gray-400 mt-0.5">{isReleased ? "Completed on" : "Due"} {ms.deadline}</p>}
                            </div>
                            <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${isReleased ? "bg-blue-50 text-blue-600" : ms.status === "submitted" ? "bg-orange-50 text-orange-600" : "bg-gray-50 text-gray-500"}`}>
                              {msAmount} · {msStatusLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            <div className="border-b border-gray-50 px-6 py-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-3">Payment Details</p>
              {(() => {
                const jobAmount = selectedContract.paymentTotalAmountSats || parseSats(selectedContract.budget) || 0;
                const platformFee = selectedContract.platformFeeSats || Math.ceil(jobAmount * ((selectedContract.platformFeePercent ?? 5) / 100));
                const clientTotal = selectedContract.paymentTotalChargedSats || jobAmount + platformFee;
                const released = selectedContract.escrowReleasedSats ?? 0;
                const funded = selectedContract.escrowFundedTotalSats ?? 0;
                const remainingFunded = Math.max(0, funded - platformFee - released);
                return (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[{ label: "Total Value", value: `${jobAmount.toLocaleString()} sats` }, { label: "Client Pays (w/ Fee)", value: `${clientTotal.toLocaleString()} sats` }, { label: "Funded Escrow", value: `${funded.toLocaleString()} sats` }, { label: "Available to Release", value: `${remainingFunded.toLocaleString()} sats` }, { label: "Platform Fee (5%)", value: `${platformFee.toLocaleString()} sats` }, { label: "Released", value: `${released.toLocaleString()} sats` }].map(({ label, value }) => (
                      <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
                        <div className="mt-0.5 font-bold text-[13px] text-gray-900">{value}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <p className="mt-3 text-[11px] text-gray-400">The 5% platform fee is included in the client invoice. Freelancer payouts are released per approved milestone.</p>
            </div>
            {submittedJobs.filter((j) => j.contractId === selectedContract.id).length > 0 && (
              <div className="border-b border-gray-50 px-6 py-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-3">Related Submissions</p>
                <div className="space-y-2">
                  {submittedJobs.filter((j) => j.contractId === selectedContract.id).map((job) => (
                    <div key={job.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-gray-900 truncate">{job.description || "Submitted work"}</p>
                        <p className="mt-0.5 text-[11px] text-gray-400">{job.submittedAt.toLocaleDateString()}</p>
                      </div>
                      <StatusBadge label={job.status === "rejected" ? "Changes Requested" : job.status === "approved" ? "Approved" : "Pending Review"} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 bg-white px-6 pb-5 pt-4">
              <button type="button" onClick={() => { if (!selectedContract?.jobId || !selectedContract?.freelancerId) return; router.push(`/client/dashboard/messages?chat=${createConversationId(selectedContract.jobId, selectedContract.freelancerId)}`); }} className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-[13px] font-bold text-white hover:bg-gray-800 transition-colors">
                <MessageSquare className="h-4 w-4" /> Message Freelancer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMISSION DETAIL MODAL */}
      {isSubmissionModalOpen && selectedSubmission && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center px-2 py-2 sm:items-center sm:px-4 sm:py-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsSubmissionModalOpen(false)} />
          <div className="relative z-[96] max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="px-5 pt-5 pb-4 border-b border-gray-50">
              <button type="button" onClick={() => setIsSubmissionModalOpen(false)} className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-lg">✕</button>
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge label={selectedSubmission.status === "approved" ? "Approved" : selectedSubmission.status === "rejected" ? "Changes Requested" : "Pending Review"} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">SUBMITTED WORK</span>
              </div>
              <h2 className="text-[20px] font-black text-gray-900 leading-tight">{selectedSubmissionContract?.title || "Contract Submission"}</h2>
              {selectedSubmission.milestoneIndex && (
                <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-2.5 py-0.5">
                  <span className="text-[10px] font-bold text-orange-700">Milestone {selectedSubmission.milestoneIndex}{selectedSubmission.milestoneTitle ? `: ${selectedSubmission.milestoneTitle}` : ""}</span>
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-gray-400">Submitted {selectedSubmission.submittedAt.toLocaleDateString()}</p>
            </div>
            <div className="px-5 py-4 border-b border-gray-50">
              <div className="rounded-xl bg-gray-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Freelancer's Submission</p>
                <p className="text-[13px] text-gray-900 leading-relaxed">{selectedSubmission.description || "Work submitted for review."}</p>
                {selectedSubmission.link && <a href={selectedSubmission.link} target="_blank" rel="noreferrer" className="mt-2 block text-[12px] text-blue-600 hover:underline break-all">{selectedSubmission.link}</a>}
                {selectedSubmission.attachment && <a href={selectedSubmission.attachment.url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50">📎 {selectedSubmission.attachment.name}</a>}
              </div>
            </div>
            {selectedSubmission.status === "rejected" && selectedSubmission.revisionMessage && (
              <div className="px-5 py-4 border-b border-gray-50">
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-2">Your Adjustment Note</p>
                  <p className="text-[13px] text-red-800 leading-relaxed">{selectedSubmission.revisionMessage}</p>
                </div>
              </div>
            )}
            <div className="px-5 pb-5 pt-4 flex flex-col gap-2">
              {selectedSubmission.status === "pending" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => { handleApproveSubmission(selectedSubmission.id); setSelectedSubmissionId(null); }} className="rounded-xl bg-green-50 py-3 text-[12px] font-bold text-green-700 hover:bg-green-100 transition-colors">Approve & Pay</button>
                    <button type="button" onClick={() => { openChangeRequest(selectedSubmission.id); setSelectedSubmissionId(null); }} className="rounded-xl bg-red-50 py-3 text-[12px] font-bold text-red-600 hover:bg-red-100 transition-colors">Request Changes</button>
                  </div>
                  {selectedSubmissionContract && <button type="button" onClick={() => { setSelectedId(selectedSubmissionContract.id); setActiveTab("contracts"); setIsModalOpen(true); setSelectedSubmissionId(null); }} className="w-full rounded-xl bg-gray-900 py-3 text-[12px] font-bold text-white hover:bg-gray-800 transition-colors">View Contract</button>}
                </>
              )}
              {selectedSubmission.status === "rejected" && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => { openChangeRequest(selectedSubmission.id); setSelectedSubmissionId(null); }} className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-[12px] font-bold text-gray-700 hover:bg-gray-50 transition-colors">Edit Note</button>
                  {selectedSubmissionContract && <button type="button" onClick={() => { setSelectedId(selectedSubmissionContract.id); setActiveTab("contracts"); setIsModalOpen(true); setSelectedSubmissionId(null); }} className="flex-1 rounded-xl bg-gray-900 py-3 text-[12px] font-bold text-white hover:bg-gray-800 transition-colors">View Contract</button>}
                </div>
              )}
              {selectedSubmission.status === "approved" && selectedSubmissionContract && (
                <button type="button" onClick={() => { setSelectedId(selectedSubmissionContract.id); setActiveTab("contracts"); setIsModalOpen(true); setSelectedSubmissionId(null); }} className="w-full rounded-xl bg-gray-900 py-3 text-[12px] font-bold text-white hover:bg-gray-800 transition-colors">View Contract</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REQUEST CHANGES MODAL */}
      {pendingChangeJob && (
        <div className="fixed inset-0 z-[105] flex items-end justify-center px-2 py-2 sm:items-center sm:px-4 sm:py-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!isRequestingChanges) setPendingChangeJobId(null); }} />
          <div className="relative z-[106] max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="px-5 pt-5 pb-4 border-b border-gray-50">
              <button type="button" onClick={() => setPendingChangeJobId(null)} disabled={isRequestingChanges} className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-lg">✕</button>
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">Request Adjustments</span>
              <h2 className="mt-1 text-[20px] font-black text-gray-900 leading-tight">{pendingChangeContract?.title || "Submitted Work"}</h2>
              <p className="mt-1.5 text-[13px] text-gray-500">Tell the freelancer exactly what needs to change.</p>
            </div>
            <div className="px-5 py-4">
              <textarea value={changeRequestNote} onChange={(e) => setChangeRequestNote(e.target.value)} rows={5} placeholder="Example: Please adjust the homepage spacing and add the missing mobile menu before resubmitting." className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-900 outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 resize-none" />
              {changeRequestError && <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-700">{changeRequestError}</p>}
            </div>
            <div className="px-5 pb-5 pt-2 flex items-center gap-3">
              <button type="button" onClick={() => setPendingChangeJobId(null)} disabled={isRequestingChanges} className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-[13px] font-bold text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button type="button" onClick={() => void handleRejectSubmission()} disabled={isRequestingChanges} className="flex-1 rounded-xl bg-orange-500 py-3 text-[13px] font-bold text-white hover:bg-orange-600 transition-colors disabled:opacity-50">
                {isRequestingChanges ? "Sending…" : pendingChangeJob.status === "rejected" ? "Update Note" : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT CONFIRMATION MODAL */}
      {showPaymentModal && pendingApprovalJobId && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center px-2 py-2 sm:items-center sm:px-4 sm:py-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative z-[101] max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="px-5 pt-5 pb-4 border-b border-gray-50">
              <button type="button" onClick={() => { setShowPaymentModal(false); setPendingApprovalJobId(null); setApprovalErrorMessage(""); }} className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-lg">✕</button>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-50"><Shield className="h-4 w-4 text-green-600" /></div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Confirm Payment</span>
              </div>
              <h2 className="text-[20px] font-black text-gray-900 leading-tight">Approve & Release Funds</h2>
              <p className="mt-1.5 text-[13px] text-gray-500">Approving this work will trigger a milestone payment to the freelancer's Lightning wallet.</p>
            </div>
            {(() => {
              const job = submittedJobs.find((j) => j.id === pendingApprovalJobId);
              const contract = job ? contracts.find((c) => c.id === job.contractId) : null;
              // const lightningAddress = freelancerData?.settings?.payment?.lightningAddress;
              // const releasedInstallments = contract?.paymentReleasedInstallments ?? 0;
              const lightningAddress =
                freelancerData?.settings?.payment?.lightningAddress ||
                freelancerData?.lightningAddress ||
                freelancerData?.settings?.lightningAddress;
              const releasedInstallments = contract?.paymentReleasedInstallments ?? 0;
              const nextMilestoneIndex = releasedInstallments + 1;
              const milestone = contract?.milestones?.find((item: any, index) => Number(item.index ?? index + 1) === nextMilestoneIndex);
              const milestoneAmountSats = Number((milestone as any)?.freelancerAmountSats ?? calculateInstallmentAmount(contract?.paymentTotalAmountSats || parseSats(contract?.budget ?? "0"), contract?.paymentInstallments ?? 1, nextMilestoneIndex));
              const milestoneLabel = milestone?.title || milestone?.name || `Milestone ${nextMilestoneIndex}`;
              const milestoneFundedSats = milestone ? Number((milestone as any).fundedSats ?? 0) : milestoneAmountSats;
              const milestoneReleasedSats = milestone ? Number((milestone as any).releasedSats ?? 0) : 0;
              const isMilestoneFunded = contract && (contract.paymentStatus === "funded" || contract.paymentStatus === "released") && (contract.paymentCurrentInstallment ?? 0) >= nextMilestoneIndex && milestoneFundedSats - milestoneReleasedSats >= milestoneAmountSats;
              const canApprove = isMilestoneFunded && !loadingFreelancer;
              return (
                <div className="px-5 py-4">
                  <div className="rounded-xl bg-gray-50 px-4 py-3 space-y-2.5 text-[13px]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Payment Details</p>
                    {[{ label: "Freelancer", value: contract?.freelancer || "Unknown" }, { label: milestoneLabel, value: `${milestoneAmountSats.toLocaleString()} sats` }, { label: "Lightning Address", value: loadingFreelancer ? "Loading…" : (lightningAddress || "Not set") }, { label: "Milestone Funded", value: isMilestoneFunded ? `Yes (Milestone ${nextMilestoneIndex})` : "No — fund escrow first" }].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between gap-4">
                        <span className="text-gray-500">{label}</span>
                        <span className="font-semibold text-gray-900 text-right break-all">{value}</span>
                      </div>
                    ))}
                  </div>
                  {approvalErrorMessage && <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[12px] text-red-700">{approvalErrorMessage}</div>}
                  <p className="mt-3 text-center text-[11px] text-gray-400">By approving, you confirm the milestone payment will be processed to the freelancer's Lightning wallet.</p>
                  <div className="mt-4 flex gap-3">
                    <button type="button" disabled={isApproving} onClick={() => { setShowPaymentModal(false); setPendingApprovalJobId(null); setApprovalErrorMessage(""); }} className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-[13px] font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">Cancel</button>
                    <button type="button" onClick={confirmApproveWithPayment} disabled={!canApprove || isApproving} className="flex-1 rounded-xl bg-orange-500 py-3 text-[13px] font-bold text-white hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
                      {isApproving ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </>
                      ) : canApprove ? (
                        "Approve & Pay"
                      ) : (
                        "Fund Escrow First"
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* DISPUTE FORM MODAL */}
      {isDisputeModalOpen && disputeContract && (
        <DisputeFormModal
          isOpen={isDisputeModalOpen}
          onClose={() => {
            setIsDisputeModalOpen(false);
            setDisputeContract(null);
          }}
          contractId={disputeContract.id}
          contractTitle={disputeContract.title}
          raisedBy="client"
        />
      )}

      {/* TERMINATION REQUEST MODAL */}
      {isTerminationModalOpen && terminationContract && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center px-2 py-2 sm:items-center sm:px-4 sm:py-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!isSubmittingTermination) setIsTerminationModalOpen(false); }} />
          <div className="relative z-[111] max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="px-5 pt-5 pb-4 border-b border-gray-50">
              <button type="button" onClick={() => setIsTerminationModalOpen(false)} disabled={isSubmittingTermination} className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-lg">✕</button>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-red-600">Contract Termination</span>
              </div>
              <h2 className="text-[20px] font-black text-gray-900 leading-tight">Request to Terminate</h2>
              <p className="mt-1.5 text-[13px] text-gray-500">
                Your request will be reviewed by our admin team before any termination is processed. You will be notified of the outcome.
              </p>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Contract summary */}
              <div className="rounded-xl bg-gray-50 px-4 py-3 space-y-2 text-[13px]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Contract Details</p>
                {[
                  { label: "Contract", value: terminationContract.title },
                  { label: "Freelancer", value: terminationContract.freelancer },
                  { label: "Budget", value: terminationContract.paymentTotalAmountSats ? `${terminationContract.paymentTotalAmountSats.toLocaleString()} sats` : terminationContract.budget },
                  {
                    label: "Remaining in Escrow",
                    value: `${Math.max(0, (terminationContract.escrowFundedTotalSats ?? 0) - (terminationContract.escrowReleasedSats ?? 0)).toLocaleString()} sats`,
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-gray-900 text-right">{value}</span>
                  </div>
                ))}
              </div>
              {/* Reason */}
              <div>
                <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Reason for termination <span className="text-red-500">*</span></label>
                <textarea
                  value={terminationReason}
                  onChange={(e) => setTerminationReason(e.target.value)}
                  rows={4}
                  placeholder="Explain why you want to terminate this contract. The admin will review your request and contact both parties if needed."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-900 outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300 resize-none"
                />
              </div>
              {terminationError && (
                <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-700">{terminationError}</p>
              )}
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                <p className="text-[12px] font-bold text-amber-700 mb-1">What happens next?</p>
                <ul className="space-y-1 text-[11px] text-amber-600 list-disc list-inside">
                  <li>Admin will review your request and may reach out to both parties</li>
                  <li>If approved, any remaining escrow balance will be refunded to your Lightning address</li>
                  <li>The contract will remain active until the admin approves the termination</li>
                </ul>
              </div>
            </div>
            <div className="px-5 pb-5 pt-2 flex items-center gap-3">
              <button type="button" onClick={() => setIsTerminationModalOpen(false)} disabled={isSubmittingTermination} className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-[13px] font-bold text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button type="button" onClick={() => void handleSubmitTermination()} disabled={isSubmittingTermination} className="flex-1 rounded-xl bg-red-500 py-3 text-[13px] font-bold text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isSubmittingTermination ? (
                  <><svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Submitting…</>
                ) : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
