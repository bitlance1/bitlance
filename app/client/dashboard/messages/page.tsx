// "use client";

// import React, { useEffect, useMemo, useState, useRef } from "react";
// import { useSearchParams } from "next/navigation";
// import ClientSidebar from "@/components/molecules/ClientSidebar";
// import MessagesList from "@/components/organisms/MessagesList";
// import ChatView from "@/components/organisms/ChatView";
// import { sendUserNotification } from "@/lib/notifications";
// import { firebaseAuth, firebaseDb } from "@/lib/firebase";
// import {
//   addDoc,
//   collection,
//   doc,
//   getDoc,
//   getDocs,
//   increment,
//   limit,
//   onSnapshot,
//   orderBy,
//   query,
//   serverTimestamp,
//   setDoc,
//   updateDoc,
//   where,
// } from "firebase/firestore";

// interface MessageListItem {
//   id: string;
//   sender: {
//     name: string;
//     avatar: string;
//     isOnline: boolean;
//     profileUrl?: string;
//   };
//   lastMessage: {
//     text: string;
//     timestamp: string;
//     /** Raw epoch milliseconds for sorting and smart date display */
//     createdAtMs?: number;
//     isRead: boolean;
//   };
//   unreadCount: number;
// }

// interface ChatMessage {
//   id: string;
//   sender: "me" | "them";
//   text: string;
//   timestamp: string;
//   isRead?: boolean;
//   attachment?: {
//     name: string;
//     size: string;
//     url?: string;
//     mimeType?: string;
//     resourceType?: string;
//   };
// }

// type SubmittedJob = {
//   id: string;
//   contractId: string;
//   description: string;
//   link?: string;
//   attachment?: { name?: string; url?: string } | null;
//   submittedAt: Date;
//   status: "pending" | "approved" | "rejected";
//   revisionMessage?: string;
//   milestoneIndex?: number;
//   milestoneTitle?: string;
// };

// type ContractPreview = {
//   id: string;
//   title?: string;
//   description?: string;
//   workStatus?: "not_started" | "in_progress" | "submitted" | "changes_requested" | "approved" | "completed";
//   paymentStatus?: "unfunded" | "invoice_created" | "funded" | "released" | "disputed" | "expired";
//   paymentInstallments?: number;
//   paymentCurrentInstallment?: number;
//   paymentTotalAmountSats?: number;
//   paymentTotalChargedSats?: number;
//   freelancerId?: string;
//   freelancerName?: string;
//   submissionMessage?: string;
//   submissionLink?: string;
//   submissionAttachment?: {
//     name?: string;
//     url?: string;
//   } | null;
// };

// type FundingMode = "full" | "per_milestone";

// type EscrowMilestone = {
//   index: number;
//   title: string;
//   freelancerAmountSats: number;
//   platformFeeSats: number;
//   totalClientPaysSats: number;
//   fundedSats: number;
//   releasedSats: number;
//   status: "pending" | "funded" | "submitted" | "approved" | "released";
// };

// type Conversation = {
//   id: string;
//   jobId: string;
//   proposalId?: string;
//   jobTitle?: string;
//   clientId: string;
//   clientName?: string;
//   freelancerId: string;
//   freelancerName?: string;
//   clientAvatarUrl?: string;
//   freelancerAvatarUrl?: string;
//   canFreelancerMessage?: boolean;
//   lastMessage?: {
//     text?: string;
//     senderId?: string;
//     createdAt?: any;
//   };
//   unread?: Record<string, number>;
//   otherOnline?: boolean;
//   paymentStatus?: "unfunded" | "invoice_created" | "funded" | "released" | "disputed" | "expired";
//   paymentAmountSats?: number;
//   paymentTotalAmountSats?: number;
//   proposedRate?: number;
//   paymentInstallments?: number;
//   paymentCurrentInstallment?: number;
//   paymentPaidAmountSats?: number;
//   paymentTotalChargedSats?: number;
//   platformFeePercent?: number;
//   platformFeeSats?: number;
//   paymentMode?: FundingMode;
//   milestones?: EscrowMilestone[];
//   escrowFundedTotalSats?: number;
//   escrowReleasedSats?: number;
//   invoiceMilestoneIndex?: number;
//   paymentRequest?: string;
//   paymentHash?: string;
//   workStatus?: "not_started" | "in_progress" | "submitted" | "changes_requested" | "approved" | "completed";
//   submissionMessage?: string;
//   submissionLink?: string;
//   submissionAttachment?: {
//     name?: string;
//     url?: string;
//   } | null;
//   submissionReviewDueAt?: any;
//   revisionMessage?: string;
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

// const normalizePaymentStatus = (data: Record<string, unknown>): Conversation["paymentStatus"] => {
//   const status = typeof data.paymentStatus === "string" ? data.paymentStatus : "unfunded";
//   if (!["unfunded", "invoice_created", "funded", "released", "disputed", "expired"].includes(status)) {
//     return "unfunded";
//   }
//   if ((status === "funded" || status === "released") && !hasFundedEscrow(data)) {
//     return "unfunded";
//   }
//   if (status === "invoice_created" && !data.paymentRequest) {
//     return "unfunded";
//   }
//   return status as Conversation["paymentStatus"];
// };

// const normalizeFundedAmount = (data: Record<string, unknown>) => {
//   const status = normalizePaymentStatus(data);
//   if (status !== "funded" && status !== "released") return 0;
//   return Math.max(0, numberField(data.escrowFundedTotalSats ?? data.paymentPaidAmountSats));
// };

// const normalizeReleasedAmount = (data: Record<string, unknown>) => {
//   const status = normalizePaymentStatus(data);
//   if (status !== "funded" && status !== "released") return 0;
//   return Math.max(0, numberField(data.escrowReleasedSats));
// };

// const normalizeMilestones = (milestones: unknown, funded: boolean) => {
//   if (!Array.isArray(milestones)) return [];
//   return milestones.map((milestone) => {
//     const item = milestone as Record<string, unknown>;
//     return {
//       ...item,
//       fundedSats: funded ? numberField(item.fundedSats) : 0,
//       releasedSats: funded ? numberField(item.releasedSats) : 0,
//       status:
//         funded || item.status === "released"
//           ? item.status
//           : "pending",
//     };
//   });
// };

// const formatTimestamp = (value?: any) => {
//   const seconds = value?.seconds;
//   if (!seconds) return "";
//   const date = new Date(seconds * 1000);
//   return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
// };

// const formatDate = (value?: any) => {
//   if (!value) return "";
//   const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
//   if (Number.isNaN(date.getTime())) return "";
//   return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
// };

// const parseSats = (value: unknown) => {
//   if (typeof value === "number") return value;
//   const cleaned = String(value ?? "").replace(/[^0-9]/g, "");
//   return cleaned ? Number(cleaned) : 0;
// };

// const clampInstallments = (value: unknown) => {
//   const count = Number(value);
//   if (!Number.isFinite(count)) return 1;
//   return Math.max(1, Math.min(3, Math.trunc(count)));
// };

// const calculateInstallmentAmount = (total: number, installments: number, installment: number) => {
//   const safeTotal = Math.max(0, Math.trunc(total));
//   const safeInstallments = clampInstallments(installments);
//   const safeInstallment = Math.max(1, Math.min(safeInstallments, Math.trunc(installment)));
//   const base = Math.floor(safeTotal / safeInstallments);
//   const remainder = safeTotal % safeInstallments;
//   return base + (safeInstallment <= remainder ? 1 : 0);
// };

// const THIRTY_MINUTES_MS = 30 * 60 * 1000;

// const getTimestampMs = (value: unknown) => {
//   if (!value) return 0;
//   if (typeof value === "number") return value;
//   if (value instanceof Date) return value.getTime();
//   if (typeof value === "object") {
//     const typed = value as { toDate?: () => Date; seconds?: number };
//     if (typeof typed.toDate === "function") return typed.toDate().getTime();
//     if (typeof typed.seconds === "number") return typed.seconds * 1000;
//   }
//   const parsed = new Date(String(value));
//   return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
// };

// const isInvoiceExpiredByAge = (data: { paymentCreatedAt?: unknown; paymentStatus?: string; paymentRequest?: string }) => {
//   if (data.paymentStatus !== "invoice_created" || !data.paymentRequest) return false;
//   const createdAtMs = getTimestampMs(data.paymentCreatedAt);
//   if (!createdAtMs) return false;
//   return Date.now() - createdAtMs >= THIRTY_MINUTES_MS;
// };

// const PLATFORM_FEE_PERCENT = 5;

// const buildMilestones = (jobAmount: number, totalClientPayable: number, count: number, titles: string[]) =>
//   Array.from({ length: count }, (_, index) => {
//     const installment = index + 1;
//     const freelancerAmountSats = calculateInstallmentAmount(jobAmount, count, installment);
//     const totalClientPaysSats = calculateInstallmentAmount(totalClientPayable, count, installment);
//     return {
//       index: installment,
//       title: titles[index]?.trim() || (count === 1 ? "Complete project" : `Milestone ${installment}`),
//       freelancerAmountSats,
//       platformFeeSats: Math.max(0, totalClientPaysSats - freelancerAmountSats),
//       totalClientPaysSats,
//       fundedSats: 0,
//       releasedSats: 0,
//       status: "pending" as const,
//     };
//   });

// const getContractId = (conversation: Conversation) =>
//   conversation.jobId && conversation.freelancerId
//     ? `${conversation.jobId}_${conversation.freelancerId}`
//     : conversation.id;

// const createConversationId = (jobId: string, freelancerId: string) => `${jobId}_${freelancerId}`;

// const getConversationForContract = async (jobId: string, freelancerId: string) => {
//   if (!jobId || !freelancerId) return null;
//   const q = query(
//     collection(firebaseDb, "conversations"),
//     where("jobId", "==", jobId),
//     where("freelancerId", "==", freelancerId),
//     limit(1)
//   );
//   const snap = await getDocs(q);
//   return snap.empty ? null : snap.docs[0];
// };

// const clearUnpaidInvoice = async (conversationId: string, contractId: string) => {
//   const staleInvoiceUpdate = {
//     paymentStatus: "expired",
//     paymentRequest: "",
//     paymentHash: "",
//     paymentAmountSats: 0,
//     invoiceMilestoneIndex: 0,
//     paymentCreatedAt: null,
//     updatedAt: serverTimestamp(),
//   };

//   await Promise.all([
//     updateDoc(doc(firebaseDb, "conversations", conversationId), staleInvoiceUpdate),
//     setDoc(doc(firebaseDb, "contracts", contractId), staleInvoiceUpdate, { merge: true }),
//   ]);
// };

// export default function ClientMessagesPage() {
//   const searchParams = useSearchParams();
//   const [selectedChat, setSelectedChat] = useState<string | null>(null);
//   const [conversations, setConversations] = useState<Conversation[]>([]);
//   const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
//   const [currentUserId, setCurrentUserId] = useState<string | null>(null);
//   const [pendingSubmissionJob, setPendingSubmissionJob] = useState<SubmittedJob | null>(null);
//   const [contractModalContractId, setContractModalContractId] = useState<string | null>(null);
//   const [contractModalContract, setContractModalContract] = useState<ContractPreview | null>(null);
//   const [contractModalLoading, setContractModalLoading] = useState(false);
//   const [contractModalError, setContractModalError] = useState<string>("");
//   const [, setApprovalErrorMessage] = useState<string>("");
//   const [, setIsApprovingSubmission] = useState(false);
//   const [presenceMap, setPresenceMap] = useState<Record<string, boolean>>({});
//   const presenceUnsubs = useRef<Record<string, () => void>>({});

//   const formatFileSize = (bytes: number) => {
//     if (!bytes || Number.isNaN(bytes)) return "0 B";
//     const units = ["B", "KB", "MB", "GB"];
//     let size = bytes;
//     let idx = 0;
//     while (size >= 1024 && idx < units.length - 1) {
//       size /= 1024;
//       idx += 1;
//     }
//     return `${size.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
//   };

//   const handleOpenContractModal = (contractId: string) => {
//     setContractModalContractId(contractId);
//   };

//   const closeContractModal = () => {
//     setContractModalContractId(null);
//   };

//   useEffect(() => {
//     if (!contractModalContractId) {
//       setContractModalContract(null);
//       setContractModalLoading(false);
//       setContractModalError("");
//       return;
//     }

//     setContractModalLoading(true);
//     setContractModalError("");
//     setContractModalContract(null);

//     void getDoc(doc(firebaseDb, "contracts", contractModalContractId))
//       .then((docSnap) => {
//         if (!docSnap.exists()) {
//           setContractModalError("Contract not found.");
//           return;
//         }
//         const data = docSnap.data() as any;
//         setContractModalContract({
//           id: docSnap.id,
//           title: data.title ?? "Contract",
//           description: data.description ?? "",
//           workStatus: data.workStatus,
//           paymentStatus: data.paymentStatus,
//           paymentInstallments: Number(data.paymentInstallments ?? 0),
//           paymentCurrentInstallment: Number(data.paymentCurrentInstallment ?? 0),
//           paymentTotalAmountSats: Number(data.paymentTotalAmountSats ?? 0),
//           paymentTotalChargedSats: Number(data.paymentTotalChargedSats ?? 0),
//           freelancerId: data.freelancerId,
//           freelancerName: data.freelancerName,
//           submissionMessage: data.submissionMessage ?? "",
//           submissionLink: data.submissionLink ?? "",
//           submissionAttachment: data.submissionAttachment ?? null,
//         });
//       })
//       .catch((error) => {
//         console.error("Unable to load contract preview:", error);
//         setContractModalError("Unable to load contract details.");
//       })
//       .finally(() => setContractModalLoading(false));
//   }, [contractModalContractId]);

//   const isPresenceActive = (userData: any) => {
//     if (!userData?.online) return false;
//     const lastSeen = userData.lastSeen;
//     const timestamp = lastSeen?.toDate ? lastSeen.toDate().getTime() : lastSeen?.seconds ? lastSeen.seconds * 1000 : null;
//     return timestamp !== null && Date.now() - timestamp < 90000;
//   };

//   useEffect(() => {
//     let unsubscribeConversations: (() => void) | null = null;
//     const unsubscribeAuth = firebaseAuth.onAuthStateChanged((user) => {
//       if (!user) {
//         setConversations([]);
//         setChatMessages([]);
//         setCurrentUserId(null);
//         return;
//       }

//       setCurrentUserId(user.uid);
//       const conversationsQuery = query(
//         collection(firebaseDb, "conversations"),
//         where("clientId", "==", user.uid)
//       );

//       unsubscribeConversations = onSnapshot(conversationsQuery, async (snapshot) => {
//         const items = await Promise.all(
//           snapshot.docs.map(async (docSnap) => {
//             const data = docSnap.data() as any;
//             const freelancerId = data.freelancerId ?? "";
//             let freelancerName = data.freelancerName ?? "";
//             let freelancerAvatarUrl = data.freelancerAvatarUrl ?? "";

//             if (freelancerId && (!freelancerName || !freelancerAvatarUrl)) {
//               try {
//                 const [freelancerSnap, allUsersSnap] = await Promise.all([
//                   getDoc(doc(firebaseDb, "freelancers", freelancerId)),
//                   getDoc(doc(firebaseDb, "all_users", freelancerId)),
//                 ]);
//                 const f = freelancerSnap.exists() ? (freelancerSnap.data() as any) : {};
//                 const a = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
//                 if (!freelancerName) {
//                   const composedName = `${f.firstName ?? ""} ${f.lastName ?? ""}`.trim();
//                   freelancerName = f.fullName ?? a.fullName ?? composedName ?? a.name ?? "Freelancer";
//                 }
//                 if (!freelancerAvatarUrl) freelancerAvatarUrl = f.avatarUrl ?? a.avatarUrl ?? "";
//               } catch {
//                 // keep fallback values
//               }
//             }

//             const normalizedPaymentStatus = normalizePaymentStatus(data);
//             const isFundedRecord = normalizedPaymentStatus === "funded" || normalizedPaymentStatus === "released";

