"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/atoms/Button";
import DashboardMetricCard from "@/components/molecules/DashboardMetricCard";
import ClientContractCard from "@/components/molecules/ClientContractCard";
import ClientProposalCard from "@/components/molecules/ClientProposalCard";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, onSnapshot, query, where } from "firebase/firestore";

type FirestoreDateValue = string | number | Date | { seconds?: number } | null | undefined;

const METRICS = [
  { label: "Active Contracts", value: "0", change: "None yet", tone: "neutral" as const },
  { label: "Open Job Posts", value: "0", change: "None yet", tone: "neutral" as const },
  { label: "Total Spent", value: "0 sats", change: "None yet", tone: "neutral" as const },
  { label: "Response Rate", value: "—", change: "Pending data", tone: "neutral" as const },
];

type ContractStatus = "Active" | "Review" | "Completed";

type Contract = {
  id: string;
  title: string;
  freelancer: string;
  freelancerId?: string;
  clientId?: string;
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
  platformFeeSats?: number;
  platformFeePercent?: number;
  escrowFundedTotalSats?: number;
  escrowReleasedSats?: number;
  workStatus?: "not_started" | "in_progress" | "submitted" | "changes_requested" | "approved" | "completed";
  scopeItems?: string[];
  milestones?: Array<{
    index?: number;
    title?: string;
    name?: string;
    amount?: string;
    deadline?: string;
    freelancerAmountSats?: number;
    fundedSats?: number;
    releasedSats?: number;
    status: "Pending" | "In Progress" | "Approved" | "pending" | "funded" | "submitted" | "approved" | "released";
  }>;
  createdAt?: FirestoreDateValue;
  updatedAt?: FirestoreDateValue;
};

type ProposalItem = {
  id: string;
  freelancerId: string;
  name: string;
  title: string;
  rate: string;
  cover: string;
  rating: number;
  availability: string;
  status?: string;
};

type JobStatus = "Open" | "In Review" | "Paused" | "Closed";

type JobPost = {
  id: string;
  title: string;
  status: JobStatus;
  budget: string;
  duration?: string;
  companyLogo?: string;
  proposals: number;
  tags: string[];
  description?: string;
  urgent?: boolean;
  jobType?: string;
  createdAt?: FirestoreDateValue;
};

