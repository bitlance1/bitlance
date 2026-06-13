// "use client";

// import { useEffect, useMemo, useRef, useState } from "react";
// import { useRouter } from "next/navigation";
// import Button from "@/components/atoms/Button";
// import { Calendar, Search } from "lucide-react";
// import { firebaseAuth, firebaseDb } from "@/lib/firebase";
// import { sendUserNotification } from "@/lib/notifications";
// import { onAuthStateChanged } from "firebase/auth";
// import { addDoc, collection, doc, getDoc, getDocs, increment, limit, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";

// type ContractStatus = "Active" | "Review" | "Completed";

// type Contract = {
//   id: string;
//   title: string;
//   clientName: string;
//   clientId?: string;
//   freelancerId?: string;
//   jobId?: string;
//   contractType?: "Fixed Price" | "Hourly";
//   status: ContractStatus;
//   budget: string;
//   progress: number;
//   nextMilestone: string;
//   startDate: string;
//   dueDate: string;
//   description: string;
//   paymentStatus?: "unfunded" | "invoice_created" | "funded" | "released" | "expired";
//   paymentInstallments?: number;
//   paymentCurrentInstallment?: number;
//   paymentReleasedInstallments?: number;
//   paymentTotalAmountSats?: number;
//   paymentTotalChargedSats?: number;
//   paymentPaidAmountSats?: number;
//   platformFeeSats?: number;
//   platformFeePercent?: number;
//   escrowFundedTotalSats?: number;
//   escrowReleasedSats?: number;
//   workStatus?: "not_started" | "in_progress" | "submitted" | "changes_requested" | "approved" | "completed";
//   submissionMessage?: string;
//   submissionLink?: string;
//   submissionAttachment?: {
//     name?: string;
//     url?: string;
//   } | null;
//   submissionReviewDueAt?: any;
//   revisionMessage?: string;
//   scopeItems?: string[];
//   milestones?: Array<{
//     index?: number;
//     name: string;
//     title?: string;
//     amount: string;
//     freelancerAmountSats?: number;
//     platformFeeSats?: number;
//     totalClientPaysSats?: number;
//     fundedSats?: number;
//     releasedSats?: number;
//     deadline: string;
//     status: "Pending" | "In Progress" | "Approved" | "pending" | "funded" | "submitted" | "approved" | "released";
//   }>;
//   createdAt?: any;
//   updatedAt?: any;
// };

// type SubmittedJob = {
//   id: string;
//   contractId: string;
//   milestoneIndex?: number;
//   milestoneTitle?: string;
//   description: string;
//   link?: string;
//   attachment?: {
//     name: string;
//     url: string;
//   };
//   submittedAt: Date;
//   status: "pending" | "approved" | "rejected";
//   revisionMessage?: string;
// };

// const formatDate = (value: any) => {
//   if (!value) return "-";
//   if (typeof value === "string") return value;
//   const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
//   return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
// };

// const formatSats = (value: string) =>
//   value.toLowerCase().includes("sats") ? value : `${value} sats`;

// const parseSats = (value: unknown) => {
//   if (typeof value === "number") return value;
//   const cleaned = String(value ?? "").replace(/[^0-9]/g, "");
//   return cleaned ? Number(cleaned) : 0;
// };

// const numberField = (value: unknown) => Number(value ?? 0);

// const hasFundedEscrow = (data: Record<string, unknown>) => {
//   const fundedTotal = Number(data.escrowFundedTotalSats ?? data.paymentPaidAmountSats ?? 0);
//   const releasedTotal = Number(data.escrowReleasedSats ?? 0);
//   const hasFundedMilestone = Array.isArray(data.milestones)
//     ? data.milestones.some((milestone) => {
//         const item = milestone as Record<string, unknown>;
//         const funded = numberField(item.fundedSats);
//         const released = numberField(item.releasedSats);
//         return funded > released;
//       })
//     : false;

//   return fundedTotal > releasedTotal || hasFundedMilestone;
// };

// const normalizePaymentStatus = (data: Record<string, unknown>): Contract["paymentStatus"] => {
//   const status = typeof data.paymentStatus === "string" ? data.paymentStatus : "unfunded";
//   if (!["unfunded", "invoice_created", "funded", "released", "expired"].includes(status)) {
//     return "unfunded";
//   }
//   if ((status === "funded" || status === "released") && !hasFundedEscrow(data)) {
//     return "unfunded";
//   }
//   if (status === "invoice_created" && !data.paymentRequest) {
//     return "unfunded";
//   }
//   return status as Contract["paymentStatus"];
// };

// const normalizeWorkStatus = (data: Record<string, unknown>): Contract["workStatus"] => {
//   const status = typeof data.workStatus === "string" ? data.workStatus : "not_started";
//   if (!["not_started", "in_progress", "submitted", "changes_requested", "approved", "completed"].includes(status)) {
//     return "not_started";
//   }
//   if (status === "in_progress" && !hasFundedEscrow(data)) {
//     return "not_started";
//   }
//   return status as Contract["workStatus"];
// };

// const calculateInstallmentAmount = (total: number, installments: number, installment: number) => {
//   const safeTotal = Math.max(0, Math.trunc(total));
//   const safeInstallments = Math.max(1, Math.min(3, Math.trunc(installments)));
//   const safeInstallment = Math.max(1, Math.min(safeInstallments, Math.trunc(installment)));
//   const base = Math.floor(safeTotal / safeInstallments);
//   const remainder = safeTotal % safeInstallments;
//   return base + (safeInstallment <= remainder ? 1 : 0);
// };