//             return {
//               id: docSnap.id,
//               jobId: data.jobId ?? "",
//               proposalId: data.proposalId ?? "",
//               jobTitle: data.jobTitle ?? "",
//               clientId: data.clientId ?? "",
//               clientName: data.clientName ?? "",
//               freelancerId,
//               freelancerName: freelancerName || "Freelancer",
//               clientAvatarUrl: data.clientAvatarUrl ?? "",
//               freelancerAvatarUrl,
//               canFreelancerMessage: !!data.canFreelancerMessage,
//               lastMessage: data.lastMessage ?? {},
//               unread: data.unread ?? {},
//               // otherOnline removed — derived live from presenceMap in messageList
//               paymentStatus: normalizedPaymentStatus,
//               paymentAmountSats: Number(data.paymentAmountSats ?? 0),
//               paymentTotalAmountSats: Number(data.paymentTotalAmountSats ?? 0),
//               proposedRate: Number(data.proposedRate ?? 0),
//               paymentInstallments: Number(data.paymentInstallments ?? 0),
//               paymentCurrentInstallment: Number(data.paymentCurrentInstallment ?? 0),
//               paymentPaidAmountSats: isFundedRecord ? Number(data.paymentPaidAmountSats ?? 0) : 0,
//               paymentTotalChargedSats: Number(data.paymentTotalChargedSats ?? 0),
//               platformFeePercent: Number(data.platformFeePercent ?? PLATFORM_FEE_PERCENT),
//               platformFeeSats: Number(data.platformFeeSats ?? 0),
//               paymentMode: data.paymentMode ?? "full",
//               milestones: normalizeMilestones(data.milestones, isFundedRecord) as EscrowMilestone[],
//               escrowFundedTotalSats: normalizeFundedAmount(data),
//               escrowReleasedSats: normalizeReleasedAmount(data),
//               invoiceMilestoneIndex: Number(data.invoiceMilestoneIndex ?? 0),
//               paymentRequest: data.paymentRequest ?? "",
//               paymentHash: data.paymentHash ?? "",
//               workStatus: data.workStatus ?? "not_started",
//               submissionMessage: data.submissionMessage ?? "",
//               submissionLink: data.submissionLink ?? "",
//               submissionAttachment: data.submissionAttachment ?? null,
//               submissionReviewDueAt: data.submissionReviewDueAt,
//               revisionMessage: data.revisionMessage ?? "",
//             } as Conversation;
//           })
//         );

//         setConversations(items);

//         const activeIds = new Set(
//           items.map((conv) => conv.freelancerId).filter(Boolean)
//         );

//         Object.keys(presenceUnsubs.current).forEach((uid) => {
//           if (!activeIds.has(uid)) {
//             presenceUnsubs.current[uid]?.();
//             delete presenceUnsubs.current[uid];
//             setPresenceMap((prev) => {
//               const next = { ...prev };
//               delete next[uid];
//               return next;
//             });
//           }
//         });

//         activeIds.forEach((uid) => {
//           if (presenceUnsubs.current[uid]) return;
//           const unsubscribePresence = onSnapshot(doc(firebaseDb, "all_users", uid), (snap) => {
//             const data = snap.exists() ? (snap.data() as any) : {};
//             setPresenceMap((prev) => ({
//               ...prev,
//               [uid]: isPresenceActive(data),
//             }));
//           });
//           presenceUnsubs.current[uid] = unsubscribePresence;
//         });
//       });
//     });

//     return () => {
//       unsubscribeAuth();
//       if (unsubscribeConversations) unsubscribeConversations();
//       Object.values(presenceUnsubs.current).forEach((unsub) => unsub());
//       presenceUnsubs.current = {};
//     };
//   }, []);

//   useEffect(() => {
//     return () => {
//       Object.values(presenceUnsubs.current).forEach((unsub) => unsub());
//       presenceUnsubs.current = {};
//     };
//   }, []);

//   useEffect(() => {
//     const chatFromUrl = searchParams.get("chat");
//     if (chatFromUrl) {
//       setSelectedChat(chatFromUrl);
//     }
//   }, [searchParams]);

//   useEffect(() => {
//     if (!selectedChat || !currentUserId) {
//       setChatMessages([]);
//       return;
//     }
//     const messagesQuery = query(
//       collection(firebaseDb, "conversations", selectedChat, "messages"),
//       orderBy("createdAt", "asc")
//     );
//     const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
//       const items: ChatMessage[] = snapshot.docs.map((docSnap) => {
//         const data = docSnap.data() as any;
//         const attachmentData = data.attachment as any;
//         return {
//           id: docSnap.id,
//           sender: data.senderId === currentUserId ? "me" : "them",
//           text: data.text ?? "",
//           timestamp: formatTimestamp(data.createdAt) || "Now",
//           isRead: true,
//           attachment: attachmentData
//             ? {
//                 name: attachmentData.name ?? "Attachment",
//                 size: attachmentData.size ?? formatFileSize(attachmentData.bytes ?? 0),
//                 url: attachmentData.url ?? "",
//                 mimeType: attachmentData.mimeType ?? "",
//                 resourceType: attachmentData.resourceType ?? "",
//               }
//             : undefined,
//         };
//       });
//       setChatMessages(items);
//     });
//     return () => unsubscribe();
//   }, [selectedChat, currentUserId]);

//   useEffect(() => {
//     if (!selectedChat || !currentUserId) return;
//     updateDoc(doc(firebaseDb, "conversations", selectedChat), {
//       [`unread.${currentUserId}`]: 0,
//       updatedAt: serverTimestamp(),
//     }).catch(() => undefined);
//   }, [selectedChat, currentUserId]);

//   const selectedConversation = conversations.find((c) => c.id === selectedChat) ?? null;

//   // ── Auto-verify invoice on chat open / page refresh ─────────────────────
//   // If there's a pending invoice_created status when the chat loads, silently
//   // check Blink right away. If it's expired, mark it expired in Firestore so
//   // the client sees "Generate Fresh Invoice" instead of a dead QR code.
//   useEffect(() => {
//     const conversation = selectedConversation;
//     if (!conversation || !currentUserId) return;
//     if (conversation.paymentStatus !== "invoice_created") return;
//     const paymentRequest = conversation.paymentRequest;
//     if (!paymentRequest) return;

//     const contractId = getContractId(conversation);

//     const checkOnLoad = async () => {
//       try {
//         const res = await fetch("/api/check-invoice", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ paymentRequest }),
//         });
//         if (!res.ok) return;
//         const data = await res.json();
//         const status = data?.data?.lnInvoicePaymentStatusByPaymentRequest?.status;
//         if (status === "PAID") {
//           void handleVerifyPayment(paymentRequest);
//         } else if (status === "EXPIRED" || isInvoiceExpiredByAge(conversation)) {
//           await clearUnpaidInvoice(conversation.id, contractId);
//         }
//         // status === "PENDING" — invoice still alive, do nothing, show QR
//       } catch {
//         // non-fatal — invoice UI stays as-is
//       }
//     };

//     void checkOnLoad();
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [selectedConversation?.id, selectedConversation?.paymentStatus, selectedConversation?.paymentRequest]);

//   const messageList = useMemo<MessageListItem[]>(() => {
//     if (!currentUserId) return [];
//     return conversations
//       .map((conv) => {
//         const otherName = conv.freelancerName || "Freelancer";
//         const lastText = conv.lastMessage?.text ?? "Start the conversation";
//         const lastTime = formatTimestamp(conv.lastMessage?.createdAt) || "";
//         const unreadCount = conv.unread?.[currentUserId] ?? 0;
//         const rawCreatedAt = conv.lastMessage?.createdAt;
//         const createdAtMs = rawCreatedAt?.seconds
//           ? rawCreatedAt.seconds * 1000
//           : rawCreatedAt
//             ? new Date(rawCreatedAt).getTime() || undefined
//             : undefined;
//         return {
//           id: conv.id,
//           sender: {
//             name: otherName,
//             avatar: conv.freelancerAvatarUrl || "/assets/avatar.png",
//             profileUrl: conv.freelancerId ? `/freelancer/public/${conv.freelancerId}` : "",
//             isOnline: !!presenceMap[conv.freelancerId],
//           },
//           lastMessage: {
//             text: lastText,
//             timestamp: lastTime,
//             createdAtMs,
//             isRead: unreadCount === 0,
//           },
//           unreadCount,
//         };
//       })
//       .sort((a, b) => {
//         const aMs = a.lastMessage.createdAtMs ?? 0;
//         const bMs = b.lastMessage.createdAtMs ?? 0;
//         return bMs - aMs;
//       });
//   }, [conversations, currentUserId, presenceMap]);

//   const selectedMessage = selectedConversation
//     ? messageList.find((m) => m.id === selectedConversation.id) ?? null
//     : null;

//   useEffect(() => {
//     if (!selectedConversation) {
//       setPendingSubmissionJob(null);
//       return;
//     }

//     const contractId = getContractId(selectedConversation);
//     const submissionQuery = query(
//       collection(firebaseDb, "submitted_jobs"),
//       where("contractId", "==", contractId),
//       where("status", "==", "pending"),
//       orderBy("submittedAt", "desc"),
//       limit(1)
//     );

//     const unsubscribe = onSnapshot(submissionQuery, (snapshot) => {
//       const item = snapshot.docs[0];
//       if (!item) {
//         setPendingSubmissionJob(null);
//         return;
//       }
//       const data = item.data() as any;
//       setPendingSubmissionJob({
//         id: item.id,
//         contractId: data.contractId,
//         description: data.description || "",
//         link: data.link || "",
//         attachment: data.attachment ?? null,
//         submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : new Date(),
//         status: data.status ?? "pending",
//         revisionMessage: data.revisionMessage ?? "",
//         milestoneIndex: Number(data.milestoneIndex ?? 0),
//         milestoneTitle: data.milestoneTitle ?? "",
//       });
//     });

//     return () => unsubscribe();
//   }, [selectedConversation]);

//   const resolveFreelancerLightningAddress = async (freelancerId: string) => {
//     if (!freelancerId) return "";
//     const [freelancerSnap, allUsersSnap] = await Promise.all([
//       getDoc(doc(firebaseDb, "freelancers", freelancerId)),
//       getDoc(doc(firebaseDb, "all_users", freelancerId)),
//     ]);
//     const freelancerData = freelancerSnap.exists() ? (freelancerSnap.data() as any) : {};
//     const allUserData = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
//     return (
//       freelancerData?.settings?.payment?.lightningAddress ||
//       freelancerData?.lightningAddress ||
//       freelancerData?.settings?.lightningAddress ||
//       allUserData?.lightningAddress ||
//       ""
//     );
//   };

//   const handleApproveSubmission = async () => {
//     if (!selectedConversation || !currentUserId || !pendingSubmissionJob) return;
//     setApprovalErrorMessage("");
//     setIsApprovingSubmission(true);

//     try {
//       const contractId = getContractId(selectedConversation);
//       const contractDoc = await getDoc(doc(firebaseDb, "contracts", contractId));
//       if (!contractDoc.exists()) {
//         throw new Error("Unable to find the linked contract for this submission.");
//       }

//       const contract = contractDoc.data() as any;
//       const paymentStatus = contract.paymentStatus ?? "unfunded";
//       const fundedInstallments = Number(contract.paymentCurrentInstallment ?? 0);
//       const totalInstallments = Number(contract.paymentInstallments ?? 1);
//       const releasedInstallments = Number(contract.paymentReleasedInstallments ?? 0);
//       const nextMilestoneIndex = releasedInstallments + 1;
//       const milestone = Array.isArray(contract.milestones)
//         ? contract.milestones.find((item: any, index: number) => Number(item.index ?? index + 1) === nextMilestoneIndex)
//         : null;
//       const totalAmount = Number(contract.paymentTotalAmountSats ?? parseSats(contract.budget) ?? 0);
//       const milestoneAmount = Number((milestone as any)?.freelancerAmountSats ?? calculateInstallmentAmount(totalAmount, totalInstallments, nextMilestoneIndex));
//       const milestoneFundedSats = milestone ? Number(milestone.fundedSats ?? 0) : milestoneAmount;
//       const milestoneReleasedSats = milestone ? Number(milestone.releasedSats ?? 0) : 0;
//       const remainingMilestoneEscrow = Math.max(0, milestoneFundedSats - milestoneReleasedSats);

//       if (nextMilestoneIndex > totalInstallments) {
//         throw new Error("All milestones for this contract have already been approved and paid.");
//       }
//       if ((Number(contract.escrowReleasedSats ?? 0) + milestoneAmount) > totalAmount) {
//         throw new Error(`Releasing ${milestoneAmount.toLocaleString()} sats would exceed the total contract budget of ${totalAmount.toLocaleString()} sats.`);
//       }
//       if ((Number(contract.escrowReleasedSats ?? 0) + milestoneAmount) > Number(contract.escrowFundedTotalSats ?? 0)) {
//         throw new Error(`Releasing ${milestoneAmount.toLocaleString()} sats would exceed the funded escrow balance.`);
//       }

//       const canRelease = fundedInstallments >= nextMilestoneIndex && (paymentStatus === "funded" || paymentStatus === "released") && remainingMilestoneEscrow >= milestoneAmount;
//       if (!canRelease) {
//         const shortfall = Math.max(0, milestoneAmount - remainingMilestoneEscrow);
//         throw new Error(shortfall > 0 ? `You need to fund ${shortfall.toLocaleString()} sats more in escrow before approving this milestone.` : "This milestone is not funded yet. Fund escrow before approving work.");
//       }

//       const lightningAddress = await resolveFreelancerLightningAddress(selectedConversation.freelancerId);
//       if (!lightningAddress) {
//         throw new Error("Freelancer has not set up a Lightning address. Payment cannot be processed.");
//       }
//       if (milestoneAmount <= 0) {
//         throw new Error("Unable to calculate milestone amount.");
//       }

//       const paymentResponse = await fetch("/api/send-payment", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           lightningAddress,
//           amount: milestoneAmount,
//           memo: `Milestone ${nextMilestoneIndex} payment for contract: ${contract.title ?? selectedConversation.jobTitle ?? "Contract"}`,
//         }),
//       });

//       const rawPaymentResponse = await paymentResponse.text();
//       let paymentData: any = null;
//       try {
//         paymentData = rawPaymentResponse ? JSON.parse(rawPaymentResponse) : null;
//       } catch {
//         throw new Error(`Failed to parse payment response: ${rawPaymentResponse}`);
//       }
//       if (!paymentResponse.ok) throw new Error(paymentData?.error ?? `Failed to send payment to freelancer: ${rawPaymentResponse}`);

//       await updateDoc(doc(firebaseDb, "submitted_jobs", pendingSubmissionJob.id), { status: "approved", updatedAt: serverTimestamp() });
//       const nextReleasedCount = releasedInstallments + 1;
//       const isFinalRelease = nextReleasedCount >= totalInstallments;
//       const updatedMilestones = (Array.isArray(contract.milestones) ? contract.milestones : []).map((item: any, index: number) => {
//         const itemIndex = Number(item.index ?? index + 1);
//         if (itemIndex !== nextMilestoneIndex) return item;
//         return { ...item, releasedSats: Number(item.releasedSats ?? 0) + milestoneAmount, status: "released", releasedAt: new Date().toISOString() };
//       });
//       const contractUpdate = {
//         workStatus: isFinalRelease ? "approved" : "in_progress",
//         paymentReleasedInstallments: nextReleasedCount,
//         escrowReleasedSats: (Number(contract.escrowReleasedSats ?? 0) + milestoneAmount),
//         milestones: updatedMilestones,
//         paymentStatus: isFinalRelease ? "released" : "funded",
//         updatedAt: serverTimestamp(),
//       };
//       await setDoc(doc(firebaseDb, "contracts", contractId), contractUpdate, { merge: true });
//       await setDoc(doc(firebaseDb, "escrows", contractId), {
//         totalReleasedToFreelancerSats: contractUpdate.escrowReleasedSats,
//         releasedMilestoneCount: nextReleasedCount,
//         milestones: updatedMilestones,
//         status: isFinalRelease ? "released" : "funded",
//         updatedAt: serverTimestamp(),
//       }, { merge: true });

