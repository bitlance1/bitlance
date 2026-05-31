"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, query } from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase";

export type FirestoreDate = string | number | Date | { seconds?: number; toDate?: () => Date } | null | undefined;

export type AdminUser = {
  id: string;
  role: string;
  fullName: string;
  email: string;
  online: boolean;
  createdAt?: FirestoreDate;
  lastSeen?: FirestoreDate;
};

export type AdminJob = {
  id: string;
  title: string;
  clientName: string;
  clientId: string;
  status: string;
  category: string;
  budget: string;
  proposals: number;
  createdAt?: FirestoreDate;
};

export type AdminProposal = {
  id: string;
  jobTitle: string;
  clientId: string;
  freelancerName: string;
  freelancerId: string;
  status: string;
  rate: string;
  createdAt?: FirestoreDate;
};

export type AdminContract = {
  id: string;
  title: string;
  clientId: string;
  freelancerId: string;
  freelancerName: string;
  status: string;
  paymentStatus: string;
  workStatus: string;
  budget: string;
  paymentTotalAmountSats: number;
  escrowFundedTotalSats: number;
  escrowReleasedSats: number;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
};

export type AdminConversation = {
  id: string;
  jobTitle: string;
  clientName: string;
  freelancerName: string;
  paymentStatus: string;
  workStatus: string;
  lastMessage: {
    text?: string;
    senderId?: string;
    createdAt?: FirestoreDate;
  };
  updatedAt?: FirestoreDate;
};

export type AdminSubmission = {
  id: string;
  contractTitle: string;
  clientId: string;
  freelancerId: string;
  milestoneIndex: number;
  status: string;
  submittedAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
};

export type AdminEscrow = {
  id: string;
  jobTitle: string;
  clientId: string;
  freelancerId: string;
  status: string;
  totalFundedSats: number;
  totalReleasedToFreelancerSats: number;
  totalClientPayableSats: number;
  updatedAt?: FirestoreDate;
};

export type AdminNotificationToken = {
  id: string;
  userId: string;
  platform: string;
  permission: string;
  updatedAt?: FirestoreDate;
};

export type AdminActivityItem = {
  id: string;
  type: string;
  title: string;
  detail: string;
  status: string;
  at?: FirestoreDate;
};

