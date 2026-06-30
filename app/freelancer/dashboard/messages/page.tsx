"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import FreelancerSidebar from "@/components/molecules/FreelancerSidebar";
import MessagesList from "@/components/organisms/MessagesList";
import ChatView from "@/components/organisms/ChatView";
import { sendUserNotification } from "@/lib/notifications";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
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
  paymentRequest?: string;
  paymentHash?: string;
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

const PLATFORM_FEE_PERCENT = 5;

const calculateInstallmentAmount = (total: number, installments: number, installment: number) => {
  const safeTotal = Math.max(0, Math.trunc(total));
  const safeInstallments = Math.max(1, Math.min(3, Math.trunc(installments)));
  const safeInstallment = Math.max(1, Math.min(safeInstallments, Math.trunc(installment)));
  const base = Math.floor(safeTotal / safeInstallments);
  const remainder = safeTotal % safeInstallments;
  return base + (safeInstallment <= remainder ? 1 : 0);
};

const parseSats = (value: unknown) => {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "").replace(/[^0-9]/g, "");
  return cleaned ? Number(cleaned) : 0;
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

const buildMilestones = (jobAmount: number, totalClientPayable: number, count: number) =>
  Array.from({ length: count }, (_, index) => {
    const installment = index + 1;
    const freelancerAmountSats = calculateInstallmentAmount(jobAmount, count, installment);
    const totalClientPaysSats = calculateInstallmentAmount(totalClientPayable, count, installment);
    return {
      index: installment,
      title: count === 1 ? "Complete project" : `Milestone ${installment}`,
      freelancerAmountSats,
      platformFeeSats: Math.max(0, totalClientPaysSats - freelancerAmountSats),
      totalClientPaysSats,
      fundedSats: 0,
      releasedSats: 0,
      status: "pending" as const,
    };
  });