//       const conversationDoc = await getConversationForContract(selectedConversation.jobId, selectedConversation.freelancerId);
//       const approvalMessage = `Milestone ${nextMilestoneIndex}${milestone?.title || milestone?.name ? `: ${milestone?.title || milestone?.name}` : ""} approved and payment of ${milestoneAmount} sats sent to freelancer.`;
//       if (conversationDoc) {
//         await updateDoc(conversationDoc.ref, {
//           workStatus: contractUpdate.workStatus,
//           paymentStatus: contractUpdate.paymentStatus,
//           escrowReleasedSats: contractUpdate.escrowReleasedSats,
//           milestones: updatedMilestones,
//           updatedAt: serverTimestamp(),
//           "lastMessage.text": approvalMessage,
//           "lastMessage.senderId": "system",
//           "lastMessage.createdAt": serverTimestamp(),
//           [`unread.${selectedConversation.freelancerId}`]: increment(1),
//         });
//       }

//       void sendUserNotification({
//         userId: selectedConversation.freelancerId,
//         title: "Milestone approved",
//         body: approvalMessage,
//         url: "/freelancer/dashboard/contracts",
//         tag: `approval-${contractId}-${nextMilestoneIndex}`,
//       }).catch(console.error);
//     } catch (error) {
//       console.error("Error approving submission:", error);
//       setApprovalErrorMessage(error instanceof Error ? error.message : "Failed to approve the submission and send payment. Please try again.");
//       throw error;
//     } finally {
//       setIsApprovingSubmission(false);
//     }
//   };

//   const handleRequestChanges = async (note: string) => {
//     if (!selectedConversation || !currentUserId || !pendingSubmissionJob) return;
//     if (!note.trim()) {
//       throw new Error("Write a short note so the freelancer knows what to adjust.");
//     }

//     try {
//       const contractId = getContractId(selectedConversation);
//       const contractDoc = await getDoc(doc(firebaseDb, "contracts", contractId));
//       if (!contractDoc.exists()) {
//         throw new Error("Unable to find the linked contract for this submission.");
//       }
//       const contract = contractDoc.data() as any;
//       const nextMilestoneIndex = Number(contract.paymentReleasedInstallments ?? 0) + 1;
//       const updatedMilestones = (Array.isArray(contract.milestones) ? contract.milestones : []).map((item: any, index: number) => {
//         const itemIndex = Number(item.index ?? index + 1);
//         if (itemIndex !== nextMilestoneIndex) return item;
//         return { ...item, status: "funded", revisionMessage: note, changesRequestedAt: new Date().toISOString() };
//       });
//       const messageText = `Work returned for adjustments on "${contract.title ?? selectedConversation.jobTitle ?? "this contract"}". Note: ${note}`;
//       const conversationId = selectedConversation.jobId && selectedConversation.freelancerId
//         ? createConversationId(selectedConversation.jobId, selectedConversation.freelancerId)
//         : contractId;

//       await Promise.all([
//         updateDoc(doc(firebaseDb, "submitted_jobs", pendingSubmissionJob.id), {
//           status: "rejected",
//           revisionMessage: note,
//           reviewedAt: serverTimestamp(),
//           updatedAt: serverTimestamp(),
//         }),
//         setDoc(doc(firebaseDb, "contracts", contractId), {
//           workStatus: "changes_requested",
//           revisionMessage: note,
//           milestones: updatedMilestones,
//           unreadByFreelancer: true,
//           updatedAt: serverTimestamp(),
//         }, { merge: true }),
//         setDoc(doc(firebaseDb, "conversations", conversationId), {
//           workStatus: "changes_requested",
//           revisionMessage: note,
//           milestones: updatedMilestones,
//           "lastMessage.text": messageText,
//           "lastMessage.senderId": "system",
//           "lastMessage.createdAt": serverTimestamp(),
//           [`unread.${selectedConversation.freelancerId}`]: increment(1),
//           updatedAt: serverTimestamp(),
//         }, { merge: true }),
//         addDoc(collection(firebaseDb, "conversations", conversationId, "messages"), {
//           senderId: "system",
//           senderRole: "system",
//           text: messageText,
//           messageType: "changes_requested",
//           createdAt: serverTimestamp(),
//         }),
//       ]);

//       void sendUserNotification({
//         userId: selectedConversation.freelancerId,
//         title: "Changes requested",
//         body: messageText,
//         url: "/freelancer/dashboard/contracts",
//         tag: `changes-${contractId}-${nextMilestoneIndex}`,
//       }).catch(console.error);
//     } catch (error) {
//       console.error("Error requesting changes:", error);
//       throw error;
//     }
//   };

//   const handleSendMessage = async (text: string, file?: File | null) => {
//     if (!selectedConversation || !currentUserId) return;
//     const otherId = selectedConversation.freelancerId;
//     let attachment: Record<string, any> | undefined;

//     if (file) {
//       const idToken = await firebaseAuth.currentUser?.getIdToken();
//       if (!idToken) return;
//       const formData = new FormData();
//       formData.append("file", file);
//       const uploadResponse = await fetch("/api/chat/upload", {
//         method: "POST",
//         headers: { Authorization: `Bearer ${idToken}` },
//         body: formData,
//       });
//       const uploadPayload = (await uploadResponse.json()) as any;
//       if (!uploadResponse.ok || !uploadPayload?.url) {
//         throw new Error(uploadPayload?.error || "Failed to upload attachment.");
//       }
//       attachment = {
//         url: uploadPayload.url,
//         name: uploadPayload.name ?? file.name,
//         bytes: uploadPayload.bytes ?? file.size,
//         size: formatFileSize(uploadPayload.bytes ?? file.size),
//         mimeType: uploadPayload.mimeType ?? file.type,
//         resourceType: uploadPayload.resourceType ?? "auto",
//         publicId: uploadPayload.publicId ?? "",
//       };
//     }

//     const messageText = text || (attachment ? `Shared a file: ${attachment.name}` : "");
//     await addDoc(collection(firebaseDb, "conversations", selectedConversation.id, "messages"), {
//       senderId: currentUserId,
//       senderRole: "client",
//       text: messageText,
//       attachment: attachment ?? null,
//       createdAt: serverTimestamp(),
//     });
//     await updateDoc(doc(firebaseDb, "conversations", selectedConversation.id), {
//       "lastMessage.text": messageText,
//       "lastMessage.senderId": currentUserId,
//       "lastMessage.createdAt": serverTimestamp(),
//       [`unread.${currentUserId}`]: 0,
//       [`unread.${otherId}`]: increment(1),
//       updatedAt: serverTimestamp(),
//     });
//     void sendUserNotification({
//       userId: otherId,
//       title: `New message from ${selectedConversation.clientName || "Client"}`,
//       body: messageText,
//       url: `/freelancer/dashboard/messages?chat=${selectedConversation.id}`,
//       tag: `message-${selectedConversation.id}`,
//     }).catch(console.error);
//   };

//   const handleCreatePaymentInvoice = async ({
//     installments = 1,
//     fundingMode = "full",
//     milestoneTitles = [],
//     chosenAmount,
//   }: {
//     installments: number;
//     fundingMode: FundingMode;
//     milestoneTitles: string[];
//     chosenAmount?: number;
//   }) => {
//     if (!selectedConversation || !currentUserId) return;

//     const contractId =
//       selectedConversation.jobId && selectedConversation.freelancerId
//         ? `${selectedConversation.jobId}_${selectedConversation.freelancerId}`
//         : selectedConversation.id;

//     const contractSnap = await getDoc(doc(firebaseDb, "contracts", contractId));
//     const contractData = contractSnap.exists() ? (contractSnap.data() as any) : {};
//     const conversationSnap = await getDoc(doc(firebaseDb, "conversations", selectedConversation.id));
//     const liveConversationData = conversationSnap.exists()
//       ? (conversationSnap.data() as Record<string, unknown>)
//       : {};
//     const escrowSnap = await getDoc(doc(firebaseDb, "escrows", contractId));
//     const escrowData = escrowSnap.exists() ? (escrowSnap.data() as Record<string, unknown>) : {};
//     if (!contractSnap.exists() || contractData.status !== "Active") {
//       throw new Error("Accept this freelancer's proposal before funding escrow.");
//     }
//     if (
//       contractData.jobId !== selectedConversation.jobId ||
//       contractData.clientId !== currentUserId ||
//       contractData.freelancerId !== selectedConversation.freelancerId
//     ) {
//       throw new Error("This escrow is not linked to the accepted job contract.");
//     }

//     const livePaymentStatus = normalizePaymentStatus({
//       ...contractData,
//       ...selectedConversation,
//       ...liveConversationData,
//     });
//     const livePaymentRequest =
//       typeof liveConversationData.paymentRequest === "string"
//         ? liveConversationData.paymentRequest
//         : selectedConversation.paymentRequest;

//     if (livePaymentStatus === "invoice_created" && livePaymentRequest) {
//       throw new Error("An escrow invoice is already active. Check or pay the current invoice before creating another one.");
//     }

//     const existingFundingData = escrowSnap.exists()
//       ? { ...contractData, ...selectedConversation, ...liveConversationData, ...escrowData }
//       : {};
//     const fundedAmount = normalizeFundedAmount(existingFundingData);
//     const releasedAmount = normalizeReleasedAmount(existingFundingData);
//     const totalAmount =
//       chosenAmount && chosenAmount > 0
//         ? chosenAmount
//         : selectedConversation.paymentTotalAmountSats ||
//           Number(contractData.paymentTotalAmountSats ?? 0) ||
//           parseSats(contractData.budget) ||
//           parseSats(contractData.amount) ||
//           selectedConversation.paymentAmountSats ||
//           0;
//     // Always use the freshly chosen installment count from the UI when no
//     // milestones have been funded yet. Only lock to the stored value once
//     // at least one milestone has been funded (mid-contract).
//     const hasFundedAny = fundedAmount > 0;
//     const paymentInstallments = hasFundedAny
//       ? (selectedConversation.paymentInstallments || Number(contractData.paymentInstallments ?? 0) || clampInstallments(installments))
//       : clampInstallments(installments);
//     const platformFeeSats = Math.ceil(totalAmount * (PLATFORM_FEE_PERCENT / 100));
//     const totalClientPayable = totalAmount + platformFeeSats;
//     if (fundedAmount >= totalClientPayable && totalClientPayable > 0) {
//       throw new Error("Escrow is already fully funded. No new invoice can be created for this contract.");
//     }
//     // If no milestones have been funded yet, always rebuild from the UI choices
//     // so the milestone count + titles match what the client just selected.
//     const existingMilestones = hasFundedAny
//       ? (escrowSnap.exists() && Array.isArray(escrowData.milestones) && escrowData.milestones.length
//           ? escrowData.milestones
//           : Array.isArray(contractData.milestones) && contractData.milestones.length
//             ? normalizeMilestones(contractData.milestones, false)
//             : Array.isArray(selectedConversation.milestones) && selectedConversation.milestones.length
//               ? normalizeMilestones(selectedConversation.milestones, false)
//               : buildMilestones(totalAmount, totalClientPayable, paymentInstallments, milestoneTitles))
//       : buildMilestones(totalAmount, totalClientPayable, paymentInstallments, milestoneTitles);
//     const milestones = existingMilestones.map((milestone: any, index: number) => ({
//       index: Number(milestone.index ?? index + 1),
//       title: milestone.title || milestoneTitles[index] || `Milestone ${index + 1}`,
//       freelancerAmountSats: Number(milestone.freelancerAmountSats ?? calculateInstallmentAmount(totalAmount, paymentInstallments, index + 1)),
//       platformFeeSats: Number(milestone.platformFeeSats ?? 0),
//       totalClientPaysSats: Number(milestone.totalClientPaysSats ?? calculateInstallmentAmount(totalClientPayable, paymentInstallments, index + 1)),
//       fundedSats: Number(milestone.fundedSats ?? 0),
//       releasedSats: Number(milestone.releasedSats ?? 0),
//       status: milestone.status ?? "pending",
//     })) as EscrowMilestone[];
//     const nextMilestone =
//       milestones.find((milestone) => milestone.status !== "funded" && milestone.status !== "released") ??
//       milestones[milestones.length - 1];
//     const hasOpenFundedMilestone = milestones.some(
//       (milestone) =>
//         Number(milestone.fundedSats ?? 0) > Number(milestone.releasedSats ?? 0) &&
//         (milestone.status === "funded" || milestone.status === "submitted" || milestone.status === "approved")
//     );
//     if (hasOpenFundedMilestone) {
//       throw new Error("A funded milestone is still open. Release or complete it before creating another invoice.");
//     }
//     if (milestones.every((milestone) => milestone.status === "funded" || milestone.status === "released")) {
//       throw new Error("Escrow is already fully funded. No new invoice can be created for this contract.");
//     }
//     const currentInstallment = fundingMode === "full" ? 1 : nextMilestone.index;
//     const amount = fundingMode === "full"
//       ? Math.max(0, totalClientPayable - fundedAmount)
//       : Math.max(0, nextMilestone.totalClientPaysSats - nextMilestone.fundedSats);

//     if (!totalAmount || !amount) {
//       throw new Error("Contract amount is missing or escrow is already fully funded.");
//     }

//     const res = await fetch("/api/create-invoice", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ amount }),
//     });
//     const data = await res.json();

//     if (!res.ok) {
//       throw new Error(data?.error ?? "Unable to create Blink invoice.");
//     }

//     const errors = data?.data?.lnInvoiceCreate?.errors ?? [];
//     if (errors.length) {
//       throw new Error(errors[0]?.message ?? "Blink could not create the invoice.");
//     }

//     const invoice = data?.data?.lnInvoiceCreate?.invoice;
//     const paymentRequest = invoice?.paymentRequest;
//     const paymentHash = invoice?.paymentHash;

//     if (!paymentRequest) {
//       throw new Error("Blink did not return a Lightning payment request.");
//     }

//     const paymentUpdate = {
//       contractId,
//       conversationId: selectedConversation.id,
//       jobId: selectedConversation.jobId,
//       proposalId: selectedConversation.proposalId ?? contractData.proposalId ?? "",
//       clientId: selectedConversation.clientId,
//       freelancerId: selectedConversation.freelancerId,
//       paymentProvider: "blink",
//       paymentStatus: "invoice_created",
//       paymentTotalAmountSats: totalAmount,
//       paymentSubtotalSats: totalAmount,
//       platformFeePercent: PLATFORM_FEE_PERCENT,
//       platformFeeSats,
//       paymentTotalChargedSats: totalClientPayable,
//       paymentMode: fundingMode,
//       paymentInstallments,
//       paymentCurrentInstallment: currentInstallment,
//       paymentAmountSats: Number(invoice?.satoshis ?? amount),
//       invoiceMilestoneIndex: currentInstallment,
//       paymentRequest,
//       paymentHash: paymentHash ?? "",
//       paymentCreatedAt: serverTimestamp(),
//       milestones,
//       escrowFundedTotalSats: fundedAmount,
//       escrowReleasedSats: releasedAmount,
//       updatedAt: serverTimestamp(),
//     };
//     const escrowId = contractId;
//     const invoiceMessage = fundingMode === "full"
//       ? `Lightning invoice created for full escrow (${totalClientPayable.toLocaleString()} sats including ${platformFeeSats.toLocaleString()} sats platform fee).`
//       : `Lightning invoice created for Milestone ${currentInstallment}: ${nextMilestone.title}.`;

