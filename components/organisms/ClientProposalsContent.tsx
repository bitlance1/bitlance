"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/atoms/Button";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { sendUserNotification } from "@/lib/notifications";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

type ProposalStatus = "all" | "submitted" | "accepted" | "rejected";

type ClientJob = {
  id: string;
  title: string;
  budget: string;
  duration: string;
  description: string;
  category: string;
  jobType: string;
  status: string;
  skills: string[];
  proposals: number;
  urgent: boolean;
  companyLogo?: string;
};

type Proposal = {
  id: string;
  jobId: string;
  jobTitle: string;
  freelancerId: string;
  freelancerName: string;
  freelancerTitle: string;
  freelancerAvatarUrl?: string;
  freelancerRating?: number;
  freelancerReviews?: number;
  freelancerCompletedJobs?: number;
  freelancerLocation?: string;
  rate: string;
  pricingType: string;
  hoursPerWeek: string;
  cover: string;
  availability: string;
  status: "submitted" | "accepted" | "rejected" | string;
  createdAt?: any;
};

const formatSats = (value: string) =>
  value?.trim() ? (value.toLowerCase().includes("sats") ? value : `${value} sats`) : "0 sats";

const parseSats = (value: unknown) => {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "").replace(/[^0-9]/g, "");
  return cleaned ? Number(cleaned) : 0;
};

