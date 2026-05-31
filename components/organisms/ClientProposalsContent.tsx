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

export default function ClientProposalsContent() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ProposalStatus>("all");
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
        setJobs([]);
        setProposals([]);
        setLoading(false);
        setErrorMessage("Please log in to review proposals.");
        return;
      }

      setLoading(true);
      setErrorMessage("");
      clientIdentity.current = await resolveClientIdentity(user.uid);

      unsubscribeJobs = onSnapshot(
        query(collection(firebaseDb, "jobs"), where("clientId", "==", user.uid)),
        (snapshot) => {
          const items = snapshot.docs.map((docSnap) => {
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
          });
          setJobs(items);
        }
      );

      unsubscribeProposals = onSnapshot(
        query(collection(firebaseDb, "proposals"), where("clientId", "==", user.uid)),
        (snapshot) => {
          const items = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as any;
            return {
              id: docSnap.id,
              jobId: data.jobId ?? "",
              jobTitle: data.jobTitle ?? "Job Proposal",
              freelancerId: data.freelancerId ?? "",
              freelancerName: data.freelancerName ?? "Freelancer",
              freelancerTitle: data.freelancerTitle ?? "Professional",
              rate: formatSats(data.rate ?? "0"),
              pricingType: data.pricingType ?? "Fixed Price",
              hoursPerWeek: data.hoursPerWeek ?? "",
              cover: data.cover ?? "",
              availability: data.availability ?? "Available",
              status: data.status ?? "submitted",
              createdAt: data.createdAt,
            };
          });
          setProposals(items);
          setLoading(false);
          setSelectedProposalId((current) => current || items[0]?.id || "");
        },
        () => {
          setLoading(false);
          setErrorMessage("Unable to load proposals right now.");
        }
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
      return true;
    });
  }, [proposals, selectedJobId, statusFilter]);

  const selectedProposal = proposals.find((proposal) => proposal.id === selectedProposalId) ?? filteredProposals[0] ?? null;
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

      batch.update(doc(firebaseDb, "proposals", proposal.id), {
        status: "accepted",
        updatedAt: serverTimestamp(),
      });
      batch.set(
        doc(firebaseDb, "contracts", contractId),
        {
          jobId: job.id,
          clientId: user.uid,
          freelancerId: proposal.freelancerId,
          freelancerName: freelancerIdentity.name,
          title: job.title,
          description: job.description,
          status: "Active",
          budget: job.budget,
          contractType: job.jobType || "Fixed Price",
          paymentTotalAmountSats,
          paymentStatus: "unfunded",
          progress: 0,
          nextMilestone: "Kickoff & onboarding",
          unreadByClient: false,
          unreadByFreelancer: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      batch.set(
        doc(firebaseDb, "conversations", conversationId),
        {
          jobId: job.id,
          jobTitle: job.title,
          proposalId: proposal.id,
          clientId: user.uid,
          clientName: clientIdentity.current.name,
          freelancerId: proposal.freelancerId,
          freelancerName: freelancerIdentity.name,
          clientAvatarUrl: clientIdentity.current.avatarUrl,
          freelancerAvatarUrl: freelancerIdentity.avatarUrl,
          paymentTotalAmountSats,
          paymentStatus: "unfunded",
          createdBy: "system",
          canFreelancerMessage: true,
          unread: {
            [user.uid]: 0,
            [proposal.freelancerId]: 1,
          },
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
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
    } finally {
      setActionId("");
    }
  };

  const rejectProposal = async (proposal: Proposal) => {
    setActionId(proposal.id);
    try {
      await updateDoc(doc(firebaseDb, "proposals", proposal.id), {
        status: "rejected",
        updatedAt: serverTimestamp(),
      });
      void sendUserNotification({
        userId: proposal.freelancerId,
        title: "Proposal rejected",
        body: `Your proposal for "${proposal.jobTitle}" was not selected.`,
        url: "/freelancer/dashboard/proposals",
        tag: `proposal-rejected-${proposal.id}`,
      }).catch(console.error);
      triggerToast(`${proposal.freelancerName} rejected.`);
    } finally {
      setActionId("");
    }
  };

  const messageFreelancer = async (proposal: Proposal) => {
    const user = firebaseAuth.currentUser;
    const job = jobMap.get(proposal.jobId);
    if (!user || !job) return;

    setActionId(proposal.id);
    try {
      const freelancerIdentity = await resolveFreelancerIdentity(proposal.freelancerId, proposal.freelancerName);
      const conversationId = createConversationId(job.id, proposal.freelancerId);
      await setDoc(
        doc(firebaseDb, "conversations", conversationId),
        {
          jobId: job.id,
          jobTitle: job.title,
          proposalId: proposal.id,
          clientId: user.uid,
          clientName: clientIdentity.current.name,
          freelancerId: proposal.freelancerId,
          freelancerName: freelancerIdentity.name,
          clientAvatarUrl: clientIdentity.current.avatarUrl,
          freelancerAvatarUrl: freelancerIdentity.avatarUrl,
          paymentTotalAmountSats: parseSats(job.budget),
          paymentStatus: "unfunded",
          createdBy: "client",
          canFreelancerMessage: true,
          unread: {
            [user.uid]: 0,
            [proposal.freelancerId]: 0,
          },
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
      router.push(`/client/dashboard/messages?chat=${conversationId}`);
    } finally {
      setActionId("");
    }
  };

  const stats = useMemo(
    () => ({
      all: proposals.length,
      submitted: proposals.filter((proposal) => proposal.status === "submitted").length,
      accepted: proposals.filter((proposal) => proposal.status === "accepted").length,
      rejected: proposals.filter((proposal) => proposal.status === "rejected").length,
    }),
    [proposals]
  );

  return (
    <section className="w-full">
      <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-6 shadow-[0_8px_22px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">
              Proposals
            </div>
            <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[#1a1a1a]">
              Review freelancers for your jobs
            </h1>
            <p className="mt-2 text-[12px] leading-[1.7] text-[#6b6762]">
              See every proposal tied to jobs you posted, inspect the job context, then accept, reject, or message the freelancer.
            </p>
          </div>
          <Button size="sm" className="rounded-full" onClick={() => router.push("/client/dashboard/job-posts?action=new")}>
            Post New Job
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["All", stats.all, "all"],
          ["Pending", stats.submitted, "submitted"],
          ["Accepted", stats.accepted, "accepted"],
          ["Rejected", stats.rejected, "rejected"],
        ].map(([label, count, id]) => (
          <button
            key={String(id)}
            type="button"
            onClick={() => setStatusFilter(id as ProposalStatus)}
            className={`rounded-[12px] border p-4 text-left transition ${
              statusFilter === id ? "border-[#F2D8AA] bg-white shadow-sm" : "border-[#EAE7E2] bg-[#FAF8F5]"
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9e9690]">{label}</div>
            <div className="mt-2 text-[24px] font-semibold text-[#1a1a1a]">{count}</div>
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-[12px] border border-[#EAE7E2] bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F5A623]">
              Filter by job
            </div>
            <div className="text-[12px] text-[#6b6762]">Choose one job or review all proposals together.</div>
          </div>
          <select
            value={selectedJobId}
            onChange={(event) => setSelectedJobId(event.target.value)}
            className="rounded-full border border-[#EAE7E2] bg-white px-4 py-2 text-[12px] text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="all">All jobs</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 rounded-[12px] border border-[#EAE7E2] bg-white p-4">
        <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F5A623]">
          Proposal List
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FAF8F5] p-6 text-[12px] text-[#6b6762]">
              Loading proposals...
            </div>
          ) : errorMessage ? (
            <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FFF6F2] p-6 text-[12px] text-[#8C4F00]">
              {errorMessage}
            </div>
          ) : filteredProposals.length ? (
            filteredProposals.map((proposal) => {
              const job = jobMap.get(proposal.jobId);
              return (
                <button
                  key={proposal.id}
                  type="button"
                  onClick={() => {
                    setSelectedProposalId(proposal.id);
                    setProposalModalOpen(true);
                  }}
                  className="rounded-[12px] border border-[#EFECE7] bg-[#FAF8F5] p-4 text-left transition hover:border-[#F2D8AA] hover:bg-[#FFFDF8] hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold text-[#1a1a1a]">{proposal.freelancerName}</div>
                      <div className="mt-1 truncate text-[11px] text-[#6b6762]">{proposal.freelancerTitle}</div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusClass(proposal.status)}`}>
                      {statusLabel(proposal.status)}
                    </span>
                  </div>
                  <div className="mt-3 text-[12px] font-semibold text-[#8C4F00]">{proposal.rate}</div>
                  <div className="mt-1 text-[11px] text-[#9e9690]">
                    {job?.title ?? proposal.jobTitle} | {formatDate(proposal.createdAt)}
                  </div>
                  <div className="mt-4 inline-flex rounded-full border border-[#EAE7E2] bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8C4F00]">
                    View Details
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FAF8F5] p-8 text-center text-[12px] text-[#6b6762]">
              No proposals match this view yet.
            </div>
          )}
        </div>
      </div>

      {proposalModalOpen && selectedProposal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setProposalModalOpen(false)} />
          <div className="relative z-[91] w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-[16px] border border-[#EAE7E2] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
            <button
              type="button"
              onClick={() => setProposalModalOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full border border-[#EAE7E2] bg-white px-3 py-1 text-[12px] text-[#6b6762] hover:bg-[#F7F4F0]"
            >
              Close
            </button>
            <div className="flex flex-col gap-4 pr-16 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">
                  Proposal Details
                </div>
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
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setJobModalOpen(true)} disabled={!selectedJob}>
                  View Job
                </Button>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => messageFreelancer(selectedProposal)}
                disabled={actionId === selectedProposal.id}
              >
                Message
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => rejectProposal(selectedProposal)}
                disabled={selectedProposal.status === "rejected" || actionId === selectedProposal.id}
              >
                Reject
              </Button>
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => acceptProposal(selectedProposal)}
                disabled={selectedProposal.status === "accepted" || actionId === selectedProposal.id}
              >
                {actionId === selectedProposal.id ? "Working..." : "Accept Proposal"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {jobModalOpen && selectedJob ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setJobModalOpen(false)} />
          <div className="relative z-[91] w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-[16px] border border-[#EAE7E2] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
            <button
              type="button"
              onClick={() => setJobModalOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full border border-[#EAE7E2] bg-white p-2 text-[#6b6762] hover:bg-[#F7F4F0]"
            >
              x
            </button>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">Job Details</div>
            <h2 className="mt-2 pr-8 text-[22px] font-semibold text-[#1a1a1a]">{selectedJob.title}</h2>
            <div className="mt-2 text-[12px] text-[#9e9690]">
              {selectedJob.status} | {formatSats(selectedJob.budget)} | {selectedJob.duration || "No duration"} | {selectedJob.proposals} proposals
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedJob.skills.map((skill) => (
                <span key={skill} className="rounded-full bg-[#F6F3F1] px-3 py-1 text-[10px] font-semibold uppercase text-[#666]">
                  {skill}
                </span>
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
      ) : null}

      {toast ? (
        <div className="fixed bottom-8 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-[#1a1a1a] px-6 py-3 text-[13px] font-medium text-white shadow-2xl">
          {toast}
        </div>
      ) : null}
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
