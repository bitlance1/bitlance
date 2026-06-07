"use client";

// import { useEffect, useMemo, useRef, useState } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import Button from "@/components/atoms/Button";
// import { Calendar, Search } from "lucide-react";
// import { firebaseAuth, firebaseDb } from "@/lib/firebase";
// import { sendUserNotification } from "@/lib/notifications";
// import { onAuthStateChanged } from "firebase/auth";
// import {
//   addDoc,
//   collection,
//   doc,
//   getDoc,
//   getDocs,
//   increment,
//   limit,
//   onSnapshot,
//   query,
//   serverTimestamp,
//   setDoc,
//   updateDoc,
//   where,
// } from "firebase/firestore";

// type ContractStatus = "Active" | "Review" | "Completed";

// type Contract = {
//   id: string;
//   title: string;
//   freelancer: string;
//   freelancerId?: string;
//   clientId?: string;
//   clientName?: string;
//   jobId?: string;
//   contractType?: "Fixed Price" | "Hourly";
//   progress: number;
//   nextMilestone: string;
//   status: ContractStatus;
//   budget: string;
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
//   submissionAttachment?: { name?: string; url?: string } | null;
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
//   description: string;
//   link?: string;
//   attachment?: { name: string; url: string };
//   submittedAt: Date;
//   status: "pending" | "approved" | "rejected";
//   revisionMessage?: string;
//   milestoneIndex?: number;
//   milestoneTitle?: string;
// };

// const formatDate = (value: any) => {
//   if (!value) return "-";
//   if (typeof value === "string") return value;
//   const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
//   return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
// };

// const formatSats = (value: string) => {
//   const safeValue = String(value ?? "").trim();
//   if (!safeValue) return "0 sats";
//   return safeValue.toLowerCase().includes("sats") ? safeValue : `${safeValue} sats`;
// };

// const parseSats = (value: string) => {
//   const cleaned = String(value ?? "").replace(/[^0-9.]/g, "");
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
//   const safeInstallments = Math.max(1, Math.trunc(installments));
//   const safeInstallment = Math.max(1, Math.min(safeInstallments, Math.trunc(installment)));
//   const base = Math.floor(safeTotal / safeInstallments);
//   const remainder = safeTotal % safeInstallments;
//   return base + (safeInstallment <= remainder ? 1 : 0);
// };