export const formatDateTime = (value?: FirestoreDate) => {
  if (!value) return "No timestamp";
  const date =
    typeof value === "object" && "toDate" in value && typeof value.toDate === "function"
      ? value.toDate()
      : typeof value === "object" && "seconds" in value && typeof value.seconds === "number"
        ? new Date(value.seconds * 1000)
        : value instanceof Date
          ? value
          : typeof value === "string" || typeof value === "number"
            ? new Date(value)
            : new Date(Number.NaN);
  if (Number.isNaN(date.getTime())) return "No timestamp";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getTimeMs = (value?: FirestoreDate) => {
  if (!value) return 0;
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  if (typeof value === "object" && "seconds" in value && typeof value.seconds === "number") {
    return value.seconds * 1000;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value !== "string" && typeof value !== "number") return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const formatSats = (value: number) => `${Math.max(0, value || 0).toLocaleString()} sats`;

const parseSats = (value: unknown) => {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "").replace(/[^0-9]/g, "");
  return cleaned ? Number(cleaned) : 0;
};

const normalize = (value: unknown, fallback = "") => String(value ?? fallback).trim();

export function useAdminDashboardData() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [proposals, setProposals] = useState<AdminProposal[]>([]);
  const [contracts, setContracts] = useState<AdminContract[]>([]);
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [escrows, setEscrows] = useState<AdminEscrow[]>([]);
  const [tokens, setTokens] = useState<AdminNotificationToken[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const unsubs = [
      onSnapshot(
        query(collection(firebaseDb, "all_users"), limit(250)),
        (snapshot) => {
          setUsers(
            snapshot.docs.map((docSnap) => {
              const data = docSnap.data() as Record<string, unknown>;
              const composed = `${normalize(data.firstName)} ${normalize(data.lastName)}`.trim();
              return {
                id: docSnap.id,
                role: normalize(data.role, "unknown"),
                fullName: normalize(data.fullName || data.name || composed || data.email, "Unnamed user"),
                email: normalize(data.email, "No email"),
                online: Boolean(data.online),
                createdAt: data.createdAt as FirestoreDate,
                lastSeen: data.lastSeen as FirestoreDate,
              };
            })
          );
        },
        () => setLoadError("Unable to load admin data. Check Firestore rules for admin users.")
      ),
      onSnapshot(query(collection(firebaseDb, "jobs"), limit(250)), (snapshot) => {
        setJobs(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            return {
              id: docSnap.id,
              title: normalize(data.title, "Untitled job"),
              clientName: normalize(data.clientName || data.clientCompany, "Client"),
              clientId: normalize(data.clientId),
              status: normalize(data.status, "Unknown"),
              category: normalize(data.category, "Uncategorized"),
              budget: normalize(data.budget, "0 sats"),
              proposals: Number(data.proposals ?? 0),
              createdAt: data.createdAt as FirestoreDate,
            };
          })
        );
      }),
      onSnapshot(query(collection(firebaseDb, "proposals"), limit(250)), (snapshot) => {
        setProposals(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            return {
              id: docSnap.id,
              jobTitle: normalize(data.jobTitle, "Job proposal"),
              clientId: normalize(data.clientId),
              freelancerName: normalize(data.freelancerName, "Freelancer"),
              freelancerId: normalize(data.freelancerId),
              status: normalize(data.status, "submitted"),
              rate: normalize(data.rate || data.fixedPrice || data.hourlyRate, "0 sats"),
              createdAt: data.createdAt as FirestoreDate,
            };
          })
        );
      }),
      onSnapshot(query(collection(firebaseDb, "contracts"), limit(250)), (snapshot) => {
        setContracts(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            return {
              id: docSnap.id,
              title: normalize(data.title, "Untitled contract"),
              clientId: normalize(data.clientId),
              freelancerId: normalize(data.freelancerId),
              freelancerName: normalize(data.freelancerName, "Freelancer"),
              status: normalize(data.status, "Unknown"),
              paymentStatus: normalize(data.paymentStatus, "unfunded"),
              workStatus: normalize(data.workStatus, "not_started"),
              budget: normalize(data.budget, "0 sats"),
              paymentTotalAmountSats: Number(data.paymentTotalAmountSats ?? parseSats(data.budget)),
              escrowFundedTotalSats: Number(data.escrowFundedTotalSats ?? data.paymentPaidAmountSats ?? 0),
              escrowReleasedSats: Number(data.escrowReleasedSats ?? 0),
              createdAt: data.createdAt as FirestoreDate,
              updatedAt: data.updatedAt as FirestoreDate,
            };
          })
        );
      }),
      onSnapshot(query(collection(firebaseDb, "conversations"), limit(250)), (snapshot) => {
        setConversations(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            const lastMessage = (data.lastMessage ?? {}) as AdminConversation["lastMessage"];
            return {
              id: docSnap.id,
              jobTitle: normalize(data.jobTitle, "Conversation"),
              clientName: normalize(data.clientName, "Client"),
              freelancerName: normalize(data.freelancerName, "Freelancer"),
              paymentStatus: normalize(data.paymentStatus, "unfunded"),
              workStatus: normalize(data.workStatus, "not_started"),
              lastMessage,
              updatedAt: data.updatedAt as FirestoreDate,
            };
          })
        );
      }),
      onSnapshot(query(collection(firebaseDb, "submitted_jobs"), limit(250)), (snapshot) => {
        setSubmissions(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            return {
              id: docSnap.id,
              contractTitle: normalize(data.contractTitle, "Submitted work"),
              clientId: normalize(data.clientId),
              freelancerId: normalize(data.freelancerId),
              milestoneIndex: Number(data.milestoneIndex ?? 1),
              status: normalize(data.status, "pending"),
              submittedAt: data.submittedAt as FirestoreDate,
              updatedAt: data.updatedAt as FirestoreDate,
            };
          })
        );
      }),
      onSnapshot(query(collection(firebaseDb, "escrows"), limit(250)), (snapshot) => {
        setEscrows(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            return {
              id: docSnap.id,
              jobTitle: normalize(data.jobTitle, "Escrow"),
              clientId: normalize(data.clientId),
              freelancerId: normalize(data.freelancerId),
              status: normalize(data.status, "unknown"),
              totalFundedSats: Number(data.totalFundedSats ?? 0),
              totalReleasedToFreelancerSats: Number(data.totalReleasedToFreelancerSats ?? 0),
              totalClientPayableSats: Number(data.totalClientPayableSats ?? 0),
              updatedAt: data.updatedAt as FirestoreDate,
            };
          })
        );
      }),
      onSnapshot(query(collection(firebaseDb, "notification_tokens"), limit(250)), (snapshot) => {
        setTokens(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            return {
              id: docSnap.id,
              userId: normalize(data.userId),
              platform: normalize(data.platform, "web"),
              permission: normalize(data.permission, "unknown"),
              updatedAt: data.updatedAt as FirestoreDate,
            };
          })
        );
      }),
    ];

    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, []);

  const summary = useMemo(() => {
    const clients = users.filter((user) => user.role === "client").length;
    const freelancers = users.filter((user) => user.role === "freelancer").length;
    const admins = users.filter((user) => user.role === "admin").length;
    const online = users.filter((user) => user.online).length;
    const openJobs = jobs.filter((job) => job.status.toLowerCase() === "open").length;
    const pendingProposals = proposals.filter((proposal) => proposal.status === "submitted").length;
    const acceptedProposals = proposals.filter((proposal) => proposal.status === "accepted").length;
    const activeContracts = contracts.filter((contract) => contract.status === "Active").length;
    const reviewSubmissions = submissions.filter((submission) => submission.status === "pending").length;
    const fundedEscrow = contracts.reduce((sum, contract) => sum + contract.escrowFundedTotalSats, 0);
    const releasedEscrow = contracts.reduce((sum, contract) => sum + contract.escrowReleasedSats, 0);
    return {
      clients,
      freelancers,
      admins,
      online,
      openJobs,
      pendingProposals,
      acceptedProposals,
      activeContracts,
      reviewSubmissions,
      fundedEscrow,
      releasedEscrow,
      notificationDevices: tokens.length,
      conversations: conversations.length,
    };
  }, [users, jobs, proposals, contracts, submissions, tokens.length, conversations.length]);

  const activity = useMemo<AdminActivityItem[]>(() => {
    const items: AdminActivityItem[] = [
      ...jobs.map((job) => ({
        id: `job-${job.id}`,
        type: "Job",
        title: job.title,
        detail: `${job.clientName} posted ${job.budget}`,
        status: job.status,
        at: job.createdAt,
      })),
      ...proposals.map((proposal) => ({
        id: `proposal-${proposal.id}`,
        type: "Proposal",
        title: proposal.jobTitle,
        detail: `${proposal.freelancerName} bid ${proposal.rate}`,
        status: proposal.status,
        at: proposal.createdAt,
      })),
      ...contracts.map((contract) => ({
        id: `contract-${contract.id}`,
        type: "Contract",
        title: contract.title,
        detail: `${contract.freelancerName} | ${contract.paymentStatus} | ${contract.workStatus}`,
        status: contract.status,
        at: contract.updatedAt || contract.createdAt,
      })),
      ...submissions.map((submission) => ({
        id: `submission-${submission.id}`,
        type: "Submission",
        title: submission.contractTitle,
        detail: `Milestone ${submission.milestoneIndex}`,
        status: submission.status,
        at: submission.updatedAt || submission.submittedAt,
      })),
      ...conversations.map((conversation) => ({
        id: `conversation-${conversation.id}`,
        type: "Message",
        title: conversation.jobTitle,
        detail: conversation.lastMessage.text || `${conversation.clientName} and ${conversation.freelancerName}`,
        status: conversation.workStatus,
        at: conversation.lastMessage.createdAt || conversation.updatedAt,
      })),
    ];
    return items.sort((a, b) => getTimeMs(b.at) - getTimeMs(a.at)).slice(0, 24);
  }, [jobs, proposals, contracts, submissions, conversations]);

  return {
    users,
    jobs,
    proposals,
    contracts,
    conversations,
    submissions,
    escrows,
    tokens,
    summary,
    activity,
    loadError,
  };
}
