"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";

type Proposal = {
  id: string;
  jobTitle: string;
  clientName: string;
  clientId?: string;
  rate: string;
  status: string;
  hoursPerWeek: string;
  pricingType: string;
  cover: string;
  jobId?: string;
  jobDescription?: string;
  jobCategory?: string;
  createdAt?: any;
};

const formatSats = (value: string) =>
  value?.trim()
    ? value.toLowerCase().includes("sats")
      ? value
      : `${value} sats`
    : "";

const formatStatus = (value: string) => {
  if (value === "accepted") return "Accepted";
  if (value === "rejected") return "Rejected";
  return "Pending";
};

const cleanText = (text: string) =>
  text?.replace(/\s{2,}/g, " ").trim() ?? "";

const isPlaceholderClientName = (value: string) =>
  !value || value.trim().toLowerCase() === "client";

export default function FreelancerProposalsContent() {
  const [view, setView] = useState<"all" | "accepted" | "pending" | "rejected">("all");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const clientNameCache = useRef<Record<string, string>>({});

  useEffect(() => {
    const unsubscribeAuth = firebaseAuth.onAuthStateChanged((user) => {
      if (!user) {
        setProposals([]);
        setLoading(false);
        setErrorMessage("Please log in to view proposals.");
        return;
      }
      setLoading(true);
      setErrorMessage("");
      const proposalsQuery = query(
        collection(firebaseDb, "proposals"),
        where("freelancerId", "==", user.uid)
      );
      const unsubscribe = onSnapshot(
        proposalsQuery,
        (snapshot) => {
          const hydrate = async () => {
            const items = await Promise.all(
              snapshot.docs.map(async (docSnap) => {
                const data = docSnap.data() as any;
                let clientId = data.clientId ?? "";
                let clientName = data.clientName ?? "";
                const jobId = data.jobId ?? "";
                let jobTitle = data.jobTitle ?? "Job Proposal";
                let jobDescription = "";
                let jobCategory = "";

                // Always fetch job to get latest title, description, category, and clientId
                if (jobId) {
                  try {
                    const jobSnap = await getDoc(doc(firebaseDb, "jobs", jobId));
                    if (jobSnap.exists()) {
                      const jobData = jobSnap.data() as any;
                      if (!clientId) clientId = jobData.clientId ?? "";
                      const jobClientName = jobData.clientName ?? jobData.clientCompany ?? "";
                      if (isPlaceholderClientName(clientName) && jobClientName) {
                        clientName = jobClientName;
                      }
                      jobTitle = jobData.title ?? jobTitle;
                      jobDescription = cleanText(jobData.description ?? "");
                      jobCategory = jobData.category ?? "";
                    }
                  } catch {
                    // ignore
                  }
                }

                // If we still don't have a name, look it up from all_users
                if (isPlaceholderClientName(clientName) && clientId) {
                  if (clientNameCache.current[clientId]) {
                    clientName = clientNameCache.current[clientId];
                  } else {
                    try {
                      // Try all_users first
                      const allUsersSnap = await getDoc(doc(firebaseDb, "all_users", clientId));
                      if (allUsersSnap.exists()) {
                        const d = allUsersSnap.data() as any;
                        clientName = d.fullName ?? d.name ?? d.email ?? "";
                      }
                      // Fallback to clients collection
                      if (!clientName) {
                        const clientsSnap = await getDoc(doc(firebaseDb, "clients", clientId));
                        if (clientsSnap.exists()) {
                          const d = clientsSnap.data() as any;
                          clientName = d.companyName ?? d.fullName ?? d.name ?? "";
                        }
                      }
                      clientNameCache.current[clientId] = clientName || "Client";
                    } catch {
                      clientName = "Client";
                    }
                  }
                }

                return {
                  id: docSnap.id,
                  jobTitle,
                  clientName: clientName || "Client",
                  clientId,
                  rate: formatSats(data.rate ?? "0"),
                  status: data.status ?? "submitted",
                  hoursPerWeek: data.hoursPerWeek ?? "",
                  pricingType: data.pricingType ?? "Fixed Price",
                  cover: cleanText(data.cover ?? ""),
                  jobId,
                  jobDescription,
                  jobCategory,
                  createdAt: data.createdAt,
                };
              })
            );
            setProposals(items);
            setLoading(false);
          };
          hydrate();
        },
        () => {
          setLoading(false);
          setErrorMessage("Unable to load proposals.");
        }
      );
      return () => unsubscribe();
    });
    return () => unsubscribeAuth();
  }, []);

  const filtered = useMemo(() => {
    if (view === "accepted") return proposals.filter((p) => p.status === "accepted");
    if (view === "rejected") return proposals.filter((p) => p.status === "rejected");
    if (view === "pending") return proposals.filter((p) => p.status === "submitted");
    return proposals;
  }, [view, proposals]);

  const openDetails = async (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setSelectedJob(null);
    setIsModalOpen(true);
    if (!proposal.jobId) return;
    const snap = await getDoc(doc(firebaseDb, "jobs", proposal.jobId));
    if (snap.exists()) {
      setSelectedJob({ id: snap.id, ...snap.data() });
    }
  };

  return (
    <section className="w-full max-w-full space-y-5 overflow-x-hidden">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-black tracking-[-0.02em] text-[#1a1a1a]">Your submitted proposals</h1>
          <p className="mt-1 text-[13px] leading-[1.6] text-[#6b6762]">
            Track your bids, client responses, and next steps.
          </p>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total", count: proposals.length, sub: "All time", iconBg: "#FFF3E0", iconStroke: "#F7931A",
            icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></> },
          { label: "Pending", count: proposals.filter(p => p.status === "submitted").length, sub: "Awaiting response", iconBg: "#FFF3E0", iconStroke: "#F7931A",
            icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></> },
          { label: "Accepted", count: proposals.filter(p => p.status === "accepted").length, sub: "Hired", iconBg: "#ECFDF5", iconStroke: "#16a34a",
            icon: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></> },
          { label: "Rejected", count: proposals.filter(p => p.status === "rejected").length, sub: "Not selected", iconBg: "#FEF2F2", iconStroke: "#dc2626",
            icon: <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></> },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-[16px] border border-[#EAE7E2] bg-white px-5 py-4 shadow-sm">
            <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[12px]" style={{ backgroundColor: s.iconBg }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={s.iconStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {s.icon}
              </svg>
            </div>
            <div>
              <div className="text-[12px] font-semibold text-[#6b6762]">{s.label}</div>
              <div className="text-[28px] font-black leading-none text-[#1a1a1a]">{s.count}</div>
              <div className="text-[11px] text-[#9e9690]">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-[#EAE7E2] bg-white px-4 py-3">
        <div className="relative min-w-[200px] flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C0B9B0]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" readOnly placeholder="Search proposals..." className="w-full rounded-[10px] border border-transparent bg-transparent py-1.5 pl-8 pr-3 text-[13px] text-[#1a1a1a] placeholder:text-[#B0A99F] focus:outline-none" />
        </div>
        <div className="h-5 w-px bg-[#EAE7E2] hidden sm:block" />
        {[
          { id: "all", label: "All" },
          { id: "pending", label: "Pending" },
          { id: "accepted", label: "Accepted" },
          { id: "rejected", label: "Rejected" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id as any)}
            className={`rounded-[10px] border px-4 py-2 text-[12px] font-medium transition-all ${
              view === tab.id
                ? "bg-[#F7931A] text-white border-[#F7931A]"
                : "border-[#EAE7E2] bg-white text-[#6b6762] hover:bg-[#F7F4F0]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Proposal list ── */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="rounded-[16px] border border-[#EAE7E2] bg-white p-8 text-center text-[13px] text-[#6b6762]">Loading proposals...</div>
        ) : errorMessage ? (
          <div className="rounded-[16px] border border-[#EAE7E2] bg-[#FFF6F2] p-8 text-center text-[13px] text-[#8C4F00]">{errorMessage}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[16px] border border-[#EAE7E2] bg-white p-10 text-center text-[13px] text-[#6b6762]">No proposals match this view yet.</div>
        ) : filtered.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} onClick={() => openDetails(proposal)} />
        ))}
      </div>

      {/* ── Detail modal ── */}
      {isModalOpen && selectedProposal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative z-[81] w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-[16px] border border-[#EAE7E2] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
            <button type="button" onClick={() => setIsModalOpen(false)} aria-label="Close"
              className="absolute right-4 top-4 rounded-full border border-[#EAE7E2] bg-white p-2 text-[#6b6762] hover:bg-[#F7F4F0]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">Proposal Details</div>
                <div className="mt-2 text-[20px] font-semibold text-[#1a1a1a] break-words">{selectedProposal.jobTitle}</div>
                <div className="text-[12px] text-[#9e9690]">Client: {selectedProposal.clientName} • {formatStatus(selectedProposal.status)}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[12px] font-semibold text-[#8C4F00]">{selectedProposal.rate}</div>
                <div className="text-[10px] text-[#9e9690]">{selectedProposal.pricingType} • {selectedProposal.hoursPerWeek || "—"} hrs/week</div>
              </div>
            </div>
            <div className="mt-4 rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-4 py-3 text-[12px] leading-[1.7] text-[#6b6762] break-words">
              {selectedProposal.cover}
            </div>
            {selectedJob ? (
              <div className="mt-6 rounded-[12px] border border-[#EAE7E2] bg-white p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#F5A623]">Job Details</div>
                <div className="mt-2 text-[13px] text-[#6b6762] break-all whitespace-pre-wrap overflow-hidden">
                  {cleanText(selectedJob.description ?? "") || "No description provided."}
                </div>
              </div>
            ) : (
              <div className="mt-6 text-[12px] text-[#9e9690]">Loading job details...</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ProposalCard({ proposal, onClick }: { proposal: Proposal; onClick: () => void }) {
  const displayText = proposal.cover || proposal.jobDescription;
  const isPending = proposal.status === "submitted";
  const isAccepted = proposal.status === "accepted";
  const isRejected = proposal.status === "rejected";

  return (
    <div onClick={onClick} className="relative w-full max-w-full overflow-hidden rounded-[16px] border border-[#EAE7E2] bg-white shadow-sm cursor-pointer hover:border-[#F7931A]/40 hover:shadow-md transition-all">
      {/* three-dot */}
      <button type="button" aria-label="More options" onClick={(e) => e.stopPropagation()}
        className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[#C0B9B0] hover:bg-[#F7F4F0]">
        <svg width="4" height="16" viewBox="0 0 4 20" fill="currentColor">
          <circle cx="2" cy="2" r="2"/><circle cx="2" cy="10" r="2"/><circle cx="2" cy="18" r="2"/>
        </svg>
      </button>

      <div className="flex flex-col gap-4 p-5 pr-12 md:flex-row md:items-start md:gap-6">

        {/* Col 1: Client info */}
        <div className="flex shrink-0 gap-3 w-full md:max-w-[160px] md:flex-col md:gap-2">
          <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[#1a2332] text-[14px] font-bold text-white">
            {(proposal.clientName?.[0] ?? "C").toUpperCase()}
          </div>
          <div>
            <div className="text-[13px] font-bold text-[#1a1a1a]">{proposal.clientName}</div>
            <div className="mt-1 text-[11px] text-[#9e9690]">{proposal.jobCategory || "Client"}</div>
          </div>
        </div>

        {/* Col 2: Applied For */}
        <div className="shrink-0 w-full md:max-w-[180px]">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#9e9690]">Applied For</div>
          <div className="text-[14px] font-bold leading-snug text-[#1a1a1a]">{proposal.jobTitle}</div>
          <div className="mt-1.5 text-[11px] text-[#9e9690]">{proposal.pricingType}</div>
        </div>

        {/* Col 3: Requested */}
        <div className="shrink-0 w-full md:max-w-[100px]">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#9e9690]">Requested</div>
          <div className="flex items-center gap-1">
            <svg width="12" height="14" viewBox="0 0 13 20" fill="#F7931A"><path d="M8 0L0 11h6l-1 9 9-13H8V0z"/></svg>
            <span className="text-[18px] font-black leading-none text-[#F7931A]">{proposal.rate.replace(/\s?sats/i, "")}</span>
            <span className="text-[11px] font-semibold text-[#9e9690]">sats</span>
          </div>
          {proposal.hoursPerWeek && (
            <>
              <div className="mt-2 mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#9e9690]">Hours/Week</div>
              <div className="text-[13px] text-[#6b6762] font-medium">{proposal.hoursPerWeek}</div>
            </>
          )}
        </div>

        {/* Col 4: Cover snippet */}
        <div className="min-w-0 flex-1">
          {displayText ? (
            <p className="text-[13px] leading-[1.7] text-[#6b6762]"
              style={{ display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {displayText}
            </p>
          ) : (
            <p className="text-[13px] text-[#9e9690] italic">No cover letter.</p>
          )}
          <button type="button" onClick={onClick} className="mt-1 text-[12px] font-semibold text-[#F7931A] hover:underline">
            View more
          </button>
        </div>

        {/* Col 5: Status */}
        <div className="flex shrink-0 flex-col gap-2 w-full md:max-w-[130px]">
          {isPending && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#F7931A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F7931A]" />PENDING
            </div>
          )}
          {isAccepted && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-green-600">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />ACCEPTED
            </div>
          )}
          {isRejected && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-500">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />REJECTED
            </div>
          )}
          <div className="text-[11px] text-[#9e9690]">
            {proposal.createdAt
              ? new Date(proposal.createdAt?.seconds ? proposal.createdAt.seconds * 1000 : proposal.createdAt)
                  .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "Recently"}
          </div>
        </div>

      </div>
    </div>
  );
}