// export default function ClientContractsContent() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const [view, setView] = useState<"all" | "ongoing" | "finished">("all");
//   const [selectedId, setSelectedId] = useState("");
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [contracts, setContracts] = useState<Contract[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [errorMessage, setErrorMessage] = useState("");
//   const [hasOpenedFromParam, setHasOpenedFromParam] = useState(false);
//   const [activeTab, setActiveTab] = useState<"contracts" | "submitted">("contracts");
//   const [submittedJobs, setSubmittedJobs] = useState<SubmittedJob[]>([]);
//   const [showPaymentModal, setShowPaymentModal] = useState(false);
//   const [pendingApprovalJobId, setPendingApprovalJobId] = useState<string | null>(null);
//   const [approvalErrorMessage, setApprovalErrorMessage] = useState<string>("");
//   const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
//   const [pendingChangeJobId, setPendingChangeJobId] = useState<string | null>(null);
//   const [changeRequestNote, setChangeRequestNote] = useState("");
//   const [changeRequestError, setChangeRequestError] = useState("");
//   const [isRequestingChanges, setIsRequestingChanges] = useState(false);
//   const [freelancerData, setFreelancerData] = useState<any>(null);
//   const [loadingFreelancer, setLoadingFreelancer] = useState(false);

//   const createConversationId = (jobId: string, freelancerId: string) => `${jobId}_${freelancerId}`;
//   const freelancerNameCache = useRef<Record<string, string>>({});
//   const freelancerAvatarCache = useRef<Record<string, string>>({});

//   const resolveFreelancerName = async (freelancerId: string, fallbackName: string) => {
//     const initialFallback = fallbackName?.trim() || "";
//     if (!freelancerId) return initialFallback || "Freelancer";
//     if (freelancerNameCache.current[freelancerId]) return freelancerNameCache.current[freelancerId];
//     let resolvedName = initialFallback;
//     try {
//       const allUsersSnap = await getDoc(doc(firebaseDb, "all_users", freelancerId));
//       if (allUsersSnap.exists()) {
//         const data = allUsersSnap.data() as any;
//         resolvedName = data.fullName ?? data.name ?? data.email ?? resolvedName;
//       }
//     } catch {}
//     if (!resolvedName) {
//       try {
//         const freelancerDocSnap = await getDoc(doc(firebaseDb, "freelancers", freelancerId));
//         if (freelancerDocSnap.exists()) {
//           const data = freelancerDocSnap.data() as any;
//           const composedName = `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
//           resolvedName = data.fullName || composedName || data.name || resolvedName;
//         }
//       } catch {}
//     }
//     if (!resolvedName) {
//       try {
//         const q = query(collection(firebaseDb, "freelancers"), where("uid", "==", freelancerId), limit(1));
//         const snap = await getDocs(q);
//         if (!snap.empty) {
//           const data = snap.docs[0].data() as any;
//           const composedName = `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
//           resolvedName = data.fullName || composedName || data.name || resolvedName;
//         }
//       } catch {}
//     }
//     freelancerNameCache.current[freelancerId] = resolvedName || "Freelancer";
//     return freelancerNameCache.current[freelancerId];
//   };

//   const getConversationForContract = async (contract: Contract) => {
//     if (!contract.jobId || !contract.freelancerId) return null;
//     const q = query(
//       collection(firebaseDb, "conversations"),
//       where("jobId", "==", contract.jobId),
//       where("freelancerId", "==", contract.freelancerId),
//       limit(1)
//     );
//     const snap = await getDocs(q);
//     return snap.empty ? null : snap.docs[0];
//   };

//   useEffect(() => {
//     let unsubscribeContracts: (() => void) | undefined;
//     let unsubscribeSubmitted: (() => void) | undefined;
//     const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
//       if (!user) {
//         if (unsubscribeContracts) unsubscribeContracts();
//         if (unsubscribeSubmitted) unsubscribeSubmitted();
//         return;
//       }
//       setLoading(true);
//       setErrorMessage("");

//       const contractsQuery = query(collection(firebaseDb, "contracts"), where("clientId", "==", user.uid));
//       unsubscribeContracts = onSnapshot(
//         contractsQuery,
//         (snapshot) => {
//           const items: Contract[] = snapshot.docs.map((docSnap) => {
//             const data = docSnap.data() as any;
//             return {
//               id: docSnap.id,
//               title: data.title ?? "Contract",
//               freelancer: data.freelancer ?? "",
//               freelancerId: data.freelancerId ?? "",
//               clientId: data.clientId ?? "",
//               clientName: data.clientName ?? "",
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
//             };
//           });

//           const hydrateFreelancerNames = async () => {
//             const hydrated = await Promise.all(
//               items.map(async (contract) => ({
//                 ...contract,
//                 freelancer: await resolveFreelancerName(contract.freelancerId ?? "", contract.freelancer ?? ""),
//               }))
//             );
//             hydrated.sort((a, b) => {
//               const aDate = a.updatedAt || a.createdAt || 0;
//               const bDate = b.updatedAt || b.createdAt || 0;
//               return bDate - aDate;
//             });
//             setContracts(hydrated);
//             setLoading(false);
//             if (!selectedId && hydrated.length) setSelectedId(hydrated[0].id);
//           };
//           hydrateFreelancerNames();
//         },
//         () => { setLoading(false); setErrorMessage("Unable to load contracts."); }
//       );

//       const submittedQuery = query(collection(firebaseDb, "submitted_jobs"), where("clientId", "==", user.uid));
//       unsubscribeSubmitted = onSnapshot(
//         submittedQuery,
//         (snapshot) => {
//           const items: SubmittedJob[] = snapshot.docs.map((docSnap) => {
//             const data = docSnap.data() as any;
//             return {
//               id: docSnap.id,
//               contractId: data.contractId ?? "",
//               description: data.description ?? "",
//               link: data.link ?? "",
//               attachment: data.attachment ?? null,
//               submittedAt: data.submittedAt?.toDate() ?? new Date(),
//               status: data.status ?? "pending",
//               revisionMessage: data.revisionMessage ?? "",
//               milestoneIndex: data.milestoneIndex,
//               milestoneTitle: data.milestoneTitle ?? "",
//             };
//           });
//           items.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
//           setSubmittedJobs(items);
//         },
//         () => {}
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

//   const ongoingContracts = useMemo(() => contracts.filter((c) => isEscrowContract(c)), [contracts]);
//   const finishedContracts = useMemo(() => contracts.filter((c) => isFinishedContract(c)), [contracts]);

//   const visibleContracts = view === "all" ? contracts : view === "ongoing" ? ongoingContracts : finishedContracts;
//   const selectedContract = contracts.find((c) => c.id === selectedId) ?? visibleContracts[0];
//   const selectedSubmission = selectedSubmissionId ? submittedJobs.find((j) => j.id === selectedSubmissionId) ?? null : null;
//   const selectedSubmissionContract = selectedSubmission ? contracts.find((c) => c.id === selectedSubmission.contractId) ?? null : null;
//   const pendingChangeJob = pendingChangeJobId ? submittedJobs.find((j) => j.id === pendingChangeJobId) ?? null : null;
//   const pendingChangeContract = pendingChangeJob ? contracts.find((c) => c.id === pendingChangeJob.contractId) ?? null : null;

//   const needsAttentionCount = submittedJobs.filter((j) => j.status === "pending").length;

//   useEffect(() => {
//     if (hasOpenedFromParam || loading) return;
//     const contractId = searchParams.get("contract");
//     if (!contractId) return;
//     const contract = contracts.find((item) => item.id === contractId);
//     if (!contract) return;

//     setSelectedId(contract.id);
//     setActiveTab("contracts");
//     setIsModalOpen(true);
//     setHasOpenedFromParam(true);
//   }, [contracts, hasOpenedFromParam, loading, searchParams]);

//   const handleApproveSubmission = async (jobId: string) => {
//     setApprovalErrorMessage("");
//     setPendingApprovalJobId(jobId);
//     setShowPaymentModal(true);
//   };

//   const confirmApproveWithPayment = async () => {
//     if (!pendingApprovalJobId) return;
//     const job = submittedJobs.find((j) => j.id === pendingApprovalJobId);
//     const contract = job ? contracts.find((c) => c.id === job.contractId) : null;
//     if (!job || !contract) { setApprovalErrorMessage("Unable to find the contract for this submission."); return; }

//     const paymentStatus = contract.paymentStatus ?? "unfunded";
//     const fundedInstallments = contract.paymentCurrentInstallment ?? 0;
//     const totalInstallments = contract.paymentInstallments ?? 1;
//     const releasedInstallments = contract.paymentReleasedInstallments ?? 0;
//     const nextMilestoneIndex = releasedInstallments + 1;
//     const milestone = contract.milestones?.find((item: any, index) => Number(item.index ?? index + 1) === nextMilestoneIndex);
//     const totalAmount = contract.paymentTotalAmountSats || parseSats(contract.budget) || 0;
//     const milestoneAmount = Number((milestone as any)?.freelancerAmountSats ?? calculateInstallmentAmount(totalAmount, totalInstallments, nextMilestoneIndex));
//     const milestoneFundedSats = milestone ? Number((milestone as any).fundedSats ?? 0) : milestoneAmount;
//     const milestoneReleasedSats = milestone ? Number((milestone as any).releasedSats ?? 0) : 0;
//     const remainingMilestoneEscrow = Math.max(0, milestoneFundedSats - milestoneReleasedSats);
//     const canRelease =
//       fundedInstallments >= nextMilestoneIndex &&
//       (paymentStatus === "funded" || paymentStatus === "released") &&
//       remainingMilestoneEscrow >= milestoneAmount;

//     if (!canRelease) {
//       const shortfall = Math.max(0, milestoneAmount - remainingMilestoneEscrow);
//       setApprovalErrorMessage(
//         shortfall > 0
//           ? `You need to fund ${shortfall.toLocaleString()} sats more in escrow before approving this milestone.`
//           : "This milestone is not funded yet. Fund escrow before approving work."
//       );
//       return;
//     }

//     const lightningAddress = freelancerData?.settings?.payment?.lightningAddress;
//     if (!lightningAddress) {
//       setApprovalErrorMessage("Freelancer has not set up a Lightning address. Payment cannot be processed.");
//       return;
//     }

//     try {
//       if (milestoneAmount <= 0) { setApprovalErrorMessage("Unable to calculate milestone amount."); return; }

//       const paymentResponse = await fetch("/api/send-payment", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           lightningAddress,
//           amount: milestoneAmount,
//           memo: `Milestone ${nextMilestoneIndex} payment for contract: ${contract.title}`,
//         }),
//       });

//       const rawPaymentResponse = await paymentResponse.text();
//       let paymentData: any = null;
//       try { paymentData = rawPaymentResponse ? JSON.parse(rawPaymentResponse) : null; } catch { throw new Error(`Failed to parse payment response: ${rawPaymentResponse}`); }
//       if (!paymentResponse.ok) throw new Error(paymentData?.error ?? `Failed to send payment to freelancer: ${rawPaymentResponse}`);

//       await updateDoc(doc(firebaseDb, "submitted_jobs", pendingApprovalJobId), { status: "approved", updatedAt: serverTimestamp() });

//       const nextReleasedCount = releasedInstallments + 1;
//       const isFinalRelease = nextReleasedCount >= totalInstallments;
//       const updatedMilestones = (contract.milestones ?? []).map((item, index) => {
//         const itemIndex = Number(item.index ?? index + 1);
//         if (itemIndex !== nextMilestoneIndex) return item;
//         return { ...item, releasedSats: Number(item.releasedSats ?? 0) + milestoneAmount, status: "released", releasedAt: new Date().toISOString() };
//       });
//       const contractUpdate = {
//         workStatus: isFinalRelease ? "approved" : "in_progress",
//         paymentReleasedInstallments: nextReleasedCount,
//         escrowReleasedSats: (contract.escrowReleasedSats ?? 0) + milestoneAmount,
//         milestones: updatedMilestones,
//         paymentStatus: isFinalRelease ? "released" : "funded",
//         updatedAt: serverTimestamp(),
//       };

//       await setDoc(doc(firebaseDb, "contracts", job.contractId), contractUpdate, { merge: true });
//       await setDoc(doc(firebaseDb, "escrows", job.contractId), {
//         totalReleasedToFreelancerSats: contractUpdate.escrowReleasedSats,
//         releasedMilestoneCount: nextReleasedCount,
//         milestones: updatedMilestones,
//         status: isFinalRelease ? "released" : "funded",
//         updatedAt: serverTimestamp(),
//       }, { merge: true });

//       try {
//         const conversationDoc = await getConversationForContract(contract);
//         const approvalMessage = `Milestone ${nextMilestoneIndex}${milestone?.title || milestone?.name ? `: ${milestone?.title || milestone?.name}` : ""} approved and payment of ${milestoneAmount} sats sent to freelancer.`;
//         if (conversationDoc) {
//           await updateDoc(conversationDoc.ref, {
//             workStatus: contractUpdate.workStatus,
//             paymentStatus: contractUpdate.paymentStatus,
//             escrowReleasedSats: contractUpdate.escrowReleasedSats,
//             milestones: updatedMilestones,
//             updatedAt: serverTimestamp(),
//             "lastMessage.text": approvalMessage,
//             "lastMessage.senderId": "system",
//             "lastMessage.createdAt": serverTimestamp(),
//             [`unread.${contract.freelancerId}`]: increment(1),
//           });
//         }
//         void sendUserNotification({
//           userId: contract.freelancerId || "",
//           title: "Milestone approved",
//           body: approvalMessage,
//           url: "/freelancer/dashboard/contracts",
//           tag: `approval-${contract.id}-${nextMilestoneIndex}`,
//         }).catch(console.error);
//       } catch (e) { console.error("Error updating conversation payment status:", e); }

//       setShowPaymentModal(false);
//       setPendingApprovalJobId(null);
//       setApprovalErrorMessage("");
//     } catch (error) {
//       console.error("Error approving submission:", error);
//       setApprovalErrorMessage(error instanceof Error ? error.message : "Failed to approve the submission and send payment. Please try again.");
//     }
//   };

//   const openChangeRequest = (jobId: string) => {
//     const job = submittedJobs.find((item) => item.id === jobId);
//     const contract = job ? contracts.find((item) => item.id === job.contractId) : null;
//     setPendingChangeJobId(jobId);
//     setChangeRequestNote(job?.revisionMessage || contract?.revisionMessage || "");
//     setChangeRequestError("");
//   };

//   const handleRejectSubmission = async () => {
//     if (!pendingChangeJobId) return;
//     const note = changeRequestNote.trim();
//     if (!note) { setChangeRequestError("Write a short note so the freelancer knows what to adjust."); return; }
//     const job = submittedJobs.find((item) => item.id === pendingChangeJobId);
//     const contract = job ? contracts.find((item) => item.id === job.contractId) : null;
//     if (!job || !contract) { setChangeRequestError("Unable to find this submitted work."); return; }
//     setIsRequestingChanges(true);
//     setChangeRequestError("");
//     try {
//       const nextMilestoneIndex = (contract.paymentReleasedInstallments ?? 0) + 1;
//       const updatedMilestones = (contract.milestones ?? []).map((item: any, index) => {
//         const itemIndex = Number(item.index ?? index + 1);
//         if (itemIndex !== nextMilestoneIndex) return item;
//         return { ...item, status: "funded", revisionMessage: note, changesRequestedAt: new Date().toISOString() };
//       });
//       const messageText = `Work returned for adjustments on "${contract.title}". Note: ${note}`;
//       const conversationId = contract.jobId && contract.freelancerId ? createConversationId(contract.jobId, contract.freelancerId) : contract.id;

//       await Promise.all([
//         updateDoc(doc(firebaseDb, "submitted_jobs", pendingChangeJobId), { status: "rejected", revisionMessage: note, reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() }),
//         setDoc(doc(firebaseDb, "contracts", job.contractId), { workStatus: "changes_requested", revisionMessage: note, milestones: updatedMilestones, unreadByFreelancer: true, updatedAt: serverTimestamp() }, { merge: true }),
//         setDoc(doc(firebaseDb, "conversations", conversationId), { workStatus: "changes_requested", revisionMessage: note, milestones: updatedMilestones, "lastMessage.text": messageText, "lastMessage.senderId": "system", "lastMessage.createdAt": serverTimestamp(), [`unread.${contract.freelancerId}`]: increment(1), updatedAt: serverTimestamp() }, { merge: true }),
//         addDoc(collection(firebaseDb, "conversations", conversationId, "messages"), { senderId: "system", senderRole: "system", text: messageText, messageType: "changes_requested", createdAt: serverTimestamp() }),
//       ]);
//       void sendUserNotification({
//         userId: contract.freelancerId || "",
//         title: "Changes requested",
//         body: messageText,
//         url: "/freelancer/dashboard/contracts",
//         tag: `changes-${contract.id}-${nextMilestoneIndex}`,
//       }).catch(console.error);

//       setPendingChangeJobId(null);
//       setChangeRequestNote("");
//       setSelectedSubmissionId(pendingChangeJobId);
//     } catch (error) {
//       console.error("Error rejecting submission:", error);
//       setChangeRequestError("Unable to send the adjustment request. Please try again.");
//     } finally {
//       setIsRequestingChanges(false);
//     }
//   };

//   useEffect(() => {
//     const fetchFreelancerPaymentData = async () => {
//       if (!pendingApprovalJobId) { setFreelancerData(null); setLoadingFreelancer(false); return; }
//       const job = submittedJobs.find((j) => j.id === pendingApprovalJobId);
//       const contract = job ? contracts.find((c) => c.id === job.contractId) : null;
//       let freelancerId = contract?.freelancerId;
//       if (!freelancerId && contract?.id) {
//         try {
//           const contractSnap = await getDoc(doc(firebaseDb, "contracts", contract.id));
//           if (contractSnap.exists()) freelancerId = (contractSnap.data() as any).freelancerId;
//         } catch (e) { console.error("Error loading contract data for freelancer id fallback:", e); }
//       }
//       if (!freelancerId) { setFreelancerData(null); setLoadingFreelancer(false); return; }
//       setLoadingFreelancer(true);
//       try {
//         const snap = await getDoc(doc(firebaseDb, "freelancers", freelancerId));
//         if (snap.exists()) {
//           setFreelancerData(snap.data());
//         } else {
//           const q = query(collection(firebaseDb, "freelancers"), where("uid", "==", freelancerId), limit(1));
//           const qSnap = await getDocs(q);
//           setFreelancerData(qSnap.empty ? null : qSnap.docs[0].data());
//         }
//       } catch (e) { console.error("Error loading freelancer payment data:", e); setFreelancerData(null); }
//       finally { setLoadingFreelancer(false); }
//     };
//     fetchFreelancerPaymentData();
//   }, [pendingApprovalJobId, submittedJobs, contracts]);

//   // ─── Derived initials helper ───────────────────────────────────────
//   const getInitials = (name: string) =>
//     (name ?? "F").split(" ").filter(Boolean).slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join("");

//   return (
//     <section className="w-full">
//       <div className="rounded-[8px] border border-[#EAE7E2] bg-white px-4 py-4 shadow-[0_8px_18px_rgba(26,26,26,0.08)] sm:px-5">
//         <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8C4F00]">
//           Contracts
//         </div>
//         <h1 className="mt-2 text-[20px] font-black tracking-[-0.02em] text-[#1a1a1a]">
//           Your Contract Tab
//         </h1>
//         <p className="mt-2 text-[12px] leading-[1.7] text-[#4d4741]">
//           Track your active, submitted, and finished works
//         </p>
//       </div>

//       {/* ── TABS ── */}
//       <div className="mt-9 rounded-[8px] border border-[#EAE7E2] bg-[#FCF9F7] px-4 py-4 shadow-[0_8px_18px_rgba(26,26,26,0.06)] sm:px-5">
//         <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
//           <div>
//             <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8C4F00]">
//               Filters
//             </div>
//             <p className="mt-1 text-[12px] text-[#4d4741]">View by contract status.</p>
//           </div>
//           <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
//         {[
//           { id: "all",       label: "All",            count: contracts.length },
//           { id: "ongoing",   label: "Active",          count: ongoingContracts.length },
//           { id: "submitted", label: "Submitted",       count: submittedJobs.length, alert: needsAttentionCount > 0 },
//           { id: "finished",  label: "Finished",        count: finishedContracts.length },
//         ].map((tab) => (
//           <button
//             key={tab.id}
//             type="button"
//             onClick={() => {
//               if (tab.id === "submitted") {
//                 setActiveTab("submitted");
//               } else {
//                 setActiveTab("contracts");
//                 setView(tab.id as "all" | "ongoing" | "finished");
//               }
//             }}
//             className={`inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.02em] transition whitespace-nowrap ${
//               (tab.id === "submitted" ? activeTab === "submitted" : activeTab === "contracts" && view === tab.id)
//                 ? "border-[#8C4F00] bg-white text-[#8C4F00] shadow-sm"
//                 : "border-[#D8D2CC] bg-white text-[#1a1a1a] hover:border-[#8C4F00]"
//             }`}
//           >
//             <span className="inline-flex items-center gap-1.5">
//               {tab.label}
//               {tab.count > 0 ? (
//                 <span className="rounded-full bg-[#F5F3EF] px-1.5 py-0.5 text-[9px] font-bold text-[#8f8780]">
//                   {tab.count}
//                 </span>
//               ) : null}

              
//               {tab.alert && (
//                 <span className="inline-flex h-2 w-2 rounded-full bg-[#F7931A]" />
//               )}
//             </span>
//           </button>
//         ))}
//           </div>
//         </div>

//       {/* ── CONTRACTS GRID ── */}
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
//                 const statusLabel = isFinishedContract(contract) ? "Finished" : isEscrowContract(contract) ? "In Progress" : "Active";
//                 const statusColor =
//                   statusLabel === "Finished" ? "bg-[#E6F4EA] text-[#2E7D32]"
//                   : statusLabel === "In Progress" ? "bg-[#E6F4EA] text-[#2E7D32]"
//                   : "bg-[#FFF4E6] text-[#8C4F00]";

//                 const amountSats = contract.paymentTotalAmountSats ?? 0;
//                 const amountLabel = amountSats > 0 ? `${amountSats.toLocaleString()} sats` : contract.budget ?? "—";
//                 const freelancerInitials = getInitials(contract.freelancer ?? "F");
//                 const stepIndex = isFinishedContract(contract)
//                   ? 4
//                   : contract.workStatus === "submitted"
//                     ? 3
//                     : isEscrowContract(contract) || contract.workStatus === "in_progress"
//                       ? 2
//                       : 1;
//                 const steps = ["Contract Accepted", "Work in Progress", "Submitted", "Approved"];
//                 const infoText = isFinishedContract(contract)
//                   ? "Contract approved. Payment has been released."
//                   : contract.workStatus === "submitted"
//                     ? "Work submitted for review. Open the contract to approve or request changes."
//                     : contract.workStatus === "changes_requested"
//                       ? "Changes requested. Waiting for the freelancer to resubmit."
//                       : "Work in progress. The freelancer can upload the deliverable when ready.";

//                 return (
//                   <div
//                     key={contract.id}
//                     className="flex flex-col rounded-[14px] border border-[#EAE7E2] bg-white p-4 shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition hover:shadow-[0_6px_20px_rgba(0,0,0,0.09)]"
//                   >
//                     <div className="flex items-start gap-3">
//                       <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#DDD8D0] bg-[#1a2332]">
//                         <span className="text-[11px] font-black text-white">{freelancerInitials}</span>
//                       </div>
//                       <div className="flex-1 min-w-0">
//                         <h3 className="text-[15px] font-black leading-tight text-[#1a1a1a] truncate">
//                           {contract.title}
//                         </h3>
//                         <p className="mt-1 truncate text-[11px] text-[#777]">
//                           Freelancer: <span className="font-semibold text-[#555]">{contract.freelancer}</span>
//                         </p>
//                       </div>
//                       <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${statusColor}`}>
//                         {statusLabel}
//                       </span>
//                     </div>

//                     <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-[#6b6762]">
//                       <span>Due: <strong className="text-[#F7931A]">{contract.dueDate}</strong></span>
//                       <span>Budget: <strong className="text-[#1a1a1a]">{amountLabel}</strong></span>
//                     </div>

//                     <div className="mt-4">
//                       <p className="text-[11px] font-bold text-[#555]">Progress</p>
//                       <div className="mt-2 grid grid-cols-4">
//                         {steps.map((step, index) => {
//                           const number = index + 1;
//                           const isComplete = number < stepIndex;
//                           const isActive = number === stepIndex;
//                           const isReached = number <= stepIndex;
//                           return (
//                             <div key={step} className="relative flex flex-col items-center text-center">
//                               {index > 0 && (
//                                 <span className={`absolute left-[-50%] right-[50%] top-[10px] h-[2px] ${number <= stepIndex ? "bg-[#F7931A]" : "bg-[#DDD8D0]"}`} />
//                               )}
//                               <span className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-black ${
//                                 isReached ? "border-[#F7931A] bg-[#F7931A] text-white" : "border-[#BBB5AE] bg-white text-[#777]"
//                               }`}>
//                                 {isComplete ? "✓" : number}
//                               </span>
//                               <span className={`mt-1.5 max-w-[72px] text-[10px] leading-tight ${isActive ? "font-black text-[#8C4F00]" : "font-semibold text-[#555]"}`}>
//                                 {step}
//                               </span>
//                             </div>
//                           );
//                         })}
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
//                         View Details
//                       </button>
//                       <button
//                         type="button"
//                         onClick={() => {
//                           if (!contract.jobId || !contract.freelancerId) return;
//                           const conversationId = createConversationId(contract.jobId, contract.freelancerId);
//                           router.push(`/client/dashboard/messages?chat=${conversationId}`);
//                         }}
//                         className="rounded-[10px] border border-[#1a2332] bg-[#1a2332] px-2 py-3 text-[11px] font-black leading-tight text-white transition hover:bg-[#E9850F] sm:text-[12px]"
//                       >
//                         Message Freelancer
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

//       {/* ── SUBMITTED JOBS GRID ── */}
//       {activeTab === "submitted" && (
//         <div className="mt-5">
//           {submittedJobs.length ? (
//             <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
//               {submittedJobs.map((job) => {
//                 const contract = contracts.find((c) => c.id === job.contractId);
//                 const statusLabel =
//                   job.status === "approved" ? "Approved"
//                   : job.status === "rejected" ? "Changes Requested"
//                   : "Pending Review";
//                 const statusColor =
//                   job.status === "approved" ? "bg-[#E6F4EA] text-[#2E7D32]"
//                   : job.status === "rejected" ? "bg-[#FFF5F5] text-[#B91C1C]"
//                   : "bg-[#FFF4E6] text-[#8C4F00]";

//                 return (
//                   <div key={job.id} className="flex flex-col rounded-[14px] border border-[#EAE7E2] bg-white p-4 shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition hover:shadow-[0_6px_20px_rgba(0,0,0,0.09)]">
//                     {/* Card header */}
//                     <div className="flex items-start gap-3">
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

//                     {/* Actions */}
//                     <div className="mt-4 flex flex-col gap-2">
//                       <button
//                         type="button"
//                         onClick={() => setSelectedSubmissionId(job.id)}
//                         className="w-full rounded-[10px] bg-[#1a2332] py-3 text-[12px] font-black uppercase tracking-[0.1em] text-white transition hover:opacity-90"
//                       >
//                         View Details
//                       </button>
//                       {job.status === "pending" && (
//                         <div className="grid grid-cols-2 gap-2">
//                           <button
//                             type="button"
//                             onClick={() => handleApproveSubmission(job.id)}
//                             className="rounded-[10px] bg-[#E6F4EA] py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#2E7D32] transition hover:bg-[#D1EBD7]"
//                           >
//                             Approve & Pay
//                           </button>
//                           <button
//                             type="button"
//                             onClick={() => openChangeRequest(job.id)}
//                             className="rounded-[10px] bg-[#FFF5F5] py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#B91C1C] transition hover:bg-[#FEE2E2]"
//                           >
//                             Request Changes
//                           </button>
//                         </div>
//                       )}
//                       {job.status === "rejected" && (
//                         <button
//                           type="button"
//                           onClick={() => openChangeRequest(job.id)}
//                           className="w-full rounded-[10px] bg-[#FFF4E6] py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#8C4F00] transition hover:bg-[#FDE8C8]"
//                         >
//                           Edit Adjustment Note
//                         </button>
//                       )}
//                     </div>
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

//       {/* ── SUBMISSION DETAIL MODAL ── */}
//       </div>

//       {selectedSubmission && (
//         <div className="fixed inset-0 z-[95] flex items-end justify-center px-2 py-2 sm:items-center sm:px-4 sm:py-4">
//           <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedSubmissionId(null)} />
//           <div className="relative z-[96] max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)]">

//             {/* Header */}
//             <div className="px-5 pt-5 pb-4 border-b border-[#F0EDE8]">
//               <button type="button" onClick={() => setSelectedSubmissionId(null)} aria-label="Close" className="absolute right-4 top-4 text-[#999] hover:text-[#1a1a1a] transition-colors text-[18px] font-light">✕</button>
//               <div className="flex items-center gap-2 mb-2">
//                 <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${
//                   selectedSubmission.status === "approved" ? "bg-[#E6F4EA] text-[#2E7D32]"
//                   : selectedSubmission.status === "rejected" ? "bg-[#FFF5F5] text-[#B91C1C]"
//                   : "bg-[#FFF4E6] text-[#8C4F00]"
//                 }`}>
//                   {selectedSubmission.status === "approved" ? "Approved" : selectedSubmission.status === "rejected" ? "Changes Requested" : "Pending Review"}
//                 </span>
//                 <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#999]">SUBMITTED WORK</span>
//               </div>
//               <h2 className="text-[20px] font-black text-[#1a1a1a] leading-tight">
//                 {selectedSubmissionContract?.title || "Contract Submission"}
//               </h2>
//               {selectedSubmission.milestoneIndex && (
//                 <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#FFF4E6] border border-[#F7931A30] px-2.5 py-0.5">
//                   <span className="text-[10px] font-bold text-[#8C4F00]">
//                     Milestone {selectedSubmission.milestoneIndex}{selectedSubmission.milestoneTitle ? `: ${selectedSubmission.milestoneTitle}` : ""}
//                   </span>
//                 </div>
//               )}
//               <p className="mt-1.5 text-[11px] text-[#999]">Submitted {selectedSubmission.submittedAt.toLocaleDateString()}</p>
//             </div>

//             {/* Submission content */}
//             <div className="px-5 py-4 border-b border-[#F0EDE8]">
//               <div className="rounded-[12px] bg-[#F5F3EF] px-4 py-3">
//                 <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#999] mb-2">Freelancer's Submission</p>
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

//             {/* Adjustment note if rejected */}
//             {selectedSubmission.status === "rejected" && selectedSubmission.revisionMessage && (
//               <div className="px-5 py-4 border-b border-[#F0EDE8]">
//                 <div className="rounded-[12px] border border-[#FCA5A5] bg-[#FFF5F5] px-4 py-3">
//                   <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#B91C1C] mb-2">Your Adjustment Note</p>
//                   <p className="text-[13px] text-[#7F1D1D] leading-[1.6]">{selectedSubmission.revisionMessage}</p>
//                 </div>
//               </div>
//             )}

//             {/* Footer actions */}
//             <div className="px-5 pb-5 pt-4 flex flex-col gap-2">
//               {selectedSubmission.status === "pending" && (
//                 <>
//                   <div className="grid grid-cols-2 gap-2">
//                     <button
//                       type="button"
//                       onClick={() => { handleApproveSubmission(selectedSubmission.id); setSelectedSubmissionId(null); }}
//                       className="rounded-[10px] bg-[#E6F4EA] py-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#2E7D32] transition hover:bg-[#D1EBD7]"
//                     >
//                       Approve & Pay
//                     </button>
//                     <button
//                       type="button"
//                       onClick={() => { openChangeRequest(selectedSubmission.id); setSelectedSubmissionId(null); }}
//                       className="rounded-[10px] bg-[#FFF5F5] py-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#B91C1C] transition hover:bg-[#FEE2E2]"
//                     >
//                       Request Changes
//                     </button>
//                   </div>
//                   {selectedSubmissionContract && (
//                     <button
//                       type="button"
//                       onClick={() => { setSelectedId(selectedSubmissionContract.id); setActiveTab("contracts"); setIsModalOpen(true); setSelectedSubmissionId(null); }}
//                       className="w-full rounded-[10px] bg-[#1a2332] py-3 text-[11px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#0f1a26]"
//                     >
//                       View Contract
//                     </button>
//                   )}
//                 </>
//               )}
//               {selectedSubmission.status === "rejected" && (
//                 <div className="flex gap-2">
//                   <Button size="sm" variant="outline" className="flex-1 rounded-[10px]" onClick={() => { openChangeRequest(selectedSubmission.id); setSelectedSubmissionId(null); }}>
//                     Edit Adjustment Note
//                   </Button>
//                   {selectedSubmissionContract && (
//                     <Button size="sm" className="flex-1 rounded-[10px] bg-[#1a2332] border-[#1a2332] text-white hover:bg-[#0f1a26]" onClick={() => { setSelectedId(selectedSubmissionContract.id); setActiveTab("contracts"); setIsModalOpen(true); setSelectedSubmissionId(null); }}>
//                       View Contract
//                     </Button>
//                   )}
//                 </div>
//               )}
//               {selectedSubmission.status === "approved" && selectedSubmissionContract && (
//                 <button
//                   type="button"
//                   onClick={() => { setSelectedId(selectedSubmissionContract.id); setActiveTab("contracts"); setIsModalOpen(true); setSelectedSubmissionId(null); }}
//                   className="w-full rounded-[10px] bg-[#1a2332] py-3 text-[11px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#0f1a26]"
//                 >
//                   View Contract
//                 </button>
//               )}
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── REQUEST CHANGES MODAL ── */}
//       {pendingChangeJob && (
//         <div className="fixed inset-0 z-[105] flex items-end justify-center px-2 py-2 sm:items-center sm:px-4 sm:py-4">
//           <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!isRequestingChanges) setPendingChangeJobId(null); }} />
//           <div className="relative z-[106] max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)]">