export default function MessagesPage() {
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
        where("freelancerId", "==", user.uid)
      );

      unsubscribeConversations = onSnapshot(conversationsQuery, async (snapshot) => {
        const items = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data() as any;
            const clientId = data.clientId ?? "";
            let clientName = data.clientName ?? "";
            let clientAvatarUrl = data.clientAvatarUrl ?? "";

            if (clientId && (!clientName || !clientAvatarUrl)) {
              try {
                const [clientSnap, allUsersSnap] = await Promise.all([
                  getDoc(doc(firebaseDb, "clients", clientId)),
                  getDoc(doc(firebaseDb, "all_users", clientId)),
                ]);
                const c = clientSnap.exists() ? (clientSnap.data() as any) : {};
                const a = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
                if (!clientName) {
                  const composedName = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
                  clientName = c.fullName ?? a.fullName ?? composedName ?? a.name ?? "Client";
                }
                if (!clientAvatarUrl) clientAvatarUrl = c.avatarUrl ?? a.avatarUrl ?? "";
              } catch {
                // keep fallback values
              }
            }

            return {
              id: docSnap.id,
              jobId: data.jobId ?? "",
              jobTitle: data.jobTitle ?? "",
              clientId,
              clientName: clientName || "Client",
              freelancerId: data.freelancerId ?? "",
              freelancerName: data.freelancerName ?? "",
              clientAvatarUrl,
              freelancerAvatarUrl: data.freelancerAvatarUrl ?? "",
              canFreelancerMessage: !!data.canFreelancerMessage,
              lastMessage: data.lastMessage ?? {},
              unread: data.unread ?? {},
              // otherOnline removed — derived live from presenceMap in messageList
              paymentStatus: data.paymentStatus ?? "unfunded",
              paymentAmountSats: Number(data.paymentAmountSats ?? 0),
              paymentTotalAmountSats: Number(data.paymentTotalAmountSats ?? 0),
              paymentInstallments: Number(data.paymentInstallments ?? 0),
              paymentCurrentInstallment: Number(data.paymentCurrentInstallment ?? 0),
              paymentPaidAmountSats: Number(data.paymentPaidAmountSats ?? 0),
              paymentTotalChargedSats: Number(data.paymentTotalChargedSats ?? 0),
              platformFeePercent: Number(data.platformFeePercent ?? PLATFORM_FEE_PERCENT),
              platformFeeSats: Number(data.platformFeeSats ?? 0),
              paymentMode: data.paymentMode ?? "full",
              milestones: Array.isArray(data.milestones) ? data.milestones : [],
              escrowFundedTotalSats: Number(data.escrowFundedTotalSats ?? 0),
              escrowReleasedSats: Number(data.escrowReleasedSats ?? 0),
              paymentRequest: data.paymentRequest ?? "",
              paymentHash: data.paymentHash ?? "",
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
          items.map((conv) => conv.clientId).filter(Boolean)
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
        where("recipientRole", "==", "freelancer")
      );

      unsubscribeOutreach = onSnapshot(outreachQuery, (snapshot) => {
        const items = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          const rawCreatedAt = data.lastMessageAt;
          return {
            id: docSnap.id,
            subject: data.subject ?? "Support Thread",
            isAdminOutreach: true,
            clientId: "support",
            clientName: "Bitlance Support",
            clientAvatarUrl: "support",
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

  const messageList = useMemo<MessageListItem[]>(() => {
    if (!currentUserId) return [];
    return conversations
      .map((conv) => {
        const otherName = conv.clientName || "Client";
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
            avatar: conv.clientAvatarUrl || "/assets/avatar.png",
            profileUrl: conv.clientId ? `/client/public/${conv.clientId}` : "",
            isOnline: !!presenceMap[conv.clientId],
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

  const handleSendMessage = async (text: string, file?: File | null) => {
    if (!selectedConversation || !currentUserId) return;
    const otherId = selectedConversation.clientId;
    let attachment: Record<string, any> | undefined;

    if (file) {
      attachment = await uploadChatFile(file);
    }

    const messageText = text || (attachment ? `Shared a file: ${attachment.name}` : "");
    if (selectedConversation.isAdminOutreach) {
      await addDoc(collection(firebaseDb, "admin_outreach", selectedConversation.id, "messages"), {
        senderId: currentUserId,
        senderRole: "freelancer",
        text: messageText,
        attachment: attachment ?? null,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(firebaseDb, "admin_outreach", selectedConversation.id), {
        lastMessageText: messageText,
        lastSenderRole: "freelancer",
        lastMessageAt: serverTimestamp(),
        unreadByRecipient: false,
        unreadByAdmin: true,
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(collection(firebaseDb, "conversations", selectedConversation.id, "messages"), {
        senderId: currentUserId,
        senderRole: "freelancer",
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
        title: `New message from ${selectedConversation.freelancerName || "Freelancer"}`,
        body: messageText,
        url: `/client/dashboard/messages?chat=${selectedConversation.id}`,
        tag: `message-${selectedConversation.id}`,
      }).catch(console.error);
    }
  };

  const uploadChatFile = async (file: File) => {
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
      size: formatFileSize(uploadPayload.bytes ?? file.size),
      mimeType: uploadPayload.mimeType ?? file.type,
      resourceType: uploadPayload.resourceType ?? "auto",
      publicId: uploadPayload.publicId ?? "",
    };
  };

  const handleSubmitWorkFromMessage = async ({
    description,
    link,
    file,
  }: {
    description: string;
    link: string;
    file?: File | null;
  }) => {
    if (!selectedConversation || !currentUserId) return;

    const contractId =
      selectedConversation.jobId && selectedConversation.freelancerId
        ? `${selectedConversation.jobId}_${selectedConversation.freelancerId}`
        : selectedConversation.id;
    const contractSnap = await getDoc(doc(firebaseDb, "contracts", contractId));
    const contractData = contractSnap.exists() ? (contractSnap.data() as any) : {};
    const paymentStatus = selectedConversation.paymentStatus ?? contractData.paymentStatus ?? "unfunded";
    const paymentInstallments = selectedConversation.paymentInstallments || Number(contractData.paymentInstallments ?? 1) || 1;
    const releasedInstallments = Number(contractData.paymentReleasedInstallments ?? 0);
    const nextMilestoneIndex = releasedInstallments + 1;
    const jobAmount =
      selectedConversation.paymentTotalAmountSats ||
      Number(contractData.paymentTotalAmountSats ?? 0) ||
      parseSats(contractData.budget) ||
      selectedConversation.paymentAmountSats ||
      0;
    const platformFeeSats =
      selectedConversation.platformFeeSats ||
      Number(contractData.platformFeeSats ?? 0) ||
      Math.ceil(jobAmount * (PLATFORM_FEE_PERCENT / 100));
    const totalClientPayable =
      selectedConversation.paymentTotalChargedSats ||
      Number(contractData.paymentTotalChargedSats ?? 0) ||
      jobAmount + platformFeeSats;
    const existingMilestones = Array.isArray(selectedConversation.milestones) && selectedConversation.milestones.length
      ? selectedConversation.milestones
      : Array.isArray(contractData.milestones) && contractData.milestones.length
        ? contractData.milestones
        : buildMilestones(jobAmount, totalClientPayable, paymentInstallments);
    const milestones = existingMilestones.map((milestone: any, index: number) => ({
      index: Number(milestone.index ?? index + 1),
      title: milestone.title || milestone.name || `Milestone ${index + 1}`,
      freelancerAmountSats: Number(milestone.freelancerAmountSats ?? calculateInstallmentAmount(jobAmount, paymentInstallments, index + 1)),
      platformFeeSats: Number(milestone.platformFeeSats ?? 0),
      totalClientPaysSats: Number(milestone.totalClientPaysSats ?? calculateInstallmentAmount(totalClientPayable, paymentInstallments, index + 1)),
      fundedSats: Number(milestone.fundedSats ?? 0),
      releasedSats: Number(milestone.releasedSats ?? 0),
      status: milestone.status ?? "pending",
    })) as EscrowMilestone[];
    const milestone =
      milestones.find((item) => Number(item.index) === nextMilestoneIndex) ??
      milestones[Math.max(0, nextMilestoneIndex - 1)];
    const milestoneAmount = Number(milestone?.freelancerAmountSats ?? calculateInstallmentAmount(jobAmount, paymentInstallments, nextMilestoneIndex));
    const fundedForMilestone = milestone
      ? Number(milestone.fundedSats ?? 0) - Number(milestone.releasedSats ?? 0)
      : milestoneAmount;

    if (paymentStatus !== "funded" && paymentStatus !== "released") {
      throw new Error("Escrow is not funded for this milestone yet.");
    }
    if (fundedForMilestone < milestoneAmount) {
      throw new Error(`Milestone escrow is short by ${(milestoneAmount - fundedForMilestone).toLocaleString()} sats. Ask the client to fund escrow before submitting.`);
    }

    const attachment = file ? await uploadChatFile(file) : null;
    const milestoneTitle = milestone?.title || `Milestone ${nextMilestoneIndex}`;
    const contractTitle = selectedConversation.jobTitle || contractData.title || "Contract";
    const contractUrl = `/client/dashboard/contracts?contract=${contractId}`;
    const notificationText = `Your deliverable for "${contractTitle}" — Milestone ${nextMilestoneIndex}: ${milestoneTitle} has been submitted for client review. ${link ? `Delivery link: ${link}. ` : ""}[Review submission details](${contractUrl})`;
    const updatedMilestones = milestones.map((item) => {
      if (Number(item.index) !== nextMilestoneIndex) return item;
      return {
        ...item,
        status: "submitted" as const,
        submittedAt: new Date().toISOString(),
      };
    });
    const submissionData = {
      contractId,
      clientId: selectedConversation.clientId,
      freelancerId: selectedConversation.freelancerId,
      contractTitle,
      milestoneIndex: nextMilestoneIndex,
      milestoneTitle,
      description: description || "Work submitted for review.",
      link: link || "",
      attachment,
      submittedAt: serverTimestamp(),
      status: "pending",
    };
    const contractUpdate = {
      workStatus: "submitted",
      submissionMessage: description || "Work submitted for review.",
      submissionLink: link || "",
      submissionAttachment: attachment,
      milestones: updatedMilestones,
      updatedAt: serverTimestamp(),
    };

    await Promise.all([
      addDoc(collection(firebaseDb, "submitted_jobs"), submissionData),
      setDoc(doc(firebaseDb, "contracts", contractId), contractUpdate, { merge: true }),
      setDoc(
        doc(firebaseDb, "conversations", selectedConversation.id),
        {
          ...contractUpdate,
          "lastMessage.text": notificationText,
          "lastMessage.senderId": selectedConversation.freelancerId,
          "lastMessage.createdAt": serverTimestamp(),
          [`unread.${selectedConversation.clientId}`]: increment(1),
          [`unread.${selectedConversation.freelancerId}`]: 0,
        },
        { merge: true }
      ),
      addDoc(collection(firebaseDb, "conversations", selectedConversation.id, "messages"), {
        senderId: selectedConversation.freelancerId,
        senderRole: "freelancer",
        text: notificationText,
        messageType: "work_submission",
        attachment: attachment ?? null,
        createdAt: serverTimestamp(),
      }),
    ]);
    void sendUserNotification({
      userId: selectedConversation.clientId,
      title: "Work submitted for review",
      body: notificationText,
      url: `/client/dashboard/contracts?contract=${contractId}`,
      tag: `work-submission-${contractId}`,
    }).catch(console.error);
  };

  const handleVerifyPayment = async (
    paymentRequestOverride?: string
  ): Promise<"funded" | "pending" | "expired"> => {
    if (!selectedConversation) return "pending";
    const contractId =
      selectedConversation.jobId && selectedConversation.freelancerId
        ? `${selectedConversation.jobId}_${selectedConversation.freelancerId}`
        : selectedConversation.id;
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
          : buildMilestones(jobAmount, totalClientPayable, paymentInstallments);
      const isFullFunding = (selectedConversation.paymentMode ?? contractData.paymentMode ?? "full") === "full";
      const invoiceAmount = selectedConversation.paymentAmountSats || 0;
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
          [`unread.${selectedConversation.clientId}`]: increment(1),
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

    if (isInvoiceExpiredByAge(selectedConversation)) {
      await updateDoc(doc(firebaseDb, "conversations", selectedConversation.id), {
        paymentStatus: "expired",
        paymentRequest: "",
        paymentHash: "",
        updatedAt: serverTimestamp(),
      });
      await setDoc(
        doc(firebaseDb, "contracts", contractId),
        {
          paymentStatus: "expired",
          paymentRequest: "",
          paymentHash: "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return "expired";
    }

    return "pending";
  };

  const canSend = selectedConversation
    ? selectedConversation.isAdminOutreach
      ? true
      : !!selectedConversation.canFreelancerMessage
    : false;

  return (
    <div className="min-h-screen bg-[#F7F6F3] font-sans">
      <div className="flex">
        <FreelancerSidebar active="/freelancer/dashboard/messages" hideMobileToggle={!!selectedChat} />

        <div className={`flex-1 lg:ml-0 ${selectedChat ? "mt-0" : "mt-3"} md:mt-0`}>
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
                <ChatView
                  message={selectedMessage}
                  chatMessages={chatMessages}
                  onBack={() => setSelectedChat(null)}
                  onSendMessage={handleSendMessage}
                  canSend={canSend}
                  viewerRole="freelancer"
                  paymentStatus={selectedConversation.paymentStatus}
                  paymentAmountSats={selectedConversation.paymentAmountSats}
                  paymentTotalAmountSats={selectedConversation.paymentTotalAmountSats}
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
                  onSubmitWork={handleSubmitWorkFromMessage}
                  onVerifyPayment={handleVerifyPayment}
                  jobId={selectedConversation.jobId}
                  jobTitle={selectedConversation.jobTitle}
                  contractId={
                    selectedConversation.jobId && selectedConversation.freelancerId
                      ? `${selectedConversation.jobId}_${selectedConversation.freelancerId}`
                      : selectedConversation.id
                  }
                  viewerRole_disputeRole="freelancer"
                  isAdminOutreach={selectedConversation.isAdminOutreach}
                  subject={selectedConversation.subject}
                />
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