const formatDate = (value: FirestoreDateValue) => {
  if (!value) return "-";
  if (typeof value === "string") return value;
  const seconds = typeof value === "object" && "seconds" in value ? value.seconds : undefined;
  const date = seconds ? new Date(seconds * 1000) : new Date(value as string | number | Date);
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

const getTimestampMs = (value: FirestoreDateValue) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  const seconds = typeof value === "object" && "seconds" in value ? value.seconds : undefined;
  if (seconds) return seconds * 1000;
  const date = new Date(value as string | Date);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const isFinishedContract = (contract: Contract) =>
  contract.status === "Completed" ||
  contract.paymentStatus === "released" ||
  contract.workStatus === "approved" ||
  contract.workStatus === "completed";

const getLiveContractStatus = (contract: Contract): ContractStatus => {
  if (isFinishedContract(contract)) return "Completed";
  if (contract.workStatus === "submitted" || contract.workStatus === "changes_requested") return "Review";
  return "Active";
};

const getMilestoneLabel = (contract: Contract, fallbackIndex: number) => {
  const milestones = contract.milestones ?? [];
  const milestone =
    milestones.find((item, index) => Number(item.index ?? index + 1) === fallbackIndex) ??
    milestones[Math.max(0, fallbackIndex - 1)];
  const title = milestone?.title || milestone?.name || contract.nextMilestone;
  return title && title !== "-" ? title : `Milestone ${fallbackIndex}`;
};

const getLiveNextMilestone = (contract: Contract) => {
  if (isFinishedContract(contract)) return "All milestones completed";

  const total = Math.max(1, contract.paymentInstallments ?? contract.milestones?.length ?? 1);
  const releasedCount =
    contract.paymentReleasedInstallments ??
    contract.milestones?.filter((milestone) => milestone.status === "released" || milestone.status === "approved").length ??
    0;
  const nextIndex = Math.min(total, releasedCount + 1);
  const label = getMilestoneLabel(contract, nextIndex);

  if (contract.workStatus === "submitted") return `${label} - submitted for review`;
  if (contract.workStatus === "changes_requested") return `${label} - changes requested`;
  if (contract.paymentStatus === "invoice_created") return `${label} - awaiting escrow funding`;
  if (contract.paymentStatus === "funded" || contract.workStatus === "in_progress") return `${label} - in progress`;
  return label;
};

const getLiveProgress = (contract: Contract) => {
  if (isFinishedContract(contract)) return 100;

  const total = Math.max(1, contract.paymentInstallments ?? contract.milestones?.length ?? 1);
  const releasedCount =
    contract.paymentReleasedInstallments ??
    contract.milestones?.filter((milestone) => milestone.status === "released" || milestone.status === "approved").length ??
    0;

  const currentMilestoneWeight =
    contract.workStatus === "submitted" ? 0.75 :
      contract.workStatus === "changes_requested" ? 0.6 :
        contract.workStatus === "in_progress" || contract.paymentStatus === "funded" ? 0.45 :
          contract.paymentStatus === "invoice_created" ? 0.15 :
            0;

  const derivedProgress = Math.round(((releasedCount + currentMilestoneWeight) / total) * 100);
  const storedProgress = Number.isFinite(contract.progress) ? contract.progress : 0;
  return Math.max(0, Math.min(99, Math.max(storedProgress, derivedProgress)));
};

const hydrateContractProgress = (contract: Contract): Contract => ({
  ...contract,
  status: getLiveContractStatus(contract),
  progress: getLiveProgress(contract),
  nextMilestone: getLiveNextMilestone(contract),
});

export default function ClientOverviewContent() {
  const [displayName, setDisplayName] = useState('Client');
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedProposals, setSelectedProposals] = useState<Record<string, boolean>>({});
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState("");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [contractsError, setContractsError] = useState("");
  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const freelancerNameCache = useRef<Record<string, string>>({});

  const selectedContract = useMemo(
    () => contracts.find((c) => c.id === selectedContractId) ?? contracts[0],
    [selectedContractId, contracts]
  );

  const activeContracts = useMemo(
    () => contracts.filter((contract) => !isFinishedContract(contract)),
    [contracts]
  );

  const latestActiveContracts = useMemo(
    () => activeContracts.slice(0, 2),
    [activeContracts]
  );

  const latestJobs = useMemo(() => {
    const sorted = [...jobs].sort((a, b) => {
      const aTime = getTimestampMs(a.createdAt);
      const bTime = getTimestampMs(b.createdAt);
      return bTime - aTime;
    });
    return sorted.slice(0, 2);
  }, [jobs]);

  const selectedJob = useMemo(
    () => latestJobs.find((j) => j.id === selectedJobId) ?? latestJobs[0],
    [selectedJobId, latestJobs]
  );

  // Fetch proposals for the selected job in real-time
  useEffect(() => {
    if (!selectedJobId) {
      setProposals([]);
      return;
    }
    setProposalsLoading(true);
    const proposalsQuery = query(
      collection(firebaseDb, "proposals"),
      where("jobId", "==", selectedJobId)
    );
    const unsubscribe = onSnapshot(
      proposalsQuery,
      (snapshot) => {
        const items: ProposalItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            id: docSnap.id,
            freelancerId: data.freelancerId ?? "",
            name: data.freelancerName ?? "Freelancer",
            title: data.freelancerTitle ?? "Professional",
            rate: data.rate ?? "-",
            cover: data.cover ?? "",
            rating: typeof data.rating === "number" ? data.rating : 5,
            availability: data.availability ?? "Available",
            status: data.status ?? "submitted",
          };
        });
        setProposals(items);
        setProposalsLoading(false);
      },
      () => {
        setProposals([]);
        setProposalsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [selectedJobId]);

  const formatBudget = (value: string) =>
    value?.trim()
      ? value.toLowerCase().includes("sats")
        ? value
        : `${value} sats`
      : null;

  const totalSpent = useMemo(() => {
    return contracts.reduce((acc, contract) => {
      const milestones = contract.milestones ?? [];
      if (milestones.length > 0) {
        const releasedSum = milestones.reduce((sum, ms) => sum + Number(ms.releasedSats ?? 0), 0);
        return acc + releasedSum;
      }
      return acc + Number(contract.escrowReleasedSats ?? 0);
    }, 0);
  }, [contracts]);

  const resolveFreelancerName = async (freelancerId: string, fallbackName: string) => {
    const initialFallback = fallbackName?.trim() || "";
    if (!freelancerId) return initialFallback || "Freelancer";
    if (freelancerNameCache.current[freelancerId]) return freelancerNameCache.current[freelancerId];

    let resolvedName = initialFallback;

    try {
      const allUsersSnap = await getDoc(doc(firebaseDb, "all_users", freelancerId));
      if (allUsersSnap.exists()) {
        const data = allUsersSnap.data() as any;
        resolvedName = data.fullName ?? data.name ?? data.email ?? resolvedName;
      }
    } catch {
      // Continue with freelancers collection lookup.
    }

    if (!resolvedName) {
      try {
        const freelancerDocSnap = await getDoc(doc(firebaseDb, "freelancers", freelancerId));
        if (freelancerDocSnap.exists()) {
          const data = freelancerDocSnap.data() as any;
          const composedName = `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
          resolvedName = data.fullName || composedName || data.name || resolvedName;
        }
      } catch {
        // Continue with UID-based lookup.
      }
    }

    if (!resolvedName) {
      try {
        const freelancersByUidQuery = query(
          collection(firebaseDb, "freelancers"),
          where("uid", "==", freelancerId),
          limit(1)
        );
        const freelancersByUidSnap = await getDocs(freelancersByUidQuery);
        if (!freelancersByUidSnap.empty) {
          const data = freelancersByUidSnap.docs[0].data() as any;
          const composedName = `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
          resolvedName = data.fullName || composedName || data.name || resolvedName;
        }
      } catch {
        // Keep fallback below.
      }
    }

    const finalName = resolvedName || "Freelancer";
    freelancerNameCache.current[freelancerId] = finalName;
    return finalName;
  };

  useEffect(() => {
    let unsubscribeContracts: (() => void) | undefined;
    let unsubscribeJobs: (() => void) | undefined;
    let isActive = true;

    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) {
        if (unsubscribeContracts) unsubscribeContracts();
        if (unsubscribeJobs) unsubscribeJobs();
        setContracts([]);
        setSelectedContractId("");
        setContractsLoading(false);
        setContractsError("Please log in to view contracts.");
        setJobs([]);
        setSelectedJobId("");
        setJobsLoading(false);
        setJobsError("Please log in to view your job posts.");
        setDisplayName('Client');
        return;
      }

      // Load Profile Name
      const loadProfile = async () => {
        try {
          const snap = await getDoc(doc(firebaseDb, 'all_users', user.uid));
          const data = snap.exists() ? (snap.data() as any) : null;
          setDisplayName(data?.fullName ?? user.displayName ?? 'Client');
        } catch {
          setDisplayName(user.displayName ?? 'Client');
        }
      };
      loadProfile();

      setContractsLoading(true);
      setContractsError("");
      setJobsLoading(true);
      setJobsError("");

      const contractsQuery = query(
        collection(firebaseDb, "contracts"),
        where("clientId", "==", user.uid)
      );

      unsubscribeContracts = onSnapshot(
        contractsQuery,
        (snapshot) => {
          const hydrateContracts = async () => {
            const items = await Promise.all(
              snapshot.docs.map(async (docSnap) => {
                const data = docSnap.data() as any;
                const freelancerId = data.freelancerId ?? "";
                const freelancer = await resolveFreelancerName(
                  freelancerId,
                  data.freelancerName ?? ""
                );

                return hydrateContractProgress({
                  id: docSnap.id,
                  title: data.title ?? "Contract",
                  freelancer,
                  freelancerId,
                  clientId: data.clientId ?? "",
                  jobId: data.jobId ?? "",
                  contractType: data.contractType ?? data.jobType ?? "Fixed Price",
                  progress: typeof data.progress === "number" ? data.progress : 0,
                  nextMilestone: data.nextMilestone ?? "-",
                  status: (data.status as ContractStatus) ?? "Active",
                  budget: formatSats(data.budget ?? "0"),
                  startDate: formatDate(data.startDate),
                  dueDate: formatDate(data.dueDate),
                  description: data.description ?? "-",
                  paymentStatus: data.paymentStatus ?? "unfunded",
                  paymentInstallments: Number(data.paymentInstallments ?? 1),
                  paymentCurrentInstallment: Number(data.paymentCurrentInstallment ?? 1),
                  paymentReleasedInstallments: Number(data.paymentReleasedInstallments ?? 0),
                  paymentTotalAmountSats: Number(data.paymentTotalAmountSats ?? parseSats(data.budget) ?? 0),
                  paymentTotalChargedSats: Number(data.paymentTotalChargedSats ?? 0),
                  platformFeeSats: Number(data.platformFeeSats ?? 0),
                  platformFeePercent: Number(data.platformFeePercent ?? 5),
                  escrowFundedTotalSats: Number(data.escrowFundedTotalSats ?? 0),
                  escrowReleasedSats: Number(data.escrowReleasedSats ?? 0),
                  workStatus: data.workStatus ?? "not_started",
                  scopeItems: Array.isArray(data.scopeItems) ? data.scopeItems : [],
                  milestones: Array.isArray(data.milestones) ? data.milestones : [],
                  createdAt: data.createdAt,
                  updatedAt: data.updatedAt,
                } satisfies Contract);
              })
            );

            if (!isActive) return;
            const sortedItems = [...items].sort(
              (a, b) => getTimestampMs(b.updatedAt || b.createdAt) - getTimestampMs(a.updatedAt || a.createdAt)
            );
            setContracts(sortedItems);
            setContractsLoading(false);
            if (sortedItems.length) {
              const latestActive = sortedItems.find((contract) => !isFinishedContract(contract)) ?? sortedItems[0];
              if (latestActive?.id) {
                setSelectedContractId((current) => current || latestActive.id);
              }
            }
          };

          hydrateContracts();
        },
        () => {
          if (!isActive) return;
          setContractsLoading(false);
          setContractsError("Unable to load latest contracts.");
        }
      );

      const jobsQuery = query(
        collection(firebaseDb, "jobs"),
        where("clientId", "==", user.uid)
      );

      unsubscribeJobs = onSnapshot(
        jobsQuery,
        (snapshot) => {
          const items: JobPost[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as any;
            return {
              id: docSnap.id,
              title: data.title ?? "",
              status: (data.status as JobStatus) ?? "Open",
              budget: data.budget ?? "",
              duration: data.duration ?? "",
              companyLogo: data.companyLogo ?? "",
              proposals: data.proposals ?? 0,
              tags: Array.isArray(data.skills) ? data.skills : [],
              description: data.description ?? "",
              urgent: !!data.urgent,
              jobType: data.jobType ?? "",
              createdAt: data.createdAt,
            };
          });
          setJobs(items);
          setJobsLoading(false);
          if (items.length) {
            const latest = [...items].sort((a, b) => {
              const aTime = getTimestampMs(a.createdAt);
              const bTime = getTimestampMs(b.createdAt);
              return bTime - aTime;
            })[0];
            if (latest?.id) {
              setSelectedJobId((current) => current || latest.id);
            }
          }
        },
        () => {
          setJobsLoading(false);
          setJobsError("Unable to load latest job posts.");
        }
      );
    });

    return () => {
      isActive = false;
      unsubscribeAuth();
      if (unsubscribeContracts) unsubscribeContracts();
      if (unsubscribeJobs) unsubscribeJobs();
    };
  }, []);

  const dynamicMetrics = [
    { label: "Active Contracts", value: `${activeContracts.length}`, change: activeContracts.length ? "Live" : "None yet", tone: activeContracts.length ? "up" as const : "neutral" as const },
    { label: "Open Job Posts", value: `${jobs.filter(j => j.status === 'Open').length}`, change: "Currently active", tone: "neutral" as const },
    { label: "Total Spent", value: `${totalSpent.toLocaleString()} sats`, change: totalSpent ? "Across contracts" : "None yet", tone: totalSpent ? "up" as const : "neutral" as const },
    { label: "Total Jobs Posted", value: `${jobs.length}`, change: "Lifetime posts", tone: "neutral" as const },
  ];

  return (
    <section className="w-full">
      <div className="rounded-[16px] border border-[#EAE7E2] bg-white p-6 shadow-[0_8px_22px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">
              Client Dashboard
            </div>
            <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.02em] text-[#1a1a1a]">
              Welcome back, {displayName}
            </h1>
            <p className="mt-2 text-[12px] leading-[1.7] text-[#6b6762]">
              Track hiring momentum, manage contracts, and keep your Bitcoin initiatives moving.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {/* <Button size="sm" variant="outline" className="rounded-full w-full sm:w-auto">
              View Reports
            </Button> */}
            <Button
              size="sm"
              className="rounded-full w-full sm:w-auto"
              onClick={() => window.location.href = '/client/dashboard/job-posts?action=new'}
            >
              Post New Job
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {dynamicMetrics.map((metric) => (
          <DashboardMetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            change={metric.change}
            tone={metric.tone}
          />
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F5A623]">
              Latest Active Contracts
            </div>
            <span className="text-[11px] text-[#9e9690]">Updated today</span>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {contractsLoading ? (
              <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FAF8F5] p-4 text-[12px] text-[#6b6762]">
                Loading latest contracts...
              </div>
            ) : contractsError ? (
              <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FFF6F2] p-4 text-[12px] text-[#8C4F00]">
                {contractsError}
              </div>
            ) : latestActiveContracts.length > 0 ? (
              latestActiveContracts.map((contract) => (
                <button
                  key={contract.id}
                  type="button"
                  onClick={() => {
                    setSelectedContractId(contract.id);
                    setContractModalOpen(true);
                  }}
                  className="text-left"
                >
                  <ClientContractCard {...contract} showDetailsHint={false} />
                </button>
              ))
            ) : (
              <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FAF8F5] p-4 text-[12px] text-[#6b6762]">
                No recent active contracts yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-5 overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F5A623]">
              Latest Job Posts
            </div>
            <span className="text-[11px] text-[#9e9690]">New this week</span>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {jobsLoading ? (
              <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FAF8F5] p-4 text-[12px] text-[#6b6762]">
                Loading latest jobs...
              </div>
            ) : jobsError ? (
              <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FFF6F2] p-4 text-[12px] text-[#8C4F00]">
                {jobsError}
              </div>
            ) : latestJobs.length ? (
              latestJobs.map((job) => {
                const budgetNumeric = job.budget?.replace(/[^0-9,]/g, "").trim() || "0";
                const statusStyles: Record<string, string> = {
                  Open: "bg-[#E8F5E9] text-[#2E7D32]",
                  Paused: "bg-[#FDECEA] text-[#C62828]",
                  "In Review": "bg-[#E8F0FE] text-[#1565C0]",
                  Closed: "bg-gray-100 text-gray-700 border border-gray-300",
                };
                const cleanDesc = job.description?.trim()
                  ? job.description.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim()
                  : null;
                return (
                  <div
                    key={job.id}
                    onClick={() => { setSelectedJobId(job.id); setJobModalOpen(true); }}
                    className="cursor-pointer rounded-[12px] border border-[#EAE7E2] bg-white p-4 hover:border-[#F7931A]/40 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-3">
                      {/* Logo */}
                      <div className="flex-shrink-0 h-10 w-10 rounded-[8px] overflow-hidden bg-[#F7931A] flex items-center justify-center">
                        {job.companyLogo ? (
                          <img src={job.companyLogo} alt="logo" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[15px] font-black text-white">B</span>
                        )}
                      </div>

                      {/* Title + desc */}
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div
                          className="text-[13px] font-bold text-[#1a1a1a] leading-[1.3]"
                          style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                        >
                          {job.title}
                        </div>
                        {cleanDesc && (
                          <div
                            className="mt-0.5 text-[11px] text-[#6b6762] leading-[1.5]"
                            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}
                          >
                            {cleanDesc}
                          </div>
                        )}
                        {/* Tags */}
                        {job.tags?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {job.tags.slice(0, 3).map((tag: string) => (
                              <span key={tag} className="rounded-full bg-[#F3F0EC] px-2 py-0.5 text-[10px] font-medium text-[#555]">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Proposals count */}
                        <div className="mt-2 flex items-center gap-1 text-[11px] text-[#9e9690]">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                          </svg>
                          <span>{job.proposals ?? 0} Proposals</span>
                        </div>
                      </div>

                      {/* Right: status + budget */}
                      <div className="flex flex-shrink-0 flex-col items-end gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${statusStyles[job.status as string] ?? "bg-[#F3F0EC] text-[#555]"}`}>
                          {job.status}
                        </span>
                        <div className="flex items-center gap-0.5 mt-1">
                          <svg width="10" height="12" viewBox="0 0 12 18" fill="#F7931A">
                            <path d="M7 0L0 10h5l-1 8 8-11H7V0z" />
                          </svg>
                          <span className="text-[16px] font-black text-[#1a1a1a] tabular-nums leading-none">{budgetNumeric}</span>
                        </div>
                        <span className="text-[9px] font-semibold uppercase text-[#9e9690]">sats</span>
                        {job.duration && (
                          <div className="flex items-center gap-0.5 text-[9px] text-[#9e9690]">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            <span>{job.duration}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FAF8F5] p-4 text-[12px] text-[#6b6762]">
                No job posts yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {contractModalOpen && selectedContract ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setContractModalOpen(false)}
          />
          <div className="relative z-[81] w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-[16px] border border-[#EAE7E2] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
            <button
              type="button"
              onClick={() => setContractModalOpen(false)}
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
                  Freelancer: {selectedContract.freelancer} • {selectedContract.status}
                </div>
              </div>
            </div>
            <div className="mt-4 mb-4 text-[12px] leading-[1.7] text-[#6b6762]">
              {selectedContract.description}
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


          </div>
        </div>
      ) : null}

      {jobModalOpen && selectedJob ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setJobModalOpen(false)}
          />
          <div className="relative z-[81] w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-[16px] border border-[#EAE7E2] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
            <button
              type="button"
              onClick={() => setJobModalOpen(false)}
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
                  Job Post Details
                </div>
                <div className="mt-2 text-[18px] font-semibold text-[#1a1a1a]">
                  {selectedJob.title}
                </div>
                <div className="mt-1 text-[12px] text-[#9e9690]">
                  {selectedJob.status}
                  {formatBudget(selectedJob.budget) ? ` • ${formatBudget(selectedJob.budget)}` : ""}
                  {" "}• {selectedJob.proposals} proposal{selectedJob.proposals !== 1 ? "s" : ""}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedJob.tags.map((tag) => (
                    <span key={tag} className="inline-flex rounded-full bg-[#F6F3F1] px-3 py-1 text-[10px] font-semibold uppercase text-[#666]">
                      {tag}
                    </span>
                  ))}
                </div>
                {selectedJob.urgent ? (
                  <div className="mt-3 inline-flex items-center rounded-full bg-[#FFF0E6] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#B45309]">
                    Urgent
                  </div>
                ) : null}
                {selectedJob.jobType ? (
                  <div className="mt-2 text-[11px] text-[#6b6762]">
                    Type: {selectedJob.jobType}
                  </div>
                ) : null}
              </div>
            </div>

            {selectedJob.description?.trim() ? (
              <div className="mt-4 rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-4 py-3 text-[12px] leading-[1.7] text-[#6b6762] line-clamp-4 overflow-y-auto break-words">
                {selectedJob.description.replace(/\s{2,}/g, " ").trim()}
              </div>
            ) : null}

            <div className="mt-5">
              <div className="text-[11px] text-[#6b6762]">
                Review candidates and select the freelancers you want to hire.
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {proposalsLoading ? (
                <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FAF8F5] p-4 text-[12px] text-[#6b6762]">
                  Loading proposals...
                </div>
              ) : proposals.length > 0 ? (
                proposals.map((proposal) => (
                  <ClientProposalCard
                    key={proposal.id}
                    {...proposal}
                    isSelected={!!selectedProposals[proposal.id]}
                    onToggle={() =>
                      setSelectedProposals((prev) => ({
                        ...prev,
                        [proposal.id]: !prev[proposal.id],
                      }))
                    }
                  />
                ))
              ) : (
                <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FAF8F5] p-4 text-[12px] text-[#9e9690] text-center py-8">
                  No proposals yet for this job.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
