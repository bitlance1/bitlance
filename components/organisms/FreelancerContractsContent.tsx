"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/atoms/Button";
import { Briefcase, Calendar, ClipboardCheck, FileText } from "lucide-react";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, doc, getDoc, getDocs, increment, limit, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";

type ContractStatus = "Active" | "Review" | "Completed";

type Contract = {
  id: string;
  title: string;
  clientName: string;
  clientId?: string;
  freelancerId?: string;
  jobId?: string;
  contractType?: "Fixed Price" | "Hourly";
  status: ContractStatus;
  budget: string;
  progress: number;
  nextMilestone: string;
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
  submissionAttachment?: {
    name?: string;
    url?: string;
  } | null;
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
};

type SubmittedJob = {
  id: string;
  contractId: string;
  milestoneIndex?: number;
  milestoneTitle?: string;
  description: string;
  link?: string;
  attachment?: {
    name: string;
    url: string;
  };
  submittedAt: Date;
  status: "pending" | "approved" | "rejected";
  revisionMessage?: string;
};

const formatDate = (value: any) => {
  if (!value) return "-";
  if (typeof value === "string") return value;
  const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const formatSats = (value: string) =>
  value.toLowerCase().includes("sats") ? value : `${value} sats`;

const parseSats = (value: unknown) => {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "").replace(/[^0-9]/g, "");
  return cleaned ? Number(cleaned) : 0;
};

const calculateInstallmentAmount = (total: number, installments: number, installment: number) => {
  const safeTotal = Math.max(0, Math.trunc(total));
  const safeInstallments = Math.max(1, Math.min(3, Math.trunc(installments)));
  const safeInstallment = Math.max(1, Math.min(safeInstallments, Math.trunc(installment)));
  const base = Math.floor(safeTotal / safeInstallments);
  const remainder = safeTotal % safeInstallments;
  return base + (safeInstallment <= remainder ? 1 : 0);
};