//             <div className="px-5 pt-5 pb-4 border-b border-[#F0EDE8]">
//               <button type="button" onClick={() => setPendingChangeJobId(null)} aria-label="Close" disabled={isRequestingChanges} className="absolute right-4 top-4 text-[#999] hover:text-[#1a1a1a] transition-colors text-[18px] font-light">✕</button>
//               <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8C4F00]">Request Adjustments</span>
//               <h2 className="mt-1 text-[20px] font-black text-[#1a1a1a] leading-tight">
//                 {pendingChangeContract?.title || "Submitted Work"}
//               </h2>
//               <p className="mt-1.5 text-[12px] text-[#6b6762]">
//                 Tell the freelancer exactly what needs to change. This note will appear in their contracts page and in the chat.
//               </p>
//             </div>

//             <div className="px-5 py-4">
//               <textarea
//                 value={changeRequestNote}
//                 onChange={(e) => setChangeRequestNote(e.target.value)}
//                 rows={5}
//                 placeholder="Example: Please adjust the homepage spacing and add the missing mobile menu before resubmitting."
//                 className="w-full rounded-[10px] border border-[#EAE7E2] bg-[#FAF8F5] px-3 py-2.5 text-[13px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20"
//               />
//               {changeRequestError && (
//                 <p className="mt-3 rounded-[10px] border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-700">
//                   {changeRequestError}
//                 </p>
//               )}
//             </div>

