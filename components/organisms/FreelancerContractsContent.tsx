"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/atoms/Button";
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
    name: string;
    amount: string;
    deadline: string;
    status: "Pending" | "In Progress" | "Approved";
  }>;
  createdAt?: any;
  updatedAt?: any;
};

type SubmittedJob = {
  id: string;
  contractId: string;
  description: string;
  link?: string;
  attachment?: {
    name: string;
    url: string;
  };
  submittedAt: Date;
  status: "pending" | "approved" | "rejected";
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

export default function FreelancerContractsContent() {
  const router = useRouter();
  const [view, setView] = useState<"active" | "ongoing">("active");
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    setIsSubmitting(true);
    setSubmissionError("");
    setSubmissionSuccess("");

    try {
      const attachment = selectedFile ? await uploadContractFile(selectedFile) : null;
      const contractUrl = `/client/dashboard/contracts?contract=${selectedContract.id}`;
      const notificationText = `Work for "${selectedContract.title}" has been submitted for review. [Check it out](${contractUrl})`;
      const messageText = notificationText;

      // Add to submitted_jobs collection
      const submissionData = {
        contractId: selectedContract.id,
        freelancerId: selectedContract.freelancerId,
        description: workMessage || "Work submitted for review.",
        link: workLink || "",
        attachment: attachment,
        submittedAt: serverTimestamp(),
        status: "pending",
      };

      // Update contract workStatus
      const contractUpdate = {
        workStatus: "submitted",
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
      setSubmissionError("Unable to submit work. Please try again.");
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
              description: data.description ?? "",
              link: data.link ?? "",
              attachment: data.attachment ?? null,
              submittedAt: data.submittedAt?.toDate() ?? new Date(),
              status: data.status ?? "pending",
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

  const activeContracts = useMemo(
    () => contracts.filter((c) => c.status === "Active"),
    [contracts]
  );
  const ongoingContracts = useMemo(
    () => contracts.filter((c) => c.status === "Review" || c.status === "Completed"),
    [contracts]
  );

  const visibleContracts = view === "active" ? activeContracts : ongoingContracts;
  const selectedContract =
    contracts.find((c) => c.id === selectedId) ?? visibleContracts[0];

  return (
    <section className="w-full">
      <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-6 shadow-[0_8px_22px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">
              Contracts
            </div>
            <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[#1a1a1a]">
              Your engagements
            </h1>
            <p className="mt-2 text-[12px] leading-[1.7] text-[#6b6762]">
              Track milestones, deliverables, and active client work.
            </p>
          </div>
          <Button size="sm" variant="outline" className="rounded-full">
            View All Contracts
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded-[12px] border border-[#EAE7E2] bg-[#F9F6F2] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F5A623]">
              {activeTab === 'contracts' ? 'Contracts' : 'Submitted Jobs'}
            </div>
            <div className="text-[12px] text-[#6b6762]">
              {activeTab === 'contracts' ? 'Switch between active and ongoing work.' : 'View your submitted work for review.'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('contracts')}
              className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                activeTab === 'contracts'
                  ? "bg-white text-[#1a1a1a] shadow-sm"
                  : "bg-transparent text-[#6b6762] border border-[#EAE7E2]"
              }`}
            >
              Contracts
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('submitted')}
              className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                activeTab === 'submitted'
                  ? "bg-white text-[#1a1a1a] shadow-sm"
                  : "bg-transparent text-[#6b6762] border border-[#EAE7E2]"
              }`}
            >
              Submitted Jobs
            </button>
          </div>
        </div>
        {activeTab === 'contracts' && (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setView("active")}
              className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                view === "active"
                  ? "bg-white text-[#1a1a1a] shadow-sm"
                  : "bg-transparent text-[#6b6762] border border-[#EAE7E2]"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setView("ongoing")}
              className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                view === "ongoing"
                  ? "bg-white text-[#1a1a1a] shadow-sm"
                  : "bg-transparent text-[#6b6762] border border-[#EAE7E2]"
              }`}
            >
              Ongoing
            </button>
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 gap-4">
          {activeTab === 'contracts' ? (
            <>
              {loading ? (
                <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-4 text-[12px] text-[#6b6762]">
                  Loading contracts...
                </div>
              ) : errorMessage ? (
                <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FFF6F2] p-4 text-[12px] text-[#8C4F00]">
                  {errorMessage}
                </div>
              ) : visibleContracts.length ? (
                visibleContracts.map((contract) => (
                  <button
                    key={contract.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(contract.id);
                      setIsModalOpen(true);
                    }}
                    className="text-left rounded-[12px] border border-[#EAE7E2] bg-white p-4 shadow-[0_6px_16px_rgba(0,0,0,0.04)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[14px] font-semibold text-[#1a1a1a]">{contract.title}</div>
                        <div className="text-[12px] text-[#9e9690]">Client: {contract.clientName}</div>
                        <div className="mt-2 text-[11px] text-[#6b6762]">{contract.nextMilestone}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[12px] font-semibold text-[#8C4F00]">{contract.budget}</div>
                        <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[#6b6762]">
                          {contract.status}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-4 text-[12px] text-[#6b6762]">
                  No contracts in this view yet.
                </div>
              )}
            </>
          ) : (
            <>
              {submittedJobs.length ? (
                submittedJobs.map((job) => (
                  // <div
                  //   key={job.id}
                  //   className="rounded-[12px] break-words break-all border border-[#EAE7E2] bg-white p-4 shadow-[0_6px_16px_rgba(0,0,0,0.04)]"
                  // >
                  //   <div className="flex items-start justify-between gap-3">
                  //     <div>
                  //       <div className="text-[14px] font-semibold text-[#1a1a1a]">{job.description}</div>
                  //       <div className="text-[12px] text-[#9e9690]">
                  //         Contract: {contracts.find(c => c.id === job.contractId)?.title || 'Unknown'}
                  //       </div>
                  //       {job.link && (
                  //         <div className="mt-2 text-[12px] text-[#6b6762] break-words  break-all">
                  //           Link: <a href={job.link} target="_blank" rel="noopener noreferrer" className="text-[#8C4F00] underline">{job.link}</a>
                  //         </div>
                  //       )}
                  //       {job.attachment && (
                  //         <div className="mt-2 text-[12px] text-[#6b6762] break-all">
                  //           Attachment: <a href={job.attachment.url} target="_blank" rel="noopener noreferrer" className="text-[#8C4F00] underline">{job.attachment.name}</a>
                  //         </div>
                  //       )}
                  //     </div>
                  //     <div className="text-right">
                  //       <div className={`text-[10px] uppercase tracking-[0.1em] font-semibold ${
                  //         job.status === 'approved' ? 'text-green-600' : job.status === 'rejected' ? 'text-red-600' : 'text-[#F5A623]'
                  //       }`}>
                  //         {job.status}
                  //       </div>
                  //       <div className="mt-2 text-[10px] text-[#6b6762]">
                  //         {job.submittedAt.toLocaleDateString()}
                  //       </div>
                  //     </div>
                  //   </div>
                  // </div>
                  <div
                  key={job.id}
                  className="rounded-[12px] border border-[#EAE7E2] bg-white p-4 shadow-[0_6px_16px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[14px] font-semibold text-[#1a1a1a] break-words">{job.description}</div>
                      <div className="text-[12px] text-[#9e9690] break-words">
                        Contract: {contracts.find(c => c.id === job.contractId)?.title || 'Unknown'}
                      </div>
                      {job.link && (
                        <div className="mt-2 text-[12px] text-[#6b6762] break-all">
                          Link: <a href={job.link} target="_blank" rel="noopener noreferrer" className="text-[#8C4F00] underline break-all">{job.link}</a>
                        </div>
                      )}
                      {job.attachment && (
                        <div className="mt-2 text-[12px] text-[#6b6762] break-all">
                          Attachment: <a href={job.attachment.url} target="_blank" rel="noopener noreferrer" className="text-[#8C4F00] underline break-all">{job.attachment.name}</a>
                        </div>
                      )}
                    </div>
                    <div className="text-right flex flex-col gap-2">
                      <div className={`text-[10px] uppercase tracking-[0.1em] font-semibold ${
                        job.status === 'approved' ? 'text-green-600' : job.status === 'rejected' ? 'text-red-600' : 'text-[#F5A623]'
                      }`}>
                        {job.status}
                      </div>
                      <div className="text-[10px] text-[#6b6762]">
                        {job.submittedAt.toLocaleDateString()}
                      </div>
                      
                    </div>
                  </div>
                </div>
                ))
              ) : (
                <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-4 text-[12px] text-[#6b6762]">
                  No submitted jobs found.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {isModalOpen && selectedContract ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative z-[81] w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-[16px] border border-[#EAE7E2] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full border border-[#EAE7E2] bg-white p-2 text-[#6b6762] hover:bg-[#F7F4F0]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">
                  Contract Details
                </div>
                <div className="mt-2 text-[18px] font-semibold text-[#1a1a1a]">
                  {selectedContract.title}
                </div>
                <div className="text-[12px] text-[#9e9690]">
                  Client: {selectedContract.clientName} • {selectedContract.status}
                </div>
              </div>
            </div>

            <div className="mt-4 text-[12px] leading-[1.7] text-[#6b6762]">
              {selectedContract.description}
            </div>

            <div className="mt-5 rounded-[12px] border border-[#EAE7E2] bg-[#FAF8F5] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8C4F00]">
                Contract Overview
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-[11px] text-[#6b6762]">
                <div className="rounded-[10px] border border-[#EFECE7] bg-white px-3 py-2">
                  <div className="uppercase tracking-[0.12em] text-[#9e9690]">Project</div>
                  <div className="mt-1 font-semibold text-[#1a1a1a]">{selectedContract.title}</div>
                </div>
                <div className="rounded-[10px] border border-[#EFECE7] bg-white px-3 py-2">
                  <div className="uppercase tracking-[0.12em] text-[#9e9690]">Client</div>
                  <div className="mt-1 font-semibold text-[#1a1a1a]">{selectedContract.clientName}</div>
                </div>
                <div className="rounded-[10px] border border-[#EFECE7] bg-white px-3 py-2">
                  <div className="uppercase tracking-[0.12em] text-[#9e9690]">Contract Type</div>
                  <div className="mt-1 font-semibold text-[#1a1a1a]">
                    {selectedContract.contractType ?? "Fixed Price"}
                  </div>
                </div>
                <div className="rounded-[10px] border border-[#EFECE7] bg-white px-3 py-2">
                  <div className="uppercase tracking-[0.12em] text-[#9e9690]">Status</div>
                  <div className="mt-1 font-semibold text-[#1a1a1a]">{selectedContract.status}</div>
                </div>
                <div className="rounded-[10px] border border-[#EFECE7] bg-white px-3 py-2">
                  <div className="uppercase tracking-[0.12em] text-[#9e9690]">Start Date</div>
                  <div className="mt-1 font-semibold text-[#1a1a1a]">{selectedContract.startDate}</div>
                </div>
                <div className="rounded-[10px] border border-[#EFECE7] bg-white px-3 py-2">
                  <div className="uppercase tracking-[0.12em] text-[#9e9690]">Budget</div>
                  <div className="mt-1 font-semibold text-[#1a1a1a]">{selectedContract.budget}</div>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[12px] border border-[#EAE7E2] bg-white p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8C4F00]">
                Scope Of Work
              </div>
              {selectedContract.scopeItems?.length ? (
                <ul className="mt-3 grid grid-cols-1 gap-2 text-[12px] text-[#6b6762]">
                  {selectedContract.scopeItems.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#F7931A]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[12px] text-[#6b6762]">
                  Define the deliverables and features for this contract.
                </p>
              )}
            </div>

            {selectedContract.contractType === "Fixed Price" ? (
              <div className="mt-5 rounded-[12px] border border-[#EAE7E2] bg-[#FAF8F5] p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8C4F00]">
                  Milestones
                </div>
                {selectedContract.milestones?.length ? (
                  <div className="mt-3 space-y-3">
                    {selectedContract.milestones.map((milestone) => (
                      <div
                        key={milestone.name}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#EFECE7] bg-white px-3 py-2 text-[11px]"
                      >
                        <div>
                          <div className="font-semibold text-[#1a1a1a]">{milestone.name}</div>
                          <div className="text-[#9e9690]">{milestone.deadline}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-[#8C4F00]">{milestone.amount}</div>
                          <div className="text-[10px] uppercase tracking-[0.12em] text-[#6b6762]">
                            {milestone.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-[12px] text-[#6b6762]">
                    Milestones will appear here once defined.
                  </p>
                )}
              </div>
            ) : null}

            <div className="mt-5 rounded-[12px] border border-[#EAE7E2] bg-white p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8C4F00]">
                Payment Details
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-[11px] text-[#6b6762]">
                <div className="rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-3 py-2">
                  <div className="uppercase tracking-[0.12em] text-[#9e9690]">Total Value</div>
                  <div className="mt-1 font-semibold text-[#1a1a1a]">{selectedContract.budget}</div>
                </div>
                <div className="rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-3 py-2">
                  <div className="uppercase tracking-[0.12em] text-[#9e9690]">Paid</div>
                  <div className="mt-1 font-semibold text-[#1a1a1a]">0 sats</div>
                </div>
                <div className="rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-3 py-2">
                  <div className="uppercase tracking-[0.12em] text-[#9e9690]">Escrow</div>
                  <div className="mt-1 font-semibold text-[#1a1a1a]">0 sats</div>
                </div>
                <div className="rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-3 py-2">
                  <div className="uppercase tracking-[0.12em] text-[#9e9690]">Pending</div>
                  <div className="mt-1 font-semibold text-[#1a1a1a]">0 sats</div>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-[#9e9690]">
                Payments are placeholders until escrow is implemented.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-[11px] text-[#6b6762]">
              <div className="rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-3 py-2">
                <div className="uppercase tracking-[0.12em] text-[#9e9690]">Budget</div>
                <div className="mt-1 font-semibold text-[#1a1a1a]">{selectedContract.budget}</div>
              </div>
              <div className="rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-3 py-2">
                <div className="uppercase tracking-[0.12em] text-[#9e9690]">Progress</div>
                <div className="mt-1 font-semibold text-[#1a1a1a]">{selectedContract.progress}%</div>
              </div>
              <div className="rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-3 py-2">
                <div className="uppercase tracking-[0.12em] text-[#9e9690]">Start</div>
                <div className="mt-1 font-semibold text-[#1a1a1a]">{selectedContract.startDate}</div>
              </div>
              <div className="rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-3 py-2">
                <div className="uppercase tracking-[0.12em] text-[#9e9690]">Due</div>
                <div className="mt-1 font-semibold text-[#1a1a1a]">{selectedContract.dueDate}</div>
              </div>
            </div>

            <div className="mt-4 rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#9e9690]">
                Next Milestone
              </div>
              <div className="mt-2 text-[12px] font-semibold text-[#1a1a1a]">
                {selectedContract.nextMilestone}
              </div>
            </div>

            <div className="mt-5 rounded-[12px] border border-[#EAE7E2] bg-[#FAF8F5] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8C4F00]">
                    Submit work
                  </div>
                  <p className="mt-2 text-[12px] text-[#6b6762]">
                    Use the contract page to upload your deliverable and share a link for client review.
                  </p>
                </div>
              </div>
             
              <div className="mt-4 space-y-3">
                <textarea
                  value={workMessage}
                  onChange={(e) => setWorkMessage(e.target.value)}
                  placeholder="Describe the completed work"
                  rows={3}
                  className="w-full rounded-[10px] border border-[#EAE7E7] bg-white px-3 py-2 text-[12px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20"
                />
                <input
                  value={workLink}
                  onChange={(e) => setWorkLink(e.target.value)}
                  placeholder="Paste a link to deliverable, preview, or repository"
                  className="w-full rounded-[10px] border border-[#EAE7E7] bg-white px-3 py-2 text-[12px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {selectedFile ? selectedFile.name : "Attach File"}
                  </Button>
                  {selectedFile ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="text-[11px] font-semibold text-[#6b6762]"
                    >
                      Remove
                    </button>
                  ) : null}
                  <Button
                    size="sm"
                    className="rounded-full"
                    onClick={() => void handleSubmitWork()}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Submitting..." : "Submit Work"}
                  </Button>
                </div>
                {submissionSuccess ? (
                  <p className="text-[12px] text-[#2F855A]">{submissionSuccess}</p>
                ) : null}
                {submissionError ? (
                  <p className="text-[12px] text-[#C53030]">{submissionError}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={async () => {
                  if (!selectedContract?.jobId || !selectedContract?.freelancerId) return;
                  const clientId = selectedContract.clientId ?? "";
                  if (!clientId) return;
                  const freelancerId =
                    firebaseAuth.currentUser?.uid ?? selectedContract.freelancerId ?? "";
                  if (!freelancerId) return;
                  let freelancerName = "Freelancer";
                  let clientName = await resolveClientName(
                    clientId,
                    selectedContract.clientName ?? ""
                  );
                  const [clientAvatarUrl, freelancerAvatarUrl] = await Promise.all([
                    resolveClientAvatar(clientId),
                    resolveFreelancerAvatar(freelancerId),
                  ]);
                  try {
                    const allUsersSnap = await getDoc(doc(firebaseDb, "all_users", freelancerId));
                    if (allUsersSnap.exists()) {
                      const d = allUsersSnap.data() as any;
                      freelancerName = d.fullName ?? d.name ?? d.email ?? "Freelancer";
                    }
                  } catch {
                    freelancerName = "Freelancer";
                  }
                  if (!clientName) clientName = "Client";
                  const conversationId = createConversationId(
                    selectedContract.jobId,
                    selectedContract.freelancerId
                  );
                  await setDoc(
                    doc(firebaseDb, "conversations", conversationId),
                    {
                      jobId: selectedContract.jobId,
                      jobTitle: selectedContract.title,
                      proposalId: "",
                      clientId,
                      clientName,
                      freelancerId: selectedContract.freelancerId,
                      freelancerName,
                      clientAvatarUrl,
                      freelancerAvatarUrl,
                      paymentTotalAmountSats: parseSats(selectedContract.budget),
                      paymentStatus: "unfunded",
                      createdBy: "system",
                      canFreelancerMessage: true,
                      unread: {
                        [clientId]: 0,
                        [selectedContract.freelancerId]: 0,
                      },
                      updatedAt: serverTimestamp(),
                      createdAt: serverTimestamp(),
                    },
                    { merge: true }
                  );
                  router.push(`/freelancer/dashboard/messages?chat=${conversationId}`);
                }}
              >
                Message Client
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