//     await Promise.all([
//       updateDoc(doc(firebaseDb, "conversations", selectedConversation.id), {
//         ...paymentUpdate,
//         "lastMessage.text": invoiceMessage,
//         "lastMessage.senderId": "system",
//         "lastMessage.createdAt": serverTimestamp(),
//         [`unread.${currentUserId}`]: 0,
//         [`unread.${selectedConversation.freelancerId}`]: increment(1),
//       }),
//       setDoc(
//         doc(firebaseDb, "contracts", contractId),
//         {
//           ...paymentUpdate,
//           escrowAmount: Number(invoice?.satoshis ?? amount),
//         },
//         { merge: true }
//       ),
//       setDoc(
//         doc(firebaseDb, "escrows", escrowId),
//         {
//           escrowId,
//           conversationId: selectedConversation.id,
//           contractId,
//           jobId: selectedConversation.jobId,
//           jobTitle: selectedConversation.jobTitle,
//           clientId: selectedConversation.clientId,
//           clientName: selectedConversation.clientName,
//           freelancerId: selectedConversation.freelancerId,
//           freelancerName: selectedConversation.freelancerName,
//           jobAmountSats: totalAmount,
//           platformFeePercent: PLATFORM_FEE_PERCENT,
//           platformFeeSats,
//           totalClientPayableSats: totalClientPayable,
//           paymentMode: fundingMode,
//           milestoneCount: paymentInstallments,
//           milestones,
//           totalFundedSats: fundedAmount,
//           totalReleasedToFreelancerSats: releasedAmount,
//           status: fundedAmount > 0 ? "partially_funded" : "invoice_created",
//           updatedAt: serverTimestamp(),
//           createdAt: serverTimestamp(),
//         },
//         { merge: true }
//       ),
//       addDoc(collection(firebaseDb, "conversations", selectedConversation.id, "messages"), {
//         senderId: "system",
//         senderRole: "system",
//         text: `${invoiceMessage} Freelancer should wait for funding confirmation before starting work.`,
//         attachment: null,
//         createdAt: serverTimestamp(),
//       }),
//     ]);
//     void sendUserNotification({
//       userId: selectedConversation.freelancerId,
//       title: "Escrow invoice created",
//       body: `${invoiceMessage} Open the chat for payment status.`,
//       url: `/freelancer/dashboard/messages?chat=${selectedConversation.id}`,
//       tag: `invoice-${selectedConversation.id}`,
//     }).catch(console.error);

//     return paymentRequest;
//   };

//   const handleVerifyPayment = async (
//     paymentRequestOverride?: string
//   ): Promise<"funded" | "pending" | "expired"> => {
//     if (!selectedConversation) return "pending";
//     const paymentRequestToCheck = paymentRequestOverride || selectedConversation?.paymentRequest;
//     if (!paymentRequestToCheck || !currentUserId) return "pending";

//     const res = await fetch("/api/check-invoice", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ paymentRequest: paymentRequestToCheck }),
//     });
//     const data = await res.json();

//     if (!res.ok) {
//       throw new Error(data?.error ?? "Unable to verify Blink invoice.");
//     }

//     const statusPayload = data?.data?.lnInvoicePaymentStatusByPaymentRequest;
//     const blinkStatus = statusPayload?.status;

//     if (blinkStatus === "PAID") {
//       const paymentInstallments = selectedConversation.paymentInstallments || 1;
//       const currentInstallment = selectedConversation.paymentCurrentInstallment || 1;
//       const contractId =
//         selectedConversation.jobId && selectedConversation.freelancerId
//           ? `${selectedConversation.jobId}_${selectedConversation.freelancerId}`
//           : selectedConversation.id;
//       const paymentHash = statusPayload?.paymentHash ?? selectedConversation.paymentHash ?? "";
//       const contractSnap = await getDoc(doc(firebaseDb, "contracts", contractId));
//       const contractData = contractSnap.exists() ? (contractSnap.data() as any) : {};
//       if (paymentHash && contractData.lastFundedPaymentHash === paymentHash) {
//         return "funded";
//       }
//       const jobAmount = selectedConversation.paymentTotalAmountSats || Number(contractData.paymentTotalAmountSats ?? 0) || 0;
//       const platformFeeSats =
//         selectedConversation.platformFeeSats ||
//         Number(contractData.platformFeeSats ?? 0) ||
//         Math.ceil(jobAmount * (PLATFORM_FEE_PERCENT / 100));
//       const totalClientPayable = selectedConversation.paymentTotalChargedSats || Number(contractData.paymentTotalChargedSats ?? 0) || jobAmount + platformFeeSats;
//       const existingMilestones = Array.isArray(selectedConversation.milestones) && selectedConversation.milestones.length
//         ? selectedConversation.milestones
//         : Array.isArray(contractData.milestones) && contractData.milestones.length
//           ? contractData.milestones
//           : buildMilestones(jobAmount, totalClientPayable, paymentInstallments, []);
//       const invoiceAmount = selectedConversation.paymentAmountSats || 0;
//       const isFullFunding = (selectedConversation.paymentMode ?? contractData.paymentMode ?? "full") === "full";
//       const nextMilestones = existingMilestones.map((milestone: any) => {
//         const shouldFund = isFullFunding || Number(milestone.index) === currentInstallment;
//         if (!shouldFund) return milestone;
//         return {
//           ...milestone,
//           fundedSats: Number(milestone.totalClientPaysSats ?? 0),
//           status: milestone.status === "released" ? "released" : "funded",
//         };
//       }) as EscrowMilestone[];
//       const fundedFreelancerAmount = nextMilestones.reduce(
//         (sum, milestone) => sum + (milestone.status === "funded" || milestone.status === "released" ? milestone.freelancerAmountSats : 0),
//         0
//       );
//       const fundedTotalAmount = isFullFunding
//         ? totalClientPayable
//         : (selectedConversation.escrowFundedTotalSats || Number(contractData.escrowFundedTotalSats ?? 0) || 0) + invoiceAmount;
//       const fundedThroughInstallment = isFullFunding ? paymentInstallments : currentInstallment;
//       const firstReadyMilestone = nextMilestones.find((milestone) => milestone.status === "funded" && !milestone.releasedSats) ?? nextMilestones[0];
//       const allMilestonesFunded = nextMilestones.every((milestone) => milestone.status === "funded" || milestone.status === "released");
//       const fundedUpdate = {
//         contractId,
//         conversationId: selectedConversation.id,
//         jobId: selectedConversation.jobId,
//         proposalId: selectedConversation.proposalId ?? contractData.proposalId ?? "",
//         clientId: selectedConversation.clientId,
//         freelancerId: selectedConversation.freelancerId,
//         paymentStatus: "funded",
//         workStatus: "in_progress",
//         paymentInstallments,
//         paymentCurrentInstallment: fundedThroughInstallment,
//         paymentPaidAmountSats: fundedFreelancerAmount,
//         paymentTotalChargedSats: totalClientPayable,
//         platformFeePercent: PLATFORM_FEE_PERCENT,
//         platformFeeSats,
//         escrowFundedTotalSats: fundedTotalAmount,
//         milestones: nextMilestones,
//         paymentReceivedAt: serverTimestamp(),
//         paymentPreimage: statusPayload?.paymentPreimage ?? "",
//         paymentHash,
//         lastFundedPaymentHash: paymentHash,
//         updatedAt: serverTimestamp(),
//       };
//       const fundedMessage = isFullFunding
//         ? `Full escrow funded for ${paymentInstallments} milestone${paymentInstallments === 1 ? "" : "s"}. Start work for Milestone ${firstReadyMilestone.index}: ${firstReadyMilestone.title}.`
//         : `Client funded Milestone ${firstReadyMilestone.index}: ${firstReadyMilestone.title}. You can start work for this milestone.`;
//       const systemMessageId = `payment_funded_${currentInstallment}_${paymentHash || selectedConversation.id}`;

//       await Promise.all([
//         updateDoc(doc(firebaseDb, "conversations", selectedConversation.id), {
//           ...fundedUpdate,
//           "lastMessage.text": fundedMessage,
//           "lastMessage.senderId": "system",
//           "lastMessage.createdAt": serverTimestamp(),
//           [`unread.${currentUserId}`]: 0,
//           [`unread.${selectedConversation.freelancerId}`]: increment(1),
//         }),
//         setDoc(doc(firebaseDb, "contracts", contractId), fundedUpdate, { merge: true }),
//         setDoc(
//           doc(firebaseDb, "escrows", contractId),
//           {
//             escrowId: contractId,
//             conversationId: selectedConversation.id,
//             contractId,
//             jobId: selectedConversation.jobId,
//             jobTitle: selectedConversation.jobTitle,
//             clientId: selectedConversation.clientId,
//             clientName: selectedConversation.clientName,
//             freelancerId: selectedConversation.freelancerId,
//             freelancerName: selectedConversation.freelancerName,
//             jobAmountSats: jobAmount,
//             platformFeePercent: PLATFORM_FEE_PERCENT,
//             platformFeeSats,
//             totalClientPayableSats: totalClientPayable,
//             paymentMode: selectedConversation.paymentMode ?? contractData.paymentMode ?? "full",
//             milestoneCount: paymentInstallments,
//             milestones: nextMilestones,
//             totalFundedSats: fundedTotalAmount,
//             totalReleasedToFreelancerSats: Number(contractData.escrowReleasedSats ?? selectedConversation.escrowReleasedSats ?? 0),
//             status: allMilestonesFunded ? "funded" : "partially_funded",
//             lastFundedPaymentHash: paymentHash,
//             updatedAt: serverTimestamp(),
//           },
//           { merge: true }
//         ),
//         setDoc(
//           doc(firebaseDb, "conversations", selectedConversation.id, "messages", systemMessageId),
//           {
//             senderId: "system",
//             senderRole: "system",
//             text: fundedMessage,
//             attachment: null,
//             createdAt: serverTimestamp(),
//           },
//           { merge: true }
//         ),
//       ]);
//       void sendUserNotification({
//         userId: selectedConversation.freelancerId,
//         title: "Escrow funded",
//         body: fundedMessage,
//         url: `/freelancer/dashboard/messages?chat=${selectedConversation.id}`,
//         tag: `funded-${selectedConversation.id}`,
//       }).catch(console.error);

//       return "funded";
//     }

//     return "pending";
//   };

//   return (
//     <div className="min-h-screen bg-[#F7F6F3] font-sans">
//       <div className="flex">
//         <ClientSidebar active="/client/dashboard/messages" hideMobileToggle={!!selectedChat} />

//         <div className={`flex-1 lg:ml-0 ${selectedChat ? "pt-0" : "pt-3"} md:pt-0`}>
//           <div className="flex h-[100dvh] pt-0">
//             <div
//               className={`
//               w-full md:w-1/3 border-r border-[#e8e6e1]  bg-[#F6F3F1]
//               ${selectedChat ? "hidden md:block" : "block"}
//               pt-0
//             `}
//             >
//               <MessagesList
//                 messages={messageList}
//                 onSelectChat={setSelectedChat}
//                 selectedChat={selectedChat}
//               />
//             </div>

//             <div
//               className={`
//               h-full w-full md:w-2/3 bg-[#F7F6F3]
//               ${selectedChat ? "block" : "hidden md:block"}
//               pt-0
//             `}
//             >
//               {selectedMessage && selectedConversation ? (
//                 <>
//                   <ChatView
//                     message={selectedMessage}
//                     chatMessages={chatMessages}
//                     onBack={() => setSelectedChat(null)}
//                     onSendMessage={handleSendMessage}
//                     viewerRole="client"
//                     paymentStatus={selectedConversation.paymentStatus}
//                     paymentAmountSats={selectedConversation.paymentAmountSats}
//                     paymentTotalAmountSats={selectedConversation.paymentTotalAmountSats}
//                     proposedRate={selectedConversation.proposedRate}
//                     paymentInstallments={selectedConversation.paymentInstallments}
//                     paymentCurrentInstallment={selectedConversation.paymentCurrentInstallment}
//                     paymentPaidAmountSats={selectedConversation.paymentPaidAmountSats}
//                     paymentTotalChargedSats={selectedConversation.paymentTotalChargedSats}
//                     platformFeePercent={selectedConversation.platformFeePercent}
//                     platformFeeSats={selectedConversation.platformFeeSats}
//                     paymentMode={selectedConversation.paymentMode}
//                     milestones={selectedConversation.milestones}
//                     paymentRequest={selectedConversation.paymentRequest}
//                     workStatus={selectedConversation.workStatus}
//                     submittedWorkHref={`/client/dashboard/contracts?contract=${
//                       selectedConversation.jobId && selectedConversation.freelancerId
//                         ? `${selectedConversation.jobId}_${selectedConversation.freelancerId}`
//                         : selectedConversation.id
//                     }`}
//                     onCreatePaymentInvoice={handleCreatePaymentInvoice}
//                     onVerifyPayment={handleVerifyPayment}
//                     onApproveSubmission={handleApproveSubmission}
//                     onRequestChanges={handleRequestChanges}
//                     pendingSubmissionJob={pendingSubmissionJob}
//                     onOpenContractModal={handleOpenContractModal}
//                     jobId={selectedConversation.jobId}
//                     jobTitle={selectedConversation.jobTitle}
//                     contractId={
//                       selectedConversation.jobId && selectedConversation.freelancerId
//                         ? `${selectedConversation.jobId}_${selectedConversation.freelancerId}`
//                         : selectedConversation.id
//                     }
//                     viewerRole_disputeRole="client"
//                   />

//                   {contractModalContractId ? (
//                     <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
//                       <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeContractModal} />
//                       <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/30 bg-white shadow-2xl">
//                         <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
//                           <div>
//                             <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Contract preview</p>
//                             <h2 className="mt-2 text-xl font-semibold text-slate-950">{contractModalContract?.title || 'Contract details'}</h2>
//                           </div>
//                           <button
//                             type="button"
//                             onClick={closeContractModal}
//                             className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
//                             aria-label="Close contract preview"
//                           >
//                             ✕
//                           </button>
//                         </div>
//                         <div className="space-y-4 px-5 py-5 text-sm text-slate-700">
//                           {contractModalLoading ? (
//                             <p>Loading contract details…</p>
//                           ) : contractModalError ? (
//                             <p className="text-red-600">{contractModalError}</p>
//                           ) : contractModalContract ? (
//                             <>
//                               <div className="space-y-3">
//                                 <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Status</p>
//                                 <div className="flex flex-wrap gap-2">
//                                   {contractModalContract.workStatus ? (
//                                     <span className="rounded-full bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">{contractModalContract.workStatus.replace(/_/g, ' ')}</span>
//                                   ) : null}
//                                   {contractModalContract.paymentStatus ? (
//                                     <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">{contractModalContract.paymentStatus.replace(/_/g, ' ')}</span>
//                                   ) : null}
//                                 </div>
//                               </div>

//                               <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
//                                 <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Submission note</p>
//                                 <p className="text-sm leading-relaxed text-slate-800">{contractModalContract.submissionMessage || 'No submission note provided.'}</p>
//                                 {contractModalContract.submissionLink ? (
//                                   <p className="text-sm break-all text-blue-700 underline"><a href={contractModalContract.submissionLink} target="_blank" rel="noreferrer">Open delivery link</a></p>
//                                 ) : null}
//                                 {contractModalContract.submissionAttachment?.url ? (
//                                   <a href={contractModalContract.submissionAttachment.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200">View attachment</a>
//                                 ) : null}
//                               </div>

//                               <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
//                                 <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Contract summary</p>
//                                 <p>{contractModalContract.description || 'No contract description available.'}</p>
//                                 <div className="grid grid-cols-2 gap-3 pt-3 text-sm text-slate-700">
//                                   <div>
//                                     <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Installments</p>
//                                     <p>{contractModalContract.paymentCurrentInstallment ?? 0} / {contractModalContract.paymentInstallments ?? 0}</p>
//                                   </div>
//                                   <div>
//                                     <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Budget</p>
//                                     <p>{contractModalContract.paymentTotalChargedSats ? `${contractModalContract.paymentTotalChargedSats.toLocaleString()} sats` : `${contractModalContract.paymentTotalAmountSats?.toLocaleString() ?? 0} sats`}</p>
//                                   </div>
//                                 </div>
//                               </div>
//                             </>
//                           ) : null}
//                         </div>
//                       </div>
//                     </div>
//                   ) : null}
//                 </>
//               ) : (
//                 <div className="h-full flex items-center justify-center text-gray-500">
//                   <div className="text-center">
//                     <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
//                       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                         <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
//                       </svg>
//                     </div>
//                     <p>Select a conversation to start messaging</p>
//                   </div>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }



"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import ClientSidebar from "@/components/molecules/ClientSidebar";
import MessagesList from "@/components/organisms/MessagesList";
import ChatView from "@/components/organisms/ChatView";
import { sendUserNotification } from "@/lib/notifications";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

interface MessageListItem {
  id: string;
  sender: {
    name: string;
    avatar: string;
    isOnline: boolean;
    profileUrl?: string;
  };
  lastMessage: {
    text: string;
    timestamp: string;
    /** Raw epoch milliseconds for sorting and smart date display */
    createdAtMs?: number;
    isRead: boolean;
  };
  unreadCount: number;
}

interface ChatMessage {
  id: string;
  sender: "me" | "them";
  text: string;
  timestamp: string;
  isRead?: boolean;
  attachment?: {
    name: string;
    size: string;
    url?: string;
    mimeType?: string;
    resourceType?: string;
  };
}

type SubmittedJob = {
  id: string;
  contractId: string;
  description: string;
  link?: string;
  attachment?: { name?: string; url?: string } | null;
  submittedAt: Date;
  status: "pending" | "approved" | "rejected";
  revisionMessage?: string;
  milestoneIndex?: number;
  milestoneTitle?: string;
};

type ContractPreview = {
  id: string;
  title?: string;
  description?: string;
  workStatus?: "not_started" | "in_progress" | "submitted" | "changes_requested" | "approved" | "completed";
  paymentStatus?: "unfunded" | "invoice_created" | "funded" | "released" | "disputed" | "expired";
  paymentInstallments?: number;
  paymentCurrentInstallment?: number;
  paymentTotalAmountSats?: number;
  paymentTotalChargedSats?: number;
  freelancerId?: string;
  freelancerName?: string;
  submissionMessage?: string;
  submissionLink?: string;
  submissionAttachment?: {
    name?: string;
    url?: string;
  } | null;
};

type FundingMode = "full" | "per_milestone";

type EscrowMilestone = {
  index: number;
  title: string;
  freelancerAmountSats: number;
  platformFeeSats: number;
  totalClientPaysSats: number;
  fundedSats: number;
  releasedSats: number;
  status: "pending" | "funded" | "submitted" | "approved" | "released";
};

type Conversation = {
  id: string;
  jobId: string;
  proposalId?: string;
  jobTitle?: string;
  clientId: string;
  clientName?: string;
  freelancerId: string;
  freelancerName?: string;
  clientAvatarUrl?: string;
  freelancerAvatarUrl?: string;
  canFreelancerMessage?: boolean;
  lastMessage?: {
    text?: string;
    senderId?: string;
    createdAt?: any;
  };
  unread?: Record<string, number>;
  otherOnline?: boolean;
  paymentStatus?: "unfunded" | "invoice_created" | "funded" | "released" | "disputed" | "expired";
  paymentAmountSats?: number;
  paymentTotalAmountSats?: number;
  paymentSubtotalSats?: number;
  proposedRate?: number;
  paymentInstallments?: number;
  paymentCurrentInstallment?: number;
  paymentPaidAmountSats?: number;
  paymentTotalChargedSats?: number;
  platformFeePercent?: number;
  platformFeeSats?: number;
  paymentMode?: FundingMode;
  milestones?: EscrowMilestone[];
  escrowFundedTotalSats?: number;
  escrowReleasedSats?: number;
  invoiceMilestoneIndex?: number;
  paymentRequest?: string;
  paymentHash?: string;
  // ── FIX: added so isInvoiceExpiredByAge can read the invoice creation time ──
  paymentCreatedAt?: any;
  workStatus?: "not_started" | "in_progress" | "submitted" | "changes_requested" | "approved" | "completed";
  submissionMessage?: string;
  submissionLink?: string;
  submissionAttachment?: {
    name?: string;
    url?: string;
  } | null;
  submissionReviewDueAt?: any;
  revisionMessage?: string;
  subject?: string;
  isAdminOutreach?: boolean;
};

const numberField = (value: unknown) => Number(value ?? 0);

const hasFundedEscrow = (data: Record<string, unknown>) => {
  const fundedTotal = Number(data.escrowFundedTotalSats ?? data.paymentPaidAmountSats ?? 0);
  const releasedTotal = Number(data.escrowReleasedSats ?? 0);
  const hasFundedMilestone = Array.isArray(data.milestones)
    ? data.milestones.some((milestone) => {
      const item = milestone as Record<string, unknown>;
      const funded = numberField(item.fundedSats);
      const released = numberField(item.releasedSats);
      return funded > released;
    })
    : false;

  return fundedTotal > releasedTotal || hasFundedMilestone;
};

const normalizePaymentStatus = (data: Record<string, unknown>): Conversation["paymentStatus"] => {
  const status = typeof data.paymentStatus === "string" ? data.paymentStatus : "unfunded";
  if (!["unfunded", "invoice_created", "funded", "released", "disputed", "expired"].includes(status)) {
    return "unfunded";
  }
  if ((status === "funded" || status === "released") && !hasFundedEscrow(data)) {
    return "unfunded";
  }
  if (status === "invoice_created" && !data.paymentRequest) {
    return "unfunded";
  }
  return status as Conversation["paymentStatus"];
};

const normalizeFundedAmount = (data: Record<string, unknown>) => {
  const status = normalizePaymentStatus(data);
  if (status !== "funded" && status !== "released") return 0;
  return Math.max(0, numberField(data.escrowFundedTotalSats ?? data.paymentPaidAmountSats));
};

const normalizeReleasedAmount = (data: Record<string, unknown>) => {
  const status = normalizePaymentStatus(data);
  if (status !== "funded" && status !== "released") return 0;
  return Math.max(0, numberField(data.escrowReleasedSats));
};

const normalizeMilestones = (milestones: unknown, funded: boolean) => {
  if (!Array.isArray(milestones)) return [];
  return milestones.map((milestone) => {
    const item = milestone as Record<string, unknown>;
    return {
      ...item,
      fundedSats: funded ? numberField(item.fundedSats) : 0,
      releasedSats: funded ? numberField(item.releasedSats) : 0,
      status:
        funded || item.status === "released"
          ? item.status
          : "pending",
    };
  });
};