//             <div className="px-5 pb-5 pt-2 flex items-center gap-3">
//               <Button size="sm" variant="outline" className="flex-1 rounded-[10px]" onClick={() => setPendingChangeJobId(null)} disabled={isRequestingChanges}>
//                 Cancel
//               </Button>
//               <button
//                 type="button"
//                 onClick={() => void handleRejectSubmission()}
//                 disabled={isRequestingChanges}
//                 className="flex-1 rounded-[10px] bg-gradient-to-r from-orange-600 to-orange-400 py-3 text-[12px] font-black uppercase tracking-[0.1em] text-white transition hover:opacity-90 disabled:opacity-50"
//               >
//                 {isRequestingChanges ? "Sending..." : pendingChangeJob.status === "rejected" ? "Update Note" : "Send Request"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── CONTRACT DETAIL MODAL ── */}
//       {isModalOpen && selectedContract && (
//         <div className="fixed inset-0 z-[80] flex items-end justify-center px-2 py-2 sm:items-center sm:px-5 sm:py-5">
//           <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
//           <div className="relative z-[81] max-h-[92vh] w-full overflow-y-auto rounded-[20px] border border-[#EAE7E2] bg-[#FFFCF8] shadow-[0_24px_70px_rgba(26,26,26,0.24)] md:max-w-3xl lg:max-w-5xl">

//             {/* Modal Header */}
//             <div className="border-b border-[#F0EDE8] bg-white px-5 pb-4 pt-5 sm:px-6 lg:px-7">
//               <button type="button" onClick={() => setIsModalOpen(false)} aria-label="Close" className="absolute right-4 top-4 text-[#999] hover:text-[#1a1a1a] transition-colors text-[18px] font-light">✕</button>
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
//               <h2 className="max-w-[760px] text-[22px] font-black leading-tight text-[#1a1a1a] sm:text-[24px]">{selectedContract.title}</h2>
//               <div className="flex items-center gap-2 mt-1.5">
//                 <div className="h-6 w-6 rounded-full bg-[#1a2332] flex items-center justify-center overflow-hidden flex-shrink-0">
//                   <span className="text-[8px] font-black text-white">{getInitials(selectedContract.freelancer ?? "F")}</span>
//                 </div>
//                 <span className="text-[13px] text-[#555]">Freelancer: <strong>{selectedContract.freelancer}</strong></span>
//               </div>
//             </div>