// export default function FreelancerContractsContent() {
//   const router = useRouter();
//   const [view, setView] = useState<"all" | "ongoing" | "finished">("all");
//   const [selectedId, setSelectedId] = useState("");
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [contracts, setContracts] = useState<Contract[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [errorMessage, setErrorMessage] = useState("");
//   const [workMessage, setWorkMessage] = useState("");
//   const [workLink, setWorkLink] = useState("");
//   const [selectedFile, setSelectedFile] = useState<File | null>(null);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [submissionSuccess, setSubmissionSuccess] = useState("");
//   const [submissionError, setSubmissionError] = useState("");
//   const [activeTab, setActiveTab] = useState<'contracts' | 'submitted'>('contracts');
//   const [submittedJobs, setSubmittedJobs] = useState<SubmittedJob[]>([]);
//   const [searchQuery, setSearchQuery] = useState("");
//   const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
//   const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
//   const [editWorkMessage, setEditWorkMessage] = useState("");
//   const [editWorkLink, setEditWorkLink] = useState("");
//   const [editSelectedFile, setEditSelectedFile] = useState<File | null>(null);
//   const [editSubmissionError, setEditSubmissionError] = useState("");
//   const [editSubmissionSuccess, setEditSubmissionSuccess] = useState("");
//   const [isUpdatingSubmission, setIsUpdatingSubmission] = useState(false);
//   const fileInputRef = useRef<HTMLInputElement>(null);
//   const editFileInputRef = useRef<HTMLInputElement>(null);
//   const createConversationId = (jobId: string, freelancerId: string) => `${jobId}_${freelancerId}`;
//   const clientNameCache = useRef<Record<string, string>>({});
//   const clientAvatarCache = useRef<Record<string, string>>({});
//   const freelancerAvatarCache = useRef<Record<string, string>>({});

//   const resolveClientName = async (clientId: string, fallbackName: string) => {
//     const initialFallback = fallbackName?.trim() || "";
//     if (!clientId) return initialFallback || "Client";
//     if (clientNameCache.current[clientId]) return clientNameCache.current[clientId];

//     let resolvedName = initialFallback;

//     try {
//       const clientDocSnap = await getDoc(doc(firebaseDb, "clients", clientId));
//       if (clientDocSnap.exists()) {
//         const data = clientDocSnap.data() as any;
//         resolvedName = data.fullName ?? data.firstName ?? data.name ?? resolvedName;
//       }
//     } catch {
//       // Continue with UID-based lookup.
//     }

//     if (!resolvedName) {
//       try {
//         const clientsByUidQuery = query(
//           collection(firebaseDb, "clients"),
//           where("uid", "==", clientId),
//           limit(1)
//         );
//         const clientsByUidSnap = await getDocs(clientsByUidQuery);
//         if (!clientsByUidSnap.empty) {
//           const data = clientsByUidSnap.docs[0].data() as any;
//           resolvedName = data.fullName ?? data.firstName ?? data.name ?? resolvedName;
//         }
//       } catch {
//         // Continue with all_users fallback.
//       }
//     }

//     if (!resolvedName) {
//       try {
//         const allUsersSnap = await getDoc(doc(firebaseDb, "all_users", clientId));
//         if (allUsersSnap.exists()) {
//           const data = allUsersSnap.data() as any;
//           resolvedName = data.fullName ?? data.name ?? data.email ?? resolvedName;
//         }
//       } catch {
//         // Keep fallback below.
//       }
//     }

//     const finalName = resolvedName || "Client";
//     clientNameCache.current[clientId] = finalName;
//     return finalName;
//   };

//   const resolveClientAvatar = async (clientId: string) => {
//     if (!clientId) return "";
//     if (clientAvatarCache.current[clientId] !== undefined) return clientAvatarCache.current[clientId];

//     let avatarUrl = "";
//     try {
//       const [clientSnap, allUsersSnap] = await Promise.all([
//         getDoc(doc(firebaseDb, "clients", clientId)),
//         getDoc(doc(firebaseDb, "all_users", clientId)),
//       ]);
//       const c = clientSnap.exists() ? (clientSnap.data() as any) : {};
//       const a = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
//       avatarUrl = c.avatarUrl ?? a.avatarUrl ?? "";
//     } catch {
//       avatarUrl = "";
//     }

//     clientAvatarCache.current[clientId] = avatarUrl;
//     return avatarUrl;
//   };

//   const resolveFreelancerAvatar = async (freelancerId: string) => {
//     if (!freelancerId) return "";
//     if (freelancerAvatarCache.current[freelancerId] !== undefined) {
//       return freelancerAvatarCache.current[freelancerId];
//     }

//     let avatarUrl = "";
//     try {
//       const [freelancerSnap, allUsersSnap] = await Promise.all([
//         getDoc(doc(firebaseDb, "freelancers", freelancerId)),
//         getDoc(doc(firebaseDb, "all_users", freelancerId)),
//       ]);
//       const f = freelancerSnap.exists() ? (freelancerSnap.data() as any) : {};
//       const a = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
//       avatarUrl = f.avatarUrl ?? a.avatarUrl ?? "";
//     } catch {
//       avatarUrl = "";
//     }

//     freelancerAvatarCache.current[freelancerId] = avatarUrl;
//     return avatarUrl;
//   };

//   const uploadContractFile = async (file: File) => {
//     const idToken = await firebaseAuth.currentUser?.getIdToken();
//     if (!idToken) throw new Error("Please log in before uploading files.");
//     const formData = new FormData();
//     formData.append("file", file);
//     const uploadResponse = await fetch("/api/chat/upload", {
//       method: "POST",
//       headers: { Authorization: `Bearer ${idToken}` },
//       body: formData,
//     });
//     const uploadPayload = (await uploadResponse.json()) as any;
//     if (!uploadResponse.ok || !uploadPayload?.url) {
//       throw new Error(uploadPayload?.error || "Failed to upload attachment.");
//     }
//     return {
//       url: uploadPayload.url,
//       name: uploadPayload.name ?? file.name,
//       bytes: uploadPayload.bytes ?? file.size,
//       size: uploadPayload.size ?? file.size,
//       mimeType: uploadPayload.mimeType ?? file.type,
//       resourceType: uploadPayload.resourceType ?? "auto",
//       publicId: uploadPayload.publicId ?? "",
//     };
//   };

//   const handleSubmitWork = async () => {
//     if (!selectedContract || !selectedContract.clientId || !selectedContract.freelancerId) return;
//     const nextMilestoneIndex = (selectedContract.paymentReleasedInstallments ?? 0) + 1;
//     const milestone = selectedContract.milestones?.find((item: any, index) => Number(item.index ?? index + 1) === nextMilestoneIndex);
//     const milestoneAmount = Number((milestone as any)?.freelancerAmountSats ?? calculateInstallmentAmount(selectedContract.paymentTotalAmountSats || parseSats(selectedContract.budget), selectedContract.paymentInstallments ?? 1, nextMilestoneIndex));
//     const fundedForMilestone = milestone
//       ? Number((milestone as any).fundedSats ?? 0) - Number((milestone as any).releasedSats ?? 0)
//       : milestoneAmount;
//     if (selectedContract.paymentStatus !== "funded" && selectedContract.paymentStatus !== "released") {
//       setSubmissionError("Escrow is not funded for this milestone yet.");
//       return;
//     }
//     if (fundedForMilestone < milestoneAmount) {
//       setSubmissionError(`Milestone escrow is short by ${(milestoneAmount - fundedForMilestone).toLocaleString()} sats. Ask the client to fund escrow before submitting.`);
//       return;
//     }
//     setIsSubmitting(true);
//     setSubmissionError("");
//     setSubmissionSuccess("");

//     try {
//       const attachment = selectedFile ? await uploadContractFile(selectedFile) : null;
//       const contractUrl = `/client/dashboard/contracts?contract=${selectedContract.id}`;
//       const notificationText = `Work for "${selectedContract.title}" — Milestone ${nextMilestoneIndex}: ${(milestone as any)?.title || (milestone as any)?.name || `Milestone ${nextMilestoneIndex}`} has been submitted for review. [Check it out](${contractUrl})`;
//       const messageText = notificationText;

//       // Add to submitted_jobs collection
//       const milestoneTitle = (milestone as any)?.title || (milestone as any)?.name || `Milestone ${nextMilestoneIndex}`;
//       const submissionData = {
//         contractId: selectedContract.id,
//         clientId: selectedContract.clientId,
//         freelancerId: selectedContract.freelancerId,
//         contractTitle: selectedContract.title,
//         milestoneIndex: nextMilestoneIndex,
//         milestoneTitle,
//         description: workMessage || "Work submitted for review.",
//         link: workLink || "",
//         attachment: attachment,
//         submittedAt: serverTimestamp(),
//         status: "pending",
//       };

//       // Update contract workStatus
//       const updatedMilestones = (selectedContract.milestones ?? []).map((item: any, index) => {
//         const itemIndex = Number(item.index ?? index + 1);
//         if (itemIndex !== nextMilestoneIndex) return item;
//         return {
//           ...item,
//           status: "submitted",
//           submittedAt: new Date().toISOString(),
//         };
//       });
//       const contractUpdate = {
//         workStatus: "submitted",
//         milestones: updatedMilestones,
//         updatedAt: serverTimestamp(),
//       };

//       const conversationId =
//         selectedContract.jobId && selectedContract.freelancerId
//           ? `${selectedContract.jobId}_${selectedContract.freelancerId}`
//           : selectedContract.id;

//       await Promise.all([
//         addDoc(collection(firebaseDb, "submitted_jobs"), submissionData),
//         setDoc(doc(firebaseDb, "contracts", selectedContract.id), contractUpdate, { merge: true }),
//         setDoc(
//           doc(firebaseDb, "conversations", conversationId),
//           {
//             milestones: updatedMilestones,
//             workStatus: "submitted",
//             "lastMessage.text": notificationText,
//             "lastMessage.senderId": selectedContract.freelancerId,
//             "lastMessage.createdAt": serverTimestamp(),
//             [`unread.${selectedContract.clientId}`]: increment(1),
//             [`unread.${selectedContract.freelancerId}`]: 0,
//             updatedAt: serverTimestamp(),
//           },
//           { merge: true }
//         ),
//         addDoc(collection(firebaseDb, "conversations", conversationId, "messages"), {
//           senderId: selectedContract.freelancerId,
//           senderRole: "freelancer",
//           text: messageText,
//           messageType: "work_submission",
//           createdAt: serverTimestamp(),
//         }),
//       ]);
//       void sendUserNotification({
//         userId: selectedContract.clientId,
//         title: "Work submitted for review",
//         body: notificationText,
//         url: `/client/dashboard/contracts?contract=${selectedContract.id}`,
//         tag: `work-submission-${selectedContract.id}`,
//       }).catch(console.error);

//       setSubmissionSuccess("Work submitted for review.");
//       setWorkMessage("");
//       setWorkLink("");
//       setSelectedFile(null);
//       if (fileInputRef.current) fileInputRef.current.value = "";
//     } catch (error) {
//       console.error("Submit work error:", error);
//       setSubmissionError(error instanceof Error ? error.message : "Unable to submit work. Please try again.");
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   useEffect(() => {
//     let unsubscribeContracts: (() => void) | undefined;
//     let unsubscribeSubmitted: (() => void) | undefined;
//     const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
//       if (!user) {
//         if (unsubscribeContracts) unsubscribeContracts();
//         if (unsubscribeSubmitted) unsubscribeSubmitted();
//         setContracts([]);
//         setSelectedId("");
//         setLoading(false);
//         setErrorMessage("Please log in to view contracts.");
//         return;
//       }
//       setLoading(true);
//       setErrorMessage("");
//       const contractsQuery = query(
//         collection(firebaseDb, "contracts"),
//         where("freelancerId", "==", user.uid)
//       );
//       unsubscribeContracts = onSnapshot(
//         contractsQuery,
//         (snapshot) => {
//           const items: Contract[] = snapshot.docs.map((docSnap) => {
//             const data = docSnap.data() as any;
//             return {
//               id: docSnap.id,
//               title: data.title ?? "Contract",
//               clientName: data.clientName ?? "",
//               clientId: data.clientId ?? "",
//               freelancerId: data.freelancerId ?? "",
//               jobId: data.jobId ?? "",
//               contractType: data.contractType ?? data.jobType ?? "Fixed Price",
//               status: (data.status as ContractStatus) ?? "Active",
//               budget: formatSats(data.budget ?? "0"),
//               progress: typeof data.progress === "number" ? data.progress : 0,
//               nextMilestone: data.nextMilestone ?? "-",
//               startDate: formatDate(data.startDate),
//               dueDate: formatDate(data.dueDate),
//               description: data.description ?? "-",
//               paymentStatus: normalizePaymentStatus(data),
//               paymentInstallments: Number(data.paymentInstallments ?? 1),
//               paymentCurrentInstallment: Number(data.paymentCurrentInstallment ?? 1),
//               paymentReleasedInstallments: Number(data.paymentReleasedInstallments ?? 0),
//               paymentTotalAmountSats: Number(data.paymentTotalAmountSats ?? parseSats(data.budget) ?? 0),
//               paymentTotalChargedSats: Number(data.paymentTotalChargedSats ?? 0),
//               paymentPaidAmountSats: Number(data.paymentPaidAmountSats ?? 0),
//               platformFeeSats: Number(data.platformFeeSats ?? 0),
//               platformFeePercent: Number(data.platformFeePercent ?? 5),
//               escrowFundedTotalSats: Number(data.escrowFundedTotalSats ?? 0),
//               escrowReleasedSats: Number(data.escrowReleasedSats ?? 0),
//               workStatus: normalizeWorkStatus(data),
//               submissionMessage: data.submissionMessage ?? "",
//               submissionLink: data.submissionLink ?? "",
//               submissionAttachment: data.submissionAttachment ?? null,
//               submissionReviewDueAt: data.submissionReviewDueAt,
//               revisionMessage: data.revisionMessage ?? "",
//               scopeItems: Array.isArray(data.scopeItems) ? data.scopeItems : [],
//               milestones: Array.isArray(data.milestones) ? data.milestones : [],
//               createdAt: data.createdAt,
//               updatedAt: data.updatedAt,
//             };
//           });
//           const hydrateClientNames = async () => {
//             const hydrated = await Promise.all(
//               items.map(async (contract) => ({
//                 ...contract,
//                 clientName: await resolveClientName(
//                   contract.clientId ?? "",
//                   contract.clientName ?? ""
//                 ),
//               }))
//             );
//             // Sort by latest first (assuming updatedAt or createdAt exists)
//             hydrated.sort((a, b) => {
//               const aDate = a.updatedAt || a.createdAt || 0;
//               const bDate = b.updatedAt || b.createdAt || 0;
//               return bDate - aDate;
//             });
//             setContracts(hydrated);
//             setLoading(false);
//             if (!selectedId && hydrated.length) setSelectedId(hydrated[0].id);
//           };
//           hydrateClientNames();
//         },
//         () => {
//           setLoading(false);
//           setErrorMessage("Unable to load contracts.");
//         }
//       );

//       // Load submitted jobs
//       const submittedQuery = query(
//         collection(firebaseDb, "submitted_jobs"),
//         where("freelancerId", "==", user.uid)
//       );
//       unsubscribeSubmitted = onSnapshot(
//         submittedQuery,
//         (snapshot) => {
//           const items: SubmittedJob[] = snapshot.docs.map((docSnap) => {
//             const data = docSnap.data() as any;
//             return {
//               id: docSnap.id,
//               contractId: data.contractId ?? "",
//               milestoneIndex: typeof data.milestoneIndex === "number" ? data.milestoneIndex : undefined,
//               milestoneTitle: data.milestoneTitle ?? undefined,
//               description: data.description ?? "",
//               link: data.link ?? "",
//               attachment: data.attachment ?? null,
//               submittedAt: data.submittedAt?.toDate() ?? new Date(),
//               status: data.status ?? "pending",
//               revisionMessage: data.revisionMessage ?? "",
//             };
//           });
//           // Sort by latest first
//           items.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
//           setSubmittedJobs(items);
//         },
//         () => {
//           // Handle error if needed
//         }
//       );
//     });
//     return () => {
//       unsubscribeAuth();
//       if (unsubscribeContracts) unsubscribeContracts();
//       if (unsubscribeSubmitted) unsubscribeSubmitted();
//     };
//   }, [selectedId]);

//   const isFinishedContract = (contract: Contract) =>
//     contract.status === "Completed" ||
//     contract.paymentStatus === "released" ||
//     contract.workStatus === "approved" ||
//     contract.workStatus === "completed";

//   const isEscrowContract = (contract: Contract) =>
//     !isFinishedContract(contract) &&
//     (contract.paymentStatus === "funded" ||
//       (contract.escrowFundedTotalSats ?? 0) > 0 ||
//       contract.workStatus === "in_progress" ||
//       contract.workStatus === "submitted" ||
//       contract.workStatus === "changes_requested");

//   const ongoingContracts = useMemo(
//     () => contracts.filter((contract) => isEscrowContract(contract)),
//     [contracts]
//   );
//   const finishedContracts = useMemo(
//     () => contracts.filter((contract) => isFinishedContract(contract)),
//     [contracts]
//   );

//   const getMilestoneCount = (contract: Contract) => contract.milestones?.length || contract.paymentInstallments || 0;
//   const getMilestoneProgressPercent = (contract: Contract) => {
//     const total = getMilestoneCount(contract);
//     if (!total) return contract.progress;
//     if (contract.status === "Completed" || contract.paymentStatus === "released" || contract.workStatus === "approved" || contract.workStatus === "completed") return 100;
//     const currentMilestone = Math.min(total, (contract.paymentReleasedInstallments ?? 0) + 1);
//     return Math.round((currentMilestone / total) * 100);
//   };
//   const getDueLabel = (dueDate: string) => {
//     const parsed = Date.parse(dueDate);
//     if (Number.isNaN(parsed)) return `Due ${dueDate}`;
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     const due = new Date(parsed);
//     due.setHours(0, 0, 0, 0);
//     const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
//     if (diffDays === 0) return "Due today";
//     if (diffDays > 0) return `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
//     const overdueDays = Math.abs(diffDays);
//     return `Overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}`;
//   };
//   const AVATAR_COLORS = [
//     "bg-purple-600",
//     "bg-blue-600",
//     "bg-emerald-600",
//     "bg-orange-500",
//     "bg-rose-600",
//     "bg-indigo-600",
//     "bg-teal-600",
//     "bg-amber-600",
//   ];
//   const getAvatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
//   const getInitials = (name: string) =>
//     (name ?? "C")
//       .split(" ")
//       .filter(Boolean)
//       .slice(0, 2)
//       .map((p: string) => p[0]?.toUpperCase())
//       .join("");
//   const Avatar = ({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) => {
//     const sizeClass = size === "sm" ? "h-8 w-8 text-[11px]" : size === "lg" ? "h-11 w-11 text-[14px]" : "h-9 w-9 text-[12px]";
//     return (
//       <div className={`flex-shrink-0 flex items-center justify-center rounded-full font-black text-white ${sizeClass} ${getAvatarColor(name)}`}>
//         {getInitials(name)}
//       </div>
//     );
//   };
//   const StatusBadge = ({ label }: { label: string }) => {
//     const map: Record<string, string> = {
//       "Needs Review": "bg-orange-50 text-orange-700 border border-orange-200",
//       "Revision Requested": "bg-red-50 text-red-700 border border-red-200",
//       "Active": "bg-blue-50 text-blue-700 border border-blue-200",
//       "Completed": "bg-green-50 text-green-700 border border-green-200",
//       "In Progress": "bg-blue-50 text-blue-700 border border-blue-200",
//       "Finished": "bg-green-50 text-green-700 border border-green-200",
//       "Approved": "bg-green-50 text-green-700 border border-green-200",
//       "Pending Review": "bg-orange-50 text-orange-700 border border-orange-200",
//       "Changes Requested": "bg-red-50 text-red-700 border border-red-200",
//       "Pending": "bg-orange-50 text-orange-600 border border-orange-100",
//       "Scheduled": "bg-gray-50 text-gray-500 border border-gray-200",
//     };
//     return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[label] ?? "bg-gray-50 text-gray-600 border border-gray-200"}`}>{label}</span>;
//   };
//   const ProgressBar = ({ percent, color = "blue" }: { percent: number; color?: "blue" | "green" | "orange" | "red" }) => {
//     const c = { blue: "bg-blue-500", green: "bg-green-500", orange: "bg-orange-500", red: "bg-red-400" };
//     return (
//       <div className="h-1.5 w-full rounded-full bg-gray-100">
//         <div className={`h-1.5 rounded-full transition-all ${c[color]}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
//       </div>
//     );
//   };

//   const visibleContracts = useMemo(() => {
//     const base = view === "all" ? contracts : view === "ongoing" ? ongoingContracts : finishedContracts;
//     if (!searchQuery.trim()) return base;
//     const q = searchQuery.toLowerCase();
//     return base.filter((contract) =>
//       contract.title.toLowerCase().includes(q) ||
//       contract.clientName.toLowerCase().includes(q) ||
//       (contract.description ?? "").toLowerCase().includes(q)
//     );
//   }, [view, contracts, ongoingContracts, finishedContracts, searchQuery]);

//   const filteredSubmittedJobs = useMemo(() => {
//     if (!searchQuery.trim()) return submittedJobs;
//     const q = searchQuery.toLowerCase();
//     return submittedJobs.filter((job) => {
//       const contract = contracts.find((c) => c.id === job.contractId);
//       return (
//         (contract?.title ?? "").toLowerCase().includes(q) ||
//         (contract?.clientName ?? "").toLowerCase().includes(q) ||
//         (job.description ?? "").toLowerCase().includes(q)
//       );
//     });
//   }, [submittedJobs, contracts, searchQuery]);

//   const selectedContract =
//     contracts.find((c) => c.id === selectedId) ?? visibleContracts[0];
//   const selectedSubmission = selectedSubmissionId
//     ? submittedJobs.find((job) => job.id === selectedSubmissionId) ?? null
//     : null;
//   const selectedSubmissionContract = selectedSubmission
//     ? contracts.find((contract) => contract.id === selectedSubmission.contractId) ?? null
//     : null;
//   const editingSubmission = editingSubmissionId
//     ? submittedJobs.find((job) => job.id === editingSubmissionId) ?? null
//     : null;
//   const editingSubmissionContract = editingSubmission
//     ? contracts.find((contract) => contract.id === editingSubmission.contractId) ?? null
//     : null;
//   const needsAttentionCount = submittedJobs.filter((job) => job.status === "rejected").length;

//   const TABS: Array<{ id: "all" | "ongoing" | "submitted" | "finished"; label: string; count: number; alert?: boolean }> = [
//     { id: "all", label: "All", count: contracts.length },
//     { id: "ongoing", label: "Active", count: ongoingContracts.length },
//     { id: "submitted", label: "Submitted Jobs", count: filteredSubmittedJobs.length, alert: needsAttentionCount > 0 },
//     { id: "finished", label: "Finished", count: finishedContracts.length },
//   ];

//   const openEditSubmission = (job: SubmittedJob) => {
//     setEditingSubmissionId(job.id);
//     setEditWorkMessage(job.description || "");
//     setEditWorkLink(job.link || "");
//     setEditSelectedFile(null);
//     setEditSubmissionError("");
//     setEditSubmissionSuccess("");
//     if (editFileInputRef.current) editFileInputRef.current.value = "";
//   };

//   const handleUpdateSubmission = async () => {
//     if (!editingSubmission || !editingSubmissionContract) return;
//     const description = editWorkMessage.trim();
//     const link = editWorkLink.trim();

//     if (!description && !link && !editSelectedFile && !editingSubmission.attachment) {
//       setEditSubmissionError("Add a note, link, or file before saving the submission.");
//       return;
//     }

//     setIsUpdatingSubmission(true);
//     setEditSubmissionError("");
//     setEditSubmissionSuccess("");

//     try {
//       const attachment = editSelectedFile
//         ? await uploadContractFile(editSelectedFile)
//         : editingSubmission.attachment ?? null;
//       const nextMilestoneIndex = (editingSubmissionContract.paymentReleasedInstallments ?? 0) + 1;
//       const updatedMilestones = (editingSubmissionContract.milestones ?? []).map((item: any, index) => {
//         const itemIndex = Number(item.index ?? index + 1);
//         if (itemIndex !== nextMilestoneIndex) return item;
//         return {
//           ...item,
//           status: "submitted",
//           resubmittedAt: new Date().toISOString(),
//         };
//       });
//       const conversationId =
//         editingSubmissionContract.jobId && editingSubmissionContract.freelancerId
//           ? `${editingSubmissionContract.jobId}_${editingSubmissionContract.freelancerId}`
//           : editingSubmissionContract.id;
//       const messageText =
//         editingSubmission.status === "rejected"
//           ? `Updated work for "${editingSubmissionContract.title}" has been resubmitted after requested adjustments.`
//           : `Submitted work for "${editingSubmissionContract.title}" was updated.`;

//       await Promise.all([
//         updateDoc(doc(firebaseDb, "submitted_jobs", editingSubmission.id), {
//           description: description || "Work submitted for review.",
//           link,
//           attachment,
//           status: "pending",
//           updatedAt: serverTimestamp(),
//           resubmittedAt: serverTimestamp(),
//         }),
//         setDoc(doc(firebaseDb, "contracts", editingSubmission.contractId), {
//           workStatus: "submitted",
//           milestones: updatedMilestones,
//           unreadByClient: true,
//           unreadByFreelancer: false,
//           updatedAt: serverTimestamp(),
//         }, { merge: true }),
//         setDoc(
//           doc(firebaseDb, "conversations", conversationId),
//           {
//             workStatus: "submitted",
//             milestones: updatedMilestones,
//             "lastMessage.text": messageText,
//             "lastMessage.senderId": editingSubmissionContract.freelancerId,
//             "lastMessage.createdAt": serverTimestamp(),
//             [`unread.${editingSubmissionContract.clientId}`]: increment(1),
//             [`unread.${editingSubmissionContract.freelancerId}`]: 0,
//             updatedAt: serverTimestamp(),
//           },
//           { merge: true }
//         ),
//         addDoc(collection(firebaseDb, "conversations", conversationId, "messages"), {
//           senderId: editingSubmissionContract.freelancerId,
//           senderRole: "freelancer",
//           text: messageText,
//           messageType: "work_resubmission",
//           createdAt: serverTimestamp(),
//         }),
//       ]);
//       void sendUserNotification({
//         userId: editingSubmissionContract.clientId || "",
//         title: "Work resubmitted",
//         body: messageText,
//         url: `/client/dashboard/contracts?contract=${editingSubmissionContract.id}`,
//         tag: `work-resubmission-${editingSubmissionContract.id}`,
//       }).catch(console.error);

//       setEditSubmissionSuccess("Submission updated and sent back to the client.");
//       setEditingSubmissionId(null);
//       setSelectedSubmissionId(editingSubmission.id);
//       setEditSelectedFile(null);
//       if (editFileInputRef.current) editFileInputRef.current.value = "";
//     } catch {
//       setEditSubmissionError("Unable to update the submission. Please try again.");
//     } finally {
//       setIsUpdatingSubmission(false);
//     }
//   };

//   return (
//     <section className="w-full min-h-screen">
//       <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 sm:py-5">
//         <p className="text-[11px] font-bold uppercase tracking-widest text-orange-600 mb-1">Contracts</p>
//         <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Your Contracts</h1>
//         <p className="text-sm text-gray-500 mt-0.5">Track your active projects, submitted work, and finished milestones.</p>
//       </div>

//       <div className="bg-white border-b rounded-[8px] border-gray-100 px-3 sm:px-6">
//         <div className="flex sm:hidden items-center gap-2 py-3 border-b border-gray-100">
//           <div className="relative flex-1">
//             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
//             <input
//               type="text"
//               value={searchQuery}
//               onChange={(e) => setSearchQuery(e.target.value)}
//               placeholder={activeTab === "submitted" ? "Search submitted work..." : "Search contracts..."}
//               className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-[13px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-300"
//             />
//           </div>
//         </div>
//         <div className="flex items-center justify-between">
//           <div className="flex items-center overflow-x-auto -mb-px" style={{ scrollbarWidth: "none" }}>
//             {TABS.map((tab) => {
//               const isActive = tab.id === "submitted"
//                 ? activeTab === "submitted"
//                 : activeTab === "contracts" && view === tab.id;
//               return (
//                 <button
//                   key={tab.id}
//                   type="button"
//                   onClick={() => {
//                     if (tab.id === "submitted") {
//                       setActiveTab("submitted");
//                     } else {
//                       setActiveTab("contracts");
//                       setView(tab.id as "all" | "ongoing" | "finished");
//                     }
//                   }}
//                   className={`relative flex flex-shrink-0 items-center gap-1.5 px-3 sm:px-4 py-4 text-[12px] sm:text-[13px] font-semibold transition-colors ${isActive ? "text-gray-900 border-b-2 border-gray-900" : "text-gray-500 hover:text-gray-700 border-b-2 border-transparent"}`}
//                 >
//                   {tab.label}
//                   <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>
//                     {tab.count}
//                   </span>
//                   {tab.alert && <span className="absolute right-1 top-3 h-2 w-2 rounded-full bg-orange-500" />}
//                 </button>
//               );
//             })}
//           </div>
//           <div className="hidden sm:flex items-center gap-2 flex-shrink-0 pl-2">
//             <div className="relative">
//               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
//               <input
//                 type="text"
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//                 placeholder={activeTab === "submitted" ? "Search submitted work..." : "Search contracts..."}
//                 className="rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-[13px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-300 w-44 lg:w-52"
//               />
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="px-3 sm:px-6 py-4 sm:py-5">

//       {/* ── CONTRACTS GRID ───────────────────────────────────────────── */}
//       {activeTab === "contracts" && (
//         <div className="mt-5">
//           {loading ? (
//             <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-6 text-[12px] text-[#6b6762]">
//               Loading contracts...
//             </div>
//           ) : errorMessage ? (
//             <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FFF6F2] p-4 text-[12px] text-[#8C4F00]">
//               {errorMessage}
//             </div>
//           ) : visibleContracts.length ? (
//             <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
//               {visibleContracts.map((contract) => {
//                 const statusLabel = isFinishedContract(contract)
//                   ? "Finished"
//                   : isEscrowContract(contract)
//                     ? "In Progress"
//                     : "Active";
//                 const progressPercent = getMilestoneProgressPercent(contract);
//                 const progressColor = statusLabel === "Finished" ? "green" : statusLabel === "In Progress" ? "blue" : "orange";
//                 const amountSats = contract.paymentTotalAmountSats ?? 0;
//                 const amountLabel = amountSats > 0
//                   ? `${amountSats.toLocaleString()} sats`
//                   : contract.budget ?? "—";
//                 const infoText = isFinishedContract(contract)
//                   ? "Contract approved. Payment has been released."
//                   : contract.workStatus === "submitted"
//                     ? "Work submitted. Waiting for client review."
//                     : contract.workStatus === "changes_requested"
//                       ? "Changes requested. Review the client's note and resubmit your work."
//                       : "Work in progress. Upload your deliverable when ready.";

//                 return (
//                   <div
//                     key={contract.id}
//                     className="flex flex-col rounded-[14px] border border-[#EAE7E2] bg-white p-4 shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition hover:shadow-[0_6px_20px_rgba(0,0,0,0.09)]"
//                   >
//                     <div className="flex items-start gap-3">
//                       <Avatar name={contract.clientName ?? "Client"} />
//                       <div className="flex-1 min-w-0">
//                         <h3 className="text-[15px] font-black leading-tight text-[#1a1a1a] truncate">
//                           {contract.title}
//                         </h3>
//                         <p className="mt-1 truncate text-[11px] text-[#777]">
//                           Client: <span className="font-semibold text-[#555]">{contract.clientName}</span>
//                         </p>
//                       </div>
//                       <StatusBadge label={statusLabel} />
//                     </div>

//                     <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] text-[#6b6762]">
//                       <div className="rounded-[10px] bg-[#F5F5F4] px-3 py-2">
//                         <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#999]">Budget</p>
//                         <p className="mt-1 font-black text-[#1a1a1a]">{amountLabel}</p>
//                       </div>
//                       <div className="rounded-[10px] bg-[#F5F5F4] px-3 py-2">
//                         <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#999]">Due Date</p>
//                         <p className="mt-1 font-semibold text-[#1a1a1a]">{contract.dueDate}</p>
//                         {statusLabel !== "Finished" ? <p className="mt-1 text-[10px] font-bold text-[#F7931A]">{getDueLabel(contract.dueDate)}</p> : null}
//                       </div>
//                     </div>

//                     <div className="mt-4">
//                       <div className="flex items-center justify-between text-[11px] font-semibold text-[#777]">
//                         <span>Progress</span>
//                         <span className="text-[#1a1a1a]">{progressPercent}%</span>
//                       </div>
//                       <div className="mt-2">
//                         <ProgressBar percent={progressPercent} color={progressColor} />
//                       </div>
//                     </div>

//                     <div className="mt-4 flex items-start gap-2 rounded-[10px] bg-[#FFF4E6] px-3 py-2.5 text-[12px] text-[#6b3f00]">
//                       <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-[#F7931A] text-[10px] font-black text-[#F7931A]">i</span>
//                       <span>{infoText}</span>
//                     </div>

//                     <div className="mt-4 grid grid-cols-2 gap-2">
//                       <button
//                         type="button"
//                         onClick={() => { setSelectedId(contract.id); setIsModalOpen(true); }}
//                         className="rounded-[10px] border border-[#1a2332] bg-white py-3 text-[12px] font-black text-[black] transition hover:bg-[#FFF8EF]"
//                       >
//                         View Contract
//                       </button>
//                       <button
//                         type="button"
//                         onClick={() => {
//                           if (!contract.jobId || !contract.freelancerId) return;
//                           const conversationId = createConversationId(contract.jobId, contract.freelancerId);
//                           router.push(`/freelancer/dashboard/messages?chat=${conversationId}`);
//                         }}
//                         className="rounded-[10px] border border-[#1a2332] bg-[#1a2332] px-2 py-3 text-[11px] font-black leading-tight text-white transition hover:bg-[#0f1a26] sm:text-[12px]"
//                       >
//                         Message Client
//                       </button>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           ) : (
//             <div className="mx-auto mt-8 flex min-h-[166px] w-full max-w-5xl flex-col items-center justify-center rounded-[8px] border border-[#EAE7E2] bg-white px-5 py-10 text-center shadow-[0_6px_14px_rgba(26,26,26,0.08)]">
//               <Search className="h-11 w-11 text-[#8C4F00]" strokeWidth={1.2} />
//               <p className="mt-4 text-[16px] font-black text-[#1a1a1a]">No Contract Found</p>
//               <p className="mt-1 text-[12px] text-[#6b6762]">You don't have any contract yet</p>
//             </div>
//           )}
//         </div>
//       )}

//       {/* ── SUBMITTED JOBS ───────────────────────────────────────────── */}
//       {activeTab === "submitted" && (
//         <div className="mt-5">
//           {filteredSubmittedJobs.length ? (
//             <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
//               {filteredSubmittedJobs.map((job) => {
//                 const contract = contracts.find(c => c.id === job.contractId);
//                 const statusLabel = job.status === "approved" ? "Approved" : job.status === "rejected" ? "Changes Requested" : "Pending Review";
//                 const statusColor = job.status === "approved" ? "bg-[#E6F4EA] text-[#2E7D32]" : job.status === "rejected" ? "bg-[#FFF5F5] text-[#B91C1C]" : "bg-[#FFF4E6] text-[#8C4F00]";
//                 return (
//                   <div key={job.id} className="flex flex-col rounded-[14px] border border-[#EAE7E2] bg-white p-4 shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition hover:shadow-[0_6px_20px_rgba(0,0,0,0.09)]">

//                     {/* Card header */}
//                     <div className="flex items-start gap-3">
//                       {/* Icon */}
//                       <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#FFF4E6] border border-[#F7931A30]">
//                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                           <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
//                           <polyline points="14 2 14 8 20 8"/>
//                           <line x1="16" y1="13" x2="8" y2="13"/>
//                           <line x1="16" y1="17" x2="8" y2="17"/>
//                         </svg>
//                       </div>

//                       <div className="flex-1 min-w-0">
//                         <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#999]">
//                           {contract?.title || "Contract"}
//                         </p>
//                         {job.milestoneIndex && (
//                           <p className="text-[11px] font-black text-[#1a1a1a] leading-tight mt-0.5">
//                             Milestone {job.milestoneIndex}{job.milestoneTitle ? `: ${job.milestoneTitle}` : ""}
//                           </p>
//                         )}
//                       </div>

//                       {/* Status badge */}
//                       <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${statusColor}`}>
//                         {statusLabel}
//                       </span>
//                     </div>

//                     {/* Description */}
//                     <div className="mt-4 rounded-[10px] bg-[#F5F3EF] px-3 py-2.5">
//                       <p className="text-[12px] text-[#555] leading-snug line-clamp-2">{job.description || "Work submitted for review."}</p>
//                     </div>

//                     {/* Date */}
//                     <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#999]">
//                       <Calendar size={11} />
//                       <span>Submitted {job.submittedAt.toLocaleDateString()}</span>
//                     </div>

//                     {/* View Details button */}
//                     <button
//                       type="button"
//                       onClick={() => setSelectedSubmissionId(job.id)}
//                       className="mt-4 w-full rounded-[10px] border border-[#1a2332] bg-[#1a2332] py-3 text-[12px] font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#0f1a26]"
//                     >
//                       View Details
//                     </button>
//                   </div>
//                 );
//               })}
//             </div>
//           ) : (
//             <div className="mx-auto mt-8 flex min-h-[166px] w-full max-w-5xl flex-col items-center justify-center rounded-[8px] border border-[#EAE7E2] bg-white px-5 py-10 text-center shadow-[0_6px_14px_rgba(26,26,26,0.08)]">
//               <Search className="h-11 w-11 text-[#8C4F00]" strokeWidth={1.2} />
//               <p className="mt-4 text-[16px] font-black text-[#1a1a1a]">No Contract Found</p>
//               <p className="mt-1 text-[12px] text-[#6b6762]">You don't have any submitted work yet</p>
//             </div>
//           )}
//         </div>
//       )}

//       </div>

//       {selectedSubmission && (
//         <div className="fixed inset-0 z-[75] flex items-end justify-center px-2 py-2 sm:items-center sm:px-4 sm:py-4">
//           <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedSubmissionId(null)} />
//           <div className="relative z-[76] max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)]">

//             {/* Header */}
//             <div className="px-5 pt-5 pb-4 border-b border-[#F0EDE8]">
//               <button type="button" onClick={() => setSelectedSubmissionId(null)} aria-label="Close" className="absolute right-4 top-4 text-[#999] hover:text-[#1a1a1a] transition-colors text-[18px] font-light">✕</button>

//               {/* Status + label */}
//               <div className="flex items-center gap-2 mb-2">
//                 <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${
//                   selectedSubmission.status === "approved" ? "bg-[#E6F4EA] text-[#2E7D32]" :
//                   selectedSubmission.status === "rejected" ? "bg-[#FFF5F5] text-[#B91C1C]" :
//                   "bg-[#FFF4E6] text-[#8C4F00]"
//                 }`}>
//                   {selectedSubmission.status === "approved" ? "Approved" : selectedSubmission.status === "rejected" ? "Changes Requested" : "Pending Review"}
//                 </span>
//                 <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#999]">SUBMITTED WORK</span>
//               </div>

//               {/* Contract title */}
//               <h2 className="text-[20px] font-black text-[#1a1a1a] leading-tight">
//                 {selectedSubmissionContract?.title || "Contract Submission"}
//               </h2>

//               {/* Milestone */}
//               {selectedSubmission.milestoneIndex && (
//                 <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#FFF4E6] border border-[#F7931A30] px-2.5 py-0.5">
//                   <span className="text-[10px] font-bold text-[#8C4F00]">
//                     Milestone {selectedSubmission.milestoneIndex}{selectedSubmission.milestoneTitle ? `: ${selectedSubmission.milestoneTitle}` : ""}
//                   </span>
//                 </div>
//               )}

//               {/* Date */}
//               <p className="mt-1.5 text-[11px] text-[#999]">Submitted {selectedSubmission.submittedAt.toLocaleDateString()}</p>
//             </div>

//             {/* Submission content */}
//             <div className="px-5 py-4 border-b border-[#F0EDE8]">
//               <div className="rounded-[12px] bg-[#F5F3EF] px-4 py-3">
//                 <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#999] mb-2">Your Submission</p>
//                 <p className="text-[13px] text-[#1a1a1a] leading-[1.6]">{selectedSubmission.description || "Work submitted for review."}</p>
//                 {selectedSubmission.link && (
//                   <p className="mt-2 text-[12px] text-[#6b6762] break-all [overflow-wrap:anywhere]">
//                     <span className="font-semibold text-[#999]">Link: </span>
//                     <a href={selectedSubmission.link} target="_blank" rel="noreferrer" className="text-[#8C4F00] underline">{selectedSubmission.link}</a>
//                   </p>
//                 )}
//                 {selectedSubmission.attachment && (
//                   <p className="mt-2 text-[12px] text-[#6b6762] break-all [overflow-wrap:anywhere]">
//                     <span className="font-semibold text-[#999]">Attachment: </span>
//                     <a href={selectedSubmission.attachment.url} target="_blank" rel="noreferrer" className="text-[#8C4F00] underline">{selectedSubmission.attachment.name}</a>
//                   </p>
//                 )}
//               </div>
//             </div>

//             {/* Client note if rejected */}
//             {selectedSubmission.status === "rejected" && (
//               <div className="border-b border-[#F0EDE8] px-5 py-4 sm:px-6 lg:px-7">
//                 <div className="rounded-[12px] border border-[#FCA5A5] bg-[#FFF5F5] px-4 py-3">
//                   <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#B91C1C] mb-2">Client Requested Adjustments</p>
//                   <p className="text-[13px] text-[#7F1D1D] leading-[1.6]">
//                     {selectedSubmission.revisionMessage || selectedSubmissionContract?.revisionMessage || "The client requested updates before approval."}
//                   </p>
//                 </div>
//               </div>
//             )}

//             {/* Footer actions */}
//             <div className="px-5 pb-5 pt-4 flex items-center gap-3">
//               {selectedSubmission.status !== "approved" && (
//                 <Button
//                   size="sm"
//                   className="flex-1 rounded-[10px] bg-[#8C4F00] hover:bg-[#6B3A00] text-white font-black py-3"
//                   onClick={() => { openEditSubmission(selectedSubmission); setSelectedSubmissionId(null); }}
//                 >
//                   {selectedSubmission.status === "rejected" ? "Adjust & Resubmit" : "Edit Submission"}
//                 </Button>
//               )}
//               {selectedSubmissionContract && (
//                 <Button
//                   size="sm"
//                   variant="outline"
//                   className="flex-1 rounded-[10px] bg-[#1a2332] text-white border-[#1a2332] hover:bg-[#0f1a26] font-black py-3"
//                   onClick={() => { setSelectedId(selectedSubmissionContract.id); setActiveTab("contracts"); setIsModalOpen(true); setSelectedSubmissionId(null); }}
//                 >
//                   View Contract
//                 </Button>
//               )}
//             </div>

//           </div>
//         </div>
//       )}

//       {editingSubmission && (
//         <div className="fixed inset-0 z-[78] flex items-end justify-center px-2 py-2 sm:items-center sm:px-4 sm:py-4">
//           <div
//             className="absolute inset-0 bg-black/40 backdrop-blur-sm"
//             onClick={() => {
//               if (!isUpdatingSubmission) setEditingSubmissionId(null);
//             }}
//           />
//           <div className="relative z-[79] max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[14px] border border-[#EAE7E2] bg-white p-4 shadow-[0_20px_50px_rgba(0,0,0,0.2)] sm:rounded-[16px] sm:p-5">
//             <button
//               type="button"
//               onClick={() => setEditingSubmissionId(null)}
//               aria-label="Close"
//               className="absolute right-4 top-4 rounded-full border border-[#EAE7E2] bg-white p-2 text-[#6b6762] hover:bg-[#F7F4F0]"
//               disabled={isUpdatingSubmission}
//             >
//               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                 <line x1="18" y1="6" x2="6" y2="18" />
//                 <line x1="6" y1="6" x2="18" y2="18" />
//               </svg>
//             </button>

//             <div className="pr-10">
//               <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8C4F00]">
//                 {editingSubmission.status === "rejected" ? "Adjust Submission" : "Edit Submission"}
//               </div>
//               <div className="mt-2 break-words text-[16px] font-semibold leading-6 text-[#1a1a1a] [overflow-wrap:anywhere] sm:text-[18px]">
//                 {editingSubmissionContract?.title || "Submitted work"}
//               </div>
//               <p className="mt-2 text-[13px] leading-6 text-[#6b6762]">
//                 Update the work message, link, or attachment. Saving sends the latest version back to the client for review.
//               </p>
//             </div>

//             {editingSubmission.status === "rejected" && (editingSubmission.revisionMessage || editingSubmissionContract?.revisionMessage) ? (
//               <div className="mt-4 rounded-[12px] border border-[#F8D7DA] bg-[#FFF5F5] p-4">
//                 <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#B42318]">
//                   Client Note
//                 </div>
//                 <p className="mt-2 text-[13px] leading-6 text-[#7F1D1D]">
//                   {editingSubmission.revisionMessage || editingSubmissionContract?.revisionMessage}
//                 </p>
//               </div>
//             ) : null}

//             <div className="mt-4 space-y-3">
//               <textarea
//                 value={editWorkMessage}
//                 onChange={(event) => setEditWorkMessage(event.target.value)}
//                 placeholder="Describe the updated work"
//                 rows={4}
//                 className="w-full rounded-[10px] border border-[#EAE7E7] bg-[#FAF8F5] px-3 py-2 text-[13px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20"
//               />
//               <input
//                 value={editWorkLink}
//                 onChange={(event) => setEditWorkLink(event.target.value)}
//                 placeholder="Paste an updated deliverable, preview, or repository link"
//                 className="w-full rounded-[10px] border border-[#EAE7E7] bg-[#FAF8F5] px-3 py-2 text-[13px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20"
//               />
//               <input
//                 ref={editFileInputRef}
//                 type="file"
//                 className="hidden"
//                 onChange={(event) => setEditSelectedFile(event.target.files?.[0] ?? null)}
//               />
//               <div className="flex flex-wrap items-center gap-2">
//                 <Button
//                   size="sm"
//                   variant="outline"
//                   className="rounded-full"
//                   onClick={() => editFileInputRef.current?.click()}
//                   disabled={isUpdatingSubmission}
//                 >
//                   {editSelectedFile ? editSelectedFile.name : editingSubmission.attachment ? "Replace File" : "Attach File"}
//                 </Button>
//                 {editingSubmission.attachment && !editSelectedFile ? (
//                   <span className="text-[11px] text-[#6b6762]">
//                     Current file: {editingSubmission.attachment.name}
//                   </span>
//                 ) : null}
//                 {editSelectedFile ? (
//                   <button
//                     type="button"
//                     onClick={() => {
//                       setEditSelectedFile(null);
//                       if (editFileInputRef.current) editFileInputRef.current.value = "";
//                     }}
//                     className="text-[11px] font-semibold text-[#6b6762]"
//                     disabled={isUpdatingSubmission}
//                   >
//                     Remove
//                   </button>
//                 ) : null}
//               </div>
//             </div>

//             {editSubmissionError ? (
//               <p className="mt-3 rounded-[10px] border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-700">
//                 {editSubmissionError}
//               </p>
//             ) : null}
//             {editSubmissionSuccess ? (
//               <p className="mt-3 rounded-[10px] border border-green-100 bg-green-50 px-3 py-2 text-[12px] text-green-700">
//                 {editSubmissionSuccess}
//               </p>
//             ) : null}

//             <div className="mt-5 grid grid-cols-1 gap-2 sm:flex sm:justify-end">
//               <Button
//                 size="sm"
//                 variant="outline"
//                 className="w-full rounded-full sm:w-auto"
//                 onClick={() => setEditingSubmissionId(null)}
//                 disabled={isUpdatingSubmission}
//               >
//                 Cancel
//               </Button>
//               <Button
//                 size="sm"
//                 className="w-full rounded-full sm:w-auto"
//                 onClick={() => void handleUpdateSubmission()}
//                 disabled={isUpdatingSubmission}
//               >
//                 {isUpdatingSubmission ? "Saving..." : editingSubmission.status === "rejected" ? "Resubmit Work" : "Save Changes"}
//               </Button>
//             </div>
//           </div>
//         </div>
//       )}

//       {isModalOpen && selectedContract ? (
//         <div className="fixed inset-0 z-[80] flex items-end justify-center px-2 py-2 sm:items-center sm:px-5 sm:py-5">
//           <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
//           <div className="relative z-[81] max-h-[92vh] w-full overflow-y-auto rounded-[20px] border border-[#EAE7E2] bg-[#FFFCF8] shadow-[0_24px_70px_rgba(26,26,26,0.24)] md:max-w-3xl lg:max-w-5xl">

//             {/* ── Modal Header ── */}
//             <div className="border-b border-[#F0EDE8] bg-white px-5 pb-4 pt-5 sm:px-6 lg:px-7">
//               <button
//                 type="button"
//                 onClick={() => setIsModalOpen(false)}
//                 aria-label="Close"
//                 className="absolute right-4 top-4 text-[#999] hover:text-[#1a1a1a] transition-colors text-[18px] font-light"
//               >
//                 ✕
//               </button>

//               {/* Status + contract ID */}
//               <div className="flex items-center gap-2 mb-2">
//                 {(() => {
//                   const statusLabel = isFinishedContract(selectedContract) ? "Finished" : isEscrowContract(selectedContract) ? "In Progress" : "Active";
//                   const statusColor = statusLabel === "Finished" ? "bg-[#E6F4EA] text-[#2E7D32]" : statusLabel === "In Progress" ? "bg-[#E6F4EA] text-[#2E7D32]" : "bg-[#FFF4E6] text-[#8C4F00]";
//                   return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${statusColor}`}>{statusLabel}</span>;
//                 })()}
//                 <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#999]">
//                   CONTRACT #{selectedContract.id.slice(-6).toUpperCase()}
//                 </span>
//               </div>

//               {/* Title */}
//               <h2 className="max-w-[760px] text-[22px] font-black leading-tight text-[#1a1a1a] sm:text-[24px]">{selectedContract.title}</h2>

//               {/* Client */}
//               <div className="flex items-center gap-2 mt-1.5">
//                 <div className="h-6 w-6 rounded-full bg-[#1a2332] flex items-center justify-center overflow-hidden flex-shrink-0">
//                   {(selectedContract as any).clientAvatarUrl ? (
//                     <img src={(selectedContract as any).clientAvatarUrl} alt={selectedContract.clientName} className="h-full w-full object-cover" />
//                   ) : (
//                     <span className="text-[8px] font-black text-white">
//                       {(selectedContract.clientName ?? "C").split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase()}
//                     </span>
//                   )}
//                 </div>
//                 <span className="text-[13px] text-[#555]">Client: <strong>{selectedContract.clientName}</strong></span>
//               </div>
//             </div>

//             {/* ── Value + Escrow Status ── */}
//             <div className="grid grid-cols-1 gap-3 border-b border-[#F0EDE8] px-5 py-4 sm:grid-cols-2 sm:px-6 lg:px-7">
//               <div className="rounded-[12px] border border-[#EFECE7] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(0,0,0,0.03)]">
//                 <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#999] mb-1">Total Contract Value</p>
//                 <p className="text-[16px] font-black text-[#F7931A]">
//                   {(() => {
//                     const sats = selectedContract.paymentTotalAmountSats || parseSats(selectedContract.budget) || 0;
//                     return sats > 0 ? `${sats.toLocaleString()} sats` : selectedContract.budget;
//                   })()}
//                 </p>
//               </div>
//               <div className="rounded-[12px] border border-[#EFECE7] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(0,0,0,0.03)]">
//                 <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#999] mb-1">Escrow Status</p>
//                 <div className="flex items-center gap-1.5">
//                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={selectedContract.paymentStatus === "funded" || selectedContract.paymentStatus === "released" ? "#1D4ED8" : "#999"} strokeWidth="2">
//                     <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
//                   </svg>
//                   <span className="text-[13px] font-bold text-[#1a1a1a]">
//                     {selectedContract.paymentStatus === "funded" ? "Funds Secured" :
//                      selectedContract.paymentStatus === "released" ? "Released" :
//                      selectedContract.paymentStatus === "invoice_created" ? "Invoice Sent" :
//                      "Not Funded"}
//                   </span>
//                 </div>
//               </div>
//             </div>

//             {/* ── Milestones ── */}
//             {selectedContract.milestones && selectedContract.milestones.length > 0 && (
//               <div className="px-5 py-4 border-b border-[#F0EDE8]">
//                 <h3 className="text-[14px] font-black text-[#1a1a1a] mb-3">Milestones</h3>
//                 <div className="relative">
//                   {/* Vertical line */}
//                   <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-[#EAE7E2]" />
//                   <div className="space-y-4">
//                     {selectedContract.milestones.map((ms: any, i: number) => {
//                       const isReleased = ms.status === "released";
//                       const isCurrent = !isReleased && ms.status !== "pending" || (i === (selectedContract.paymentReleasedInstallments ?? 0));
//                       const msAmount = ms.freelancerAmountSats ? `${ms.freelancerAmountSats.toLocaleString()} sats` : ms.amount ?? "—";
//                       const msStatusLabel = isReleased ? "Paid" : ms.status === "funded" || ms.status === "submitted" ? "Pending" : "Scheduled";
//                       const msStatusColor = isReleased ? "bg-[#EFF6FF] text-[#1D4ED8]" : ms.status === "funded" || ms.status === "submitted" ? "bg-[#FFF4E6] text-[#F7931A]" : "bg-[#F5F3EF] text-[#999]";
//                       return (
//                         <div key={i} className="flex items-start gap-4 pl-6 relative">
//                           {/* Dot */}
//                           <div className={`absolute left-0 top-1 h-4 w-4 rounded-full border-2 flex items-center justify-center ${isReleased ? "border-[#1D4ED8] bg-[#1D4ED8]" : isCurrent ? "border-[#F7931A] bg-[#F7931A]" : "border-[#DDD8D0] bg-white"}`}>
//                             {isReleased && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
//                           </div>
//                           <div className="flex-1 flex items-start justify-between gap-2">
//                             <div>
//                               <p className={`text-[13px] font-bold ${isReleased ? "text-[#555]" : "text-[#1a1a1a]"}`}>{ms.title || ms.name || `Milestone ${i + 1}`}</p>
//                               {ms.deadline && <p className="text-[11px] text-[#999] mt-0.5">{isReleased ? "Completed on" : "Due"} {ms.deadline}</p>}
//                             </div>
//                             <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${msStatusColor}`}>
//                               {msAmount} {msStatusLabel}
//                             </span>
//                           </div>
//                         </div>
//                       );
//                     })}
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* ── Contract Terms ── */}
//             <div className="border-b border-[#F0EDE8] px-5 py-4 sm:px-6 lg:px-7">
//               <div className="rounded-[12px] border border-[#EAE7E2] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(0,0,0,0.03)]">
//                 <h3 className="text-[13px] font-black text-[#1a1a1a] mb-3">Contract Terms</h3>
//                 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
//                   <div className="flex items-start gap-2">
//                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" className="mt-0.5 flex-shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
//                     <div>
//                       <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#999]">Deliverable Type</p>
//                       <p className="text-[12px] font-semibold text-[#1a1a1a]">{selectedContract.contractType ?? "Fixed Price"}</p>
//                     </div>
//                   </div>
//                   <div className="flex items-start gap-2">
//                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" className="mt-0.5 flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
//                     <div>
//                       <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#999]">Work Status</p>
//                       <p className="text-[12px] font-semibold text-[#1a1a1a] capitalize">{selectedContract.workStatus?.replace(/_/g, " ") ?? "Not started"}</p>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             {/* ── Submit Work Section (all existing logic preserved) ── */}
//             <div className="px-5 py-4 sm:px-6 lg:px-7">
//               {(() => {
//                 const isFinished =
//                   selectedContract.workStatus === "approved" ||
//                   selectedContract.workStatus === "completed" ||
//                   selectedContract.paymentStatus === "released" ||
//                   selectedContract.status === "Completed";
//                 const isSubmitted = selectedContract.workStatus === "submitted";
//                 const isChangesRequested = selectedContract.workStatus === "changes_requested";
//                 const releasedCount = selectedContract.paymentReleasedInstallments ?? 0;
//                 const totalMilestones = selectedContract.paymentInstallments ?? 1;
//                 const nextIdx = releasedCount + 1;
//                 const milestones = selectedContract.milestones ?? [];
//                 const currentMs = milestones.find((m: any, i: number) => Number(m.index ?? i + 1) === nextIdx);
//                 const currentMsTitle = (currentMs as any)?.title || (currentMs as any)?.name || `Milestone ${nextIdx}`;

//                 if (isFinished) {
//                   return (
//                     <div className="rounded-[12px] border border-[#D1FAE5] bg-[#F0FDF4] p-4">
//                       <div className="flex items-center gap-2">
//                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
//                         <span className="text-[12px] font-bold text-[#065F46] uppercase tracking-[0.1em]">Contract Completed</span>
//                       </div>
//                       <p className="mt-2 text-[12px] text-[#065F46]">All milestones approved and payment released. No further submissions needed.</p>
//                     </div>
//                   );
//                 }
//                 if (isSubmitted) {
//                   return (
//                     <div className="rounded-[12px] border border-[#DBEAFE] bg-[#EFF6FF] p-4">
//                       <div className="flex items-center gap-2">
//                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
//                         <span className="text-[12px] font-bold text-[#1E40AF] uppercase tracking-[0.1em]">Awaiting Client Review</span>
//                       </div>
//                       <p className="mt-2 text-[12px] text-[#1E40AF]">Your work for <strong>Milestone {nextIdx}: {currentMsTitle}</strong> has been submitted. You'll be notified once the client reviews it.</p>
//                     </div>
//                   );
//                 }
//                 if (isChangesRequested) {
//                   return (
//                     <div className="space-y-3">
//                       <div className="rounded-[12px] border border-[#FCA5A5] bg-[#FFF5F5] p-4">
//                         <div className="flex items-center gap-2 mb-2">
//                           <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
//                           <span className="text-[11px] font-black text-[#B91C1C] uppercase tracking-[0.12em]">Adjustment Requested — Milestone {nextIdx}: {currentMsTitle}</span>
//                         </div>
//                         <p className="text-[12px] text-[#7F1D1D] leading-[1.6]"><strong>The client asked for changes.</strong> Review their note, make adjustments, and resubmit for <strong>{currentMsTitle}</strong>.</p>
//                         {selectedContract.revisionMessage ? (
//                           <div className="mt-3 rounded-[8px] border border-[#FCA5A5] bg-white px-3 py-2">
//                             <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#B91C1C] mb-1">Client's note:</p>
//                             <p className="text-[12px] text-[#7F1D1D] leading-[1.6] italic">"{selectedContract.revisionMessage}"</p>
//                           </div>
//                         ) : null}
//                       </div>
//                       <div className="space-y-2">
//                         <textarea value={workMessage} onChange={(e) => setWorkMessage(e.target.value)} placeholder={`Describe what you adjusted for "${currentMsTitle}"`} rows={3} className="w-full rounded-[10px] border border-[#EAE7E7] bg-[#FAF8F5] px-3 py-2 text-[12px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20" />
//                         <input value={workLink} onChange={(e) => setWorkLink(e.target.value)} placeholder="Paste a link to the updated deliverable" className="w-full rounded-[10px] border border-[#EAE7E7] bg-[#FAF8F5] px-3 py-2 text-[12px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20" />
//                         <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
//                         <div className="flex flex-wrap items-center gap-2">
//                           <Button size="sm" variant="outline" className="rounded-full" onClick={() => fileInputRef.current?.click()}>{selectedFile ? selectedFile.name : "Attach File"}</Button>
//                           {selectedFile ? <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-[11px] font-semibold text-[#6b6762]">Remove</button> : null}
//                           <Button size="sm" className="rounded-full" onClick={() => void handleSubmitWork()} disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "Resubmit Adjusted Work"}</Button>
//                         </div>
//                         {submissionSuccess ? <p className="text-[12px] text-[#2F855A]">{submissionSuccess}</p> : null}
//                         {submissionError ? <p className="text-[12px] text-[#C53030]">{submissionError}</p> : null}
//                       </div>
//                     </div>
//                   );
//                 }
//                 return (
//                   <div className="space-y-2">
//                     <div className="flex items-center gap-2 mb-2">
//                       <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8C4F00]">Submit Work</span>
//                       <div className="inline-flex items-center rounded-full bg-[#FFF4E6] border border-[#F7931A40] px-2.5 py-0.5">
//                         <span className="text-[9px] font-bold text-[#8C4F00]">Milestone {nextIdx} of {totalMilestones}: {currentMsTitle}</span>
//                       </div>
//                     </div>
//                     <textarea value={workMessage} onChange={(e) => setWorkMessage(e.target.value)} placeholder={`Describe what you completed for "${currentMsTitle}"`} rows={3} className="w-full rounded-[10px] border border-[#EAE7E7] bg-[#FAF8F5] px-3 py-2 text-[12px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20" />
//                     <input value={workLink} onChange={(e) => setWorkLink(e.target.value)} placeholder="Paste a link to deliverable, preview, or repository" className="w-full rounded-[10px] border border-[#EAE7E7] bg-[#FAF8F5] px-3 py-2 text-[12px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20" />
//                     <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
//                     <div className="flex flex-wrap items-center gap-2">
//                       <Button size="sm" variant="outline" className="rounded-full" onClick={() => fileInputRef.current?.click()}>{selectedFile ? selectedFile.name : "Attach File"}</Button>
//                       {selectedFile ? <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-[11px] font-semibold text-[#6b6762]">Remove</button> : null}
//                       <Button size="sm" className="rounded-full" onClick={() => void handleSubmitWork()} disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "Submit Work"}</Button>
//                     </div>
//                     {submissionSuccess ? <p className="text-[12px] text-[#2F855A]">{submissionSuccess}</p> : null}
//                     {submissionError ? <p className="text-[12px] text-[#C53030]">{submissionError}</p> : null}
//                   </div>
//                 );
//               })()}
//             </div>

//             {/* ── Footer Actions ── */}
//             <div className="flex items-center gap-3 border-t border-[#F0EDE8] bg-white px-5 pb-5 pt-3 sm:px-6 lg:px-7">
//               {/* Submit Work / Message Client buttons */}
//               {/* <Button
//                 size="sm"
//                 className="flex-1 rounded-[10px] bg-[#8C4F00] hover:bg-[#6B3A00] text-white font-black py-3"
//                 onClick={() => {
//                   const el = document.querySelector('[placeholder*="Describe what you"]') as HTMLTextAreaElement | null;
//                   el?.focus();
//                 }}
//               >
//                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
//                 Submit Work
//               </Button> */}
//               <Button
//                 size="sm"
//                 variant="outline"
//                 className="flex-1 rounded-[10px] border-[#1a2332] bg-[#1a2332] py-3 font-black text-white"
//                 onClick={async () => {
//                   if (!selectedContract?.jobId || !selectedContract?.freelancerId) return;
//                   const clientId = selectedContract.clientId ?? "";
//                   if (!clientId) return;
//                   const freelancerId = firebaseAuth.currentUser?.uid ?? selectedContract.freelancerId ?? "";
//                   if (!freelancerId) return;
//                   let freelancerName = "Freelancer";
//                   let clientName = await resolveClientName(clientId, selectedContract.clientName ?? "");
//                   const [clientAvatarUrl, freelancerAvatarUrl] = await Promise.all([resolveClientAvatar(clientId), resolveFreelancerAvatar(freelancerId)]);
//                   try {
//                     const allUsersSnap = await getDoc(doc(firebaseDb, "all_users", freelancerId));
//                     if (allUsersSnap.exists()) { const d = allUsersSnap.data() as any; freelancerName = d.fullName ?? d.name ?? d.email ?? "Freelancer"; }
//                   } catch { freelancerName = "Freelancer"; }
//                   if (!clientName) clientName = "Client";
//                   const conversationId = createConversationId(selectedContract.jobId, selectedContract.freelancerId);
//                   await setDoc(doc(firebaseDb, "conversations", conversationId), { jobId: selectedContract.jobId, jobTitle: selectedContract.title, proposalId: "", clientId, clientName, freelancerId: selectedContract.freelancerId, freelancerName, clientAvatarUrl, freelancerAvatarUrl, paymentTotalAmountSats: parseSats(selectedContract.budget), paymentStatus: "unfunded", createdBy: "system", canFreelancerMessage: true, unread: { [clientId]: 0, [freelancerId]: 0 }, updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true });
//                   router.push(`/freelancer/dashboard/messages?chat=${conversationId}`);
//                 }}
//               >
//                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
//                 Message Client
//               </Button>
//             </div>

//           </div>
//         </div>
//       ) : null}

//     </section>
//   );
// }



"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/atoms/Button";
import {
  Calendar,
  Search,
  MessageSquare,
  MoreVertical,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  SortDesc,
  Shield,
  Upload,
  RefreshCw,
} from "lucide-react";
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

// ── Types ────────────────────────────────────────────────────────────────────

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
};

type SubmittedJob = {
  id: string;
  contractId: string;
  milestoneIndex?: number;
  milestoneTitle?: string;
  description: string;
  link?: string;
  attachment?: { name: string; url: string };
  submittedAt: Date;
  status: "pending" | "approved" | "rejected";
  revisionMessage?: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  const safeInstallments = Math.max(1, Math.min(3, Math.trunc(installments)));
  const safeInstallment = Math.max(1, Math.min(safeInstallments, Math.trunc(installment)));
  const base = Math.floor(safeTotal / safeInstallments);
  const remainder = safeTotal % safeInstallments;
  return base + (safeInstallment <= remainder ? 1 : 0);
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

// ── Shared UI Components ──────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-purple-600", "bg-blue-600", "bg-emerald-600", "bg-orange-500",
  "bg-rose-600", "bg-indigo-600", "bg-teal-600", "bg-amber-600",
];
const getAvatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
const getInitials = (name: string) =>
  (name ?? "C").split(" ").filter(Boolean).slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join("");

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-[11px]" : size === "lg" ? "h-11 w-11 text-[14px]" : "h-9 w-9 text-[12px]";
  return (
    <div className={`flex-shrink-0 flex items-center justify-center rounded-full font-black text-white ${sizeClass} ${getAvatarColor(name)}`}>
      {getInitials(name)}
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  const map: Record<string, string> = {
    "Needs Review": "bg-orange-50 text-orange-700 border border-orange-200",
    "Revision Requested": "bg-red-50 text-red-700 border border-red-200",
    "Active": "bg-blue-50 text-blue-700 border border-blue-200",
    "Completed": "bg-green-50 text-green-700 border border-green-200",
    "In Progress": "bg-blue-50 text-blue-700 border border-blue-200",
    "Finished": "bg-green-50 text-green-700 border border-green-200",
    "Approved": "bg-green-50 text-green-700 border border-green-200",
    "Pending Review": "bg-orange-50 text-orange-700 border border-orange-200",
    "Changes Requested": "bg-red-50 text-red-700 border border-red-200",
    "Pending": "bg-orange-50 text-orange-600 border border-orange-100",
    "Scheduled": "bg-gray-50 text-gray-500 border border-gray-200",
    "Awaiting Review": "bg-orange-50 text-orange-700 border border-orange-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${map[label] ?? "bg-gray-50 text-gray-600 border border-gray-200"}`}>
      {label}
    </span>
  );
}

function ProgressBar({ percent, color = "blue" }: { percent: number; color?: "blue" | "green" | "orange" | "red" }) {
  const c = { blue: "bg-blue-500", green: "bg-green-500", orange: "bg-orange-500", red: "bg-red-400" };
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100">
      <div className={`h-1.5 rounded-full transition-all ${c[color]}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

// ── Milestone helpers (mirrored from ClientContractsContent) ──────────────────

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

const getMilestoneLabel = (state: MilestoneState) => ({
  approved: "Approved",
  review: "Awaiting Review",
  revision: "Changes Requested",
  active: "In Progress",
  pending: "Pending",
}[state]);

const getMilestoneProgressPercent = (contract: Contract) => {
  const total = getMilestoneCount(contract);
  if (!total) return contract.progress;
  if (contract.status === "Completed" || contract.paymentStatus === "released" || contract.workStatus === "approved" || contract.workStatus === "completed") return 100;
  const currentMilestone = Math.min(total, (contract.paymentReleasedInstallments ?? 0) + 1);
  return Math.round((currentMilestone / total) * 100);
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
        const textColor = { approved: "text-green-600", review: "text-orange-600", revision: "text-red-600", active: "text-blue-600", pending: "text-gray-400" }[state];
        return (
          <div key={index} className="grid grid-cols-[1rem_minmax(0,1fr)_5.2rem] items-center gap-2">
            <MilestoneDot state={state} index={index} />
            <span className={`truncate text-[10px] font-semibold ${textColor}`}>{milestone.title || milestone.name || `Milestone ${index + 1}`}</span>
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
          const textColor = { approved: "text-green-600", review: "text-orange-600", revision: "text-red-600", active: "text-blue-700", pending: "text-gray-400" }[state];
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

// ── Main Component ────────────────────────────────────────────────────────────

export default function FreelancerContractsContent() {
  const router = useRouter();
  const [view, setView] = useState<"all" | "ongoing" | "finished">("all");
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
  const [activeTab, setActiveTab] = useState<"contracts" | "submitted">("contracts");
  const [submittedJobs, setSubmittedJobs] = useState<SubmittedJob[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [editWorkMessage, setEditWorkMessage] = useState("");
  const [editWorkLink, setEditWorkLink] = useState("");
  const [editSelectedFile, setEditSelectedFile] = useState<File | null>(null);
  const [editSubmissionError, setEditSubmissionError] = useState("");
  const [editSubmissionSuccess, setEditSubmissionSuccess] = useState("");
  const [isUpdatingSubmission, setIsUpdatingSubmission] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const reviewDetailRef = useRef<HTMLDivElement | null>(null);
  const [reviewListHeight, setReviewListHeight] = useState<number | null>(null);
  const clientNameCache = useRef<Record<string, string>>({});
  const clientAvatarCache = useRef<Record<string, string>>({});
  const freelancerAvatarCache = useRef<Record<string, string>>({});

  const createConversationId = (jobId: string, freelancerId: string) => `${jobId}_${freelancerId}`;

  // ── Firebase helpers ────────────────────────────────────────────────────────

  const resolveClientName = async (clientId: string, fallbackName: string) => {
    const initialFallback = fallbackName?.trim() || "";
    if (!clientId) return initialFallback || "Client";
    if (clientNameCache.current[clientId]) return clientNameCache.current[clientId];
    let resolvedName = initialFallback;
    try {
      const snap = await getDoc(doc(firebaseDb, "clients", clientId));
      if (snap.exists()) { const d = snap.data() as any; resolvedName = d.fullName ?? d.firstName ?? d.name ?? resolvedName; }
    } catch {}
    if (!resolvedName) {
      try {
        const q = query(collection(firebaseDb, "clients"), where("uid", "==", clientId), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) { const d = snap.docs[0].data() as any; resolvedName = d.fullName ?? d.firstName ?? d.name ?? resolvedName; }
      } catch {}
    }
    if (!resolvedName) {
      try {
        const snap = await getDoc(doc(firebaseDb, "all_users", clientId));
        if (snap.exists()) { const d = snap.data() as any; resolvedName = d.fullName ?? d.name ?? d.email ?? resolvedName; }
      } catch {}
    }
    clientNameCache.current[clientId] = resolvedName || "Client";
    return clientNameCache.current[clientId];
  };

  const resolveClientAvatar = async (clientId: string) => {
    if (!clientId) return "";
    if (clientAvatarCache.current[clientId] !== undefined) return clientAvatarCache.current[clientId];
    let avatarUrl = "";
    try {
      const [clientSnap, allUsersSnap] = await Promise.all([getDoc(doc(firebaseDb, "clients", clientId)), getDoc(doc(firebaseDb, "all_users", clientId))]);
      const c = clientSnap.exists() ? (clientSnap.data() as any) : {};
      const a = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
      avatarUrl = c.avatarUrl ?? a.avatarUrl ?? "";
    } catch { avatarUrl = ""; }
    clientAvatarCache.current[clientId] = avatarUrl;
    return avatarUrl;
  };

  const resolveFreelancerAvatar = async (freelancerId: string) => {
    if (!freelancerId) return "";
    if (freelancerAvatarCache.current[freelancerId] !== undefined) return freelancerAvatarCache.current[freelancerId];
    let avatarUrl = "";
    try {
      const [fSnap, aSnap] = await Promise.all([getDoc(doc(firebaseDb, "freelancers", freelancerId)), getDoc(doc(firebaseDb, "all_users", freelancerId))]);
      const f = fSnap.exists() ? (fSnap.data() as any) : {};
      const a = aSnap.exists() ? (aSnap.data() as any) : {};
      avatarUrl = f.avatarUrl ?? a.avatarUrl ?? "";
    } catch { avatarUrl = ""; }
    freelancerAvatarCache.current[freelancerId] = avatarUrl;
    return avatarUrl;
  };

  const uploadContractFile = async (file: File) => {
    const idToken = await firebaseAuth.currentUser?.getIdToken();
    if (!idToken) throw new Error("Please log in before uploading files.");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/chat/upload", { method: "POST", headers: { Authorization: `Bearer ${idToken}` }, body: formData });
    const payload = (await res.json()) as any;
    if (!res.ok || !payload?.url) throw new Error(payload?.error || "Failed to upload attachment.");
    return { url: payload.url, name: payload.name ?? file.name, bytes: payload.bytes ?? file.size, size: payload.size ?? file.size, mimeType: payload.mimeType ?? file.type, resourceType: payload.resourceType ?? "auto", publicId: payload.publicId ?? "" };
  };

  // ── Submit work ────────────────────────────────────────────────────────────

  const handleSubmitWork = async () => {
    if (!selectedContract || !selectedContract.clientId || !selectedContract.freelancerId) return;
    const nextMilestoneIndex = (selectedContract.paymentReleasedInstallments ?? 0) + 1;
    const milestone = selectedContract.milestones?.find((item: any, index) => Number(item.index ?? index + 1) === nextMilestoneIndex);
    const milestoneAmount = Number((milestone as any)?.freelancerAmountSats ?? calculateInstallmentAmount(selectedContract.paymentTotalAmountSats || parseSats(selectedContract.budget), selectedContract.paymentInstallments ?? 1, nextMilestoneIndex));
    const fundedForMilestone = milestone ? Number((milestone as any).fundedSats ?? 0) - Number((milestone as any).releasedSats ?? 0) : milestoneAmount;
    if (selectedContract.paymentStatus !== "funded" && selectedContract.paymentStatus !== "released") { setSubmissionError("Escrow is not funded for this milestone yet."); return; }
    if (fundedForMilestone < milestoneAmount) { setSubmissionError(`Milestone escrow is short by ${(milestoneAmount - fundedForMilestone).toLocaleString()} sats. Ask the client to fund escrow before submitting.`); return; }
    setIsSubmitting(true); setSubmissionError(""); setSubmissionSuccess("");
    try {
      const attachment = selectedFile ? await uploadContractFile(selectedFile) : null;
      const contractUrl = `/client/dashboard/contracts?contract=${selectedContract.id}`;
      const milestoneTitle = (milestone as any)?.title || (milestone as any)?.name || `Milestone ${nextMilestoneIndex}`;
      const notificationText = `Work for "${selectedContract.title}" — Milestone ${nextMilestoneIndex}: ${milestoneTitle} has been submitted for review. [Check it out](${contractUrl})`;
      const updatedMilestones = (selectedContract.milestones ?? []).map((item: any, index) => {
        const itemIndex = Number(item.index ?? index + 1);
        if (itemIndex !== nextMilestoneIndex) return item;
        return { ...item, status: "submitted", submittedAt: new Date().toISOString() };
      });
      const conversationId = selectedContract.jobId && selectedContract.freelancerId ? `${selectedContract.jobId}_${selectedContract.freelancerId}` : selectedContract.id;
      await Promise.all([
        addDoc(collection(firebaseDb, "submitted_jobs"), { contractId: selectedContract.id, clientId: selectedContract.clientId, freelancerId: selectedContract.freelancerId, contractTitle: selectedContract.title, milestoneIndex: nextMilestoneIndex, milestoneTitle, description: workMessage || "Work submitted for review.", link: workLink || "", attachment, submittedAt: serverTimestamp(), status: "pending" }),
        setDoc(doc(firebaseDb, "contracts", selectedContract.id), { workStatus: "submitted", milestones: updatedMilestones, updatedAt: serverTimestamp() }, { merge: true }),
        setDoc(doc(firebaseDb, "conversations", conversationId), { milestones: updatedMilestones, workStatus: "submitted", "lastMessage.text": notificationText, "lastMessage.senderId": selectedContract.freelancerId, "lastMessage.createdAt": serverTimestamp(), [`unread.${selectedContract.clientId}`]: increment(1), [`unread.${selectedContract.freelancerId}`]: 0, updatedAt: serverTimestamp() }, { merge: true }),
        addDoc(collection(firebaseDb, "conversations", conversationId, "messages"), { senderId: selectedContract.freelancerId, senderRole: "freelancer", text: notificationText, messageType: "work_submission", createdAt: serverTimestamp() }),
      ]);
      void sendUserNotification({ userId: selectedContract.clientId, title: "Work submitted for review", body: notificationText, url: `/client/dashboard/contracts?contract=${selectedContract.id}`, tag: `work-submission-${selectedContract.id}` }).catch(console.error);
      setSubmissionSuccess("Work submitted for review."); setWorkMessage(""); setWorkLink(""); setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Submit work error:", error);
      setSubmissionError(error instanceof Error ? error.message : "Unable to submit work. Please try again.");
    } finally { setIsSubmitting(false); }
  };

  // ── Update / resubmit submission ───────────────────────────────────────────

  const handleUpdateSubmission = async () => {
    if (!editingSubmission || !editingSubmissionContract) return;
    const description = editWorkMessage.trim();
    const link = editWorkLink.trim();
    if (!description && !link && !editSelectedFile && !editingSubmission.attachment) { setEditSubmissionError("Add a note, link, or file before saving."); return; }
    setIsUpdatingSubmission(true); setEditSubmissionError(""); setEditSubmissionSuccess("");
    try {
      const attachment = editSelectedFile ? await uploadContractFile(editSelectedFile) : editingSubmission.attachment ?? null;
      const nextMilestoneIndex = (editingSubmissionContract.paymentReleasedInstallments ?? 0) + 1;
      const updatedMilestones = (editingSubmissionContract.milestones ?? []).map((item: any, index) => {
        const itemIndex = Number(item.index ?? index + 1);
        if (itemIndex !== nextMilestoneIndex) return item;
        return { ...item, status: "submitted", resubmittedAt: new Date().toISOString() };
      });
      const conversationId = editingSubmissionContract.jobId && editingSubmissionContract.freelancerId ? `${editingSubmissionContract.jobId}_${editingSubmissionContract.freelancerId}` : editingSubmissionContract.id;
      const messageText = editingSubmission.status === "rejected" ? `Updated work for "${editingSubmissionContract.title}" has been resubmitted after requested adjustments.` : `Submitted work for "${editingSubmissionContract.title}" was updated.`;
      await Promise.all([
        updateDoc(doc(firebaseDb, "submitted_jobs", editingSubmission.id), { description: description || "Work submitted for review.", link, attachment, status: "pending", updatedAt: serverTimestamp(), resubmittedAt: serverTimestamp() }),
        setDoc(doc(firebaseDb, "contracts", editingSubmission.contractId), { workStatus: "submitted", milestones: updatedMilestones, unreadByClient: true, unreadByFreelancer: false, updatedAt: serverTimestamp() }, { merge: true }),
        setDoc(doc(firebaseDb, "conversations", conversationId), { workStatus: "submitted", milestones: updatedMilestones, "lastMessage.text": messageText, "lastMessage.senderId": editingSubmissionContract.freelancerId, "lastMessage.createdAt": serverTimestamp(), [`unread.${editingSubmissionContract.clientId}`]: increment(1), [`unread.${editingSubmissionContract.freelancerId}`]: 0, updatedAt: serverTimestamp() }, { merge: true }),
        addDoc(collection(firebaseDb, "conversations", conversationId, "messages"), { senderId: editingSubmissionContract.freelancerId, senderRole: "freelancer", text: messageText, messageType: "work_resubmission", createdAt: serverTimestamp() }),
      ]);
      void sendUserNotification({ userId: editingSubmissionContract.clientId || "", title: "Work resubmitted", body: messageText, url: `/client/dashboard/contracts?contract=${editingSubmissionContract.id}`, tag: `work-resubmission-${editingSubmissionContract.id}` }).catch(console.error);
      setEditSubmissionSuccess("Submission updated and sent back to the client."); setEditingSubmissionId(null); setSelectedSubmissionId(editingSubmission.id); setEditSelectedFile(null);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
    } catch { setEditSubmissionError("Unable to update the submission. Please try again."); }
    finally { setIsUpdatingSubmission(false); }
  };

  const openEditSubmission = (job: SubmittedJob) => {
    setEditingSubmissionId(job.id); setEditWorkMessage(job.description || ""); setEditWorkLink(job.link || ""); setEditSelectedFile(null); setEditSubmissionError(""); setEditSubmissionSuccess("");
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  };

  // ── Firestore listeners ────────────────────────────────────────────────────

  useEffect(() => {
    let unsubContracts: (() => void) | undefined;
    let unsubSubmitted: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) { unsubContracts?.(); unsubSubmitted?.(); setContracts([]); setSelectedId(""); setLoading(false); setErrorMessage("Please log in to view contracts."); return; }
      setLoading(true); setErrorMessage("");

      unsubContracts = onSnapshot(
        query(collection(firebaseDb, "contracts"), where("freelancerId", "==", user.uid)),
        (snapshot) => {
          const items: Contract[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as any;
            return {
              id: docSnap.id, title: data.title ?? "Contract", clientName: data.clientName ?? "", clientId: data.clientId ?? "", freelancerId: data.freelancerId ?? "", jobId: data.jobId ?? "",
              contractType: data.contractType ?? data.jobType ?? "Fixed Price", status: (data.status as ContractStatus) ?? "Active", budget: formatSats(data.budget ?? "0"), progress: typeof data.progress === "number" ? data.progress : 0,
              nextMilestone: data.nextMilestone ?? "-", startDate: formatDate(data.startDate), dueDate: formatDate(data.dueDate), description: data.description ?? "-",
              paymentStatus: normalizePaymentStatus(data), paymentInstallments: Number(data.paymentInstallments ?? 1), paymentCurrentInstallment: Number(data.paymentCurrentInstallment ?? 1),
              paymentReleasedInstallments: Number(data.paymentReleasedInstallments ?? 0), paymentTotalAmountSats: Number(data.paymentTotalAmountSats ?? parseSats(data.budget) ?? 0),
              paymentTotalChargedSats: Number(data.paymentTotalChargedSats ?? 0), paymentPaidAmountSats: Number(data.paymentPaidAmountSats ?? 0),
              platformFeeSats: Number(data.platformFeeSats ?? 0), platformFeePercent: Number(data.platformFeePercent ?? 5),
              escrowFundedTotalSats: Number(data.escrowFundedTotalSats ?? 0), escrowReleasedSats: Number(data.escrowReleasedSats ?? 0),
              workStatus: normalizeWorkStatus(data), submissionMessage: data.submissionMessage ?? "", submissionLink: data.submissionLink ?? "",
              submissionAttachment: data.submissionAttachment ?? null, submissionReviewDueAt: data.submissionReviewDueAt, revisionMessage: data.revisionMessage ?? "",
              scopeItems: Array.isArray(data.scopeItems) ? data.scopeItems : [], milestones: Array.isArray(data.milestones) ? data.milestones : [],
              createdAt: data.createdAt, updatedAt: data.updatedAt,
            };
          });
          (async () => {
            const hydrated = await Promise.all(items.map(async (c) => ({ ...c, clientName: await resolveClientName(c.clientId ?? "", c.clientName ?? "") })));
            hydrated.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
            setContracts(hydrated);
            setLoading(false);
            if (!selectedId && hydrated.length) setSelectedId(hydrated[0].id);
          })();
        },
        () => { setLoading(false); setErrorMessage("Unable to load contracts."); }
      );

      unsubSubmitted = onSnapshot(
        query(collection(firebaseDb, "submitted_jobs"), where("freelancerId", "==", user.uid)),
        (snapshot) => {
          const items: SubmittedJob[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as any;
            return { id: docSnap.id, contractId: data.contractId ?? "", milestoneIndex: typeof data.milestoneIndex === "number" ? data.milestoneIndex : undefined, milestoneTitle: data.milestoneTitle ?? undefined, description: data.description ?? "", link: data.link ?? "", attachment: data.attachment ?? null, submittedAt: data.submittedAt?.toDate() ?? new Date(), status: data.status ?? "pending", revisionMessage: data.revisionMessage ?? "" };
          });
          items.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
          setSubmittedJobs(items);
        },
        () => {}
      );
    });
    return () => { unsubAuth(); unsubContracts?.(); unsubSubmitted?.(); };
  }, [selectedId]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const isFinishedContract = (c: Contract) =>
    c.status === "Completed" || c.paymentStatus === "released" || c.workStatus === "approved" || c.workStatus === "completed";

  const isEscrowContract = (c: Contract) =>
    !isFinishedContract(c) && (c.paymentStatus === "funded" || (c.escrowFundedTotalSats ?? 0) > 0 || c.workStatus === "in_progress" || c.workStatus === "submitted" || c.workStatus === "changes_requested");

  const ongoingContracts = useMemo(() => contracts.filter(isEscrowContract), [contracts]);
  const finishedContracts = useMemo(() => contracts.filter(isFinishedContract), [contracts]);
  const needsAttentionCount = submittedJobs.filter((j) => j.status === "rejected").length;

  const visibleContracts = useMemo(() => {
    const base = view === "all" ? contracts : view === "ongoing" ? ongoingContracts : finishedContracts;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter((c) => c.title.toLowerCase().includes(q) || c.clientName.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q));
  }, [view, contracts, ongoingContracts, finishedContracts, searchQuery]);

  const filteredSubmittedJobs = useMemo(() => {
    if (!searchQuery.trim()) return submittedJobs;
    const q = searchQuery.toLowerCase();
    return submittedJobs.filter((job) => {
      const contract = contracts.find((c) => c.id === job.contractId);
      return (contract?.title ?? "").toLowerCase().includes(q) || (contract?.clientName ?? "").toLowerCase().includes(q) || (job.description ?? "").toLowerCase().includes(q);
    });
  }, [submittedJobs, contracts, searchQuery]);

  const selectedContract = contracts.find((c) => c.id === selectedId) ?? visibleContracts[0];
  const selectedSubmission = selectedSubmissionId ? submittedJobs.find((j) => j.id === selectedSubmissionId) ?? null : null;
  const selectedSubmissionContract = selectedSubmission ? contracts.find((c) => c.id === selectedSubmission.contractId) ?? null : null;
  const editingSubmission = editingSubmissionId ? submittedJobs.find((j) => j.id === editingSubmissionId) ?? null : null;
  const editingSubmissionContract = editingSubmission ? contracts.find((c) => c.id === editingSubmission.contractId) ?? null : null;

  // ── Sync reviewDetailRef height (for split panel) ─────────────────────────

  useEffect(() => {
    if (activeTab !== "submitted") return;
    const node = reviewDetailRef.current;
    if (!node) return;
    const updateHeight = () => setReviewListHeight(Math.ceil(node.getBoundingClientRect().height));
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    window.addEventListener("resize", updateHeight);
    return () => { observer.disconnect(); window.removeEventListener("resize", updateHeight); };
  }, [activeTab, selectedSubmissionId, filteredSubmittedJobs.length, contracts.length]);

  // ── Helper: display status + progress color ───────────────────────────────

  const getContractDisplayStatus = (c: Contract) => {
    if (isFinishedContract(c)) return "Finished";
    if (c.workStatus === "submitted") return "Awaiting Review";
    if (c.workStatus === "changes_requested") return "Changes Requested";
    if (isEscrowContract(c)) return "In Progress";
    return "Active";
  };

  const getProgressColor = (c: Contract): "blue" | "green" | "orange" | "red" => {
    if (isFinishedContract(c)) return "green";
    if (c.workStatus === "submitted") return "orange";
    if (c.workStatus === "changes_requested") return "red";
    return "blue";
  };

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const TABS = [
    { id: "all", label: "All", count: contracts.length },
    { id: "ongoing", label: "Active", count: ongoingContracts.length },
    { id: "submitted", label: "Submitted Jobs", count: filteredSubmittedJobs.length, alert: needsAttentionCount > 0 },
    { id: "finished", label: "Finished", count: finishedContracts.length },
  ] as const;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="w-full min-h-screen">
      {/* PAGE HEADER */}
      <div className="border-b border-gray-100 px-4 sm:px-6 py-4 sm:py-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-orange-600 mb-1">Contracts</p>
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Your Contracts</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track your active projects, submitted work, and finished milestones.</p>
      </div>

      {/* TABS */}
      <div className="bg-white border-b rounded-[8px] border-gray-100 px-3 sm:px-6">
        {/* Mobile search */}
        <div className="flex sm:hidden items-center gap-2 py-3 border-b border-gray-100">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === "submitted" ? "Search submitted work..." : "Search contracts..."}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-[13px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-300" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center overflow-x-auto -mb-px" style={{ scrollbarWidth: "none" }}>
            {TABS.map((tab) => {
              const isActive = tab.id === "submitted" ? activeTab === "submitted" : activeTab === "contracts" && view === tab.id;
              return (
                <button key={tab.id} type="button"
                  onClick={() => { if (tab.id === "submitted") { setActiveTab("submitted"); } else { setActiveTab("contracts"); setView(tab.id as "all" | "ongoing" | "finished"); } setSearchQuery(""); }}
                  className={`relative flex flex-shrink-0 items-center gap-1.5 px-3 sm:px-4 py-4 text-[12px] sm:text-[13px] font-semibold transition-colors ${isActive ? "text-gray-900 border-b-2 border-gray-900" : "text-gray-500 hover:text-gray-700 border-b-2 border-transparent"}`}>
                  {tab.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>{tab.count}</span>
                  {"alert" in tab && tab.alert && <span className="absolute right-1 top-3 h-2 w-2 rounded-full bg-orange-500" />}
                </button>
              );
            })}
          </div>

          {/* Desktop search */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0 pl-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === "submitted" ? "Search submitted work..." : "Search contracts..."}
                className="rounded-lg border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-[13px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-300 w-44 lg:w-52" />
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="px-3 sm:px-6 py-4 sm:py-5">

        {/* ── ALL CONTRACTS ───────────────────────────────────────────────── */}
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
                {/* Desktop table header */}
                <div className="hidden lg:grid mb-2 grid-cols-[1.7fr_1fr_1.55fr_0.85fr_0.95fr_0.8fr_1.05fr] items-center gap-0 rounded-t-xl border border-b-0 border-gray-100 bg-gray-50 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-500">
                  <span>Contract</span><span>Status</span><span>Milestones</span><span>Budget</span><span>Dates</span><span>Progress</span><span className="text-right">Actions</span>
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
                        {/* Mobile card */}
                        <div className="lg:hidden px-4 py-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <Avatar name={contract.clientName} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-black leading-snug text-gray-900 break-words">{contract.title}</p>
                              <p className="text-[12px] text-gray-400 mt-0.5 truncate">Client: {contract.clientName}</p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <StatusBadge label={statusLabel} />
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[12px]">
                            <div className="rounded-lg bg-gray-50 px-3 py-2">
                              <p className="text-[10px] text-gray-400 font-medium">Budget</p>
                              <p className="font-black text-gray-900">{contract.paymentTotalAmountSats ? `${contract.paymentTotalAmountSats.toLocaleString()} sats` : contract.budget}</p>
                            </div>
                            <div className="rounded-lg bg-gray-50 px-3 py-2">
                              <p className="text-[10px] text-gray-400 font-medium">Due Date</p>
                              <p className="font-semibold text-gray-900">{contract.dueDate}</p>
                              {statusLabel !== "Finished" && <p className="text-[10px] text-orange-500 font-bold">{getDueLabel(contract.dueDate)}</p>}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-semibold text-gray-500">Progress</span>
                              <span className="text-[11px] font-black text-gray-900">{getMilestoneProgressPercent(contract)}%</span>
                            </div>
                            <ProgressBar percent={getMilestoneProgressPercent(contract)} color={progressColor} />
                            {totalMs > 0 && <p className="text-[10px] text-gray-400 mt-0.5">Milestone {Math.min(releasedCount + 1, totalMs)} of {totalMs}</p>}
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button type="button" onClick={() => { setSelectedId(contract.id); setIsModalOpen(true); }} className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[12px] font-black text-gray-700 hover:bg-gray-50">
                              View Details <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => { if (!contract.jobId || !contract.freelancerId) return; router.push(`/freelancer/dashboard/messages?chat=${createConversationId(contract.jobId, contract.freelancerId)}`); }} className="rounded-lg border border-gray-200 bg-white p-2.5 text-gray-500 hover:bg-gray-50">
                              <MessageSquare className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Desktop table row */}
                        <div className="hidden lg:grid min-h-[104px] grid-cols-[1.7fr_1fr_1.55fr_0.85fr_0.95fr_0.8fr_1.05fr] items-center gap-0 px-4 py-4">
                          <div className="flex min-w-0 items-center gap-3 pr-4">
                            <Avatar name={contract.clientName} />
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-black leading-snug text-gray-900">{contract.title}</p>
                              <p className="text-[11px] text-gray-400 truncate">Client: {contract.clientName}</p>
                            </div>
                          </div>
                          <div className="border-l border-gray-100 px-4">
                            <StatusBadge label={statusLabel} />
                            {totalMs > 0 && <p className="mt-2 text-[10px] font-bold text-gray-700">Milestone {Math.min(releasedCount + 1, totalMs)} of {totalMs}</p>}
                            <p className="mt-0.5 text-[10px] text-gray-400">{statusLabel === "Finished" ? `Completed ${contract.dueDate}` : statusLabel === "Awaiting Review" ? "Submitted for review" : `Started ${contract.startDate}`}</p>
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
                            {statusLabel !== "Finished" && <p className="mt-1 text-[10px] font-bold text-orange-500">{getDueLabel(contract.dueDate)}</p>}
                          </div>
                          <div className="border-l border-gray-100 px-4">
                            <span className="text-[12px] font-black text-gray-900">{getMilestoneProgressPercent(contract)}%</span>
                            <ProgressBar percent={getMilestoneProgressPercent(contract)} color={progressColor} />
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2 border-l border-gray-100 pl-4">
                            <button type="button" onClick={() => { setSelectedId(contract.id); setIsModalOpen(true); }} className="flex min-w-[116px] items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] font-black text-gray-700 hover:bg-gray-50">
                              View Details <ChevronRight className="h-3 w-3" />
                            </button>
                            <button type="button" onClick={() => { if (!contract.jobId || !contract.freelancerId) return; router.push(`/freelancer/dashboard/messages?chat=${createConversationId(contract.jobId, contract.freelancerId)}`); }} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50">
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" className="rounded-lg bg-white p-2 text-gray-400 hover:bg-gray-50">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600"><AlertCircle className="h-4 w-4" /></div>
                      <div>
                        <p className="text-[12px] font-black text-blue-700">Need help?</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-blue-500">Open a contract to submit your work or view the client's revision notes before resubmitting.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-[12px] text-gray-400">Showing {visibleContracts.length} of {contracts.length} contracts</p>
              </>
            )}
          </>
        )}

        {/* ── ACTIVE CONTRACTS — milestone progress ─────────────────────── */}
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
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"><SortDesc className="h-4 w-4" /></div>
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
                        {/* Mobile */}
                        <div className="lg:hidden px-4 py-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <Avatar name={contract.clientName} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-black leading-snug text-gray-900 break-words">{contract.title}</p>
                              <p className="text-[12px] text-gray-400 mt-0.5 truncate">Client: {contract.clientName}</p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <StatusBadge label="In Progress" />
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
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { setSelectedId(contract.id); setIsModalOpen(true); }} className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[12px] font-black text-gray-700 hover:bg-gray-50">
                              View Details <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => { if (!contract.jobId || !contract.freelancerId) return; router.push(`/freelancer/dashboard/messages?chat=${createConversationId(contract.jobId, contract.freelancerId)}`); }} className="rounded-lg border border-gray-200 bg-white p-2.5 text-gray-500 hover:bg-gray-50">
                              <MessageSquare className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Desktop */}
                        <div className="hidden lg:grid grid-cols-[1.25fr_1.8fr_0.65fr_0.75fr_0.75fr] items-center gap-5 px-5 py-4">
                          <div className="flex min-w-0 items-center gap-4 border-r border-gray-100 pr-4">
                            <Avatar name={contract.clientName} />
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-black leading-snug text-gray-900">{contract.title}</p>
                              <p className="mt-0.5 truncate text-[11px] text-gray-400">Client: {contract.clientName}</p>
                              <div className="mt-3 flex flex-wrap items-center gap-3">
                                <StatusBadge label="In Progress" />
                                <span className="text-[10px] font-semibold text-gray-500">Started {contract.startDate}</span>
                              </div>
                            </div>
                          </div>
                          <div className="min-w-0 border-r border-gray-100 pr-4"><MilestoneTimeline contract={contract} /></div>
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
                            <button type="button" onClick={() => { if (!contract.jobId || !contract.freelancerId) return; router.push(`/freelancer/dashboard/messages?chat=${createConversationId(contract.jobId, contract.freelancerId)}`); }} className="flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-500 hover:bg-gray-50">
                              <MessageSquare className="h-3.5 w-3.5" />
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

        {/* ── SUBMITTED JOBS — split panel ──────────────────────────────── */}
        {activeTab === "submitted" && (
          <>
            {filteredSubmittedJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-300 mb-3" />
                <p className="font-bold text-gray-800">No submitted jobs</p>
                <p className="text-sm text-gray-400 mt-1">You haven't submitted any work yet</p>
              </div>
            ) : (
              <div className="w-full max-w-full min-w-0 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
                {/* Left: list */}
                <div className="w-full max-w-full min-w-0 flex min-h-0 flex-col space-y-3 xl:max-h-[var(--review-list-height)] xl:overflow-hidden" style={reviewListHeight ? ({ "--review-list-height": `${reviewListHeight}px` } as any) : undefined}>
                  <div className="w-full max-w-full min-w-0 rounded-xl border border-gray-100 bg-white px-4 py-4 shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
                    <h2 className="font-black text-gray-900">Submitted Jobs ({filteredSubmittedJobs.length})</h2>
                    <p className="text-[12px] text-gray-400">All work you've submitted to clients.</p>
                  </div>
                  <div className="w-full max-w-full min-w-0 min-h-0 flex-1 space-y-3 xl:overflow-y-auto xl:pr-1">
                    {filteredSubmittedJobs.map((job) => {
                      const contract = contracts.find((c) => c.id === job.contractId);
                      const isSelected = selectedSubmissionId === job.id || (!selectedSubmissionId && filteredSubmittedJobs[0]?.id === job.id);
                      const total = contract?.paymentTotalAmountSats ?? 0;
                      const releasedCount = contract?.paymentReleasedInstallments ?? 0;
                      const totalMs = contract?.milestones?.length ?? contract?.paymentInstallments ?? 0;
                      const currentMilestone = job.milestoneIndex ?? Math.min(releasedCount + 1, totalMs || releasedCount + 1);
                      const progress = totalMs > 0 ? Math.round((currentMilestone / totalMs) * 100) : contract?.progress ?? 0;
                      const jobStatusLabel = job.status === "approved" ? "Approved" : job.status === "rejected" ? "Changes Requested" : "Pending Review";
                      const jobStatusColor = job.status === "approved" ? "text-green-600" : job.status === "rejected" ? "text-red-600" : "text-orange-600";
                      return (
                        <button key={job.id} type="button"
                          onClick={() => { setSelectedSubmissionId(job.id); if (typeof window !== "undefined" && window.innerWidth < 1280) setIsSubmissionModalOpen(true); }}
                          className={`w-full max-w-full min-w-0 rounded-xl border px-4 py-4 text-left shadow-[0_1px_8px_rgba(15,23,42,0.04)] transition-all ${isSelected ? "border-orange-300 bg-orange-50/70 ring-1 ring-orange-200" : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-md"}`}>
                          <div className="flex items-start gap-3">
                            <Avatar name={contract?.clientName ?? "C"} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="truncate text-[13px] font-black leading-snug text-gray-900">{contract?.title ?? "Contract"}</p>
                                <span className="flex-shrink-0 rounded-lg bg-orange-100 px-2 py-1 text-[10px] font-black text-orange-700">
                                  Milestone {currentMilestone} / {totalMs || "?"}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-0.5 truncate">Client: {contract?.clientName}</p>
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
                            <ProgressBar percent={progress} color={job.status === "rejected" ? "red" : job.status === "approved" ? "green" : "orange"} />
                            <p className="text-right text-[10px] text-gray-400 mt-0.5">{progress}% Complete</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right: detail panel */}
                {(() => {
                  const job = selectedSubmissionId ? filteredSubmittedJobs.find((j) => j.id === selectedSubmissionId) ?? filteredSubmittedJobs[0] : filteredSubmittedJobs[0];
                  const contract = job ? contracts.find((c) => c.id === job.contractId) : null;
                  if (!job || !contract) return null;
                  const total = contract.paymentTotalAmountSats ?? 0;
                  const totalMs = contract.milestones?.length ?? 0;
                  const perMs = totalMs > 0 ? Math.round(total / totalMs) : 0;
                  const releasedCount = contract.paymentReleasedInstallments ?? 0;
                  const currentMilestone = job.milestoneIndex ?? Math.min(releasedCount + 1, totalMs || releasedCount + 1);
                  const reviewProgress = totalMs > 0 ? Math.round((currentMilestone / totalMs) * 100) : contract.progress;
                  const detailStatusLabel = job.status === "approved" ? "Approved" : job.status === "rejected" ? "Changes Requested" : "Pending Review";
                  return (
                    <div ref={reviewDetailRef} className="hidden overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_1px_10px_rgba(15,23,42,0.05)] xl:block">
                      <div className="px-6 py-5 border-b border-gray-100">
                        <div className="flex items-start gap-4">
                          <Avatar name={contract.clientName} size="lg" />
                          <div className="flex-1 min-w-0">
                            <h2 className="text-[18px] font-black text-gray-900">{contract.title}</h2>
                            <p className="text-[12px] text-gray-400 mt-0.5">Client: {contract.clientName}</p>
                          </div>
                          <div className="text-right">
                            <StatusBadge label={detailStatusLabel} />
                            <p className="mt-1 text-[11px] font-bold text-gray-500">Milestone {currentMilestone} of {totalMs}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-0 mt-5 pt-4 border-t border-gray-100">
                          {[{ label: "Total Budget", value: total > 0 ? `${total.toLocaleString()} sats` : contract.budget }, { label: "Start Date", value: contract.startDate }, { label: "Due Date", value: contract.dueDate, accent: true }, { label: "Progress", value: `${reviewProgress}%` }].map(({ label, value, accent }) => (
                            <div key={label} className="border-r border-gray-100 px-4 first:pl-0 last:border-r-0">
                              <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> {label}</p>
                              <p className={`text-[13px] font-bold ${accent ? "text-orange-500" : "text-gray-900"}`}>{value}</p>
                              {label === "Progress" && <div className="mt-2"><ProgressBar percent={reviewProgress} color={job.status === "rejected" ? "red" : job.status === "approved" ? "green" : "orange"} /></div>}
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
                            const isCurrentPending = isCurrent && job.status === "pending";
                            const isCurrentChanges = isCurrent && job.status === "rejected";
                            const msAmount = ms.freelancerAmountSats ?? perMs;
                            return (
                              <details key={i} open={isCurrentPending || isCurrentChanges} className={`border-b last:border-b-0 ${isCurrentChanges ? "border-red-100 bg-red-50/40" : isCurrentPending ? "border-orange-100 bg-orange-50/65" : "border-gray-100 bg-white"}`}>
                                <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none">
                                  <MilestoneDot state={isReleased ? "approved" : isCurrentChanges ? "revision" : isCurrentPending ? "review" : isCurrent ? "active" : "pending"} index={i} size="md" />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[13px] text-gray-900">{ms.title || ms.name || `Milestone ${i + 1}`}</p>
                                    <p className="text-[11px] text-gray-400">{isReleased ? `Approved ${ms.deadline || contract.dueDate}` : isCurrentPending ? `Submitted ${job.submittedAt.toLocaleDateString()} — awaiting review` : ms.deadline ? `Due ${ms.deadline}` : "Pending"}</p>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <StatusBadge label={isReleased ? "Approved" : isCurrentChanges ? "Changes Requested" : isCurrentPending ? "Awaiting Review" : isCurrent ? "In Progress" : "Pending"} />
                                    <span className="text-[12px] font-bold text-gray-700">{msAmount ? `${Number(msAmount).toLocaleString()} sats` : ms.amount}</span>
                                    <ChevronRight className="h-4 w-4 text-gray-300" />
                                  </div>
                                </summary>

                                {/* Submission content or changes requested note */}
                                {(isCurrentPending || isCurrentChanges) && (
                                  <div className={`px-4 pb-4 border-t ${isCurrentChanges ? "border-red-100" : "border-orange-100"}`}>
                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mt-3 mb-2">Your submission</p>
                                    <p className="text-[13px] text-gray-700 bg-white rounded-lg border border-gray-100 px-3 py-2.5">{job.description || "Work submitted for review."}</p>
                                    {job.link && <a href={job.link} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1.5 text-[12px] text-blue-600 hover:underline"><ArrowRight className="h-3 w-3" /> {job.link}</a>}
                                    {job.attachment && <a href={job.attachment.url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50">📎 {job.attachment.name}<span className="ml-auto text-[10px] text-gray-400">Download</span></a>}
                                    {isCurrentChanges && (job.revisionMessage || contract.revisionMessage) && (
                                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-1">Client's note</p>
                                        <p className="text-[12px] text-red-800 italic">"{job.revisionMessage || contract.revisionMessage}"</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </details>
                            );
                          })}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
                        {job.status !== "approved" && (
                          <button type="button" onClick={() => openEditSubmission(job)} className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-5 py-3 text-[13px] font-bold text-orange-700 transition-colors hover:bg-orange-100">
                            <RefreshCw className="h-4 w-4" /> {job.status === "rejected" ? "Adjust & Resubmit" : "Edit Submission"}
                          </button>
                        )}
                        <button type="button" onClick={() => { if (!contract.jobId || !contract.freelancerId) return; router.push(`/freelancer/dashboard/messages?chat=${createConversationId(contract.jobId, contract.freelancerId)}`); }} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-[13px] font-bold text-gray-700 transition-colors hover:bg-gray-50">
                          <MessageSquare className="h-4 w-4" /> Message Client
                        </button>
                        {job.status !== "approved" && (
                          <button type="button" onClick={() => { setSelectedId(contract.id); setActiveTab("contracts"); setIsModalOpen(true); }} className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-[13px] font-bold text-white transition-colors hover:bg-gray-800">
                            <Upload className="h-4 w-4" /> Submit New Work
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

        {/* ── FINISHED CONTRACTS ────────────────────────────────────────── */}
        {activeTab === "contracts" && view === "finished" && (
          <>
            {visibleContracts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-300 mb-3" />
                <p className="font-bold text-gray-800">{searchQuery ? "No results found" : "No finished contracts"}</p>
                <p className="text-sm text-gray-400 mt-1">{searchQuery ? "Try a different search term" : "Completed projects will appear here"}</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-green-100 bg-green-50/40 px-4 py-3.5 shadow-[0_1px_10px_rgba(15,23,42,0.04)]">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-green-500 text-white"><CheckCircle2 className="h-5 w-5" /></div>
                  <div>
                    <h2 className="font-black text-gray-900">Finished Contracts ({visibleContracts.length})</h2>
                    <p className="text-[12px] text-gray-400">Successfully completed projects.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {visibleContracts.map((contract) => {
                    const total = contract.paymentTotalAmountSats ?? 0;
                    const totalMs = contract.milestones?.length || contract.paymentInstallments || 0;
                    return (
                      <div key={contract.id} className="rounded-2xl border border-l-4 border-gray-100 border-l-green-500 bg-white shadow-[0_1px_10px_rgba(15,23,42,0.05)] transition-all hover:shadow-md overflow-hidden">
                        {/* Mobile */}
                        <div className="lg:hidden px-4 py-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <Avatar name={contract.clientName} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-black leading-snug text-gray-900 break-words">{contract.title}</p>
                              <p className="text-[12px] text-gray-400 mt-0.5 truncate">Client: {contract.clientName}</p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <StatusBadge label="Finished" />
                                <span className="text-[10px] font-semibold text-gray-500">{contract.startDate} – {contract.dueDate}</span>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[12px]">
                            <div className="rounded-lg bg-gray-50 px-3 py-2">
                              <p className="text-[10px] text-gray-400 font-medium">Total Earned</p>
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
                            <button type="button" onClick={() => { if (!contract.jobId || !contract.freelancerId) return; router.push(`/freelancer/dashboard/messages?chat=${createConversationId(contract.jobId, contract.freelancerId)}`); }} className="rounded-lg border border-gray-200 bg-white p-2.5 text-gray-500 hover:bg-gray-50">
                              <MessageSquare className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Desktop */}
                        <div className="hidden lg:grid min-h-[116px] grid-cols-[1.45fr_1.05fr_1.35fr_0.85fr] items-center gap-5 px-5 py-4">
                          <div className="flex min-w-0 items-center gap-4 border-r border-gray-100 pr-4">
                            <Avatar name={contract.clientName} />
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-black leading-snug text-gray-900">{contract.title}</p>
                              <p className="mt-0.5 truncate text-[11px] text-gray-400">Client: {contract.clientName}</p>
                              <div className="mt-4 flex flex-wrap items-center gap-3">
                                <StatusBadge label="Finished" />
                                <span className="text-[10px] font-semibold text-gray-500">Completed: {contract.dueDate}</span>
                              </div>
                            </div>
                          </div>
                          <div className="border-r border-gray-100 pr-4">
                            <div className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] text-gray-500">Total Earned</span></div>
                            <p className="mt-1 font-black text-[14px] text-gray-900">{total > 0 ? `${total.toLocaleString()} sats` : contract.budget}</p>
                            <div className="mt-3 flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] text-gray-500">Duration</span></div>
                            <p className="text-[12px] font-semibold text-gray-700">{contract.startDate} - {contract.dueDate}</p>
                          </div>
                          <div className="border-r border-gray-100 pr-4">
                            <p className="mb-1 text-[11px] font-bold text-gray-700">Milestones</p>
                            <div className="flex items-center gap-1 mb-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /><span className="text-[12px] font-semibold text-gray-700">{totalMs} / {totalMs} Completed</span></div>
                            <div className="flex items-center gap-2"><div className="flex-1"><ProgressBar percent={100} color="green" /></div><span className="text-[10px] font-bold text-gray-500">100%</span></div>
                            <div className="mt-1 space-y-0.5">
                              <div className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /><span className="text-[10px] text-green-600">All milestones approved</span></div>
                              <div className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /><span className="text-[10px] text-green-600">Payment released</span></div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button type="button" onClick={() => { setSelectedId(contract.id); setIsModalOpen(true); }} className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[12px] font-black text-gray-700 shadow-sm hover:bg-gray-50">
                              View Contract <ChevronRight className="h-3 w-3" />
                            </button>
                            <button type="button" onClick={() => { if (!contract.jobId || !contract.freelancerId) return; router.push(`/freelancer/dashboard/messages?chat=${createConversationId(contract.jobId, contract.freelancerId)}`); }} className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[12px] font-bold text-gray-600 shadow-sm hover:bg-gray-50">
                              <MessageSquare className="h-3.5 w-3.5" /> Message Client
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

      {/* ── CONTRACT DETAIL MODAL ────────────────────────────────────────── */}
      {isModalOpen && selectedContract && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center px-2 py-2 sm:items-center sm:px-5 sm:py-5">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative z-[81] max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl md:max-w-3xl lg:max-w-5xl">

            {/* Header */}
            <div className="border-b border-gray-100 px-6 pb-4 pt-5">
              <button type="button" onClick={() => setIsModalOpen(false)} className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-lg">✕</button>
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge label={isFinishedContract(selectedContract) ? "Finished" : isEscrowContract(selectedContract) ? "In Progress" : "Active"} />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Contract #{selectedContract.id.slice(-6).toUpperCase()}</span>
              </div>
              <h2 className="text-[22px] font-black text-gray-900 leading-tight">{selectedContract.title}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <Avatar name={selectedContract.clientName} size="sm" />
                <span className="text-[13px] text-gray-500">Client: <strong className="text-gray-800">{selectedContract.clientName}</strong></span>
              </div>
            </div>

            {/* Value + Escrow */}
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

            {/* Overview */}
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

            {/* Description */}
            {selectedContract.description && selectedContract.description !== "-" && (
              <div className="border-b border-gray-50 px-6 py-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-2">Description</p>
                <p className="text-[13px] text-gray-600 leading-relaxed">{selectedContract.description}</p>
              </div>
            )}

            {/* Scope */}
            {selectedContract.scopeItems && selectedContract.scopeItems.length > 0 && (
              <div className="border-b border-gray-50 px-6 py-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-3">Scope of Work</p>
                <ul className="space-y-1.5">{selectedContract.scopeItems.map((item) => <li key={item} className="flex items-start gap-2 text-[13px] text-gray-600"><span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orange-400" /><span>{item}</span></li>)}</ul>
              </div>
            )}

            {/* Milestones */}
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

            {/* Submit Work section */}
            <div className="border-b border-gray-50 px-6 py-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-3">Submit Work</p>
              {(() => {
                const isFinished = selectedContract.workStatus === "approved" || selectedContract.workStatus === "completed" || selectedContract.paymentStatus === "released" || selectedContract.status === "Completed";
                const isSubmitted = selectedContract.workStatus === "submitted";
                const isChangesRequested = selectedContract.workStatus === "changes_requested";
                const releasedCount = selectedContract.paymentReleasedInstallments ?? 0;
                const totalMilestones = selectedContract.paymentInstallments ?? 1;
                const nextIdx = releasedCount + 1;
                const milestones = selectedContract.milestones ?? [];
                const currentMs = milestones.find((m: any, i: number) => Number(m.index ?? i + 1) === nextIdx);
                const currentMsTitle = (currentMs as any)?.title || (currentMs as any)?.name || `Milestone ${nextIdx}`;

                if (isFinished) return (
                  <div className="rounded-xl border border-green-100 bg-green-50/60 px-4 py-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-[12px] font-bold text-green-700 uppercase tracking-wider">Contract Completed</span>
                    </div>
                    <p className="mt-2 text-[12px] text-green-600">All milestones approved and payment released. No further submissions needed.</p>
                  </div>
                );

                if (isSubmitted) return (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="text-[12px] font-bold text-blue-700 uppercase tracking-wider">Awaiting Client Review</span>
                    </div>
                    <p className="mt-2 text-[12px] text-blue-600">Your work for <strong>Milestone {nextIdx}: {currentMsTitle}</strong> has been submitted. You'll be notified once the client reviews it.</p>
                  </div>
                );

                if (isChangesRequested) return (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-red-100 bg-red-50/60 px-4 py-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="text-[11px] font-black text-red-700 uppercase tracking-wider">Changes Requested — Milestone {nextIdx}: {currentMsTitle}</span>
                      </div>
                      <p className="text-[12px] text-red-700 leading-relaxed">The client asked for changes. Review their note, make adjustments, and resubmit.</p>
                      {selectedContract.revisionMessage && (
                        <div className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-1">Client's note</p>
                          <p className="text-[12px] text-red-800 italic">"{selectedContract.revisionMessage}"</p>
                        </div>
                      )}
                    </div>
                    <textarea value={workMessage} onChange={(e) => setWorkMessage(e.target.value)} placeholder={`Describe what you adjusted for "${currentMsTitle}"`} rows={3} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-900 outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 resize-none" />
                    <input value={workLink} onChange={(e) => setWorkLink(e.target.value)} placeholder="Paste a link to the updated deliverable" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-900 outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300" />
                    <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] font-semibold text-gray-700 hover:bg-gray-50">{selectedFile ? selectedFile.name : "Attach File"}</button>
                      {selectedFile && <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-[11px] font-semibold text-gray-500">Remove</button>}
                      <button type="button" onClick={() => void handleSubmitWork()} disabled={isSubmitting} className="rounded-lg bg-orange-500 px-4 py-2 text-[12px] font-bold text-white hover:bg-orange-600 disabled:opacity-50">{isSubmitting ? "Submitting..." : "Resubmit Adjusted Work"}</button>
                    </div>
                    {submissionSuccess && <p className="text-[12px] text-green-700 font-semibold">{submissionSuccess}</p>}
                    {submissionError && <p className="text-[12px] text-red-600">{submissionError}</p>}
                  </div>
                );

                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-orange-600">Submit Work</span>
                      <div className="inline-flex items-center rounded-full bg-orange-50 border border-orange-200 px-2.5 py-0.5">
                        <span className="text-[9px] font-bold text-orange-700">Milestone {nextIdx} of {totalMilestones}: {currentMsTitle}</span>
                      </div>
                    </div>
                    <textarea value={workMessage} onChange={(e) => setWorkMessage(e.target.value)} placeholder={`Describe what you completed for "${currentMsTitle}"`} rows={3} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-900 outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 resize-none" />
                    <input value={workLink} onChange={(e) => setWorkLink(e.target.value)} placeholder="Paste a link to deliverable, preview, or repository" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-900 outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300" />
                    <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] font-semibold text-gray-700 hover:bg-gray-50">{selectedFile ? selectedFile.name : "Attach File"}</button>
                      {selectedFile && <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-[11px] font-semibold text-gray-500">Remove</button>}
                      <button type="button" onClick={() => void handleSubmitWork()} disabled={isSubmitting} className="rounded-lg bg-gray-900 px-4 py-2 text-[12px] font-bold text-white hover:bg-gray-800 disabled:opacity-50">{isSubmitting ? "Submitting..." : "Submit Work"}</button>
                    </div>
                    {submissionSuccess && <p className="text-[12px] text-green-700 font-semibold">{submissionSuccess}</p>}
                    {submissionError && <p className="text-[12px] text-red-600">{submissionError}</p>}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 bg-white px-6 pb-5 pt-4">
              <button type="button"
                onClick={async () => {
                  if (!selectedContract?.jobId || !selectedContract?.freelancerId) return;
                  const clientId = selectedContract.clientId ?? "";
                  if (!clientId) return;
                  const freelancerId = firebaseAuth.currentUser?.uid ?? selectedContract.freelancerId ?? "";
                  if (!freelancerId) return;
                  let freelancerName = "Freelancer";
                  let clientName = await resolveClientName(clientId, selectedContract.clientName ?? "");
                  const [clientAvatarUrl, freelancerAvatarUrl] = await Promise.all([resolveClientAvatar(clientId), resolveFreelancerAvatar(freelancerId)]);
                  try { const snap = await getDoc(doc(firebaseDb, "all_users", freelancerId)); if (snap.exists()) { const d = snap.data() as any; freelancerName = d.fullName ?? d.name ?? d.email ?? "Freelancer"; } } catch { freelancerName = "Freelancer"; }
                  if (!clientName) clientName = "Client";
                  const conversationId = createConversationId(selectedContract.jobId, selectedContract.freelancerId);
                  await setDoc(doc(firebaseDb, "conversations", conversationId), { jobId: selectedContract.jobId, jobTitle: selectedContract.title, proposalId: "", clientId, clientName, freelancerId: selectedContract.freelancerId, freelancerName, clientAvatarUrl, freelancerAvatarUrl, paymentTotalAmountSats: parseSats(selectedContract.budget), paymentStatus: "unfunded", createdBy: "system", canFreelancerMessage: true, unread: { [clientId]: 0, [freelancerId]: 0 }, updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true });
                  router.push(`/freelancer/dashboard/messages?chat=${conversationId}`);
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-[13px] font-bold text-white hover:bg-gray-800 transition-colors">
                <MessageSquare className="h-4 w-4" /> Message Client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUBMISSION DETAIL MODAL (mobile) ────────────────────────────── */}
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
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Your Submission</p>
                <p className="text-[13px] text-gray-900 leading-relaxed">{selectedSubmission.description || "Work submitted for review."}</p>
                {selectedSubmission.link && <a href={selectedSubmission.link} target="_blank" rel="noreferrer" className="mt-2 block text-[12px] text-blue-600 hover:underline break-all">{selectedSubmission.link}</a>}
                {selectedSubmission.attachment && <a href={selectedSubmission.attachment.url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50">📎 {selectedSubmission.attachment.name}</a>}
              </div>
            </div>
            {selectedSubmission.status === "rejected" && (selectedSubmission.revisionMessage || selectedSubmissionContract?.revisionMessage) && (
              <div className="px-5 py-4 border-b border-gray-50">
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-2">Client Requested Changes</p>
                  <p className="text-[13px] text-red-800 leading-relaxed">{selectedSubmission.revisionMessage || selectedSubmissionContract?.revisionMessage}</p>
                </div>
              </div>
            )}
            <div className="px-5 pb-5 pt-4 flex flex-col gap-2">
              {selectedSubmission.status !== "approved" && (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { openEditSubmission(selectedSubmission); setIsSubmissionModalOpen(false); }} className="rounded-xl bg-orange-50 border border-orange-200 py-3 text-[12px] font-bold text-orange-700 hover:bg-orange-100 transition-colors">
                    {selectedSubmission.status === "rejected" ? "Adjust & Resubmit" : "Edit Submission"}
                  </button>
                  {selectedSubmissionContract && (
                    <button type="button" onClick={() => { setSelectedId(selectedSubmissionContract.id); setActiveTab("contracts"); setIsModalOpen(true); setIsSubmissionModalOpen(false); }} className="rounded-xl bg-gray-900 py-3 text-[12px] font-bold text-white hover:bg-gray-800 transition-colors">View Contract</button>
                  )}
                </div>
              )}
              {selectedSubmission.status === "approved" && selectedSubmissionContract && (
                <button type="button" onClick={() => { setSelectedId(selectedSubmissionContract.id); setActiveTab("contracts"); setIsModalOpen(true); setIsSubmissionModalOpen(false); }} className="w-full rounded-xl bg-gray-900 py-3 text-[12px] font-bold text-white hover:bg-gray-800 transition-colors">View Contract</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT / RESUBMIT MODAL ────────────────────────────────────────── */}
      {editingSubmission && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center px-2 py-2 sm:items-center sm:px-4 sm:py-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!isUpdatingSubmission) setEditingSubmissionId(null); }} />
          <div className="relative z-[101] max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="px-5 pt-5 pb-4 border-b border-gray-50">
              <button type="button" onClick={() => setEditingSubmissionId(null)} disabled={isUpdatingSubmission} className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-lg">✕</button>
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">{editingSubmission.status === "rejected" ? "Adjust Submission" : "Edit Submission"}</span>
              <h2 className="mt-1 text-[20px] font-black text-gray-900 leading-tight">{editingSubmissionContract?.title || "Submitted work"}</h2>
              <p className="mt-1.5 text-[13px] text-gray-500">Update your work and resubmit. The client will be notified.</p>
            </div>
            {editingSubmission.status === "rejected" && (editingSubmission.revisionMessage || editingSubmissionContract?.revisionMessage) && (
              <div className="px-5 py-4 border-b border-gray-50">
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-2">Client Note</p>
                  <p className="text-[13px] text-red-800 leading-relaxed">{editingSubmission.revisionMessage || editingSubmissionContract?.revisionMessage}</p>
                </div>
              </div>
            )}
            <div className="px-5 py-4 space-y-3">
              <textarea value={editWorkMessage} onChange={(e) => setEditWorkMessage(e.target.value)} placeholder="Describe the updated work" rows={4} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-900 outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 resize-none" />
              <input value={editWorkLink} onChange={(e) => setEditWorkLink(e.target.value)} placeholder="Paste an updated deliverable link" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-gray-900 outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300" />
              <input ref={editFileInputRef} type="file" className="hidden" onChange={(e) => setEditSelectedFile(e.target.files?.[0] ?? null)} />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => editFileInputRef.current?.click()} disabled={isUpdatingSubmission} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] font-semibold text-gray-700 hover:bg-gray-50">
                  {editSelectedFile ? editSelectedFile.name : editingSubmission.attachment ? "Replace File" : "Attach File"}
                </button>
                {editingSubmission.attachment && !editSelectedFile && <span className="text-[11px] text-gray-500">Current: {editingSubmission.attachment.name}</span>}
                {editSelectedFile && <button type="button" onClick={() => { setEditSelectedFile(null); if (editFileInputRef.current) editFileInputRef.current.value = ""; }} disabled={isUpdatingSubmission} className="text-[11px] font-semibold text-gray-500">Remove</button>}
              </div>
              {editSubmissionError && <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-700">{editSubmissionError}</p>}
              {editSubmissionSuccess && <p className="rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-[12px] text-green-700">{editSubmissionSuccess}</p>}
            </div>
            <div className="flex gap-3 px-5 pb-5 pt-2">
              <button type="button" onClick={() => setEditingSubmissionId(null)} disabled={isUpdatingSubmission} className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-[13px] font-bold text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
              <button type="button" onClick={() => void handleUpdateSubmission()} disabled={isUpdatingSubmission} className="flex-1 rounded-xl bg-orange-500 py-3 text-[13px] font-bold text-white hover:bg-orange-600 transition-colors disabled:opacity-50">
                {isUpdatingSubmission ? "Saving…" : editingSubmission.status === "rejected" ? "Resubmit Work" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}