const formatDate = (value?: any) => {
  if (!value) return "Recently";
  const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const statusLabel = (status: string) => {
  if (status === "accepted") return "Accepted";
  if (status === "rejected") return "Rejected";
  return "Pending";
};

const statusClass = (status: string) => {
  if (status === "accepted") return "bg-green-50 text-green-700 border-green-100";
  if (status === "rejected") return "bg-red-50 text-red-700 border-red-100";
  return "bg-[#FFF7ED] text-[#B45309] border-[#FED7AA]";
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export default function ClientProposalsContent() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ProposalStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [actionId, setActionId] = useState("");
  const [toast, setToast] = useState("");
  const clientIdentity = useRef<{ name: string; avatarUrl: string }>({ name: "Client", avatarUrl: "" });

  const triggerToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };

  const resolveClientIdentity = async (uid: string) => {
    try {
      const [clientSnap, allUsersSnap] = await Promise.all([
        getDoc(doc(firebaseDb, "clients", uid)),
        getDoc(doc(firebaseDb, "all_users", uid)),
      ]);
      const c = clientSnap.exists() ? (clientSnap.data() as any) : {};
      const a = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
      const composed = `${c.firstName ?? a.firstName ?? ""} ${c.lastName ?? a.lastName ?? ""}`.trim();
      return {
        name: c.fullName ?? a.fullName ?? c.name ?? a.name ?? a.email ?? composed ?? "Client",
        avatarUrl: c.avatarUrl ?? a.avatarUrl ?? "",
      };
    } catch {
      return { name: "Client", avatarUrl: "" };
    }
  };

  const resolveFreelancerIdentity = async (uid: string, fallbackName: string) => {
    try {
      const [freelancerSnap, allUsersSnap] = await Promise.all([
        getDoc(doc(firebaseDb, "freelancers", uid)),
        getDoc(doc(firebaseDb, "all_users", uid)),
      ]);
      const f = freelancerSnap.exists() ? (freelancerSnap.data() as any) : {};
      const a = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
      const composed = `${f.firstName ?? a.firstName ?? ""} ${f.lastName ?? a.lastName ?? ""}`.trim();
      return {
        name: f.fullName ?? a.fullName ?? fallbackName ?? composed ?? "Freelancer",
        avatarUrl: f.avatarUrl ?? a.avatarUrl ?? "",
      };
    } catch {
      return { name: fallbackName || "Freelancer", avatarUrl: "" };
    }
  };

  useEffect(() => {
    let unsubscribeJobs: (() => void) | undefined;
    let unsubscribeProposals: (() => void) | undefined;

    const unsubscribeAuth = firebaseAuth.onAuthStateChanged(async (user) => {
      if (!user) {
        setJobs([]); setProposals([]); setLoading(false);
        setErrorMessage("Please log in to review proposals.");
        return;
      }
      setLoading(true); setErrorMessage("");
      clientIdentity.current = await resolveClientIdentity(user.uid);

      unsubscribeJobs = onSnapshot(
        query(collection(firebaseDb, "jobs"), where("clientId", "==", user.uid)),
        (snapshot) => {
          setJobs(snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as any;
            return {
              id: docSnap.id,
              title: data.title ?? "Untitled Job",
              budget: data.budget ?? "",
              duration: data.duration ?? "",
              description: data.description ?? "",
              category: data.category ?? "",
              jobType: data.jobType ?? "",
              status: data.status ?? "Open",
              skills: Array.isArray(data.skills) ? data.skills : [],
              proposals: Number(data.proposals ?? 0),
              urgent: !!data.urgent,
              companyLogo: data.companyLogo ?? "",
            };
          }));
        }
      );

      unsubscribeProposals = onSnapshot(
        query(collection(firebaseDb, "proposals"), where("clientId", "==", user.uid)),
        async (snapshot) => {
          const items: Proposal[] = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const data = docSnap.data() as any;
              const freelancerId = data.freelancerId ?? "";
              let avatarUrl = "";
              let rating = 4.5;
              let reviews = 0;
              let completedJobs = 0;
              let location = data.availability ?? "Remote";
              if (freelancerId) {
                try {
                  const [fSnap, aSnap] = await Promise.all([
                    getDoc(doc(firebaseDb, "freelancers", freelancerId)),
                    getDoc(doc(firebaseDb, "all_users", freelancerId)),
                  ]);
                  const f = fSnap.exists() ? (fSnap.data() as any) : {};
                  const a = aSnap.exists() ? (aSnap.data() as any) : {};
                  avatarUrl = f.avatarUrl ?? a.avatarUrl ?? "";
                  rating = f.rating ?? a.rating ?? 4.5;
                  reviews = f.reviews ?? a.reviews ?? 0;
                  completedJobs = f.completedJobs ?? a.completedJobs ?? 0;
                  location = f.location ?? a.location ?? f.availability ?? a.availability ?? data.availability ?? "Remote";
                } catch { /* use defaults */ }
              }
              return {
                id: docSnap.id,
                jobId: data.jobId ?? "",
                jobTitle: data.jobTitle ?? "Job Proposal",
                freelancerId,
                freelancerName: data.freelancerName ?? "Freelancer",
                freelancerTitle: data.freelancerTitle ?? "Professional",
                freelancerAvatarUrl: avatarUrl,
                freelancerRating: rating,
                freelancerReviews: reviews,
                freelancerCompletedJobs: completedJobs,
                freelancerLocation: location,
                rate: formatSats(data.rate ?? "0"),
                pricingType: data.pricingType ?? "Fixed Price",
                hoursPerWeek: data.hoursPerWeek ?? "",
                cover: data.cover ?? "",
                availability: data.availability ?? "Available",
                status: data.status ?? "submitted",
                createdAt: data.createdAt,
              };
            })
          );
          setProposals(items);
          setLoading(false);
          setSelectedProposalId((current) => current || items[0]?.id || "");
        },
        () => { setLoading(false); setErrorMessage("Unable to load proposals right now."); }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeJobs) unsubscribeJobs();
      if (unsubscribeProposals) unsubscribeProposals();
    };
  }, []);

  const jobMap = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);

  const filteredProposals = useMemo(() => {
    return proposals.filter((proposal) => {
      if (statusFilter !== "all" && proposal.status !== statusFilter) return false;
      if (selectedJobId !== "all" && proposal.jobId !== selectedJobId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const job = jobMap.get(proposal.jobId);
        if (!proposal.freelancerName.toLowerCase().includes(q) &&
            !(job?.title ?? proposal.jobTitle).toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [proposals, selectedJobId, statusFilter, searchQuery, jobMap]);

  const selectedProposal = proposals.find((p) => p.id === selectedProposalId) ?? filteredProposals[0] ?? null;
  const selectedJob = selectedProposal ? jobMap.get(selectedProposal.jobId) : null;
  const createConversationId = (jobId: string, freelancerId: string) => `${jobId}_${freelancerId}`;

  const acceptProposal = async (proposal: Proposal) => {
    const user = firebaseAuth.currentUser;
    const job = jobMap.get(proposal.jobId);
    if (!user || !job || !proposal.freelancerId) return;
    setActionId(proposal.id);
    try {
      const freelancerIdentity = await resolveFreelancerIdentity(proposal.freelancerId, proposal.freelancerName);
      const paymentTotalAmountSats = parseSats(job.budget);
      const contractId = `${job.id}_${proposal.freelancerId}`;
      const conversationId = createConversationId(job.id, proposal.freelancerId);
      const batch = writeBatch(firebaseDb);
      batch.update(doc(firebaseDb, "proposals", proposal.id), { status: "accepted", updatedAt: serverTimestamp() });
      batch.set(doc(firebaseDb, "contracts", contractId), {
        jobId: job.id, clientId: user.uid, freelancerId: proposal.freelancerId,
        proposalId: proposal.id,
        freelancerName: freelancerIdentity.name, title: job.title, description: job.description,
        status: "Active", budget: job.budget, contractType: job.jobType || "Fixed Price",
        paymentTotalAmountSats, progress: 0,
        nextMilestone: "Kickoff & onboarding", unreadByClient: false, unreadByFreelancer: true,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }, { merge: true });
      batch.set(doc(firebaseDb, "conversations", conversationId), {
        jobId: job.id, jobTitle: job.title, proposalId: proposal.id,
        clientId: user.uid, clientName: clientIdentity.current.name,
        freelancerId: proposal.freelancerId, freelancerName: freelancerIdentity.name,
        clientAvatarUrl: clientIdentity.current.avatarUrl, freelancerAvatarUrl: freelancerIdentity.avatarUrl,
        paymentTotalAmountSats, createdBy: "system",
        canFreelancerMessage: true,
        unread: { [user.uid]: 0, [proposal.freelancerId]: 1 },
        updatedAt: serverTimestamp(), createdAt: serverTimestamp(),
      }, { merge: true });
      batch.update(doc(firebaseDb, "jobs", job.id), {
        selectedFreelancerIds: arrayUnion(proposal.freelancerId),
        selectedFreelancerNames: arrayUnion(freelancerIdentity.name),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      void sendUserNotification({
        userId: proposal.freelancerId,
        title: "Proposal accepted",
        body: `Your proposal for "${job.title}" was accepted. Contract and chat are ready.`,
        url: `/freelancer/dashboard/messages?chat=${conversationId}`,
        tag: `proposal-accepted-${proposal.id}`,
      }).catch(console.error);
      triggerToast(`${freelancerIdentity.name} accepted. Contract and chat are ready.`);
    } finally { setActionId(""); }
  };

  const rejectProposal = async (proposal: Proposal) => {
    setActionId(proposal.id);
    try {
      await updateDoc(doc(firebaseDb, "proposals", proposal.id), { status: "rejected", updatedAt: serverTimestamp() });
      void sendUserNotification({
        userId: proposal.freelancerId, title: "Proposal rejected",
        body: `Your proposal for "${proposal.jobTitle}" was not selected.`,
        url: "/freelancer/dashboard/proposals", tag: `proposal-rejected-${proposal.id}`,
      }).catch(console.error);
      triggerToast(`${proposal.freelancerName} rejected.`);
    } finally { setActionId(""); }
  };

  const messageFreelancer = async (proposal: Proposal) => {
    const user = firebaseAuth.currentUser;
    const job = jobMap.get(proposal.jobId);
    if (!user || !job) return;
    setActionId(proposal.id);
    try {
      const freelancerIdentity = await resolveFreelancerIdentity(proposal.freelancerId, proposal.freelancerName);
      const conversationId = createConversationId(job.id, proposal.freelancerId);
      await setDoc(doc(firebaseDb, "conversations", conversationId), {
        jobId: job.id, jobTitle: job.title, proposalId: proposal.id,
        clientId: user.uid, clientName: clientIdentity.current.name,
        freelancerId: proposal.freelancerId, freelancerName: freelancerIdentity.name,
        clientAvatarUrl: clientIdentity.current.avatarUrl, freelancerAvatarUrl: freelancerIdentity.avatarUrl,
        paymentTotalAmountSats: parseSats(job.budget),
        createdBy: "client", canFreelancerMessage: true,
        unread: { [user.uid]: 0, [proposal.freelancerId]: 0 },
        updatedAt: serverTimestamp(), createdAt: serverTimestamp(),
      }, { merge: true });
      router.push(`/client/dashboard/messages?chat=${conversationId}`);
    } finally { setActionId(""); }
  };

  const stats = useMemo(() => ({
    all: proposals.length,
    submitted: proposals.filter((p) => p.status === "submitted").length,
    accepted: proposals.filter((p) => p.status === "accepted").length,
    rejected: proposals.filter((p) => p.status === "rejected").length,
  }), [proposals]);

  return (
    <section className="w-full max-w-full space-y-5 overflow-x-hidden">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-black tracking-[-0.02em] text-[#1a1a1a]">Review freelancers for your jobs</h1>
          <p className="mt-1 text-[13px] leading-[1.6] text-[#6b6762]">
            See every proposal tied to jobs you posted, inspect the job context, then accept, reject, or message the freelancer.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/client/dashboard/job-posts?action=new")}
          className="shrink-0 rounded-full bg-[#F7931A] px-5 py-2.5 text-[13px] font-black text-white hover:bg-[#e0840f] transition-colors"
        >
          Post New Job
        </button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="flex items-center gap-3 rounded-[16px] border border-[#EAE7E2] bg-white px-5 py-4 shadow-sm">
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[12px] bg-[#FFF3E0]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <div className="text-[12px] font-semibold text-[#6b6762]">Total Proposals</div>
            <div className="text-[28px] font-black leading-none text-[#1a1a1a]">{stats.all}</div>
            <div className="text-[11px] text-[#9e9690]">All time</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-[16px] border border-[#EAE7E2] bg-white px-5 py-4 shadow-sm">
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[12px] bg-[#FFF3E0]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div>
            <div className="text-[12px] font-semibold text-[#6b6762]">Awaiting Review</div>
            <div className="text-[28px] font-black leading-none text-[#1a1a1a]">{stats.submitted}</div>
            <div className="text-[11px] text-[#9e9690]">Needs your attention</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-[16px] border border-[#EAE7E2] bg-white px-5 py-4 shadow-sm">
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[12px] bg-[#ECFDF5]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div>
            <div className="text-[12px] font-semibold text-[#6b6762]">Accepted</div>
            <div className="text-[28px] font-black leading-none text-[#1a1a1a]">{stats.accepted}</div>
            <div className="text-[11px] text-[#9e9690]">Hired freelancers</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-[16px] border border-[#EAE7E2] bg-white px-5 py-4 shadow-sm">
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[12px] bg-[#FEF2F2]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <div>
            <div className="text-[12px] font-semibold text-[#6b6762]">Rejected</div>
            <div className="text-[28px] font-black leading-none text-[#1a1a1a]">{stats.rejected}</div>
            <div className="text-[11px] text-[#9e9690]">Not selected</div>
          </div>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-[#EAE7E2] bg-white px-4 py-3">
        <div className="relative min-w-[200px] flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C0B9B0]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search freelancers or skills..."
            className="w-full rounded-[10px] border border-transparent bg-transparent py-1.5 pl-8 pr-3 text-[13px] text-[#1a1a1a] placeholder:text-[#B0A99F] focus:outline-none" />
        </div>
        <div className="h-5 w-px bg-[#EAE7E2] hidden sm:block" />
        <select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}
          className="rounded-[10px] border border-[#EAE7E2] bg-white px-3 py-2 text-[12px] font-medium text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-orange-200 appearance-none pr-7 relative">
          <option value="all">All Jobs</option>
          {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ProposalStatus)}
          className="rounded-[10px] border border-[#EAE7E2] bg-white px-3 py-2 text-[12px] font-medium text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-orange-200">
          <option value="all">All Status</option>
          <option value="submitted">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
        <select defaultValue="newest" onChange={() => {}}
          className="rounded-[10px] border border-[#EAE7E2] bg-white px-3 py-2 text-[12px] font-medium text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-orange-200">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" aria-label="List view"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#F7931A] text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
          <button type="button" aria-label="Grid view"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#EAE7E2] bg-white text-[#9e9690] hover:bg-[#F7F4F0]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Proposal list ── */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="rounded-[16px] border border-[#EAE7E2] bg-white p-8 text-center text-[13px] text-[#6b6762]">Loading proposals...</div>
        ) : errorMessage ? (
          <div className="rounded-[16px] border border-[#EAE7E2] bg-[#FFF6F2] p-8 text-center text-[13px] text-[#8C4F00]">{errorMessage}</div>
        ) : filteredProposals.length === 0 ? (
          <div className="rounded-[16px] border border-[#EAE7E2] bg-white p-10 text-center text-[13px] text-[#6b6762]">No proposals match this view yet.</div>
        ) : filteredProposals.map((proposal) => {
          const job = jobMap.get(proposal.jobId);
          const skills = job?.skills ?? [];
          const isPending = proposal.status === "submitted";
          const isAccepted = proposal.status === "accepted";
          const isRejected = proposal.status === "rejected";
          const isBusy = actionId === proposal.id;

          return (
            <div key={proposal.id} className="relative w-full max-w-full overflow-hidden rounded-[16px] border border-[#EAE7E2] bg-white shadow-sm">
              {/* three-dot */}
              <button type="button" aria-label="More options"
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[#C0B9B0] hover:bg-[#F7F4F0]">
                <svg width="4" height="16" viewBox="0 0 4 20" fill="currentColor">
                  <circle cx="2" cy="2" r="2"/><circle cx="2" cy="10" r="2"/><circle cx="2" cy="18" r="2"/>
                </svg>
              </button>

              <div className="flex flex-col gap-5 p-5 pr-12 md:flex-row md:items-start md:gap-6">

                {/* Col 1: Freelancer */}
                <div className="flex shrink-0 gap-3 w-full md:max-w-[170px] md:flex-col md:gap-2">
                  {/* Avatar — real photo or initials fallback */}
                  <div className="relative h-[64px] w-[64px] shrink-0">
                    {proposal.freelancerAvatarUrl ? (
                      <img
                        src={proposal.freelancerAvatarUrl}
                        alt={proposal.freelancerName}
                        className="h-[64px] w-[64px] rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[#2D2D2D] text-[17px] font-bold text-white">
                        {getInitials(proposal.freelancerName)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] font-bold text-[#1a1a1a]">{proposal.freelancerName}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" fill="#16a34a"/>
                        <polyline points="8 12 11 15 16 9" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[12px]">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="#F7931A">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      <span className="font-semibold text-[#1a1a1a]">{(proposal.freelancerRating ?? 4.5).toFixed(1)}</span>
                      <span className="text-[#9e9690]">({proposal.freelancerReviews ?? 0} reviews)</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[12px] text-[#6b6762]">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9e9690" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                      </svg>
                      <span>{proposal.freelancerCompletedJobs ?? 0} completed jobs</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[12px] text-[#6b6762]">
                      <svg width="10" height="11" viewBox="0 0 24 24" fill="none" stroke="#9e9690" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                      </svg>
                      <span>{proposal.freelancerLocation || proposal.availability || "Remote"}</span>
                    </div>
                  </div>
                </div>

                {/* Col 2: Applied For */}
                <div className="shrink-0 w-full md:max-w-[170px]">
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#9e9690]">Applied For</div>
                  <div className="text-[14px] font-bold leading-snug text-[#1a1a1a]">{job?.title ?? proposal.jobTitle}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {skills.length > 0
                      ? skills.slice(0, 3).map((skill) => (
                          <span key={skill} className="rounded-full bg-[#F0EDE9] px-2.5 py-0.5 text-[11px] font-medium text-[#555]">{skill}</span>
                        ))
                      : <span className="rounded-full bg-[#F0EDE9] px-2.5 py-0.5 text-[11px] font-medium text-[#555]">{proposal.pricingType}</span>
                    }
                    {skills.length > 3 && (
                      <span className="rounded-full bg-[#F0EDE9] px-2.5 py-0.5 text-[11px] font-medium text-[#555]">+{skills.length - 3}</span>
                    )}
                  </div>
                </div>

                {/* Col 3: Requested */}
                <div className="shrink-0 w-full md:max-w-[100px]">
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#9e9690]">Requested</div>
                  <div className="flex items-center gap-1">
                    <svg width="13" height="16" viewBox="0 0 13 20" fill="#F7931A">
                      <path d="M8 0L0 11h6l-1 9 9-13H8V0z"/>
                    </svg>
                    <span className="text-[20px] font-black leading-none text-[#F7931A]">
                      {proposal.rate.replace(/\s?sats/i, "")}
                    </span>
                    <span className="text-[11px] font-semibold text-[#9e9690]">sats</span>
                  </div>
                  <div className="mt-2 mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#9e9690]">Delivered In</div>
                  <div className="flex items-center gap-1 text-[13px] text-[#6b6762]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9e9690" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span className="font-medium">{job?.duration || proposal.hoursPerWeek || "TBD"}</span>
                  </div>
                </div>

                {/* Col 4: Cover */}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-[1.7] text-[#6b6762]"
                    style={{ display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {proposal.cover || "No cover letter provided."}
                  </p>
                  {proposal.cover && (
                    <button type="button"
                      onClick={() => { setSelectedProposalId(proposal.id); setProposalModalOpen(true); }}
                      className="mt-1 text-[12px] font-semibold text-[#F7931A] hover:underline">
                      View more
                    </button>
                  )}
                </div>

                {/* Col 5: Status + actions */}
                <div className="flex shrink-0 flex-col gap-2 w-full md:max-w-[160px]">
                  {isPending && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#F7931A]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#F7931A]" />
                      NEEDS REVIEW
                    </div>
                  )}
                  {isAccepted && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-green-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      ACCEPTED
                    </div>
                  )}
                  {isRejected && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      REJECTED
                    </div>
                  )}
                  <div className="text-[11px] text-[#9e9690]">Applied on {formatDate(proposal.createdAt)}</div>

                  {isPending && (
                    <>
                      {/* Accept + Message on same row */}
                      <div className="flex items-center gap-2">
                        <button type="button" disabled={isBusy} onClick={() => acceptProposal(proposal)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-[#F7931A] px-3 py-2 text-[12px] font-bold text-white transition hover:bg-[#e0840f] disabled:opacity-60">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          {isBusy ? "Working..." : "Accept"}
                        </button>
                        <button type="button" disabled={isBusy} onClick={() => messageFreelancer(proposal)}
                          className="flex items-center justify-center gap-1 rounded-[8px] border border-[#EAE7E2] bg-white px-2 py-2 text-[11px] font-semibold text-[#1a1a1a] hover:bg-[#F7F4F0] disabled:opacity-60">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                          </svg>
                          Message
                        </button>
                      </div>
                      {/* Reject below */}
                      <button type="button" disabled={isBusy} onClick={() => rejectProposal(proposal)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-[8px] border border-red-200 bg-white px-3 py-2 text-[12px] font-semibold text-red-500 hover:bg-red-50 disabled:opacity-60">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        Reject
                      </button>
                    </>
                  )}
                  {isAccepted && (
                    <button type="button" onClick={() => router.push("/client/dashboard/contracts")}
                      className="flex items-center gap-1.5 rounded-[8px] border border-[#EAE7E2] bg-white px-3 py-2 text-[12px] font-semibold text-[#1a1a1a] hover:bg-[#F7F4F0]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                      View Contract
                    </button>
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* ── Proposal detail modal ── */}
      {proposalModalOpen && selectedProposal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setProposalModalOpen(false)} />
          <div className="relative z-[91] w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-[16px] border border-[#EAE7E2] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
            <button type="button" onClick={() => setProposalModalOpen(false)} aria-label="Close"
              className="absolute right-4 top-4 rounded-full border border-[#EAE7E2] bg-white px-3 py-1 text-[12px] text-[#6b6762] hover:bg-[#F7F4F0]">Close</button>
            <div className="flex flex-col gap-4 pr-16 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">Proposal Details</div>
                <h2 className="mt-2 text-[22px] font-semibold text-[#1a1a1a]">{selectedProposal.freelancerName}</h2>
                <p className="mt-1 text-[12px] text-[#6b6762]">{selectedProposal.freelancerTitle}</p>
              </div>
              <span className={`w-fit rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusClass(selectedProposal.status)}`}>
                {statusLabel(selectedProposal.status)}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-[11px] text-[#6b6762]">
              <Info label="Rate" value={selectedProposal.rate} />
              <Info label="Pricing" value={selectedProposal.pricingType} />
              <Info label="Availability" value={selectedProposal.availability} />
              <Info label="Hours" value={selectedProposal.hoursPerWeek || "-"} />
            </div>
            <div className="mt-5 rounded-[12px] border border-[#EFECE7] bg-[#FAF8F5] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9e9690]">Cover Letter</div>
              <p className="mt-3 whitespace-pre-wrap text-[12px] leading-[1.8] text-[#5f5a55]">
                {selectedProposal.cover || "No cover letter was provided."}
              </p>
            </div>
            <div className="mt-5 rounded-[12px] border border-[#EFECE7] bg-white p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9e9690]">Job</div>
                  <h3 className="mt-2 text-[15px] font-semibold text-[#1a1a1a]">{selectedJob?.title ?? selectedProposal.jobTitle}</h3>
                  <p className="mt-1 text-[12px] text-[#6b6762]">
                    {selectedJob ? `${formatSats(selectedJob.budget)} | ${selectedJob.duration || "No duration"}` : "Job details are still loading."}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setJobModalOpen(true)} disabled={!selectedJob}>View Job</Button>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => messageFreelancer(selectedProposal)} disabled={actionId === selectedProposal.id}>Message</Button>
              <Button size="sm" variant="outline" className="rounded-full border-red-200 text-red-600 hover:bg-red-50" onClick={() => rejectProposal(selectedProposal)} disabled={selectedProposal.status === "rejected" || actionId === selectedProposal.id}>Reject</Button>
              <Button size="sm" className="rounded-full" onClick={() => acceptProposal(selectedProposal)} disabled={selectedProposal.status === "accepted" || actionId === selectedProposal.id}>
                {actionId === selectedProposal.id ? "Working..." : "Accept Proposal"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Job detail modal ── */}
      {jobModalOpen && selectedJob && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setJobModalOpen(false)} />
          <div className="relative z-[91] w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-[16px] border border-[#EAE7E2] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
            <button type="button" onClick={() => setJobModalOpen(false)} aria-label="Close"
              className="absolute right-4 top-4 rounded-full border border-[#EAE7E2] bg-white p-2 text-[#6b6762] hover:bg-[#F7F4F0]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">Job Details</div>
            <h2 className="mt-2 pr-8 text-[22px] font-semibold text-[#1a1a1a]">{selectedJob.title}</h2>
            <div className="mt-2 text-[12px] text-[#9e9690]">
              {selectedJob.status} | {formatSats(selectedJob.budget)} | {selectedJob.duration || "No duration"} | {selectedJob.proposals} proposals
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedJob.skills.map((skill) => (
                <span key={skill} className="rounded-full bg-[#F6F3F1] px-3 py-1 text-[10px] font-semibold uppercase text-[#666]">{skill}</span>
              ))}
            </div>
            <div className="mt-5 rounded-[12px] border border-[#EFECE7] bg-[#FAF8F5] p-4 text-[12px] leading-[1.8] text-[#5f5a55]">
              {selectedJob.description || "No description provided."}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Info label="Category" value={selectedJob.category || "-"} />
              <Info label="Type" value={selectedJob.jobType || "-"} />
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-[#1a1a1a] px-6 py-3 text-[13px] font-medium text-white shadow-2xl">
          {toast}
        </div>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.12em] text-[#9e9690]">{label}</div>
      <div className="mt-1 break-words text-[12px] font-semibold text-[#1a1a1a]">{value}</div>
    </div>
  );
}