//             {/* Value + Escrow */}
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
//                     {selectedContract.paymentStatus === "funded" ? "Funds Secured"
//                     : selectedContract.paymentStatus === "released" ? "Released"
//                     : selectedContract.paymentStatus === "invoice_created" ? "Invoice Sent"
//                     : "Not Funded"}
//                   </span>
//                 </div>
//               </div>
//             </div>

//             {/* Contract Overview */}
//             <div className="border-b border-[#F0EDE8] px-5 py-4 sm:px-6 lg:px-7">
//               <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8C4F00] mb-3">Contract Overview</p>
//               <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
//                 {[
//                   { label: "Contract Type", value: selectedContract.contractType ?? "Fixed Price" },
//                   { label: "Work Status", value: selectedContract.workStatus?.replace(/_/g, " ") ?? "Not started" },
//                   { label: "Start Date", value: selectedContract.startDate },
//                   { label: "Due Date", value: selectedContract.dueDate },
//                   { label: "Progress", value: `${selectedContract.progress}%` },
//                   { label: "Next Milestone", value: selectedContract.nextMilestone },
//                 ].map(({ label, value }) => (
//                   <div key={label} className="rounded-[10px] border border-[#EFECE7] bg-white px-3 py-2 shadow-[0_4px_14px_rgba(0,0,0,0.025)]">
//                     <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#999]">{label}</div>
//                     <div className="mt-0.5 font-semibold text-[#1a1a1a] capitalize truncate">{value}</div>
//                   </div>
//                 ))}
//               </div>
//             </div>

//             {/* Description */}
//             {selectedContract.description && selectedContract.description !== "-" && (
//               <div className="border-b border-[#F0EDE8] px-5 py-4 sm:px-6 lg:px-7">
//                 <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8C4F00] mb-2">Description</p>
//                 <p className="text-[12px] text-[#6b6762] leading-[1.7]">{selectedContract.description}</p>
//               </div>
//             )}

//             {/* Scope of Work */}
//             {selectedContract.scopeItems && selectedContract.scopeItems.length > 0 && (
//               <div className="border-b border-[#F0EDE8] px-5 py-4 sm:px-6 lg:px-7">
//                 <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8C4F00] mb-3">Scope of Work</p>
//                 <ul className="space-y-1.5">
//                   {selectedContract.scopeItems.map((item) => (
//                     <li key={item} className="flex items-start gap-2 text-[12px] text-[#555]">
//                       <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#F7931A]" />
//                       <span>{item}</span>
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//             )}

//             {/* Milestones timeline */}
//             {selectedContract.milestones && selectedContract.milestones.length > 0 && (
//               <div className="border-b border-[#F0EDE8] px-5 py-4 sm:px-6 lg:px-7">
//                 <h3 className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8C4F00] mb-3">Milestones</h3>
//                 <div className="relative">
//                   <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-[#EAE7E2]" />
//                   <div className="space-y-4">
//                     {selectedContract.milestones.map((ms, i) => {
//                       const isReleased = ms.status === "released";
//                       const isCurrent = !isReleased && i === (selectedContract.paymentReleasedInstallments ?? 0);
//                       const msAmount = ms.freelancerAmountSats ? `${ms.freelancerAmountSats.toLocaleString()} sats` : ms.amount ?? "—";
//                       const msStatusLabel = isReleased ? "Paid" : ms.status === "funded" || ms.status === "submitted" ? "Pending" : "Scheduled";
//                       const msStatusColor = isReleased ? "bg-[#EFF6FF] text-[#1D4ED8]" : ms.status === "funded" || ms.status === "submitted" ? "bg-[#FFF4E6] text-[#F7931A]" : "bg-[#F5F3EF] text-[#999]";
//                       return (
//                         <div key={i} className="flex items-start gap-4 pl-6 relative">
//                           <div className={`absolute left-0 top-1 h-4 w-4 rounded-full border-2 flex items-center justify-center ${isReleased ? "border-[#1D4ED8] bg-[#1D4ED8]" : isCurrent ? "border-[#F7931A] bg-[#F7931A]" : "border-[#DDD8D0] bg-white"}`}>
//                             {isReleased && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
//                           </div>
//                           <div className="flex-1 flex items-start justify-between gap-2">
//                             <div>
//                               <p className={`text-[13px] font-bold ${isReleased ? "text-[#555]" : "text-[#1a1a1a]"}`}>{ms.title || ms.name || `Milestone ${i + 1}`}</p>
//                               {ms.deadline && <p className="text-[11px] text-[#999] mt-0.5">{isReleased ? "Completed on" : "Due"} {ms.deadline}</p>}
//                             </div>
//                             <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${msStatusColor}`}>
//                               {msAmount} · {msStatusLabel}
//                             </span>
//                           </div>
//                         </div>
//                       );
//                     })}
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* Payment Details */}
//             <div className="border-b border-[#F0EDE8] px-5 py-4 sm:px-6 lg:px-7">
//               <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8C4F00] mb-3">Payment Details</p>
//               {(() => {
//                 const jobAmount = selectedContract.paymentTotalAmountSats || parseSats(selectedContract.budget) || 0;
//                 const platformFee = selectedContract.platformFeeSats || Math.ceil(jobAmount * ((selectedContract.platformFeePercent ?? 5) / 100));
//                 const clientTotal = selectedContract.paymentTotalChargedSats || jobAmount + platformFee;
//                 const released = selectedContract.escrowReleasedSats ?? 0;
//                 const funded = selectedContract.escrowFundedTotalSats ?? 0;
//                 const remainingFunded = Math.max(0, funded - platformFee - released);
//                 return (
//                   <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
//                     {[
//                       { label: "Total Value", value: `${jobAmount.toLocaleString()} sats` },
//                       { label: "Client Pays (w/ Fee)", value: `${clientTotal.toLocaleString()} sats` },
//                       { label: "Funded Escrow", value: `${funded.toLocaleString()} sats` },
//                       { label: "Available to Release", value: `${remainingFunded.toLocaleString()} sats` },
//                       { label: "Platform Fee (5%)", value: `${platformFee.toLocaleString()} sats` },
//                       { label: "Released", value: `${released.toLocaleString()} sats` },
//                     ].map(({ label, value }) => (
//                       <div key={label} className="rounded-[10px] border border-[#EFECE7] bg-white px-3 py-2 shadow-[0_4px_14px_rgba(0,0,0,0.025)]">
//                         <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#999]">{label}</div>
//                         <div className="mt-0.5 font-semibold text-[#1a1a1a]">{value}</div>
//                       </div>
//                     ))}
//                   </div>
//                 );
//               })()}
//               <p className="mt-3 text-[11px] text-[#9e9690]">
//                 The 5% platform fee is included in the client invoice. Freelancer payouts are released per approved milestone.
//               </p>
//             </div>

//             {/* Related Submissions */}
//             {submittedJobs.filter((j) => j.contractId === selectedContract.id).length > 0 && (
//               <div className="border-b border-[#F0EDE8] px-5 py-4 sm:px-6 lg:px-7">
//                 <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8C4F00] mb-3">Related Submissions</p>
//                 <div className="space-y-2">
//                   {submittedJobs.filter((j) => j.contractId === selectedContract.id).map((job) => (
//                     <div key={job.id} className="flex items-start justify-between gap-3 rounded-[10px] border border-[#F0ECE6] bg-[#FAF8F5] px-3 py-3">
//                       <div className="min-w-0 flex-1">
//                         <p className="text-[12px] font-semibold text-[#1a1a1a] truncate">{job.description || "Submitted work"}</p>
//                         <p className="mt-0.5 text-[11px] text-[#999]">{job.submittedAt.toLocaleDateString()}</p>
//                       </div>
//                       <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${
//                         job.status === "approved" ? "bg-[#E6F4EA] text-[#2E7D32]"
//                         : job.status === "rejected" ? "bg-[#FFF5F5] text-[#B91C1C]"
//                         : "bg-[#FFF4E6] text-[#8C4F00]"
//                       }`}>
//                         {job.status === "rejected" ? "Changes Req." : job.status}
//                       </span>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             )}

//             {/* Footer */}
//             <div className="flex items-center gap-3 bg-white px-5 pb-5 pt-4 sm:px-6 lg:px-7">
//               <button
//                 type="button"
//                 onClick={async () => {
//                   if (!selectedContract?.jobId || !selectedContract?.freelancerId) return;
//                   const conversationId = createConversationId(selectedContract.jobId, selectedContract.freelancerId);
//                   router.push(`/client/dashboard/messages?chat=${conversationId}`);
//                 }}
//                 className="flex-1 flex items-center justify-center gap-1.5 rounded-[10px] border border-[#1a2332] bg-[#1a2332] py-3 text-[12px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#1a2332]"
//               >
//                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
//                 Message Freelancer
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── PAYMENT CONFIRMATION MODAL ── */}
//       {showPaymentModal && pendingApprovalJobId && (
//         <div className="fixed inset-0 z-[100] flex items-end justify-center px-2 py-2 sm:items-center sm:px-4 sm:py-4">
//           <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
//           <div className="relative z-[101] max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)]">

//             <div className="px-5 pt-5 pb-4 border-b border-[#F0EDE8]">
//               <button
//                 type="button"
//                 onClick={() => { setShowPaymentModal(false); setPendingApprovalJobId(null); setApprovalErrorMessage(""); }}
//                 aria-label="Close"
//                 className="absolute right-4 top-4 text-[#999] hover:text-[#1a1a1a] transition-colors text-[18px] font-light"
//               >✕</button>
//               <div className="flex items-center gap-2 mb-2">
//                 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E6F4EA]">
//                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
//                 </div>
//                 <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#999]">Confirm Payment</span>
//               </div>
//               <h2 className="text-[20px] font-black text-[#1a1a1a] leading-tight">Approve & Release Funds</h2>
//               <p className="mt-1.5 text-[12px] text-[#6b6762]">Approving this work will trigger a milestone payment to the freelancer's Lightning wallet.</p>
//             </div>