const formatTimestamp = (value?: any) => {
  const seconds = value?.seconds;
  if (!seconds) return "";
  const date = new Date(seconds * 1000);
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (value?: any) => {
  if (!value) return "";
  const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const parseSats = (value: unknown) => {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "").replace(/[^0-9]/g, "");
  return cleaned ? Number(cleaned) : 0;
};

const clampInstallments = (value: unknown) => {
  const count = Number(value);
  if (!Number.isFinite(count)) return 1;
  return Math.max(1, Math.min(3, Math.trunc(count)));
};

const calculateInstallmentAmount = (total: number, installments: number, installment: number) => {
  const safeTotal = Math.max(0, Math.trunc(total));
  const safeInstallments = clampInstallments(installments);
  const safeInstallment = Math.max(1, Math.min(safeInstallments, Math.trunc(installment)));
  const base = Math.floor(safeTotal / safeInstallments);
  const remainder = safeTotal % safeInstallments;
  return base + (safeInstallment <= remainder ? 1 : 0);
};

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

const getTimestampMs = (value: unknown) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object") {
    const typed = value as { toDate?: () => Date; seconds?: number };
    if (typeof typed.toDate === "function") return typed.toDate().getTime();
    if (typeof typed.seconds === "number") return typed.seconds * 1000;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const isInvoiceExpiredByAge = (data: { paymentCreatedAt?: unknown; paymentStatus?: string; paymentRequest?: string }) => {
  if (data.paymentStatus !== "invoice_created" || !data.paymentRequest) return false;
  const createdAtMs = getTimestampMs(data.paymentCreatedAt);
  if (!createdAtMs) return false;
  return Date.now() - createdAtMs >= THIRTY_MINUTES_MS;
};

const PLATFORM_FEE_PERCENT = 5;

const buildMilestones = (jobAmount: number, totalClientPayable: number, count: number, titles: string[]) =>
  Array.from({ length: count }, (_, index) => {
    const installment = index + 1;
    const freelancerAmountSats = calculateInstallmentAmount(jobAmount, count, installment);
    const totalClientPaysSats = calculateInstallmentAmount(totalClientPayable, count, installment);
    return {
      index: installment,
      title: titles[index]?.trim() || (count === 1 ? "Complete project" : `Milestone ${installment}`),
      freelancerAmountSats,
      platformFeeSats: Math.max(0, totalClientPaysSats - freelancerAmountSats),
      totalClientPaysSats,
      fundedSats: 0,
      releasedSats: 0,
      status: "pending" as const,
    };
  });

const getContractId = (conversation: Conversation) =>
  conversation.jobId && conversation.freelancerId
    ? `${conversation.jobId}_${conversation.freelancerId}`
    : conversation.id;

const createConversationId = (jobId: string, freelancerId: string) => `${jobId}_${freelancerId}`;

const getConversationForContract = async (jobId: string, freelancerId: string) => {
  if (!jobId || !freelancerId) return null;
  const q = query(
    collection(firebaseDb, "conversations"),
    where("jobId", "==", jobId),
    where("freelancerId", "==", freelancerId),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0];
};

const clearUnpaidInvoice = async (conversationId: string, contractId: string) => {
  const staleInvoiceUpdate = {
    paymentStatus: "expired",
    paymentRequest: "",
    paymentHash: "",
    paymentAmountSats: 0,
    invoiceMilestoneIndex: 0,
    paymentCreatedAt: null,
    updatedAt: serverTimestamp(),
  };

  await Promise.all([
    updateDoc(doc(firebaseDb, "conversations", conversationId), staleInvoiceUpdate),
    setDoc(doc(firebaseDb, "contracts", contractId), staleInvoiceUpdate, { merge: true }),
  ]);
};

export default function ClientMessagesPage() {
  const searchParams = useSearchParams();
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [dbConversations, setDbConversations] = useState<Conversation[]>([]);
  const [dbOutreach, setDbOutreach] = useState<Conversation[]>([]);

  const conversations = useMemo(() => {
    return [...dbConversations, ...dbOutreach];
  }, [dbConversations, dbOutreach]);

  const selectedConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedChat) ?? null;
  }, [conversations, selectedChat]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pendingSubmissionJob, setPendingSubmissionJob] = useState<SubmittedJob | null>(null);
  const [contractModalContractId, setContractModalContractId] = useState<string | null>(null);
  const [contractModalContract, setContractModalContract] = useState<ContractPreview | null>(null);
  const [contractModalLoading, setContractModalLoading] = useState(false);
  const [contractModalError, setContractModalError] = useState<string>("");
  const [, setApprovalErrorMessage] = useState<string>("");
  const [, setIsApprovingSubmission] = useState(false);
  const [presenceMap, setPresenceMap] = useState<Record<string, boolean>>({});
  const presenceUnsubs = useRef<Record<string, () => void>>({});

  const formatFileSize = (bytes: number) => {
    if (!bytes || Number.isNaN(bytes)) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let idx = 0;
    while (size >= 1024 && idx < units.length - 1) {
      size /= 1024;
      idx += 1;
    }
    return `${size.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
  };

  const handleOpenContractModal = (contractId: string) => {
    setContractModalContractId(contractId);
  };

  const closeContractModal = () => {
    setContractModalContractId(null);
  };

  useEffect(() => {
    if (!contractModalContractId) {
      setContractModalContract(null);
      setContractModalLoading(false);
      setContractModalError("");
      return;
    }

    setContractModalLoading(true);
    setContractModalError("");
    setContractModalContract(null);

    void getDoc(doc(firebaseDb, "contracts", contractModalContractId))
      .then((docSnap) => {
        if (!docSnap.exists()) {
          setContractModalError("Contract not found.");
          return;
        }
        const data = docSnap.data() as any;
        setContractModalContract({
          id: docSnap.id,
          title: data.title ?? "Contract",
          description: data.description ?? "",
          workStatus: data.workStatus,
          paymentStatus: data.paymentStatus,
          paymentInstallments: Number(data.paymentInstallments ?? 0),
          paymentCurrentInstallment: Number(data.paymentCurrentInstallment ?? 0),
          paymentTotalAmountSats: Number(data.paymentTotalAmountSats ?? 0),
          paymentTotalChargedSats: Number(data.paymentTotalChargedSats ?? 0),
          freelancerId: data.freelancerId,
          freelancerName: data.freelancerName,
          submissionMessage: data.submissionMessage ?? "",
          submissionLink: data.submissionLink ?? "",
          submissionAttachment: data.submissionAttachment ?? null,
        });
      })
      .catch((error) => {
        console.error("Unable to load contract preview:", error);
        setContractModalError("Unable to load contract details.");
      })
      .finally(() => setContractModalLoading(false));
  }, [contractModalContractId]);

  const isPresenceActive = (userData: any) => {
    if (!userData?.online) return false;
    const lastSeen = userData.lastSeen;
    const timestamp = lastSeen?.toDate ? lastSeen.toDate().getTime() : lastSeen?.seconds ? lastSeen.seconds * 1000 : null;
    return timestamp !== null && Date.now() - timestamp < 90000;
  };

  useEffect(() => {
    let unsubscribeConversations: (() => void) | null = null;
    let unsubscribeOutreach: (() => void) | null = null;
    const unsubscribeAuth = firebaseAuth.onAuthStateChanged((user) => {
      if (!user) {
        setDbConversations([]);
        setDbOutreach([]);
        setChatMessages([]);
        setCurrentUserId(null);
        return;
      }

      setCurrentUserId(user.uid);
      const conversationsQuery = query(
        collection(firebaseDb, "conversations"),
        where("clientId", "==", user.uid)
      );

      unsubscribeConversations = onSnapshot(conversationsQuery, async (snapshot) => {
        const items = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data() as any;
            const freelancerId = data.freelancerId ?? "";
            let freelancerName = data.freelancerName ?? "";
            let freelancerAvatarUrl = data.freelancerAvatarUrl ?? "";

            if (freelancerId && (!freelancerName || !freelancerAvatarUrl)) {
              try {
                const [freelancerSnap, allUsersSnap] = await Promise.all([
                  getDoc(doc(firebaseDb, "freelancers", freelancerId)),
                  getDoc(doc(firebaseDb, "all_users", freelancerId)),
                ]);
                const f = freelancerSnap.exists() ? (freelancerSnap.data() as any) : {};
                const a = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
                if (!freelancerName) {
                  const composedName = `${f.firstName ?? ""} ${f.lastName ?? ""}`.trim();
                  freelancerName = f.fullName ?? a.fullName ?? composedName ?? a.name ?? "Freelancer";
                }
                if (!freelancerAvatarUrl) freelancerAvatarUrl = f.avatarUrl ?? a.avatarUrl ?? "";
              } catch {
                // keep fallback values
              }
            }

            let proposedRate = Number(data.proposedRate ?? 0);
            let proposalId = data.proposalId ?? "";

            if (freelancerId && (!proposedRate || !proposalId)) {
              try {
                if (!proposalId && data.jobId) {
                  const proposalsQuery = query(
                    collection(firebaseDb, "proposals"),
                    where("jobId", "==", data.jobId),
                    where("freelancerId", "==", freelancerId),
                    limit(1)
                  );
                  const proposalsSnap = await getDocs(proposalsQuery);
                  if (!proposalsSnap.empty) {
                    proposalId = proposalsSnap.docs[0].id;
                    const pData = proposalsSnap.docs[0].data() as any;
                    proposedRate = parseSats(pData.rate || pData.amount || pData.budget || 0);

                    // Heal conversation and contract documents in background
                    const updateData: Record<string, any> = { proposalId };
                    if (proposedRate > 0) {
                      updateData.proposedRate = proposedRate;
                    }
                    await updateDoc(docSnap.ref, updateData);
                    const contractId = getContractId({ id: docSnap.id, jobId: data.jobId, freelancerId } as any);
                    await setDoc(doc(firebaseDb, "contracts", contractId), updateData, { merge: true });
                  }
                } else if (proposalId && !proposedRate) {
                  const proposalSnap = await getDoc(doc(firebaseDb, "proposals", proposalId));
                  if (proposalSnap.exists()) {
                    const pData = proposalSnap.data() as any;
                    proposedRate = parseSats(pData.rate || pData.amount || pData.budget || 0);

                    if (proposedRate > 0) {
                      await updateDoc(docSnap.ref, { proposedRate });
                      const contractId = getContractId({ id: docSnap.id, jobId: data.jobId, freelancerId } as any);
                      await setDoc(doc(firebaseDb, "contracts", contractId), { proposedRate }, { merge: true });
                    }
                  }
                }
              } catch (err) {
                console.error("Failed to query or heal proposal details:", err);
              }
            }

            const normalizedPaymentStatus = normalizePaymentStatus(data);
            const isFundedRecord = normalizedPaymentStatus === "funded" || normalizedPaymentStatus === "released";

            return {
              id: docSnap.id,
              jobId: data.jobId ?? "",
              proposalId: proposalId || data.proposalId || "",
              jobTitle: data.jobTitle ?? "",
              clientId: data.clientId ?? "",
              clientName: data.clientName ?? "",
              freelancerId,
              freelancerName: freelancerName || "Freelancer",
              clientAvatarUrl: data.clientAvatarUrl ?? "",
              freelancerAvatarUrl,
              canFreelancerMessage: !!data.canFreelancerMessage,
              lastMessage: data.lastMessage ?? {},
              unread: data.unread ?? {},
              // otherOnline removed — derived live from presenceMap in messageList
              paymentStatus: normalizedPaymentStatus,
              paymentAmountSats: Number(data.paymentAmountSats ?? 0),
              paymentTotalAmountSats: Number(data.paymentTotalAmountSats ?? 0),
              proposedRate: proposedRate || Number(data.proposedRate ?? 0),
              paymentInstallments: Number(data.paymentInstallments ?? 0),
              paymentCurrentInstallment: Number(data.paymentCurrentInstallment ?? 0),
              paymentPaidAmountSats: isFundedRecord ? Number(data.paymentPaidAmountSats ?? 0) : 0,
              paymentTotalChargedSats: Number(data.paymentTotalChargedSats ?? 0),
              platformFeePercent: Number(data.platformFeePercent ?? PLATFORM_FEE_PERCENT),
              platformFeeSats: Number(data.platformFeeSats ?? 0),
              paymentMode: data.paymentMode ?? "full",
              milestones: normalizeMilestones(data.milestones, isFundedRecord) as EscrowMilestone[],
              escrowFundedTotalSats: normalizeFundedAmount(data),
              escrowReleasedSats: normalizeReleasedAmount(data),
              invoiceMilestoneIndex: Number(data.invoiceMilestoneIndex ?? 0),
              paymentRequest: data.paymentRequest ?? "",
              paymentHash: data.paymentHash ?? "",
              // ── FIX: map paymentCreatedAt so expiry age check has data to work with ──
              paymentCreatedAt: data.paymentCreatedAt ?? null,
              workStatus: data.workStatus ?? "not_started",
              submissionMessage: data.submissionMessage ?? "",
              submissionLink: data.submissionLink ?? "",
              submissionAttachment: data.submissionAttachment ?? null,
              submissionReviewDueAt: data.submissionReviewDueAt,
              revisionMessage: data.revisionMessage ?? "",
            } as Conversation;
          })
        );

        setDbConversations(items);

        const activeIds = new Set(
          items.map((conv) => conv.freelancerId).filter(Boolean)
        );

        Object.keys(presenceUnsubs.current).forEach((uid) => {
          if (!activeIds.has(uid)) {
            presenceUnsubs.current[uid]?.();
            delete presenceUnsubs.current[uid];
            setPresenceMap((prev) => {
              const next = { ...prev };
              delete next[uid];
              return next;
            });
          }
        });

        activeIds.forEach((uid) => {
          if (presenceUnsubs.current[uid]) return;
          const unsubscribePresence = onSnapshot(doc(firebaseDb, "all_users", uid), (snap) => {
            const data = snap.exists() ? (snap.data() as any) : {};
            setPresenceMap((prev) => ({
              ...prev,
              [uid]: isPresenceActive(data),
            }));
          });
          presenceUnsubs.current[uid] = unsubscribePresence;
        });
      });

      const outreachQuery = query(
        collection(firebaseDb, "admin_outreach"),
        where("recipientId", "==", user.uid),
        where("recipientRole", "==", "client")
      );

      unsubscribeOutreach = onSnapshot(outreachQuery, (snapshot) => {
        const items = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          const rawCreatedAt = data.lastMessageAt;
          return {
            id: docSnap.id,
            subject: data.subject ?? "Support Thread",
            isAdminOutreach: true,
            freelancerId: "support",
            freelancerName: "Bitlance Support",
            freelancerAvatarUrl: "support",
            unread: {
              [user.uid]: data.unreadByRecipient ? 1 : 0
            },
            lastMessage: {
              text: data.lastMessageText ?? "Start conversation",
              senderId: data.lastSenderRole === "admin" ? "support" : user.uid,
              createdAt: rawCreatedAt ?? null
            }
          } as Conversation;
        });
        setDbOutreach(items);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeConversations) unsubscribeConversations();
      if (unsubscribeOutreach) unsubscribeOutreach();
      Object.values(presenceUnsubs.current).forEach((unsub) => unsub());
      presenceUnsubs.current = {};
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(presenceUnsubs.current).forEach((unsub) => unsub());
      presenceUnsubs.current = {};
    };
  }, []);

  useEffect(() => {
    const chatFromUrl = searchParams.get("chat");
    if (chatFromUrl) {
      setSelectedChat(chatFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedChat || !currentUserId) {
      setChatMessages([]);
      return;
    }
    const isOutreach = selectedConversation?.isAdminOutreach;
    const messagesQuery = query(
      collection(
        firebaseDb,
        isOutreach ? "admin_outreach" : "conversations",
        selectedChat,
        "messages"
      ),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const items: ChatMessage[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as any;
        const attachmentData = data.attachment as any;
        const isMe = data.senderId === currentUserId || (data.senderRole && data.senderRole !== "admin" && data.senderId === currentUserId);
        return {
          id: docSnap.id,
          sender: isMe ? "me" : "them",
          text: data.text ?? "",
          timestamp: formatTimestamp(data.createdAt) || "Now",
          isRead: true,
          attachment: attachmentData
            ? {
              name: attachmentData.name ?? "Attachment",
              size: attachmentData.size ?? formatFileSize(attachmentData.bytes ?? 0),
              url: attachmentData.url ?? "",
              mimeType: attachmentData.mimeType ?? "",
              resourceType: attachmentData.resourceType ?? "",
            }
            : undefined,
        };
      });
      setChatMessages(items);
    });
    return () => unsubscribe();
  }, [selectedChat, currentUserId, selectedConversation?.isAdminOutreach]);

  useEffect(() => {
    if (!selectedChat || !currentUserId) return;
    if (selectedConversation?.isAdminOutreach) {
      updateDoc(doc(firebaseDb, "admin_outreach", selectedChat), {
        unreadByRecipient: false,
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);
    } else {
      updateDoc(doc(firebaseDb, "conversations", selectedChat), {
        [`unread.${currentUserId}`]: 0,
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);
    }
  }, [selectedChat, currentUserId, selectedConversation?.isAdminOutreach]);

  // ── Auto-verify invoice on chat open / page refresh + 60-second polling ──
  // FIX: replaced single one-shot checkOnLoad with a function that also runs
  // on an interval so a tab left open for 30+ min will still catch expiry.
  // FIX: age-based expiry now works because paymentCreatedAt is mapped above.
  useEffect(() => {
    const conversation = selectedConversation;
    if (!conversation || !currentUserId) return;
    if (conversation.paymentStatus !== "invoice_created") return;
    const paymentRequest = conversation.paymentRequest;
    if (!paymentRequest) return;

    const contractId = getContractId(conversation);

    const checkInvoice = async () => {
      try {
        // Age-based expiry: no network call needed, just check the timestamp
        if (isInvoiceExpiredByAge(conversation)) {
          await clearUnpaidInvoice(conversation.id, contractId);
          return;
        }
        const res = await fetch("/api/check-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentRequest }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const status = data?.data?.lnInvoicePaymentStatusByPaymentRequest?.status;
        if (status === "PAID") {
          void handleVerifyPayment(paymentRequest);
        } else if (status === "EXPIRED") {
          await clearUnpaidInvoice(conversation.id, contractId);
        }
        // status === "PENDING" — invoice still alive, do nothing
      } catch {
        // non-fatal — invoice UI stays as-is
      }
    };

    // Run immediately on mount / chat switch
    void checkInvoice();

    // Then poll every 60 s so a tab left open also catches expiry
    const interval = window.setInterval(() => void checkInvoice(), 60_000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id, selectedConversation?.paymentStatus, selectedConversation?.paymentRequest, selectedConversation?.paymentCreatedAt]);

  const messageList = useMemo<MessageListItem[]>(() => {
    if (!currentUserId) return [];
    return conversations
      .map((conv) => {
        const otherName = conv.freelancerName || "Freelancer";
        const lastText = conv.lastMessage?.text ?? "Start the conversation";
        const lastTime = formatTimestamp(conv.lastMessage?.createdAt) || "";
        const unreadCount = conv.unread?.[currentUserId] ?? 0;
        const rawCreatedAt = conv.lastMessage?.createdAt;
        const createdAtMs = rawCreatedAt?.seconds
          ? rawCreatedAt.seconds * 1000
          : rawCreatedAt
            ? new Date(rawCreatedAt).getTime() || undefined
            : undefined;
        return {
          id: conv.id,
          sender: {
            name: otherName,
            avatar: conv.freelancerAvatarUrl || "/assets/avatar.png",
            profileUrl: conv.freelancerId ? `/freelancer/public/${conv.freelancerId}` : "",
            isOnline: !!presenceMap[conv.freelancerId],
          },
          lastMessage: {
            text: lastText,
            timestamp: lastTime,
            createdAtMs,
            isRead: unreadCount === 0,
          },
          unreadCount,
        };
      })
      .sort((a, b) => {
        const aMs = a.lastMessage.createdAtMs ?? 0;
        const bMs = b.lastMessage.createdAtMs ?? 0;
        return bMs - aMs;
      });
  }, [conversations, currentUserId, presenceMap]);

  const selectedMessage = selectedConversation
    ? messageList.find((m) => m.id === selectedConversation.id) ?? null
    : null;

  useEffect(() => {
    if (!selectedConversation) {
      setPendingSubmissionJob(null);
      return;
    }

    const contractId = getContractId(selectedConversation);
    const submissionQuery = query(
      collection(firebaseDb, "submitted_jobs"),
      where("contractId", "==", contractId),
      where("status", "==", "pending"),
      orderBy("submittedAt", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(submissionQuery, (snapshot) => {
      const item = snapshot.docs[0];
      if (!item) {
        setPendingSubmissionJob(null);
        return;
      }
      const data = item.data() as any;
      setPendingSubmissionJob({
        id: item.id,
        contractId: data.contractId,
        description: data.description || "",
        link: data.link || "",
        attachment: data.attachment ?? null,
        submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : new Date(),
        status: data.status ?? "pending",
        revisionMessage: data.revisionMessage ?? "",
        milestoneIndex: Number(data.milestoneIndex ?? 0),
        milestoneTitle: data.milestoneTitle ?? "",
      });
    });

    return () => unsubscribe();
  }, [selectedConversation]);

  const resolveFreelancerLightningAddress = async (freelancerId: string) => {
    if (!freelancerId) return "";
    const [freelancerSnap, allUsersSnap] = await Promise.all([
      getDoc(doc(firebaseDb, "freelancers", freelancerId)),
      getDoc(doc(firebaseDb, "all_users", freelancerId)),
    ]);
    const freelancerData = freelancerSnap.exists() ? (freelancerSnap.data() as any) : {};
    const allUserData = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
    return (
      freelancerData?.settings?.payment?.lightningAddress ||
      freelancerData?.lightningAddress ||
      freelancerData?.settings?.lightningAddress ||
      allUserData?.lightningAddress ||
      ""
    );
  };

  const handleApproveSubmission = async () => {
    if (!selectedConversation || !currentUserId || !pendingSubmissionJob) return;
    setApprovalErrorMessage("");
    setIsApprovingSubmission(true);

    try {
      const contractId = getContractId(selectedConversation);
      const contractDoc = await getDoc(doc(firebaseDb, "contracts", contractId));
      if (!contractDoc.exists()) {
        throw new Error("Unable to find the linked contract for this submission.");
      }

      const contract = contractDoc.data() as any;
      const paymentStatus = contract.paymentStatus ?? "unfunded";
      const fundedInstallments = Number(contract.paymentCurrentInstallment ?? 0);
      const totalInstallments = Number(contract.paymentInstallments ?? 1);
      const releasedInstallments = Number(contract.paymentReleasedInstallments ?? 0);
      const nextMilestoneIndex = releasedInstallments + 1;
      const milestone = Array.isArray(contract.milestones)
        ? contract.milestones.find((item: any, index: number) => Number(item.index ?? index + 1) === nextMilestoneIndex)
        : null;
      const budgetAmount = parseSats(contract.budget);
      const proposedAmount = Number(contract.proposedRate ?? 0);
      const milestonesTotal = Array.isArray(contract.milestones)
        ? contract.milestones.reduce((sum: number, m: any) => sum + Number(m.freelancerAmountSats ?? 0), 0)
        : 0;
      const fundedTotal = Number(contract.escrowFundedTotalSats ?? 0);
      const isProposedRateChosen =
        proposedAmount > 0 &&
        (Number(contract.paymentSubtotalSats) === proposedAmount ||
         milestonesTotal === proposedAmount ||
         fundedTotal === proposedAmount ||
         Number(contract.paymentTotalAmountSats) === proposedAmount);
      const totalAmount = Number(
        contract.paymentSubtotalSats ||
        (isProposedRateChosen ? proposedAmount : (contract.paymentTotalAmountSats || budgetAmount || 0))
      );
      const milestoneAmount = Number((milestone as any)?.freelancerAmountSats ?? calculateInstallmentAmount(totalAmount, totalInstallments, nextMilestoneIndex));
      const milestoneFundedSats = milestone ? Number(milestone.fundedSats ?? 0) : milestoneAmount;
      const milestoneReleasedSats = milestone ? Number(milestone.releasedSats ?? 0) : 0;
      const remainingMilestoneEscrow = Math.max(0, milestoneFundedSats - milestoneReleasedSats);

      if (nextMilestoneIndex > totalInstallments) {
        throw new Error("All milestones for this contract have already been approved and paid.");
      }
      if ((Number(contract.escrowReleasedSats ?? 0) + milestoneAmount) > totalAmount) {
        throw new Error(`Releasing ${milestoneAmount.toLocaleString()} sats would exceed the total contract budget of ${totalAmount.toLocaleString()} sats.`);
      }
      if ((Number(contract.escrowReleasedSats ?? 0) + milestoneAmount) > Number(contract.escrowFundedTotalSats ?? 0)) {
        throw new Error(`Releasing ${milestoneAmount.toLocaleString()} sats would exceed the funded escrow balance.`);
      }

      const canRelease = fundedInstallments >= nextMilestoneIndex && (paymentStatus === "funded" || paymentStatus === "released") && remainingMilestoneEscrow >= milestoneAmount;
      if (!canRelease) {
        const shortfall = Math.max(0, milestoneAmount - remainingMilestoneEscrow);
        throw new Error(shortfall > 0 ? `You need to fund ${shortfall.toLocaleString()} sats more in escrow before approving this milestone.` : "This milestone is not funded yet. Fund escrow before approving work.");
      }

      const lightningAddress = await resolveFreelancerLightningAddress(selectedConversation.freelancerId);
      if (!lightningAddress) {
        throw new Error("Freelancer has not set up a Lightning address. Payment cannot be processed.");
      }
      if (milestoneAmount <= 0) {
        throw new Error("Unable to calculate milestone amount.");
      }

      const paymentResponse = await fetch("/api/send-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lightningAddress,
          amount: milestoneAmount,
          memo: `Milestone ${nextMilestoneIndex} payment for contract: ${contract.title ?? selectedConversation.jobTitle ?? "Contract"}`,
        }),
      });

      const rawPaymentResponse = await paymentResponse.text();
      let paymentData: any = null;
      try {
        paymentData = rawPaymentResponse ? JSON.parse(rawPaymentResponse) : null;
      } catch {
        throw new Error(`Failed to parse payment response: ${rawPaymentResponse}`);
      }
      if (!paymentResponse.ok) throw new Error(paymentData?.error ?? `Failed to send payment to freelancer: ${rawPaymentResponse}`);

      await updateDoc(doc(firebaseDb, "submitted_jobs", pendingSubmissionJob.id), { status: "approved", updatedAt: serverTimestamp() });
      const nextReleasedCount = releasedInstallments + 1;
      const isFinalRelease = nextReleasedCount >= totalInstallments;
      const updatedMilestones = (Array.isArray(contract.milestones) ? contract.milestones : []).map((item: any, index: number) => {
        const itemIndex = Number(item.index ?? index + 1);
        if (itemIndex !== nextMilestoneIndex) return item;
        return { ...item, releasedSats: Number(item.releasedSats ?? 0) + milestoneAmount, status: "released", releasedAt: new Date().toISOString() };
      });
      const contractUpdate = {
        workStatus: isFinalRelease ? "approved" : "in_progress",
        paymentReleasedInstallments: nextReleasedCount,
        escrowReleasedSats: (Number(contract.escrowReleasedSats ?? 0) + milestoneAmount),
        milestones: updatedMilestones,
        paymentStatus: isFinalRelease ? "released" : "funded",
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(firebaseDb, "contracts", contractId), contractUpdate, { merge: true });
      await setDoc(doc(firebaseDb, "escrows", contractId), {
        totalReleasedToFreelancerSats: contractUpdate.escrowReleasedSats,
        releasedMilestoneCount: nextReleasedCount,
        milestones: updatedMilestones,
        status: isFinalRelease ? "released" : "funded",
        updatedAt: serverTimestamp(),
      }, { merge: true });

      const conversationDoc = await getConversationForContract(selectedConversation.jobId, selectedConversation.freelancerId);
      const approvalMessage = `Milestone ${nextMilestoneIndex}${milestone?.title || milestone?.name ? `: ${milestone?.title || milestone?.name}` : ""} approved and payment of ${milestoneAmount} sats sent to freelancer.`;
      if (conversationDoc) {
        await updateDoc(conversationDoc.ref, {
          workStatus: contractUpdate.workStatus,
          paymentStatus: contractUpdate.paymentStatus,
          escrowReleasedSats: contractUpdate.escrowReleasedSats,
          milestones: updatedMilestones,
          updatedAt: serverTimestamp(),
          "lastMessage.text": approvalMessage,
          "lastMessage.senderId": "system",
          "lastMessage.createdAt": serverTimestamp(),
          [`unread.${selectedConversation.freelancerId}`]: increment(1),
        });
      }

      void sendUserNotification({
        userId: selectedConversation.freelancerId,
        title: "Milestone approved",
        body: approvalMessage,
        url: "/freelancer/dashboard/contracts",
        tag: `approval-${contractId}-${nextMilestoneIndex}`,
      }).catch(console.error);
    } catch (error) {
      console.error("Error approving submission:", error);
      setApprovalErrorMessage(error instanceof Error ? error.message : "Failed to approve the submission and send payment. Please try again.");
      throw error;
    } finally {
      setIsApprovingSubmission(false);
    }
  };

  const handleRequestChanges = async (note: string) => {
    if (!selectedConversation || !currentUserId || !pendingSubmissionJob) return;
    if (!note.trim()) {
      throw new Error("Write a short note so the freelancer knows what to adjust.");
    }

    try {
      const contractId = getContractId(selectedConversation);
      const contractDoc = await getDoc(doc(firebaseDb, "contracts", contractId));
      if (!contractDoc.exists()) {
        throw new Error("Unable to find the linked contract for this submission.");
      }
      const contract = contractDoc.data() as any;
      const nextMilestoneIndex = Number(contract.paymentReleasedInstallments ?? 0) + 1;
      const updatedMilestones = (Array.isArray(contract.milestones) ? contract.milestones : []).map((item: any, index: number) => {
        const itemIndex = Number(item.index ?? index + 1);
        if (itemIndex !== nextMilestoneIndex) return item;
        return { ...item, status: "funded", revisionMessage: note, changesRequestedAt: new Date().toISOString() };
      });
      const messageText = `Work returned for adjustments on "${contract.title ?? selectedConversation.jobTitle ?? "this contract"}". Note: ${note}`;
      const conversationId = selectedConversation.jobId && selectedConversation.freelancerId
        ? createConversationId(selectedConversation.jobId, selectedConversation.freelancerId)
        : contractId;

      await Promise.all([
        updateDoc(doc(firebaseDb, "submitted_jobs", pendingSubmissionJob.id), {
          status: "rejected",
          revisionMessage: note,
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        setDoc(doc(firebaseDb, "contracts", contractId), {
          workStatus: "changes_requested",
          revisionMessage: note,
          milestones: updatedMilestones,
          unreadByFreelancer: true,
          updatedAt: serverTimestamp(),
        }, { merge: true }),
        setDoc(doc(firebaseDb, "conversations", conversationId), {
          workStatus: "changes_requested",
          revisionMessage: note,
          milestones: updatedMilestones,
          "lastMessage.text": messageText,
          "lastMessage.senderId": "system",
          "lastMessage.createdAt": serverTimestamp(),
          [`unread.${selectedConversation.freelancerId}`]: increment(1),
          updatedAt: serverTimestamp(),
        }, { merge: true }),
        addDoc(collection(firebaseDb, "conversations", conversationId, "messages"), {
          senderId: "system",
          senderRole: "system",
          text: messageText,
          messageType: "changes_requested",
          createdAt: serverTimestamp(),
        }),
      ]);

      void sendUserNotification({
        userId: selectedConversation.freelancerId,
        title: "Changes requested",
        body: messageText,
        url: "/freelancer/dashboard/contracts",
        tag: `changes-${contractId}-${nextMilestoneIndex}`,
      }).catch(console.error);
    } catch (error) {
      console.error("Error requesting changes:", error);
      throw error;
    }
  };

  const handleSendMessage = async (text: string, file?: File | null) => {
    if (!selectedConversation || !currentUserId) return;
    const otherId = selectedConversation.freelancerId;
    let attachment: Record<string, any> | undefined;

    if (file) {
      const idToken = await firebaseAuth.currentUser?.getIdToken();
      if (!idToken) return;
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
      attachment = {
        url: uploadPayload.url,
        name: uploadPayload.name ?? file.name,
        bytes: uploadPayload.bytes ?? file.size,
        size: formatFileSize(uploadPayload.bytes ?? file.size),
        mimeType: uploadPayload.mimeType ?? file.type,
        resourceType: uploadPayload.resourceType ?? "auto",
        publicId: uploadPayload.publicId ?? "",
      };
    }

    const messageText = text || (attachment ? `Shared a file: ${attachment.name}` : "");
    if (selectedConversation.isAdminOutreach) {
      await addDoc(collection(firebaseDb, "admin_outreach", selectedConversation.id, "messages"), {
        senderId: currentUserId,
        senderRole: "client",
        text: messageText,
        attachment: attachment ?? null,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(firebaseDb, "admin_outreach", selectedConversation.id), {
        lastMessageText: messageText,
        lastSenderRole: "client",
        lastMessageAt: serverTimestamp(),
        unreadByRecipient: false,
        unreadByAdmin: true,
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(collection(firebaseDb, "conversations", selectedConversation.id, "messages"), {
        senderId: currentUserId,
        senderRole: "client",
        text: messageText,
        attachment: attachment ?? null,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(firebaseDb, "conversations", selectedConversation.id), {
        "lastMessage.text": messageText,
        "lastMessage.senderId": currentUserId,
        "lastMessage.createdAt": serverTimestamp(),
        [`unread.${currentUserId}`]: 0,
        [`unread.${otherId}`]: increment(1),
        updatedAt: serverTimestamp(),
      });
      void sendUserNotification({
        userId: otherId,
        title: `New message from ${selectedConversation.clientName || "Client"}`,
        body: messageText,
        url: `/freelancer/dashboard/messages?chat=${selectedConversation.id}`,
        tag: `message-${selectedConversation.id}`,
      }).catch(console.error);
    }
  };

  const handleCreatePaymentInvoice = async ({
    installments = 1,
    fundingMode = "full",
    milestoneTitles = [],
    chosenAmount,
  }: {
    installments: number;
    fundingMode: FundingMode;
    milestoneTitles: string[];
    chosenAmount?: number;
  }) => {
    if (!selectedConversation || !currentUserId) return;

    const contractId =
      selectedConversation.jobId && selectedConversation.freelancerId
        ? `${selectedConversation.jobId}_${selectedConversation.freelancerId}`
        : selectedConversation.id;

    const contractSnap = await getDoc(doc(firebaseDb, "contracts", contractId));
    const contractData = contractSnap.exists() ? (contractSnap.data() as any) : {};
    const conversationSnap = await getDoc(doc(firebaseDb, "conversations", selectedConversation.id));
    const liveConversationData = conversationSnap.exists()
      ? (conversationSnap.data() as Record<string, unknown>)
      : {};
    const escrowSnap = await getDoc(doc(firebaseDb, "escrows", contractId));
    const escrowData = escrowSnap.exists() ? (escrowSnap.data() as Record<string, unknown>) : {};
    if (!contractSnap.exists() || contractData.status !== "Active") {
      throw new Error("Accept this freelancer's proposal before funding escrow.");
    }
    if (
      contractData.jobId !== selectedConversation.jobId ||
      contractData.clientId !== currentUserId ||
      contractData.freelancerId !== selectedConversation.freelancerId
    ) {
      throw new Error("This escrow is not linked to the accepted job contract.");
    }

    const livePaymentStatus = normalizePaymentStatus({
      ...contractData,
      ...selectedConversation,
      ...liveConversationData,
    });
    const livePaymentRequest =
      typeof liveConversationData.paymentRequest === "string"
        ? liveConversationData.paymentRequest
        : selectedConversation.paymentRequest;

    if (livePaymentStatus === "invoice_created" && livePaymentRequest) {
      throw new Error("An escrow invoice is already active. Check or pay the current invoice before creating another one.");
    }

    const existingFundingData = escrowSnap.exists()
      ? { ...contractData, ...selectedConversation, ...liveConversationData, ...escrowData }
      : {};
    const fundedAmount = normalizeFundedAmount(existingFundingData);
    const releasedAmount = normalizeReleasedAmount(existingFundingData);
    const originalJobAmount =
      parseSats(contractData.budget) ||
      parseSats(contractData.amount) ||
      Number(contractData.paymentTotalAmountSats ?? 0) ||
      selectedConversation.paymentTotalAmountSats ||
      selectedConversation.paymentAmountSats ||
      0;
    const totalAmount =
      chosenAmount && chosenAmount > 0 ? chosenAmount : originalJobAmount;
    const jobAmountSats = totalAmount;
    const hasFundedAny = fundedAmount > 0;
    const paymentInstallments = hasFundedAny
      ? (selectedConversation.paymentInstallments || Number(contractData.paymentInstallments ?? 0) || clampInstallments(installments))
      : clampInstallments(installments);
    const platformFeeSats = Math.ceil(totalAmount * (PLATFORM_FEE_PERCENT / 100));
    const totalClientPayable = totalAmount + platformFeeSats;
    if (fundedAmount >= totalClientPayable && totalClientPayable > 0) {
      throw new Error("Escrow is already fully funded. No new invoice can be created for this contract.");
    }
    const existingMilestones = hasFundedAny
      ? (escrowSnap.exists() && Array.isArray(escrowData.milestones) && escrowData.milestones.length
        ? escrowData.milestones
        : Array.isArray(contractData.milestones) && contractData.milestones.length
          ? normalizeMilestones(contractData.milestones, false)
          : Array.isArray(selectedConversation.milestones) && selectedConversation.milestones.length
            ? normalizeMilestones(selectedConversation.milestones, false)
            : buildMilestones(totalAmount, totalClientPayable, paymentInstallments, milestoneTitles))
      : buildMilestones(totalAmount, totalClientPayable, paymentInstallments, milestoneTitles);
    const milestones = existingMilestones.map((milestone: any, index: number) => ({
      index: Number(milestone.index ?? index + 1),
      title: milestone.title || milestoneTitles[index] || `Milestone ${index + 1}`,
      freelancerAmountSats: Number(milestone.freelancerAmountSats ?? calculateInstallmentAmount(totalAmount, paymentInstallments, index + 1)),
      platformFeeSats: Number(milestone.platformFeeSats ?? 0),
      totalClientPaysSats: Number(milestone.totalClientPaysSats ?? calculateInstallmentAmount(totalClientPayable, paymentInstallments, index + 1)),
      fundedSats: Number(milestone.fundedSats ?? 0),
      releasedSats: Number(milestone.releasedSats ?? 0),
      status: milestone.status ?? "pending",
    })) as EscrowMilestone[];
    const nextMilestone =
      milestones.find((milestone) => milestone.status !== "funded" && milestone.status !== "released") ??
      milestones[milestones.length - 1];
    const hasOpenFundedMilestone = milestones.some(
      (milestone) =>
        Number(milestone.fundedSats ?? 0) > Number(milestone.releasedSats ?? 0) &&
        (milestone.status === "funded" || milestone.status === "submitted" || milestone.status === "approved")
    );
    if (hasOpenFundedMilestone) {
      throw new Error("A funded milestone is still open. Release or complete it before creating another invoice.");
    }
    if (milestones.every((milestone) => milestone.status === "funded" || milestone.status === "released")) {
      throw new Error("Escrow is already fully funded. No new invoice can be created for this contract.");
    }
    const currentInstallment = fundingMode === "full" ? 1 : nextMilestone.index;
    const amount = fundingMode === "full"
      ? Math.max(0, totalClientPayable - fundedAmount)
      : Math.max(0, nextMilestone.totalClientPaysSats - nextMilestone.fundedSats);

    if (!totalAmount || !amount) {
      throw new Error("Contract amount is missing or escrow is already fully funded.");
    }

    const res = await fetch("/api/create-invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error ?? "Unable to create Blink invoice.");
    }

    const errors = data?.data?.lnInvoiceCreate?.errors ?? [];
    if (errors.length) {
      throw new Error(errors[0]?.message ?? "Blink could not create the invoice.");
    }

    const invoice = data?.data?.lnInvoiceCreate?.invoice;
    const paymentRequest = invoice?.paymentRequest;
    const paymentHash = invoice?.paymentHash;

    if (!paymentRequest) {
      throw new Error("Blink did not return a Lightning payment request.");
    }

    const paymentUpdate = {
      contractId,
      conversationId: selectedConversation.id,
      jobId: selectedConversation.jobId,
      proposalId: selectedConversation.proposalId ?? contractData.proposalId ?? "",
      clientId: selectedConversation.clientId,
      freelancerId: selectedConversation.freelancerId,
      paymentProvider: "blink",
      paymentStatus: "invoice_created",
      paymentTotalAmountSats: jobAmountSats,
      paymentSubtotalSats: totalAmount,
      platformFeePercent: PLATFORM_FEE_PERCENT,
      platformFeeSats,
      paymentTotalChargedSats: totalClientPayable,
      paymentMode: fundingMode,
      paymentInstallments,
      paymentCurrentInstallment: currentInstallment,
      paymentAmountSats: Number(invoice?.satoshis ?? amount),
      invoiceMilestoneIndex: currentInstallment,
      paymentRequest,
      paymentHash: paymentHash ?? "",
      paymentCreatedAt: serverTimestamp(),
      milestones,
      escrowFundedTotalSats: fundedAmount,
      escrowReleasedSats: releasedAmount,
      updatedAt: serverTimestamp(),
    };
    const escrowId = contractId;
    const invoiceMessage = fundingMode === "full"
      ? `Lightning invoice created for full escrow (${totalClientPayable.toLocaleString()} sats including ${platformFeeSats.toLocaleString()} sats platform fee).`
      : `Lightning invoice created for Milestone ${currentInstallment}: ${nextMilestone.title}.`;

    await Promise.all([
      updateDoc(doc(firebaseDb, "conversations", selectedConversation.id), {
        ...paymentUpdate,
        "lastMessage.text": invoiceMessage,
        "lastMessage.senderId": "system",
        "lastMessage.createdAt": serverTimestamp(),
        [`unread.${currentUserId}`]: 0,
        [`unread.${selectedConversation.freelancerId}`]: increment(1),
      }),
      setDoc(
        doc(firebaseDb, "contracts", contractId),
        {
          ...paymentUpdate,
          escrowAmount: Number(invoice?.satoshis ?? amount),
        },
        { merge: true }
      ),
      setDoc(
        doc(firebaseDb, "escrows", escrowId),
        {
          escrowId,
          conversationId: selectedConversation.id,
          contractId,
          jobId: selectedConversation.jobId,
          jobTitle: selectedConversation.jobTitle,
          clientId: selectedConversation.clientId,
          clientName: selectedConversation.clientName,
          freelancerId: selectedConversation.freelancerId,
          freelancerName: selectedConversation.freelancerName,
          jobAmountSats: jobAmountSats,
          platformFeePercent: PLATFORM_FEE_PERCENT,
          platformFeeSats,
          totalClientPayableSats: totalClientPayable,
          paymentMode: fundingMode,
          milestoneCount: paymentInstallments,
          milestones,
          totalFundedSats: fundedAmount,
          totalReleasedToFreelancerSats: releasedAmount,
          status: fundedAmount > 0 ? "partially_funded" : "invoice_created",
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      ),
      addDoc(collection(firebaseDb, "conversations", selectedConversation.id, "messages"), {
        senderId: "system",
        senderRole: "system",
        text: `${invoiceMessage} Freelancer should wait for funding confirmation before starting work.`,
        attachment: null,
        createdAt: serverTimestamp(),
      }),
    ]);
    void sendUserNotification({
      userId: selectedConversation.freelancerId,
      title: "Escrow invoice created",
      body: `${invoiceMessage} Open the chat for payment status.`,
      url: `/freelancer/dashboard/messages?chat=${selectedConversation.id}`,
      tag: `invoice-${selectedConversation.id}`,
    }).catch(console.error);

    return paymentRequest;
  };

  const handleCancelInvoice = async () => {
    if (!selectedConversation) return;
    const contractId = getContractId(selectedConversation);
    await clearUnpaidInvoice(selectedConversation.id, contractId);
  };

  const handleVerifyPayment = async (
    paymentRequestOverride?: string
  ): Promise<"funded" | "pending" | "expired"> => {
    if (!selectedConversation) return "pending";
    const paymentRequestToCheck = paymentRequestOverride || selectedConversation?.paymentRequest;
    if (!paymentRequestToCheck || !currentUserId) return "pending";

    const res = await fetch("/api/check-invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentRequest: paymentRequestToCheck }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error ?? "Unable to verify Blink invoice.");
    }

    const statusPayload = data?.data?.lnInvoicePaymentStatusByPaymentRequest;
    const blinkStatus = statusPayload?.status;

    if (blinkStatus === "PAID") {
      const paymentInstallments = selectedConversation.paymentInstallments || 1;
      const currentInstallment = selectedConversation.paymentCurrentInstallment || 1;
      const contractId =
        selectedConversation.jobId && selectedConversation.freelancerId
          ? `${selectedConversation.jobId}_${selectedConversation.freelancerId}`
          : selectedConversation.id;
      const paymentHash = statusPayload?.paymentHash ?? selectedConversation.paymentHash ?? "";
      const contractSnap = await getDoc(doc(firebaseDb, "contracts", contractId));
      const contractData = contractSnap.exists() ? (contractSnap.data() as any) : {};
      if (paymentHash && contractData.lastFundedPaymentHash === paymentHash) {
        return "funded";
      }
      const jobAmount =
        selectedConversation.paymentSubtotalSats ||
        selectedConversation.paymentTotalAmountSats ||
        Number(contractData.paymentSubtotalSats ?? 0) ||
        Number(contractData.paymentTotalAmountSats ?? 0) ||
        0;
      const platformFeeSats =
        selectedConversation.platformFeeSats ||
        Number(contractData.platformFeeSats ?? 0) ||
        Math.ceil(jobAmount * (PLATFORM_FEE_PERCENT / 100));
      const totalClientPayable = selectedConversation.paymentTotalChargedSats || Number(contractData.paymentTotalChargedSats ?? 0) || jobAmount + platformFeeSats;
      const existingMilestones = Array.isArray(selectedConversation.milestones) && selectedConversation.milestones.length
        ? selectedConversation.milestones
        : Array.isArray(contractData.milestones) && contractData.milestones.length
          ? contractData.milestones
          : buildMilestones(jobAmount, totalClientPayable, paymentInstallments, []);
      const invoiceAmount = selectedConversation.paymentAmountSats || 0;
      const isFullFunding = (selectedConversation.paymentMode ?? contractData.paymentMode ?? "full") === "full";
      const nextMilestones = existingMilestones.map((milestone: any) => {
        const shouldFund = isFullFunding || Number(milestone.index) === currentInstallment;
        if (!shouldFund) return milestone;
        return {
          ...milestone,
          fundedSats: Number(milestone.totalClientPaysSats ?? 0),
          status: milestone.status === "released" ? "released" : "funded",
        };
      }) as EscrowMilestone[];
      const fundedFreelancerAmount = nextMilestones.reduce(
        (sum, milestone) => sum + (milestone.status === "funded" || milestone.status === "released" ? milestone.freelancerAmountSats : 0),
        0
      );
      const fundedTotalAmount = isFullFunding
        ? totalClientPayable
        : (selectedConversation.escrowFundedTotalSats || Number(contractData.escrowFundedTotalSats ?? 0) || 0) + invoiceAmount;
      const fundedThroughInstallment = isFullFunding ? paymentInstallments : currentInstallment;
      const firstReadyMilestone = nextMilestones.find((milestone) => milestone.status === "funded" && !milestone.releasedSats) ?? nextMilestones[0];
      const allMilestonesFunded = nextMilestones.every((milestone) => milestone.status === "funded" || milestone.status === "released");
      const fundedUpdate = {
        contractId,
        conversationId: selectedConversation.id,
        jobId: selectedConversation.jobId,
        proposalId: selectedConversation.proposalId ?? contractData.proposalId ?? "",
        clientId: selectedConversation.clientId,
        freelancerId: selectedConversation.freelancerId,
        paymentStatus: "funded",
        workStatus: "in_progress",
        paymentInstallments,
        paymentCurrentInstallment: fundedThroughInstallment,
        paymentPaidAmountSats: fundedFreelancerAmount,
        paymentTotalChargedSats: totalClientPayable,
        platformFeePercent: PLATFORM_FEE_PERCENT,
        platformFeeSats,
        escrowFundedTotalSats: fundedTotalAmount,
        milestones: nextMilestones,
        paymentReceivedAt: serverTimestamp(),
        paymentPreimage: statusPayload?.paymentPreimage ?? "",
        paymentHash,
        lastFundedPaymentHash: paymentHash,
        updatedAt: serverTimestamp(),
      };
      const fundedMessage = isFullFunding
        ? `Full escrow funded for ${paymentInstallments} milestone${paymentInstallments === 1 ? "" : "s"}. Start work for Milestone ${firstReadyMilestone.index}: ${firstReadyMilestone.title}.`
        : `Client funded Milestone ${firstReadyMilestone.index}: ${firstReadyMilestone.title}. You can start work for this milestone.`;
      const systemMessageId = `payment_funded_${currentInstallment}_${paymentHash || selectedConversation.id}`;

      await Promise.all([
        updateDoc(doc(firebaseDb, "conversations", selectedConversation.id), {
          ...fundedUpdate,
          "lastMessage.text": fundedMessage,
          "lastMessage.senderId": "system",
          "lastMessage.createdAt": serverTimestamp(),
          [`unread.${currentUserId}`]: 0,
          [`unread.${selectedConversation.freelancerId}`]: increment(1),
        }),
        setDoc(doc(firebaseDb, "contracts", contractId), fundedUpdate, { merge: true }),
        setDoc(
          doc(firebaseDb, "escrows", contractId),
          {
            escrowId: contractId,
            conversationId: selectedConversation.id,
            contractId,
            jobId: selectedConversation.jobId,
            jobTitle: selectedConversation.jobTitle,
            clientId: selectedConversation.clientId,
            clientName: selectedConversation.clientName,
            freelancerId: selectedConversation.freelancerId,
            freelancerName: selectedConversation.freelancerName,
            jobAmountSats: jobAmount,
            platformFeePercent: PLATFORM_FEE_PERCENT,
            platformFeeSats,
            totalClientPayableSats: totalClientPayable,
            paymentMode: selectedConversation.paymentMode ?? contractData.paymentMode ?? "full",
            milestoneCount: paymentInstallments,
            milestones: nextMilestones,
            totalFundedSats: fundedTotalAmount,
            totalReleasedToFreelancerSats: Number(contractData.escrowReleasedSats ?? selectedConversation.escrowReleasedSats ?? 0),
            status: allMilestonesFunded ? "funded" : "partially_funded",
            lastFundedPaymentHash: paymentHash,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ),
        setDoc(
          doc(firebaseDb, "conversations", selectedConversation.id, "messages", systemMessageId),
          {
            senderId: "system",
            senderRole: "system",
            text: fundedMessage,
            attachment: null,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        ),
      ]);
      void sendUserNotification({
        userId: selectedConversation.freelancerId,
        title: "Escrow funded",
        body: fundedMessage,
        url: `/freelancer/dashboard/messages?chat=${selectedConversation.id}`,
        tag: `funded-${selectedConversation.id}`,
      }).catch(console.error);

      return "funded";
    }

    return "pending";
  };

  return (
    <div className="min-h-screen bg-[#F7F6F3] font-sans">
      <div className="flex">
        <ClientSidebar active="/client/dashboard/messages" hideMobileToggle={!!selectedChat} />

        <div className={`flex-1 lg:ml-0 ${selectedChat ? "pt-0" : "pt-3"} md:pt-0`}>
          <div className="flex h-[100dvh] pt-0">
            <div
              className={`
              w-full md:w-1/3 border-r border-[#e8e6e1]  bg-[#F6F3F1]
              ${selectedChat ? "hidden md:block" : "block"}
              pt-0
            `}
            >
              <MessagesList
                messages={messageList}
                onSelectChat={setSelectedChat}
                selectedChat={selectedChat}
              />
            </div>

            <div
              className={`
              h-full w-full md:w-2/3 bg-[#F7F6F3]
              ${selectedChat ? "block" : "hidden md:block"}
              pt-0
            `}
            >
              {selectedMessage && selectedConversation ? (
                <>
                  <ChatView
                    message={selectedMessage}
                    chatMessages={chatMessages}
                    onBack={() => setSelectedChat(null)}
                    onSendMessage={handleSendMessage}
                    viewerRole="client"
                    paymentStatus={selectedConversation.paymentStatus}
                    paymentAmountSats={selectedConversation.paymentAmountSats}
                    paymentTotalAmountSats={selectedConversation.paymentTotalAmountSats}
                    proposedRate={selectedConversation.proposedRate}
                    paymentInstallments={selectedConversation.paymentInstallments}
                    paymentCurrentInstallment={selectedConversation.paymentCurrentInstallment}
                    paymentPaidAmountSats={selectedConversation.paymentPaidAmountSats}
                    paymentTotalChargedSats={selectedConversation.paymentTotalChargedSats}
                    platformFeePercent={selectedConversation.platformFeePercent}
                    platformFeeSats={selectedConversation.platformFeeSats}
                    paymentMode={selectedConversation.paymentMode}
                    milestones={selectedConversation.milestones}
                    paymentRequest={selectedConversation.paymentRequest}
                    workStatus={selectedConversation.workStatus}
                    submittedWorkHref={`/client/dashboard/contracts?contract=${selectedConversation.jobId && selectedConversation.freelancerId
                        ? `${selectedConversation.jobId}_${selectedConversation.freelancerId}`
                        : selectedConversation.id
                      }`}
                    onCreatePaymentInvoice={handleCreatePaymentInvoice}
                    onVerifyPayment={handleVerifyPayment}
                    onCancelInvoice={handleCancelInvoice}
                    onApproveSubmission={handleApproveSubmission}
                    onRequestChanges={handleRequestChanges}
                    pendingSubmissionJob={pendingSubmissionJob}
                    onOpenContractModal={handleOpenContractModal}
                    jobId={selectedConversation.jobId}
                    jobTitle={selectedConversation.jobTitle}
                    contractId={
                      selectedConversation.jobId && selectedConversation.freelancerId
                        ? `${selectedConversation.jobId}_${selectedConversation.freelancerId}`
                        : selectedConversation.id
                    }
                    viewerRole_disputeRole="client"
                    isAdminOutreach={selectedConversation.isAdminOutreach}
                    subject={selectedConversation.subject}
                  />

                  {contractModalContractId ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeContractModal} />
                      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/30 bg-white shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Contract preview</p>
                            <h2 className="mt-2 text-xl font-semibold text-slate-950">{contractModalContract?.title || 'Contract details'}</h2>
                          </div>
                          <button
                            type="button"
                            onClick={closeContractModal}
                            className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
                            aria-label="Close contract preview"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="space-y-4 px-5 py-5 text-sm text-slate-700">
                          {contractModalLoading ? (
                            <p>Loading contract details…</p>
                          ) : contractModalError ? (
                            <p className="text-red-600">{contractModalError}</p>
                          ) : contractModalContract ? (
                            <>
                              <div className="space-y-3">
                                <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Status</p>
                                <div className="flex flex-wrap gap-2">
                                  {contractModalContract.workStatus ? (
                                    <span className="rounded-full bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">{contractModalContract.workStatus.replace(/_/g, ' ')}</span>
                                  ) : null}
                                  {contractModalContract.paymentStatus ? (
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">{contractModalContract.paymentStatus.replace(/_/g, ' ')}</span>
                                  ) : null}
                                </div>
                              </div>

                              <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
                                <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Submission note</p>
                                <p className="text-sm leading-relaxed text-slate-800">{contractModalContract.submissionMessage || 'No submission note provided.'}</p>
                                {contractModalContract.submissionLink ? (
                                  <p className="text-sm break-all text-blue-700 underline"><a href={contractModalContract.submissionLink} target="_blank" rel="noreferrer">Open delivery link</a></p>
                                ) : null}
                                {contractModalContract.submissionAttachment?.url ? (
                                  <a href={contractModalContract.submissionAttachment.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200">View attachment</a>
                                ) : null}
                              </div>

                              <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
                                <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Contract summary</p>
                                <p>{contractModalContract.description || 'No contract description available.'}</p>
                                <div className="grid grid-cols-2 gap-3 pt-3 text-sm text-slate-700">
                                  <div>
                                    <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Installments</p>
                                    <p>{contractModalContract.paymentCurrentInstallment ?? 0} / {contractModalContract.paymentInstallments ?? 0}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Budget</p>
                                    <p>{contractModalContract.paymentTotalChargedSats ? `${contractModalContract.paymentTotalChargedSats.toLocaleString()} sats` : `${contractModalContract.paymentTotalAmountSats?.toLocaleString() ?? 0} sats`}</p>
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <p>Select a conversation to start messaging</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}