export default function FreelancerContractsContent() {
  const router = useRouter();
  const [view, setView] = useState<"active" | "ongoing" | "finished">("active");
  const [selectedId, setSelectedId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [workMessage, setWorkMessage] = useState("");
  const [workLink, setWorkLink] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [activeTab, setActiveTab] = useState<'contracts' | 'submitted'>('contracts');
  const [submittedJobs, setSubmittedJobs] = useState<SubmittedJob[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [editWorkMessage, setEditWorkMessage] = useState("");
  const [editWorkLink, setEditWorkLink] = useState("");
  const [editSelectedFile, setEditSelectedFile] = useState<File | null>(null);
  const [editSubmissionError, setEditSubmissionError] = useState("");
  const [editSubmissionSuccess, setEditSubmissionSuccess] = useState("");
  const [isUpdatingSubmission, setIsUpdatingSubmission] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const createConversationId = (jobId: string, freelancerId: string) => `${jobId}_${freelancerId}`;
  const clientNameCache = useRef<Record<string, string>>({});
  const clientAvatarCache = useRef<Record<string, string>>({});
  const freelancerAvatarCache = useRef<Record<string, string>>({});

  const resolveClientName = async (clientId: string, fallbackName: string) => {
    const initialFallback = fallbackName?.trim() || "";
    if (!clientId) return initialFallback || "Client";
    if (clientNameCache.current[clientId]) return clientNameCache.current[clientId];

    let resolvedName = initialFallback;

    try {
      const clientDocSnap = await getDoc(doc(firebaseDb, "clients", clientId));
      if (clientDocSnap.exists()) {
        const data = clientDocSnap.data() as any;
        resolvedName = data.fullName ?? data.firstName ?? data.name ?? resolvedName;
      }
    } catch {
      // Continue with UID-based lookup.
    }

    if (!resolvedName) {
      try {
        const clientsByUidQuery = query(
          collection(firebaseDb, "clients"),
          where("uid", "==", clientId),
          limit(1)
        );
        const clientsByUidSnap = await getDocs(clientsByUidQuery);
        if (!clientsByUidSnap.empty) {
          const data = clientsByUidSnap.docs[0].data() as any;
          resolvedName = data.fullName ?? data.firstName ?? data.name ?? resolvedName;
        }
      } catch {
        // Continue with all_users fallback.
      }
    }

    if (!resolvedName) {
      try {
        const allUsersSnap = await getDoc(doc(firebaseDb, "all_users", clientId));
        if (allUsersSnap.exists()) {
          const data = allUsersSnap.data() as any;
          resolvedName = data.fullName ?? data.name ?? data.email ?? resolvedName;
        }
      } catch {
        // Keep fallback below.
      }
    }

    const finalName = resolvedName || "Client";
    clientNameCache.current[clientId] = finalName;
    return finalName;
  };

  const resolveClientAvatar = async (clientId: string) => {
    if (!clientId) return "";
    if (clientAvatarCache.current[clientId] !== undefined) return clientAvatarCache.current[clientId];

    let avatarUrl = "";
    try {
      const [clientSnap, allUsersSnap] = await Promise.all([
        getDoc(doc(firebaseDb, "clients", clientId)),
        getDoc(doc(firebaseDb, "all_users", clientId)),
      ]);
      const c = clientSnap.exists() ? (clientSnap.data() as any) : {};
      const a = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
      avatarUrl = c.avatarUrl ?? a.avatarUrl ?? "";
    } catch {
      avatarUrl = "";
    }

    clientAvatarCache.current[clientId] = avatarUrl;
    return avatarUrl;
  };

  const resolveFreelancerAvatar = async (freelancerId: string) => {
    if (!freelancerId) return "";
    if (freelancerAvatarCache.current[freelancerId] !== undefined) {
      return freelancerAvatarCache.current[freelancerId];
    }

    let avatarUrl = "";
    try {
      const [freelancerSnap, allUsersSnap] = await Promise.all([
        getDoc(doc(firebaseDb, "freelancers", freelancerId)),
        getDoc(doc(firebaseDb, "all_users", freelancerId)),
      ]);
      const f = freelancerSnap.exists() ? (freelancerSnap.data() as any) : {};
      const a = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
      avatarUrl = f.avatarUrl ?? a.avatarUrl ?? "";
    } catch {
      avatarUrl = "";
    }

    freelancerAvatarCache.current[freelancerId] = avatarUrl;
    return avatarUrl;
  };

  const uploadContractFile = async (file: File) => {
    const idToken = await firebaseAuth.currentUser?.getIdToken();
    if (!idToken) throw new Error("Please log in before uploading files.");
    const formData = new FormData();
    formData.append("file", file);
    const uploadResponse = await fetch("/api/chat/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
      body: formData,
    });
    const uploadPayload = (await uploadResponse.json()) as any;
    if (!uploadResponse.ok || !uploadPayload?.url) {
      throw new Error(uploadPayload?.error || "Failed to upload attachment.");
    }
    return {
      url: uploadPayload.url,
      name: uploadPayload.name ?? file.name,
      bytes: uploadPayload.bytes ?? file.size,
      size: uploadPayload.size ?? file.size,
      mimeType: uploadPayload.mimeType ?? file.type,
      resourceType: uploadPayload.resourceType ?? "auto",
      publicId: uploadPayload.publicId ?? "",
    };
  };

  const handleSubmitWork = async () => {
    if (!selectedContract || !selectedContract.clientId || !selectedContract.freelancerId) return;
    const nextMilestoneIndex = (selectedContract.paymentReleasedInstallments ?? 0) + 1;
    const milestone = selectedContract.milestones?.find((item: any, index) => Number(item.index ?? index + 1) === nextMilestoneIndex);
    const milestoneAmount = Number((milestone as any)?.freelancerAmountSats ?? calculateInstallmentAmount(selectedContract.paymentTotalAmountSats || parseSats(selectedContract.budget), selectedContract.paymentInstallments ?? 1, nextMilestoneIndex));
    const fundedForMilestone = milestone
      ? Number((milestone as any).fundedSats ?? 0) - Number((milestone as any).releasedSats ?? 0)
      : milestoneAmount;
    if (selectedContract.paymentStatus !== "funded" && selectedContract.paymentStatus !== "released") {
      setSubmissionError("Escrow is not funded for this milestone yet.");
      return;
    }
    if (fundedForMilestone < milestoneAmount) {
      setSubmissionError(`Milestone escrow is short by ${(milestoneAmount - fundedForMilestone).toLocaleString()} sats. Ask the client to fund escrow before submitting.`);
      return;
    }
    setIsSubmitting(true);
    setSubmissionError("");
    setSubmissionSuccess("");

    try {
      const attachment = selectedFile ? await uploadContractFile(selectedFile) : null;
      const contractUrl = `/client/dashboard/contracts?contract=${selectedContract.id}`;
      const notificationText = `Work for "${selectedContract.title}" — Milestone ${nextMilestoneIndex}: ${(milestone as any)?.title || (milestone as any)?.name || `Milestone ${nextMilestoneIndex}`} has been submitted for review. [Check it out](${contractUrl})`;
      const messageText = notificationText;

      // Add to submitted_jobs collection
      const milestoneTitle = (milestone as any)?.title || (milestone as any)?.name || `Milestone ${nextMilestoneIndex}`;
      const submissionData = {
        contractId: selectedContract.id,
        clientId: selectedContract.clientId,
        freelancerId: selectedContract.freelancerId,
        contractTitle: selectedContract.title,
        milestoneIndex: nextMilestoneIndex,
        milestoneTitle,
        description: workMessage || "Work submitted for review.",
        link: workLink || "",
        attachment: attachment,
        submittedAt: serverTimestamp(),
        status: "pending",
      };

      // Update contract workStatus
      const updatedMilestones = (selectedContract.milestones ?? []).map((item: any, index) => {
        const itemIndex = Number(item.index ?? index + 1);
        if (itemIndex !== nextMilestoneIndex) return item;
        return {
          ...item,
          status: "submitted",
          submittedAt: new Date().toISOString(),
        };
      });
      const contractUpdate = {
        workStatus: "submitted",
        milestones: updatedMilestones,
        updatedAt: serverTimestamp(),
      };

      const conversationId =
        selectedContract.jobId && selectedContract.freelancerId
          ? `${selectedContract.jobId}_${selectedContract.freelancerId}`
          : selectedContract.id;

      await Promise.all([
        addDoc(collection(firebaseDb, "submitted_jobs"), submissionData),
        setDoc(doc(firebaseDb, "contracts", selectedContract.id), contractUpdate, { merge: true }),
        setDoc(
          doc(firebaseDb, "conversations", conversationId),
          {
            milestones: updatedMilestones,
            workStatus: "submitted",
            "lastMessage.text": notificationText,
            "lastMessage.senderId": selectedContract.freelancerId,
            "lastMessage.createdAt": serverTimestamp(),
            [`unread.${selectedContract.clientId}`]: increment(1),
            [`unread.${selectedContract.freelancerId}`]: 0,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ),
        addDoc(collection(firebaseDb, "conversations", conversationId, "messages"), {
          senderId: selectedContract.freelancerId,
          senderRole: "freelancer",
          text: messageText,
          messageType: "work_submission",
          createdAt: serverTimestamp(),
        }),
      ]);

      setSubmissionSuccess("Work submitted for review.");
      setWorkMessage("");
      setWorkLink("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Submit work error:", error);
      setSubmissionError(error instanceof Error ? error.message : "Unable to submit work. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    let unsubscribeContracts: (() => void) | undefined;
    let unsubscribeSubmitted: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) {
        if (unsubscribeContracts) unsubscribeContracts();
        if (unsubscribeSubmitted) unsubscribeSubmitted();
        setContracts([]);
        setSelectedId("");
        setLoading(false);
        setErrorMessage("Please log in to view contracts.");
        return;
      }
      setLoading(true);
      setErrorMessage("");
      const contractsQuery = query(
        collection(firebaseDb, "contracts"),
        where("freelancerId", "==", user.uid)
      );
      unsubscribeContracts = onSnapshot(
        contractsQuery,
        (snapshot) => {
          const items: Contract[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as any;
            return {
              id: docSnap.id,
              title: data.title ?? "Contract",
              clientName: data.clientName ?? "",
              clientId: data.clientId ?? "",
              freelancerId: data.freelancerId ?? "",
              jobId: data.jobId ?? "",
              contractType: data.contractType ?? data.jobType ?? "Fixed Price",
              status: (data.status as ContractStatus) ?? "Active",
              budget: formatSats(data.budget ?? "0"),
              progress: typeof data.progress === "number" ? data.progress : 0,
              nextMilestone: data.nextMilestone ?? "-",
              startDate: formatDate(data.startDate),
              dueDate: formatDate(data.dueDate),
              description: data.description ?? "-",
              paymentStatus: data.paymentStatus ?? "unfunded",
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
              workStatus: data.workStatus ?? "not_started",
              submissionMessage: data.submissionMessage ?? "",
              submissionLink: data.submissionLink ?? "",
              submissionAttachment: data.submissionAttachment ?? null,
              submissionReviewDueAt: data.submissionReviewDueAt,
              revisionMessage: data.revisionMessage ?? "",
              scopeItems: Array.isArray(data.scopeItems) ? data.scopeItems : [],
              milestones: Array.isArray(data.milestones) ? data.milestones : [],
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          });
          const hydrateClientNames = async () => {
            const hydrated = await Promise.all(
              items.map(async (contract) => ({
                ...contract,
                clientName: await resolveClientName(
                  contract.clientId ?? "",
                  contract.clientName ?? ""
                ),
              }))
            );
            // Sort by latest first (assuming updatedAt or createdAt exists)
            hydrated.sort((a, b) => {
              const aDate = a.updatedAt || a.createdAt || 0;
              const bDate = b.updatedAt || b.createdAt || 0;
              return bDate - aDate;
            });
            setContracts(hydrated);
            setLoading(false);
            if (!selectedId && hydrated.length) setSelectedId(hydrated[0].id);
          };
          hydrateClientNames();
        },
        () => {
          setLoading(false);
          setErrorMessage("Unable to load contracts.");
        }
      );

      // Load submitted jobs
      const submittedQuery = query(
        collection(firebaseDb, "submitted_jobs"),
        where("freelancerId", "==", user.uid)
      );
      unsubscribeSubmitted = onSnapshot(
        submittedQuery,
        (snapshot) => {
          const items: SubmittedJob[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as any;
            return {
              id: docSnap.id,
              contractId: data.contractId ?? "",
              milestoneIndex: typeof data.milestoneIndex === "number" ? data.milestoneIndex : undefined,
              milestoneTitle: data.milestoneTitle ?? undefined,
              description: data.description ?? "",
              link: data.link ?? "",
              attachment: data.attachment ?? null,
              submittedAt: data.submittedAt?.toDate() ?? new Date(),
              status: data.status ?? "pending",
              revisionMessage: data.revisionMessage ?? "",
            };
          });
          // Sort by latest first
          items.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
          setSubmittedJobs(items);
        },
        () => {
          // Handle error if needed
        }
      );
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeContracts) unsubscribeContracts();
      if (unsubscribeSubmitted) unsubscribeSubmitted();
    };
  }, [selectedId]);

  const isFinishedContract = (contract: Contract) =>
    contract.status === "Completed" ||
    contract.paymentStatus === "released" ||
    contract.workStatus === "approved" ||
    contract.workStatus === "completed";

  const isEscrowContract = (contract: Contract) =>
    !isFinishedContract(contract) &&
    (contract.paymentStatus === "funded" ||
      (contract.escrowFundedTotalSats ?? 0) > 0 ||
      contract.workStatus === "in_progress" ||
      contract.workStatus === "submitted" ||
      contract.workStatus === "changes_requested");

  const activeContracts = useMemo(
    () => contracts.filter((contract) => !isFinishedContract(contract) && !isEscrowContract(contract)),
    [contracts]
  );
  const ongoingContracts = useMemo(
    () => contracts.filter((contract) => isEscrowContract(contract)),
    [contracts]
  );
  const finishedContracts = useMemo(
    () => contracts.filter((contract) => isFinishedContract(contract)),
    [contracts]
  );

  const visibleContracts =
    view === "active" ? activeContracts : view === "ongoing" ? ongoingContracts : finishedContracts;
  const selectedContract =
    contracts.find((c) => c.id === selectedId) ?? visibleContracts[0];
  const selectedSubmission = selectedSubmissionId
    ? submittedJobs.find((job) => job.id === selectedSubmissionId) ?? null
    : null;
  const selectedSubmissionContract = selectedSubmission
    ? contracts.find((contract) => contract.id === selectedSubmission.contractId) ?? null
    : null;
  const editingSubmission = editingSubmissionId
    ? submittedJobs.find((job) => job.id === editingSubmissionId) ?? null
    : null;
  const editingSubmissionContract = editingSubmission
    ? contracts.find((contract) => contract.id === editingSubmission.contractId) ?? null
    : null;
  const contractStatusFilters: Array<{ id: typeof view; label: string; count: number }> = [
    { id: "active", label: "Active", count: activeContracts.length },
    { id: "ongoing", label: "Ongoing", count: ongoingContracts.length },
    { id: "finished", label: "Finished jobs", count: finishedContracts.length },
  ];
  const needsAttentionCount = submittedJobs.filter((job) => job.status === "rejected").length;

  const openEditSubmission = (job: SubmittedJob) => {
    setEditingSubmissionId(job.id);
    setEditWorkMessage(job.description || "");
    setEditWorkLink(job.link || "");
    setEditSelectedFile(null);
    setEditSubmissionError("");
    setEditSubmissionSuccess("");
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  };

  const handleUpdateSubmission = async () => {
    if (!editingSubmission || !editingSubmissionContract) return;
    const description = editWorkMessage.trim();
    const link = editWorkLink.trim();

    if (!description && !link && !editSelectedFile && !editingSubmission.attachment) {
      setEditSubmissionError("Add a note, link, or file before saving the submission.");
      return;
    }

    setIsUpdatingSubmission(true);
    setEditSubmissionError("");
    setEditSubmissionSuccess("");

    try {
      const attachment = editSelectedFile
        ? await uploadContractFile(editSelectedFile)
        : editingSubmission.attachment ?? null;
      const nextMilestoneIndex = (editingSubmissionContract.paymentReleasedInstallments ?? 0) + 1;
      const updatedMilestones = (editingSubmissionContract.milestones ?? []).map((item: any, index) => {
        const itemIndex = Number(item.index ?? index + 1);
        if (itemIndex !== nextMilestoneIndex) return item;
        return {
          ...item,
          status: "submitted",
          resubmittedAt: new Date().toISOString(),
        };
      });
      const conversationId =
        editingSubmissionContract.jobId && editingSubmissionContract.freelancerId
          ? `${editingSubmissionContract.jobId}_${editingSubmissionContract.freelancerId}`
          : editingSubmissionContract.id;
      const messageText =
        editingSubmission.status === "rejected"
          ? `Updated work for "${editingSubmissionContract.title}" has been resubmitted after requested adjustments.`
          : `Submitted work for "${editingSubmissionContract.title}" was updated.`;

      await Promise.all([
        updateDoc(doc(firebaseDb, "submitted_jobs", editingSubmission.id), {
          description: description || "Work submitted for review.",
          link,
          attachment,
          status: "pending",
          updatedAt: serverTimestamp(),
          resubmittedAt: serverTimestamp(),
        }),
        setDoc(doc(firebaseDb, "contracts", editingSubmission.contractId), {
          workStatus: "submitted",
          milestones: updatedMilestones,
          unreadByClient: true,
          unreadByFreelancer: false,
          updatedAt: serverTimestamp(),
        }, { merge: true }),
        setDoc(
          doc(firebaseDb, "conversations", conversationId),
          {
            workStatus: "submitted",
            milestones: updatedMilestones,
            "lastMessage.text": messageText,
            "lastMessage.senderId": editingSubmissionContract.freelancerId,
            "lastMessage.createdAt": serverTimestamp(),
            [`unread.${editingSubmissionContract.clientId}`]: increment(1),
            [`unread.${editingSubmissionContract.freelancerId}`]: 0,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ),
        addDoc(collection(firebaseDb, "conversations", conversationId, "messages"), {
          senderId: editingSubmissionContract.freelancerId,
          senderRole: "freelancer",
          text: messageText,
          messageType: "work_resubmission",
          createdAt: serverTimestamp(),
        }),
      ]);

      setEditSubmissionSuccess("Submission updated and sent back to the client.");
      setEditingSubmissionId(null);
      setSelectedSubmissionId(editingSubmission.id);
      setEditSelectedFile(null);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
    } catch {
      setEditSubmissionError("Unable to update the submission. Please try again.");
    } finally {
      setIsUpdatingSubmission(false);
    }
  };

  return (
    <section className="w-full">

      {/* ── TABS ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 border-b border-[#EAE7E2] px-1">
        {[
          { id: "active",   label: "Active",        count: activeContracts.length },
          { id: "ongoing",  label: "Ongoing",        count: ongoingContracts.length },
          { id: "finished", label: "Finished",       count: finishedContracts.length },
          { id: "submitted", label: "Submitted Jobs", count: submittedJobs.length, alert: needsAttentionCount > 0 },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              if (tab.id === "submitted") {
                setActiveTab("submitted");
              } else {
                setActiveTab("contracts");
                setView(tab.id as "active" | "ongoing" | "finished");
              }
            }}
            className={`relative py-3 text-[13px] font-semibold transition whitespace-nowrap ${
              (tab.id === "submitted" ? activeTab === "submitted" : activeTab === "contracts" && view === tab.id)
                ? "text-[#F7931A]"
                : "text-[#8f8780] hover:text-[#1a1a1a]"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              {tab.label}
              {tab.count > 0 && (
                <span className="rounded-full bg-[#F5F3EF] px-1.5 py-0.5 text-[9px] font-bold text-[#8f8780]">
                  {tab.count}
                </span>
              )}
              {tab.alert && (
                <span className="inline-flex h-2 w-2 rounded-full bg-[#F7931A]" />
              )}
            </span>
            {(tab.id === "submitted" ? activeTab === "submitted" : activeTab === "contracts" && view === tab.id) && (
              <span className="absolute bottom-0 left-0 h-[2px] w-full rounded-full bg-[#F7931A]" />
            )}
          </button>
        ))}
      </div>

      {/* ── CONTRACTS GRID ───────────────────────────────────────────── */}
      {activeTab === "contracts" && (
        <div className="mt-5">
          {loading ? (
            <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-6 text-[12px] text-[#6b6762]">
              Loading contracts...
            </div>
          ) : errorMessage ? (
            <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FFF6F2] p-4 text-[12px] text-[#8C4F00]">
              {errorMessage}
            </div>
          ) : visibleContracts.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {visibleContracts.map((contract) => {
                const statusLabel = isFinishedContract(contract)
                  ? "Finished"
                  : isEscrowContract(contract)
                    ? "Ongoing"
                    : "Active";
                const statusColor =
                  statusLabel === "Finished"
                    ? "bg-[#E6F4EA] text-[#2E7D32]"
                    : statusLabel === "Ongoing"
                      ? "bg-[#EFF6FF] text-[#1D4ED8]"
                      : "bg-[#FFF4E6] text-[#8C4F00]";

                const amountSats = contract.paymentTotalAmountSats ?? 0;
                const amountLabel = amountSats > 0
                  ? `${amountSats.toLocaleString()} sats`
                  : contract.budget ?? "—";

                const clientInitials = (contract.clientName ?? "C")
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p: string) => p[0]?.toUpperCase())
                  .join("");

                return (
                  <div
                    key={contract.id}
                    className="flex flex-col rounded-[14px] border border-[#EAE7E2] bg-white p-4 shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition hover:shadow-[0_6px_20px_rgba(0,0,0,0.09)]"
                  >
                    {/* Card header */}
                    <div className="flex items-start gap-3">
                      {/* Client avatar */}
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E8E2D9] border border-[#DDD8D0]">
                        {(contract as any).clientAvatarUrl ? (
                          <img src={(contract as any).clientAvatarUrl} alt={contract.clientName} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[11px] font-black text-[#8C4F00]">{clientInitials}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#999]">
                          {contract.clientName}
                        </p>
                        <h3 className="mt-0.5 text-[15px] font-black text-[#1a1a1a] leading-tight truncate">
                          {contract.title}
                        </h3>
                      </div>

                      {/* Status badge */}
                      <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>

                    {/* Contract value */}
                    <div className="mt-4 flex items-center justify-between rounded-[10px] bg-[#F5F3EF] px-3 py-2.5">
                      <span className="text-[12px] text-[#888]">Contract Value</span>
                      <span className="text-[13px] font-black text-[]">{amountLabel}</span>
                    </div>

                    {/* Next milestone */}
                    {contract.nextMilestone && contract.nextMilestone !== "-" && (
                      <div className="mt-3 flex items-center gap-2 text-[12px] text-[#555]">
                        <Calendar size={13} className="flex-shrink-0 text-[#999]" />
                        <span>Next Milestone: <strong>{contract.nextMilestone}</strong></span>
                        {contract.dueDate && contract.dueDate !== "-" && (
                          <span className="ml-auto flex-shrink-0 font-bold text-[#F7931A]">{contract.dueDate}</span>
                        )}
                      </div>
                    )}

                    {/* View Details button */}
                    <button
                      type="button"
                      onClick={() => { setSelectedId(contract.id); setIsModalOpen(true); }}
                      className="mt-4 w-full rounded-[10px] bg-gradient-to-r from-orange-600 to-orange-400 py-3 text-[12px] font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#0f1a26]"
                    >
                      View Details
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[#EAE7E2] bg-white px-5 py-10 text-center">
              <FileText className="h-10 w-10 text-[#F7931A]" />
              <p className="mt-3 text-[14px] font-semibold text-[#1a1a1a]">
                No {view === "finished" ? "finished jobs" : `${view} contracts`} yet
              </p>
              <Button
                size="sm"
                className="mt-4 rounded-full"
                onClick={() => router.push("/freelancer/dashboard/job-feed")}
              >
                <Briefcase className="mr-2 h-4 w-4" />
                Find Tasks
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── SUBMITTED JOBS ───────────────────────────────────────────── */}
      {activeTab === "submitted" && (
        <div className="mt-5">
          {submittedJobs.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {submittedJobs.map((job) => {
                const contract = contracts.find(c => c.id === job.contractId);
                const statusLabel = job.status === "approved" ? "Approved" : job.status === "rejected" ? "Changes Requested" : "Pending Review";
                const statusColor = job.status === "approved" ? "bg-[#E6F4EA] text-[#2E7D32]" : job.status === "rejected" ? "bg-[#FFF5F5] text-[#B91C1C]" : "bg-[#FFF4E6] text-[#8C4F00]";
                return (
                  <div key={job.id} className="flex flex-col rounded-[14px] border border-[#EAE7E2] bg-white p-4 shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition hover:shadow-[0_6px_20px_rgba(0,0,0,0.09)]">

                    {/* Card header */}
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#FFF4E6] border border-[#F7931A30]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#999]">
                          {contract?.title || "Contract"}
                        </p>
                        {job.milestoneIndex && (
                          <p className="text-[11px] font-black text-[#1a1a1a] leading-tight mt-0.5">
                            Milestone {job.milestoneIndex}{job.milestoneTitle ? `: ${job.milestoneTitle}` : ""}
                          </p>
                        )}
                      </div>

                      {/* Status badge */}
                      <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>

                    {/* Description */}
                    <div className="mt-4 rounded-[10px] bg-[#F5F3EF] px-3 py-2.5">
                      <p className="text-[12px] text-[#555] leading-snug line-clamp-2">{job.description || "Work submitted for review."}</p>
                    </div>

                    {/* Date */}
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#999]">
                      <Calendar size={11} />
                      <span>Submitted {job.submittedAt.toLocaleDateString()}</span>
                    </div>

                    {/* View Details button */}
                    <button
                      type="button"
                      onClick={() => setSelectedSubmissionId(job.id)}
                      className="mt-4 w-full rounded-[10px] bg-gradient-to-r from-orange-600 to-orange-400 py-3 text-[12px] font-black uppercase tracking-[0.1em] text-white transition "
                    >
                      View Details
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[#EAE7E2] bg-white px-5 py-10 text-center">
              <ClipboardCheck className="h-10 w-10 text-[#F7931A]" />
              <p className="mt-3 text-[14px] font-semibold text-[#1a1a1a]">No submitted jobs yet</p>
              <p className="mt-1 text-[12px] text-[#999]">Submitted work will appear here once you submit a milestone.</p>
            </div>
          )}
        </div>
      )}

      {selectedSubmission && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center px-2 py-2 sm:items-center sm:px-4 sm:py-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedSubmissionId(null)} />
          <div className="relative z-[76] max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)]">

            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-[#F0EDE8]">
              <button type="button" onClick={() => setSelectedSubmissionId(null)} aria-label="Close" className="absolute right-4 top-4 text-[#999] hover:text-[#1a1a1a] transition-colors text-[18px] font-light">✕</button>

              {/* Status + label */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${
                  selectedSubmission.status === "approved" ? "bg-[#E6F4EA] text-[#2E7D32]" :
                  selectedSubmission.status === "rejected" ? "bg-[#FFF5F5] text-[#B91C1C]" :
                  "bg-[#FFF4E6] text-[#8C4F00]"
                }`}>
                  {selectedSubmission.status === "approved" ? "Approved" : selectedSubmission.status === "rejected" ? "Changes Requested" : "Pending Review"}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#999]">SUBMITTED WORK</span>
              </div>

              {/* Contract title */}
              <h2 className="text-[20px] font-black text-[#1a1a1a] leading-tight">
                {selectedSubmissionContract?.title || "Contract Submission"}
              </h2>

              {/* Milestone */}
              {selectedSubmission.milestoneIndex && (
                <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#FFF4E6] border border-[#F7931A30] px-2.5 py-0.5">
                  <span className="text-[10px] font-bold text-[#8C4F00]">
                    Milestone {selectedSubmission.milestoneIndex}{selectedSubmission.milestoneTitle ? `: ${selectedSubmission.milestoneTitle}` : ""}
                  </span>
                </div>
              )}

              {/* Date */}
              <p className="mt-1.5 text-[11px] text-[#999]">Submitted {selectedSubmission.submittedAt.toLocaleDateString()}</p>
            </div>

            {/* Submission content */}
            <div className="px-5 py-4 border-b border-[#F0EDE8]">
              <div className="rounded-[12px] bg-[#F5F3EF] px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#999] mb-2">Your Submission</p>
                <p className="text-[13px] text-[#1a1a1a] leading-[1.6]">{selectedSubmission.description || "Work submitted for review."}</p>
                {selectedSubmission.link && (
                  <p className="mt-2 text-[12px] text-[#6b6762] break-all [overflow-wrap:anywhere]">
                    <span className="font-semibold text-[#999]">Link: </span>
                    <a href={selectedSubmission.link} target="_blank" rel="noreferrer" className="text-[#8C4F00] underline">{selectedSubmission.link}</a>
                  </p>
                )}
                {selectedSubmission.attachment && (
                  <p className="mt-2 text-[12px] text-[#6b6762] break-all [overflow-wrap:anywhere]">
                    <span className="font-semibold text-[#999]">Attachment: </span>
                    <a href={selectedSubmission.attachment.url} target="_blank" rel="noreferrer" className="text-[#8C4F00] underline">{selectedSubmission.attachment.name}</a>
                  </p>
                )}
              </div>
            </div>

            {/* Client note if rejected */}
            {selectedSubmission.status === "rejected" && (
              <div className="px-5 py-4 border-b border-[#F0EDE8]">
                <div className="rounded-[12px] border border-[#FCA5A5] bg-[#FFF5F5] px-4 py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#B91C1C] mb-2">Client Requested Adjustments</p>
                  <p className="text-[13px] text-[#7F1D1D] leading-[1.6]">
                    {selectedSubmission.revisionMessage || selectedSubmissionContract?.revisionMessage || "The client requested updates before approval."}
                  </p>
                </div>
              </div>
            )}

            {/* Footer actions */}
            <div className="px-5 pb-5 pt-4 flex items-center gap-3">
              {selectedSubmission.status !== "approved" && (
                <Button
                  size="sm"
                  className="flex-1 rounded-[10px] bg-[#8C4F00] hover:bg-[#6B3A00] text-white font-black py-3"
                  onClick={() => { openEditSubmission(selectedSubmission); setSelectedSubmissionId(null); }}
                >
                  {selectedSubmission.status === "rejected" ? "Adjust & Resubmit" : "Edit Submission"}
                </Button>
              )}
              {selectedSubmissionContract && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 rounded-[10px] bg-[#1a2332] text-white border-[#1a2332] hover:bg-[#0f1a26] font-black py-3"
                  onClick={() => { setSelectedId(selectedSubmissionContract.id); setActiveTab("contracts"); setIsModalOpen(true); setSelectedSubmissionId(null); }}
                >
                  View Contract
                </Button>
              )}
            </div>

          </div>
        </div>
      )}

      {editingSubmission && (
        <div className="fixed inset-0 z-[78] flex items-end justify-center px-2 py-2 sm:items-center sm:px-4 sm:py-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              if (!isUpdatingSubmission) setEditingSubmissionId(null);
            }}
          />
          <div className="relative z-[79] max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[14px] border border-[#EAE7E2] bg-white p-4 shadow-[0_20px_50px_rgba(0,0,0,0.2)] sm:rounded-[16px] sm:p-5">
            <button
              type="button"
              onClick={() => setEditingSubmissionId(null)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full border border-[#EAE7E2] bg-white p-2 text-[#6b6762] hover:bg-[#F7F4F0]"
              disabled={isUpdatingSubmission}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="pr-10">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8C4F00]">
                {editingSubmission.status === "rejected" ? "Adjust Submission" : "Edit Submission"}
              </div>
              <div className="mt-2 break-words text-[16px] font-semibold leading-6 text-[#1a1a1a] [overflow-wrap:anywhere] sm:text-[18px]">
                {editingSubmissionContract?.title || "Submitted work"}
              </div>
              <p className="mt-2 text-[13px] leading-6 text-[#6b6762]">
                Update the work message, link, or attachment. Saving sends the latest version back to the client for review.
              </p>
            </div>

            {editingSubmission.status === "rejected" && (editingSubmission.revisionMessage || editingSubmissionContract?.revisionMessage) ? (
              <div className="mt-4 rounded-[12px] border border-[#F8D7DA] bg-[#FFF5F5] p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#B42318]">
                  Client Note
                </div>
                <p className="mt-2 text-[13px] leading-6 text-[#7F1D1D]">
                  {editingSubmission.revisionMessage || editingSubmissionContract?.revisionMessage}
                </p>
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              <textarea
                value={editWorkMessage}
                onChange={(event) => setEditWorkMessage(event.target.value)}
                placeholder="Describe the updated work"
                rows={4}
                className="w-full rounded-[10px] border border-[#EAE7E7] bg-[#FAF8F5] px-3 py-2 text-[13px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20"
              />
              <input
                value={editWorkLink}
                onChange={(event) => setEditWorkLink(event.target.value)}
                placeholder="Paste an updated deliverable, preview, or repository link"
                className="w-full rounded-[10px] border border-[#EAE7E7] bg-[#FAF8F5] px-3 py-2 text-[13px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20"
              />
              <input
                ref={editFileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => setEditSelectedFile(event.target.files?.[0] ?? null)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => editFileInputRef.current?.click()}
                  disabled={isUpdatingSubmission}
                >
                  {editSelectedFile ? editSelectedFile.name : editingSubmission.attachment ? "Replace File" : "Attach File"}
                </Button>
                {editingSubmission.attachment && !editSelectedFile ? (
                  <span className="text-[11px] text-[#6b6762]">
                    Current file: {editingSubmission.attachment.name}
                  </span>
                ) : null}
                {editSelectedFile ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditSelectedFile(null);
                      if (editFileInputRef.current) editFileInputRef.current.value = "";
                    }}
                    className="text-[11px] font-semibold text-[#6b6762]"
                    disabled={isUpdatingSubmission}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>

            {editSubmissionError ? (
              <p className="mt-3 rounded-[10px] border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                {editSubmissionError}
              </p>
            ) : null}
            {editSubmissionSuccess ? (
              <p className="mt-3 rounded-[10px] border border-green-100 bg-green-50 px-3 py-2 text-[12px] text-green-700">
                {editSubmissionSuccess}
              </p>
            ) : null}

            <div className="mt-5 grid grid-cols-1 gap-2 sm:flex sm:justify-end">
              <Button
                size="sm"
                variant="outline"
                className="w-full rounded-full sm:w-auto"
                onClick={() => setEditingSubmissionId(null)}
                disabled={isUpdatingSubmission}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="w-full rounded-full sm:w-auto"
                onClick={() => void handleUpdateSubmission()}
                disabled={isUpdatingSubmission}
              >
                {isUpdatingSubmission ? "Saving..." : editingSubmission.status === "rejected" ? "Resubmit Work" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && selectedContract ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center px-2 py-2 sm:items-center sm:px-4 sm:py-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative z-[81] max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)]">

            {/* ── Modal Header ── */}
            <div className="px-5 pt-5 pb-4 border-b border-[#F0EDE8]">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close"
                className="absolute right-4 top-4 text-[#999] hover:text-[#1a1a1a] transition-colors text-[18px] font-light"
              >
                ✕
              </button>

              {/* Status + contract ID */}
              <div className="flex items-center gap-2 mb-2">
                {(() => {
                  const statusLabel = isFinishedContract(selectedContract) ? "Finished" : isEscrowContract(selectedContract) ? "Ongoing" : "Active";
                  const statusColor = statusLabel === "Finished" ? "bg-[#E6F4EA] text-[#2E7D32]" : statusLabel === "Ongoing" ? "bg-[#EFF6FF] text-[#1D4ED8]" : "bg-[#FFF4E6] text-[#8C4F00]";
                  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${statusColor}`}>{statusLabel}</span>;
                })()}
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#999]">
                  CONTRACT #{selectedContract.id.slice(-6).toUpperCase()}
                </span>
              </div>

              {/* Title */}
              <h2 className="text-[22px] font-black text-[#1a1a1a] leading-tight">{selectedContract.title}</h2>

              {/* Client */}
              <div className="flex items-center gap-2 mt-1.5">
                <div className="h-6 w-6 rounded-full bg-[#1a2332] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {(selectedContract as any).clientAvatarUrl ? (
                    <img src={(selectedContract as any).clientAvatarUrl} alt={selectedContract.clientName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[8px] font-black text-white">
                      {(selectedContract.clientName ?? "C").split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-[13px] text-[#555]">Client: <strong>{selectedContract.clientName}</strong></span>
              </div>
            </div>

            {/* ── Value + Escrow Status ── */}
            <div className="px-5 py-4 grid grid-cols-2 gap-3 border-b border-[#F0EDE8]">
              <div className="rounded-[12px] bg-[#F5F3EF] px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#999] mb-1">Total Contract Value</p>
                <p className="text-[16px] font-black text-[#F7931A]">
                  {(() => {
                    const sats = selectedContract.paymentTotalAmountSats || parseSats(selectedContract.budget) || 0;
                    return sats > 0 ? `${sats.toLocaleString()} sats` : selectedContract.budget;
                  })()}
                </p>
              </div>
              <div className="rounded-[12px] bg-[#F5F3EF] px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#999] mb-1">Escrow Status</p>
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={selectedContract.paymentStatus === "funded" || selectedContract.paymentStatus === "released" ? "#1D4ED8" : "#999"} strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span className="text-[13px] font-bold text-[#1a1a1a]">
                    {selectedContract.paymentStatus === "funded" ? "Funds Secured" :
                     selectedContract.paymentStatus === "released" ? "Released" :
                     selectedContract.paymentStatus === "invoice_created" ? "Invoice Sent" :
                     "Not Funded"}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Milestones ── */}
            {selectedContract.milestones && selectedContract.milestones.length > 0 && (
              <div className="px-5 py-4 border-b border-[#F0EDE8]">
                <h3 className="text-[14px] font-black text-[#1a1a1a] mb-3">Milestones</h3>
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-[#EAE7E2]" />
                  <div className="space-y-4">
                    {selectedContract.milestones.map((ms: any, i: number) => {
                      const isReleased = ms.status === "released";
                      const isCurrent = !isReleased && ms.status !== "pending" || (i === (selectedContract.paymentReleasedInstallments ?? 0));
                      const msAmount = ms.freelancerAmountSats ? `${ms.freelancerAmountSats.toLocaleString()} sats` : ms.amount ?? "—";
                      const msStatusLabel = isReleased ? "Paid" : ms.status === "funded" || ms.status === "submitted" ? "Pending" : "Scheduled";
                      const msStatusColor = isReleased ? "bg-[#EFF6FF] text-[#1D4ED8]" : ms.status === "funded" || ms.status === "submitted" ? "bg-[#FFF4E6] text-[#F7931A]" : "bg-[#F5F3EF] text-[#999]";
                      return (
                        <div key={i} className="flex items-start gap-4 pl-6 relative">
                          {/* Dot */}
                          <div className={`absolute left-0 top-1 h-4 w-4 rounded-full border-2 flex items-center justify-center ${isReleased ? "border-[#1D4ED8] bg-[#1D4ED8]" : isCurrent ? "border-[#F7931A] bg-[#F7931A]" : "border-[#DDD8D0] bg-white"}`}>
                            {isReleased && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                          </div>
                          <div className="flex-1 flex items-start justify-between gap-2">
                            <div>
                              <p className={`text-[13px] font-bold ${isReleased ? "text-[#555]" : "text-[#1a1a1a]"}`}>{ms.title || ms.name || `Milestone ${i + 1}`}</p>
                              {ms.deadline && <p className="text-[11px] text-[#999] mt-0.5">{isReleased ? "Completed on" : "Due"} {ms.deadline}</p>}
                            </div>
                            <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${msStatusColor}`}>
                              {msAmount} {msStatusLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Contract Terms ── */}
            <div className="px-5 py-4 border-b border-[#F0EDE8]">
              <div className="rounded-[12px] border border-[#EAE7E2] bg-[#F5F3EF] px-4 py-3">
                <h3 className="text-[13px] font-black text-[#1a1a1a] mb-3">Contract Terms</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" className="mt-0.5 flex-shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#999]">Deliverable Type</p>
                      <p className="text-[12px] font-semibold text-[#1a1a1a]">{selectedContract.contractType ?? "Fixed Price"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" className="mt-0.5 flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#999]">Work Status</p>
                      <p className="text-[12px] font-semibold text-[#1a1a1a] capitalize">{selectedContract.workStatus?.replace(/_/g, " ") ?? "Not started"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Submit Work Section (all existing logic preserved) ── */}
            <div className="px-5 py-4">
              {(() => {
                const isFinished =
                  selectedContract.workStatus === "approved" ||
                  selectedContract.workStatus === "completed" ||
                  selectedContract.paymentStatus === "released" ||
                  selectedContract.status === "Completed";
                const isSubmitted = selectedContract.workStatus === "submitted";
                const isChangesRequested = selectedContract.workStatus === "changes_requested";
                const releasedCount = selectedContract.paymentReleasedInstallments ?? 0;
                const totalMilestones = selectedContract.paymentInstallments ?? 1;
                const nextIdx = releasedCount + 1;
                const milestones = selectedContract.milestones ?? [];
                const currentMs = milestones.find((m: any, i: number) => Number(m.index ?? i + 1) === nextIdx);
                const currentMsTitle = (currentMs as any)?.title || (currentMs as any)?.name || `Milestone ${nextIdx}`;

                if (isFinished) {
                  return (
                    <div className="rounded-[12px] border border-[#D1FAE5] bg-[#F0FDF4] p-4">
                      <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        <span className="text-[12px] font-bold text-[#065F46] uppercase tracking-[0.1em]">Contract Completed</span>
                      </div>
                      <p className="mt-2 text-[12px] text-[#065F46]">All milestones approved and payment released. No further submissions needed.</p>
                    </div>
                  );
                }
                if (isSubmitted) {
                  return (
                    <div className="rounded-[12px] border border-[#DBEAFE] bg-[#EFF6FF] p-4">
                      <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <span className="text-[12px] font-bold text-[#1E40AF] uppercase tracking-[0.1em]">Awaiting Client Review</span>
                      </div>
                      <p className="mt-2 text-[12px] text-[#1E40AF]">Your work for <strong>Milestone {nextIdx}: {currentMsTitle}</strong> has been submitted. You'll be notified once the client reviews it.</p>
                    </div>
                  );
                }
                if (isChangesRequested) {
                  return (
                    <div className="space-y-3">
                      <div className="rounded-[12px] border border-[#FCA5A5] bg-[#FFF5F5] p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          <span className="text-[11px] font-black text-[#B91C1C] uppercase tracking-[0.12em]">Adjustment Requested — Milestone {nextIdx}: {currentMsTitle}</span>
                        </div>
                        <p className="text-[12px] text-[#7F1D1D] leading-[1.6]"><strong>The client asked for changes.</strong> Review their note, make adjustments, and resubmit for <strong>{currentMsTitle}</strong>.</p>
                        {selectedContract.revisionMessage ? (
                          <div className="mt-3 rounded-[8px] border border-[#FCA5A5] bg-white px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#B91C1C] mb-1">Client's note:</p>
                            <p className="text-[12px] text-[#7F1D1D] leading-[1.6] italic">"{selectedContract.revisionMessage}"</p>
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <textarea value={workMessage} onChange={(e) => setWorkMessage(e.target.value)} placeholder={`Describe what you adjusted for "${currentMsTitle}"`} rows={3} className="w-full rounded-[10px] border border-[#EAE7E7] bg-[#FAF8F5] px-3 py-2 text-[12px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20" />
                        <input value={workLink} onChange={(e) => setWorkLink(e.target.value)} placeholder="Paste a link to the updated deliverable" className="w-full rounded-[10px] border border-[#EAE7E7] bg-[#FAF8F5] px-3 py-2 text-[12px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20" />
                        <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => fileInputRef.current?.click()}>{selectedFile ? selectedFile.name : "Attach File"}</Button>
                          {selectedFile ? <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-[11px] font-semibold text-[#6b6762]">Remove</button> : null}
                          <Button size="sm" className="rounded-full" onClick={() => void handleSubmitWork()} disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "Resubmit Adjusted Work"}</Button>
                        </div>
                        {submissionSuccess ? <p className="text-[12px] text-[#2F855A]">{submissionSuccess}</p> : null}
                        {submissionError ? <p className="text-[12px] text-[#C53030]">{submissionError}</p> : null}
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8C4F00]">Submit Work</span>
                      <div className="inline-flex items-center rounded-full bg-[#FFF4E6] border border-[#F7931A40] px-2.5 py-0.5">
                        <span className="text-[9px] font-bold text-[#8C4F00]">Milestone {nextIdx} of {totalMilestones}: {currentMsTitle}</span>
                      </div>
                    </div>
                    <textarea value={workMessage} onChange={(e) => setWorkMessage(e.target.value)} placeholder={`Describe what you completed for "${currentMsTitle}"`} rows={3} className="w-full rounded-[10px] border border-[#EAE7E7] bg-[#FAF8F5] px-3 py-2 text-[12px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20" />
                    <input value={workLink} onChange={(e) => setWorkLink(e.target.value)} placeholder="Paste a link to deliverable, preview, or repository" className="w-full rounded-[10px] border border-[#EAE7E7] bg-[#FAF8F5] px-3 py-2 text-[12px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20" />
                    <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => fileInputRef.current?.click()}>{selectedFile ? selectedFile.name : "Attach File"}</Button>
                      {selectedFile ? <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-[11px] font-semibold text-[#6b6762]">Remove</button> : null}
                      <Button size="sm" className="rounded-full" onClick={() => void handleSubmitWork()} disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "Submit Work"}</Button>
                    </div>
                    {submissionSuccess ? <p className="text-[12px] text-[#2F855A]">{submissionSuccess}</p> : null}
                    {submissionError ? <p className="text-[12px] text-[#C53030]">{submissionError}</p> : null}
                  </div>
                );
              })()}
            </div>

            {/* ── Footer Actions ── */}
            <div className="px-5 pb-5 pt-2 border-t border-[#F0EDE8] flex items-center gap-3">
              {/* Submit Work / Message Client buttons */}
              {/* <Button
                size="sm"
                className="flex-1 rounded-[10px] bg-[#8C4F00] hover:bg-[#6B3A00] text-white font-black py-3"
                onClick={() => {
                  const el = document.querySelector('[placeholder*="Describe what you"]') as HTMLTextAreaElement | null;
                  el?.focus();
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Submit Work
              </Button> */}
              <Button
                size="sm"
                variant="outline"
                className="flex-1 rounded-[10px] bg-[#1a2332] text-white border-[#1a2332] ] font-black py-3"
                onClick={async () => {
                  if (!selectedContract?.jobId || !selectedContract?.freelancerId) return;
                  const clientId = selectedContract.clientId ?? "";
                  if (!clientId) return;
                  const freelancerId = firebaseAuth.currentUser?.uid ?? selectedContract.freelancerId ?? "";
                  if (!freelancerId) return;
                  let freelancerName = "Freelancer";
                  let clientName = await resolveClientName(clientId, selectedContract.clientName ?? "");
                  const [clientAvatarUrl, freelancerAvatarUrl] = await Promise.all([resolveClientAvatar(clientId), resolveFreelancerAvatar(freelancerId)]);
                  try {
                    const allUsersSnap = await getDoc(doc(firebaseDb, "all_users", freelancerId));
                    if (allUsersSnap.exists()) { const d = allUsersSnap.data() as any; freelancerName = d.fullName ?? d.name ?? d.email ?? "Freelancer"; }
                  } catch { freelancerName = "Freelancer"; }
                  if (!clientName) clientName = "Client";
                  const conversationId = createConversationId(selectedContract.jobId, selectedContract.freelancerId);
                  await setDoc(doc(firebaseDb, "conversations", conversationId), { jobId: selectedContract.jobId, jobTitle: selectedContract.title, proposalId: "", clientId, clientName, freelancerId: selectedContract.freelancerId, freelancerName, clientAvatarUrl, freelancerAvatarUrl, paymentTotalAmountSats: parseSats(selectedContract.budget), paymentStatus: "unfunded", createdBy: "system", canFreelancerMessage: true, unread: { [clientId]: 0, [freelancerId]: 0 }, updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true });
                  router.push(`/freelancer/dashboard/messages?chat=${conversationId}`);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Message Client
              </Button>
            </div>

          </div>
        </div>
      ) : null}

    </section>
  );
}