//             {(() => {
//               const job = submittedJobs.find((j) => j.id === pendingApprovalJobId);
//               const contract = job ? contracts.find((c) => c.id === job.contractId) : null;
//               const lightningAddress = freelancerData?.settings?.payment?.lightningAddress;
//               const releasedInstallments = contract?.paymentReleasedInstallments ?? 0;
//               const nextMilestoneIndex = releasedInstallments + 1;
//               const milestone = contract?.milestones?.find((item: any, index) => Number(item.index ?? index + 1) === nextMilestoneIndex);
//               const milestoneAmountSats = Number((milestone as any)?.freelancerAmountSats ?? calculateInstallmentAmount(contract?.paymentTotalAmountSats || parseSats(contract?.budget ?? "0"), contract?.paymentInstallments ?? 1, nextMilestoneIndex));
//               const milestoneLabel = milestone?.title || milestone?.name || `Milestone ${nextMilestoneIndex}`;
//               const milestoneFundedSats = milestone ? Number((milestone as any).fundedSats ?? 0) : milestoneAmountSats;
//               const milestoneReleasedSats = milestone ? Number((milestone as any).releasedSats ?? 0) : 0;
//               const isMilestoneFunded =
//                 contract &&
//                 (contract.paymentStatus === "funded" || contract.paymentStatus === "released") &&
//                 (contract.paymentCurrentInstallment ?? 0) >= nextMilestoneIndex &&
//                 milestoneFundedSats - milestoneReleasedSats >= milestoneAmountSats;
//               const canApprove = isMilestoneFunded && !loadingFreelancer;

//               return (
//                 <div className="px-5 py-4">
//                   <div className="rounded-[12px] bg-[#F5F3EF] px-4 py-3 space-y-2.5 text-[12px]">
//                     <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#999] mb-1">Payment Details</p>
//                     {[
//                       { label: "Freelancer", value: contract?.freelancer || "Unknown" },
//                       { label: milestoneLabel, value: `${milestoneAmountSats.toLocaleString()} sats` },
//                       { label: "Lightning Address", value: loadingFreelancer ? "Loading..." : (lightningAddress || "Not set") },
//                       { label: "Milestone Funded", value: isMilestoneFunded ? `Yes (Milestone ${nextMilestoneIndex})` : "No — fund escrow first" },
//                     ].map(({ label, value }) => (
//                       <div key={label} className="flex items-center justify-between gap-4">
//                         <span className="text-[#888]">{label}</span>
//                         <span className="font-semibold text-[#1a1a1a] text-right break-all">{value}</span>
//                       </div>
//                     ))}
//                   </div>

//                   {approvalErrorMessage && (
//                     <div className="mt-3 rounded-[12px] border border-[#FCA5A5] bg-[#FFF5F5] px-4 py-3 text-[12px] text-[#B91C1C]">
//                       {approvalErrorMessage}
//                     </div>
//                   )}

//                   <p className="mt-3 text-center text-[11px] text-[#9e9690]">
//                     By approving, you confirm the milestone payment will be processed to the freelancer's Lightning wallet.
//                   </p>

//                   <div className="mt-4 flex gap-3">
//                     <button
//                       type="button"
//                       onClick={() => { setShowPaymentModal(false); setPendingApprovalJobId(null); setApprovalErrorMessage(""); }}
//                       className="flex-1 rounded-[10px] border border-[#EAE7E2] bg-white py-3 text-[12px] font-black uppercase tracking-[0.08em] text-[#6b6762] transition hover:bg-[#F7F4F0]"
//                     >
//                       Cancel
//                     </button>
//                     <button
//                       type="button"
//                       onClick={confirmApproveWithPayment}
//                       disabled={!canApprove}
//                       className="flex-1 rounded-[10px] bg-gradient-to-r from-orange-600 to-orange-400 py-3 text-[12px] font-black uppercase tracking-[0.08em] text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
//                     >
//                       {canApprove ? "Approve & Pay" : "Fund Escrow First"}
//                     </button>
//                   </div>
//                 </div>
//               );
//             })()}
//           </div>
//         </div>
//       )}
//     </section>
//   );
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/atoms/Button";
import { Calendar, Search, MessageSquare, MoreVertical, ChevronRight, CheckCircle2, Clock, AlertCircle, ArrowRight, Filter, SortDesc, Shield } from "lucide-react";
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

type ContractStatus = "Active" | "Review" | "Completed";

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
  "bg-purple-600","bg-blue-600","bg-emerald-600","bg-orange-500","bg-rose-600","bg-indigo-600","bg-teal-600","bg-amber-600",
];
const getAvatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
const getInitials = (name: string) =>
  (name ?? "F").split(" ").filter(Boolean).slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join("");

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-[11px]" : size === "lg" ? "h-11 w-11 text-[14px]" : "h-9 w-9 text-[12px]";
  return (
    <div className={`flex-shrink-0 flex items-center justify-center rounded-full font-black text-white ${sizeClass} ${getAvatarColor(name)}`}>
      {getInitials(name)}
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
  const [pendingApprovalJobId, setPendingApprovalJobId] = useState<string | null>(null);
  const [approvalErrorMessage, setApprovalErrorMessage] = useState<string>("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [pendingChangeJobId, setPendingChangeJobId] = useState<string | null>(null);
  const [changeRequestNote, setChangeRequestNote] = useState("");
  const [changeRequestError, setChangeRequestError] = useState("");
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const [freelancerData, setFreelancerData] = useState<any>(null);
  const [loadingFreelancer, setLoadingFreelancer] = useState(false);

  const createConversationId = (jobId: string, freelancerId: string) => `${jobId}_${freelancerId}`;
  const freelancerNameCache = useRef<Record<string, string>>({});

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
    } catch {}
    if (!resolvedName) {
      try {
        const snap = await getDoc(doc(firebaseDb, "freelancers", freelancerId));
        if (snap.exists()) {
          const d = snap.data() as any;
          resolvedName = d.fullName || `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || d.name || resolvedName;
        }
      } catch {}
    }
    if (!resolvedName) {
      try {
        const q = query(collection(firebaseDb, "freelancers"), where("uid", "==", freelancerId), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0].data() as any;
          resolvedName = d.fullName || `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || d.name || resolvedName;
        }
      } catch {}
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
            };
          });
          (async () => {
            const hydrated = await Promise.all(items.map(async (c) => ({ ...c, freelancer: await resolveFreelancerName(c.freelancerId ?? "", c.freelancer ?? "") })));
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
            return {
              id: docSnap.id,
              contractId: data.contractId ?? "",
              description: data.description ?? "",
              link: data.link ?? "",
              attachment: data.attachment ?? null,
              submittedAt: data.submittedAt?.toDate() ?? new Date(),
              status: data.status ?? "pending",
              revisionMessage: data.revisionMessage ?? "",
              milestoneIndex: data.milestoneIndex,
              milestoneTitle: data.milestoneTitle ?? "",
            };
          });
          items.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
          setSubmittedJobs(items);
        },
        () => {}
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

  const visibleContracts = view === "all" ? contracts : view === "ongoing" ? ongoingContracts : finishedContracts;
  const selectedContract = contracts.find((c) => c.id === selectedId) ?? visibleContracts[0];
  const selectedSubmission = selectedSubmissionId ? submittedJobs.find((j) => j.id === selectedSubmissionId) ?? null : null;
  const selectedSubmissionContract = selectedSubmission ? contracts.find((c) => c.id === selectedSubmission.contractId) ?? null : null;
  const pendingChangeJob = pendingChangeJobId ? submittedJobs.find((j) => j.id === pendingChangeJobId) ?? null : null;
  const pendingChangeContract = pendingChangeJob ? contracts.find((c) => c.id === pendingChangeJob.contractId) ?? null : null;

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
    if (!pendingApprovalJobId) return;
    const job = submittedJobs.find((j) => j.id === pendingApprovalJobId);
    const contract = job ? contracts.find((c) => c.id === job.contractId) : null;
    if (!job || !contract) { setApprovalErrorMessage("Unable to find the contract for this submission."); return; }
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
    const canRelease = fundedInstallments >= nextMilestoneIndex && (paymentStatus === "funded" || paymentStatus === "released") && remainingMilestoneEscrow >= milestoneAmount;
    if (!canRelease) {
      const shortfall = Math.max(0, milestoneAmount - remainingMilestoneEscrow);
      setApprovalErrorMessage(shortfall > 0 ? `You need to fund ${shortfall.toLocaleString()} sats more in escrow before approving this milestone.` : "This milestone is not funded yet. Fund escrow before approving work.");
      return;
    }
    const lightningAddress = freelancerData?.settings?.payment?.lightningAddress;
    if (!lightningAddress) { setApprovalErrorMessage("Freelancer has not set up a Lightning address. Payment cannot be processed."); return; }
    try {
      if (milestoneAmount <= 0) { setApprovalErrorMessage("Unable to calculate milestone amount."); return; }
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
      if (!freelancerId && contract?.id) {
        try {
          const snap = await getDoc(doc(firebaseDb, "contracts", contract.id));
          if (snap.exists()) freelancerId = (snap.data() as any).freelancerId;
        } catch (e) { console.error(e); }
      }
      if (!freelancerId) { setFreelancerData(null); setLoadingFreelancer(false); return; }
      setLoadingFreelancer(true);
      try {
        const snap = await getDoc(doc(firebaseDb, "freelancers", freelancerId));
        if (snap.exists()) {
          setFreelancerData(snap.data());
        } else {
          const q = query(collection(firebaseDb, "freelancers"), where("uid", "==", freelancerId), limit(1));
          const qSnap = await getDocs(q);
          setFreelancerData(qSnap.empty ? null : qSnap.docs[0].data());
        }
      } catch (e) { console.error(e); setFreelancerData(null); }
      finally { setLoadingFreelancer(false); }
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
    { id: "submitted", label: "Needs Review", count: needsAttentionCount, alert: needsAttentionCount > 0 },
    { id: "finished", label: "Completed", count: finishedContracts.length },
  ] as const;

  return (
    <section className="w-full min-h-screen bg-gray-50">
      {/* PAGE HEADER */}
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-orange-600 mb-1">Contracts</p>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Your Contracts</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track your projects, review submissions, and manage payments.</p>
      </div>

      {/* TABS */}
      <div className="bg-white border-b border-gray-100 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
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
                  }}
                  className={`relative flex items-center gap-2 px-4 py-4 text-[13px] font-semibold transition-colors ${isActive ? "text-gray-900 border-b-2 border-gray-900" : "text-gray-500 hover:text-gray-700 border-b-2 border-transparent"}`}
                >
                  {tab.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>
                    {tab.count}
                  </span>
                  {tab.alert && <span className="absolute right-2 top-3 h-2 w-2 rounded-full bg-orange-500" />}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder={activeTab === "submitted" ? "Search submitted work..." : "Search contracts..."}
                className="rounded-lg border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-[13px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-300 w-52"
              />
            </div>
            <button type="button" className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <Filter className="h-3.5 w-3.5" /> Filter
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="px-6 py-5">

        {/* ALL CONTRACTS TABLE VIEW */}
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
                <p className="text-sm text-gray-400 mt-1">You don't have any contracts yet</p>
              </div>
            ) : (
              <>
                <div className="mb-2 grid grid-cols-[2fr_1.2fr_1fr_0.7fr_0.8fr_0.8fr_1fr] items-center gap-4 px-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <span>Contract</span>
                  <span>Status</span>
                  <span>Milestones</span>
                  <span>Budget</span>
                  <span>Dates</span>
                  <span>Progress</span>
                  <span className="text-right">Actions</span>
                </div>
                <div className="space-y-2">
                  {visibleContracts.map((contract) => {
                    const statusLabel = getContractDisplayStatus(contract);
                    const progressColor = getProgressColor(contract);
                    const releasedCount = contract.paymentReleasedInstallments ?? 0;
                    const totalMs = contract.milestones?.length ?? 0;
                    const perMs = totalMs > 0 ? Math.round((contract.paymentTotalAmountSats ?? 0) / totalMs) : 0;
                    return (
                      <div key={contract.id} className="grid grid-cols-[2fr_1.2fr_1fr_0.7fr_0.8fr_0.8fr_1fr] items-center gap-4 rounded-xl bg-white border border-gray-100 px-4 py-4 hover:border-gray-200 hover:shadow-sm transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={contract.freelancer} />
                          <div className="min-w-0">
                            <p className="font-bold text-[13px] text-gray-900 truncate">{contract.title}</p>
                            <p className="text-[11px] text-gray-400 truncate">Freelancer: {contract.freelancer}</p>
                          </div>
                        </div>
                        <div>
                          <StatusBadge label={statusLabel} />
                          {totalMs > 0 && <p className="text-[10px] text-gray-400 mt-1">Milestone {releasedCount + 1} of {totalMs}</p>}
                        </div>
                        <div className="space-y-1">
                          {contract.milestones?.slice(0, 5).map((ms, i) => {
                            const isReleased = ms.status === "released" || ms.status === "approved" || ms.status === "Approved";
                            const isCurrent = i === releasedCount;
                            const isAwaitingReview = isCurrent && (ms.status === "submitted" || ms.status === "funded");
                            return (
                              <div key={i} className="flex items-center gap-1.5">
                                <span className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full text-[7px] font-black ${isReleased ? "bg-green-500 text-white" : isAwaitingReview ? "bg-orange-400 text-white" : isCurrent ? "bg-blue-400 text-white" : "bg-gray-100 text-gray-400"}`}>
                                  {isReleased ? "✓" : i + 1}
                                </span>
                                <span className={`text-[10px] truncate flex-1 ${isReleased ? "text-green-600" : isAwaitingReview ? "text-orange-600" : isCurrent ? "text-blue-600" : "text-gray-300"}`}>
                                  {ms.title || ms.name || `Milestone ${i + 1}`}
                                </span>
                                <span className={`text-[9px] flex-shrink-0 ${isReleased ? "text-green-500" : isAwaitingReview ? "text-orange-500" : isCurrent ? "text-blue-400" : "text-gray-300"}`}>
                                  {isReleased ? "Approved" : isAwaitingReview ? "Awaiting Review" : isCurrent ? "In Progress" : "Pending"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div>
                          <p className="font-bold text-[13px] text-gray-900">{contract.paymentTotalAmountSats ? `${contract.paymentTotalAmountSats.toLocaleString()} sats` : contract.budget}</p>
                          {perMs > 0 && <p className="text-[10px] text-gray-400">{perMs.toLocaleString()} sats<br/>per milestone</p>}
                        </div>
                        <div className="text-[11px]">
                          <p className="text-gray-500">{contract.startDate} –</p>
                          <p className="text-gray-500">{contract.dueDate}</p>
                        </div>
                        <div>
                          <span className="text-[12px] font-bold text-gray-800">{contract.progress}%</span>
                          <ProgressBar percent={contract.progress} color={progressColor} />
                        </div>
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {statusLabel === "Needs Review" && (
                            <button type="button" onClick={() => { const job = submittedJobs.find((j) => j.contractId === contract.id && j.status === "pending"); if (job) handleApproveSubmission(job.id); }} className="rounded-lg bg-orange-500 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-orange-600 transition-colors whitespace-nowrap">
                              Review Submission
                            </button>
                          )}
                          {statusLabel === "Revision Requested" && (
                            <button type="button" onClick={() => { setSelectedId(contract.id); setIsModalOpen(true); }} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-100 whitespace-nowrap">
                              Review Revision
                            </button>
                          )}
                          <button type="button" onClick={() => { setSelectedId(contract.id); setIsModalOpen(true); }} className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-700 hover:bg-gray-50">
                            View Details <ChevronRight className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={() => { if (!contract.jobId || !contract.freelancerId) return; router.push(`/client/dashboard/messages?chat=${createConversationId(contract.jobId, contract.freelancerId)}`); }} className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 hover:bg-gray-50">
                            <MessageSquare className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-400 hover:bg-gray-50">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-4 text-[12px] text-gray-400">Showing 1 to {visibleContracts.length} of {contracts.length} contracts</p>
              </>
            )}
          </>
        )}

        {/* ACTIVE CONTRACTS — milestone progress view */}
        {activeTab === "contracts" && view === "ongoing" && (
          <>
            {loading ? (
              <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
            ) : ongoingContracts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-300 mb-3" />
                <p className="font-bold text-gray-800">No active contracts</p>
                <p className="text-sm text-gray-400 mt-1">All caught up!</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-gray-900">Active Contracts ({ongoingContracts.length})</h2>
                    <p className="text-[12px] text-gray-400">Projects currently in progress.</p>
                  </div>
                  <button type="button" className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-50">
                    <SortDesc className="h-3.5 w-3.5" /> Newest First
                  </button>
                </div>
                <div className="space-y-3">
                  {ongoingContracts.map((contract) => {
                    const releasedCount = contract.paymentReleasedInstallments ?? 0;
                    const totalMs = contract.milestones?.length ?? 0;
                    const perMs = totalMs > 0 ? Math.round((contract.paymentTotalAmountSats ?? 0) / totalMs) : 0;
                    return (
                      <div key={contract.id} className="rounded-xl bg-white border border-gray-100 px-5 py-4 hover:border-gray-200 hover:shadow-sm transition-all">
                        <div className="flex items-start gap-4">
                          <Avatar name={contract.freelancer} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="font-bold text-[14px] text-gray-900 truncate">{contract.title}</p>
                              <StatusBadge label="In Progress" />
                            </div>
                            <p className="text-[11px] text-gray-400">Freelancer: {contract.freelancer} · Started {contract.startDate}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[10px] text-gray-400">Budget</p>
                            <p className="font-bold text-[13px] text-gray-900">{contract.paymentTotalAmountSats ? `${contract.paymentTotalAmountSats.toLocaleString()} sats` : contract.budget}</p>
                            {perMs > 0 && <p className="text-[10px] text-gray-400">{perMs.toLocaleString()} sats per milestone</p>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[10px] text-gray-400">Dates</p>
                            <p className="text-[12px] text-gray-700">{contract.startDate} – {contract.dueDate}</p>
                            <p className="text-orange-500 text-[11px] font-semibold">Due {contract.dueDate}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button type="button" onClick={() => { setSelectedId(contract.id); setIsModalOpen(true); }} className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-bold text-gray-700 hover:bg-gray-50">
                              View Details <ChevronRight className="h-3 w-3" />
                            </button>
                            <button type="button" onClick={() => { if (!contract.jobId || !contract.freelancerId) return; router.push(`/client/dashboard/messages?chat=${createConversationId(contract.jobId, contract.freelancerId)}`); }} className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 hover:bg-gray-50">
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-400 hover:bg-gray-50">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        {contract.milestones && contract.milestones.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-gray-50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] font-semibold text-gray-500">Milestone Progress</span>
                              <span className="text-[11px] text-gray-400">{releasedCount} / {totalMs}</span>
                            </div>
                            <div className="flex items-start gap-0">
                              {contract.milestones.map((ms, i) => {
                                const isReleased = ms.status === "released" || ms.status === "approved" || ms.status === "Approved";
                                const isCurrent = i === releasedCount;
                                const isSubmitted = (ms.status === "submitted" || ms.status === "funded") && isCurrent;
                                return (
                                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                                    <div className="relative w-full flex items-center justify-center">
                                      {i > 0 && <div className={`absolute right-1/2 top-3 h-0.5 w-full ${isReleased ? "bg-green-400" : isCurrent ? "bg-blue-200" : "bg-gray-100"}`} />}
                                      <div className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[9px] font-black ${isReleased ? "border-green-500 bg-green-500 text-white" : isSubmitted ? "border-orange-400 bg-orange-400 text-white" : isCurrent ? "border-blue-500 bg-white text-blue-500" : "border-gray-200 bg-white text-gray-300"}`}>
                                        {isReleased ? "✓" : i + 1}
                                      </div>
                                    </div>
                                    <span className={`text-[9px] font-medium text-center ${isReleased ? "text-green-600" : isCurrent ? "text-blue-600" : "text-gray-300"}`}>M{i + 1}</span>
                                    <span className={`text-[9px] text-center ${isReleased ? "text-green-500" : isSubmitted ? "text-orange-500" : isCurrent ? "text-blue-400" : "text-gray-300"}`}>
                                      {isReleased ? "Approved" : isSubmitted ? "Awaiting Review" : isCurrent ? "In Progress" : "Pending"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* NEEDS REVIEW — split panel view */}
        {activeTab === "submitted" && (
          <>
            {submittedJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-300 mb-3" />
                <p className="font-bold text-gray-800">Nothing to review</p>
                <p className="text-sm text-gray-400 mt-1">You don't have any submitted work yet</p>
              </div>
            ) : (
              <div className="flex gap-5">
                {/* Left: list */}
                <div className="w-[320px] flex-shrink-0 space-y-2">
                  <div className="mb-3">
                    <h2 className="font-bold text-gray-900">Needs Review ({needsAttentionCount})</h2>
                    <p className="text-[12px] text-gray-400">Contracts awaiting your review and action.</p>
                  </div>
                  {submittedJobs.map((job) => {
                    const contract = contracts.find((c) => c.id === job.contractId);
                    const isSelected = selectedSubmissionId === job.id || (!selectedSubmissionId && submittedJobs[0]?.id === job.id);
                    const total = contract?.paymentTotalAmountSats ?? 0;
                    const releasedCount = contract?.paymentReleasedInstallments ?? 0;
                    const totalMs = contract?.milestones?.length ?? contract?.paymentInstallments ?? 0;
                    const progress = totalMs > 0 ? Math.round((releasedCount / totalMs) * 100) : contract?.progress ?? 0;
                    return (
                      <button key={job.id} type="button" onClick={() => setSelectedSubmissionId(job.id)}
                        className={`w-full text-left rounded-xl border px-4 py-3.5 transition-all ${isSelected ? "border-orange-300 bg-orange-50 shadow-sm" : "border-gray-100 bg-white hover:border-gray-200"}`}>
                        <div className="flex items-start gap-3">
                          <Avatar name={contract?.freelancer ?? "F"} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-bold text-[13px] text-gray-900 truncate">{contract?.title ?? "Contract"}</p>
                              <span className="flex-shrink-0 text-[10px] font-bold text-orange-600">
                                Milestone {(contract?.paymentReleasedInstallments ?? 0) + 1} / {contract?.milestones?.length ?? contract?.paymentInstallments ?? "?"}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5">Freelancer: {contract?.freelancer}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0 mt-0.5" />
                        </div>
                        <div className="mt-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[10px] text-orange-600">
                            <Clock className="h-3 w-3" />
                            <span>Awaiting your review · {job.submittedAt.toLocaleDateString()}</span>
                          </div>
                          <span className="text-[11px] font-bold text-gray-700">{total > 0 ? `${total.toLocaleString()} sats` : contract?.budget}</span>
                        </div>
                        <div className="mt-2">
                          <ProgressBar percent={progress} color="orange" />
                          <p className="text-right text-[10px] text-gray-400 mt-0.5">{progress}% Complete</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Right: detail panel */}
                {(() => {
                  const job = selectedSubmissionId ? submittedJobs.find((j) => j.id === selectedSubmissionId) : submittedJobs[0];
                  const contract = job ? contracts.find((c) => c.id === job.contractId) : null;
                  if (!job || !contract) return null;
                  const total = contract.paymentTotalAmountSats ?? 0;
                  const totalMs = contract.milestones?.length ?? 0;
                  const perMs = totalMs > 0 ? Math.round(total / totalMs) : 0;
                  const releasedCount = contract.paymentReleasedInstallments ?? 0;
                  return (
                    <div className="flex-1 rounded-xl bg-white border border-gray-100 overflow-hidden">
                      <div className="px-6 py-5 border-b border-gray-50">
                        <div className="flex items-start gap-4">
                          <Avatar name={contract.freelancer} size="lg" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-2.5 py-0.5 text-[11px] font-bold text-orange-700">
                                <AlertCircle className="h-3 w-3" /> Awaiting Review
                              </span>
                              <span className="text-[11px] text-gray-400">Milestone {releasedCount + 1} of {totalMs}</span>
                            </div>
                            <h2 className="text-[18px] font-black text-gray-900">{contract.title}</h2>
                            <p className="text-[12px] text-gray-400 mt-0.5">Freelancer: {contract.freelancer}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-50">
                          {[
                            { label: "Total Budget", value: total > 0 ? `${total.toLocaleString()} sats` : contract.budget },
                            { label: "Start Date", value: contract.startDate },
                            { label: "Due Date", value: contract.dueDate, accent: true },
                            { label: "Progress", value: `${contract.progress}%` },
                          ].map(({ label, value, accent }) => (
                            <div key={label}>
                              <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> {label}
                              </p>
                              <p className={`text-[13px] font-bold ${accent ? "text-orange-500" : "text-gray-900"}`}>{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Milestones */}
                      <div className="px-6 py-4">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">Milestones</p>
                        <div className="space-y-2">
                          {contract.milestones?.map((ms, i) => {
                            const isReleased = ms.status === "released" || ms.status === "approved" || ms.status === "Approved";
                            const isCurrent = i === releasedCount;
                            const isAwaitingReview = isCurrent && (job.milestoneIndex === i + 1 || (job.milestoneIndex === undefined && i === releasedCount));
                            const msAmount = ms.freelancerAmountSats ?? perMs;
                            return (
                              <details key={i} open={isAwaitingReview} className={`rounded-xl border ${isAwaitingReview ? "border-orange-200" : "border-gray-100"}`}>
                                <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none">
                                  <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-black ${isReleased ? "bg-green-500 text-white" : isAwaitingReview ? "bg-orange-400 text-white" : isCurrent ? "bg-blue-400 text-white" : "bg-gray-100 text-gray-400"}`}>
                                    {isReleased ? "✓" : i + 1}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[13px] text-gray-900">{ms.title || ms.name || `Milestone ${i + 1}`}</p>
                                    {isReleased && <p className="text-[11px] text-gray-400">Submitted — Approved {ms.deadline}</p>}
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
                                    <div className="mt-3 flex gap-2">
                                      <button type="button" onClick={() => handleApproveSubmission(job.id)} className="flex-1 rounded-xl bg-green-50 py-2.5 text-[12px] font-bold text-green-700 hover:bg-green-100 transition-colors">
                                        Approve & Pay
                                      </button>
                                      <button type="button" onClick={() => openChangeRequest(job.id)} className="flex-1 rounded-xl bg-red-50 py-2.5 text-[12px] font-bold text-red-600 hover:bg-red-100 transition-colors">
                                        Request Changes
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </details>
                            );
                          })}
                        </div>
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
            {finishedContracts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-300 mb-3" />
                <p className="font-bold text-gray-800">No completed contracts</p>
                <p className="text-sm text-gray-400 mt-1">Completed projects will appear here</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-gray-900 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Completed Contracts ({finishedContracts.length})
                    </h2>
                    <p className="text-[12px] text-gray-400">Successfully completed projects.</p>
                  </div>
                  <button type="button" className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-50">
                    <SortDesc className="h-3.5 w-3.5" /> Newest First
                  </button>
                </div>
                <div className="space-y-2">
                  {finishedContracts.map((contract) => {
                    const total = contract.paymentTotalAmountSats ?? 0;
                    const totalMs = contract.milestones?.length ?? 0;
                    return (
                      <div key={contract.id} className="rounded-xl bg-white border-l-4 border-l-green-500 border-r border-t border-b border-gray-100 px-5 py-4">
                        <div className="flex items-start gap-4">
                          <Avatar name={contract.freelancer} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="font-bold text-[14px] text-gray-900">{contract.title}</p>
                              <StatusBadge label="Completed" />
                            </div>
                            <p className="text-[11px] text-gray-400">Freelancer: {contract.freelancer} · Completed {contract.dueDate}</p>
                          </div>
                          <div className="flex-shrink-0">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-[11px] text-gray-500">Total Budget</span>
                            </div>
                            <p className="font-bold text-[14px] text-gray-900">{total > 0 ? `${total.toLocaleString()} sats` : contract.budget}</p>
                          </div>
                          <div className="flex-shrink-0">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-[11px] text-gray-500">Duration</span>
                            </div>
                            <p className="text-[12px] font-semibold text-gray-700">{contract.startDate} – {contract.dueDate}</p>
                          </div>
                          <div className="flex-shrink-0 min-w-[160px]">
                            <p className="text-[11px] font-medium text-gray-500 mb-1">Milestones</p>
                            <div className="flex items-center gap-1 mb-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              <span className="text-[12px] font-semibold text-gray-700">{totalMs} / {totalMs} Completed</span>
                            </div>
                            <ProgressBar percent={100} color="green" />
                            <div className="mt-1 space-y-0.5">
                              <div className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /><span className="text-[10px] text-green-600">All payments released</span></div>
                              <div className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /><span className="text-[10px] text-green-600">Contract closed</span></div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5 flex-shrink-0">
                            <button type="button" onClick={() => { setSelectedId(contract.id); setIsModalOpen(true); }} className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] font-bold text-gray-700 hover:bg-gray-50">
                              View Contract <ChevronRight className="h-3 w-3" />
                            </button>
                            <button type="button" onClick={() => { if (!contract.jobId || !contract.freelancerId) return; router.push(`/client/dashboard/messages?chat=${createConversationId(contract.jobId, contract.freelancerId)}`); }} className="flex items-center gap-1 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-[12px] font-medium text-gray-500 hover:bg-gray-100">
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
                <Avatar name={selectedContract.freelancer} size="sm" />
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
      {selectedSubmission && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center px-2 py-2 sm:items-center sm:px-4 sm:py-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedSubmissionId(null)} />
          <div className="relative z-[96] max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="px-5 pt-5 pb-4 border-b border-gray-50">
              <button type="button" onClick={() => setSelectedSubmissionId(null)} className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-lg">✕</button>
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
              const lightningAddress = freelancerData?.settings?.payment?.lightningAddress;
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
                    <button type="button" onClick={() => { setShowPaymentModal(false); setPendingApprovalJobId(null); setApprovalErrorMessage(""); }} className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-[13px] font-bold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                    <button type="button" onClick={confirmApproveWithPayment} disabled={!canApprove} className="flex-1 rounded-xl bg-orange-500 py-3 text-[13px] font-bold text-white hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {canApprove ? "Approve & Pay" : "Fund Escrow First"}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
}