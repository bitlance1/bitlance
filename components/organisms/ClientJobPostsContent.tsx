"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/atoms/Button";
import ClientJobPostCard from "@/components/molecules/ClientJobPostCard";
import ClientProposalCard from "@/components/molecules/ClientProposalCard";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { sendUserNotification } from "@/lib/notifications";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  arrayUnion,
  where,
} from "firebase/firestore";

type JobStatus = "Open" | "In Review" | "Paused";

type JobPost = {
  id: string;
  uuid: string;
  title: string;
  description?: string;
  status: JobStatus;
  budget: string;
  duration?: string;
  companyLogo?: string;
  proposals: number;
  tags: string[];
  urgent?: boolean;
  jobType?: string;
  category?: string;
};

const JOB_CATEGORIES = [
  "Development",
  "Design & Creative",
  "Writing",
  "Marketing",
  "Sales",
  "Customer Support",
  "Finance & Accounting",
  "Data & Analytics",
  "Product Management",
  "DevOps & Infrastructure",
  "Security",
  "QA & Testing",
  "Blockchain & Crypto",
  "Project Management",
];

const parseSats = (value: unknown) => {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "").replace(/[^0-9]/g, "");
  return cleaned ? Number(cleaned) : 0;
};

export default function ClientJobPostsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedJobId, setSelectedJobId] = useState("");
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState("");
  const [selectedProposals, setSelectedProposals] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "review" | "paused">("all");
  const [isPostModalOpen, setIsPostModalOpen] = useState(searchParams.get('action') === 'new');
  const [postTitle, setPostTitle] = useState("");
  const [postBudget, setPostBudget] = useState("");
  const [postDuration, setPostDuration] = useState("");
  const [postCompanyLogo, setPostCompanyLogo] = useState("");
  const [postCompanyLogoUploading, setPostCompanyLogoUploading] = useState(false);
  const [postType, setPostType] = useState("Fixed Price");
  const [postDescription, setPostDescription] = useState("");
  const [postUrgent, setPostUrgent] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [postSkills, setPostSkills] = useState<string[]>([]);
  const [postCategory, setPostCategory] = useState("");
  const [clientCompanyLogoUrl, setClientCompanyLogoUrl] = useState("");
  const [clientName, setClientName] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isEditingJob, setIsEditingJob] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editCompanyLogo, setEditCompanyLogo] = useState("");
  const [editCompanyLogoUploading, setEditCompanyLogoUploading] = useState(false);
  const [editType, setEditType] = useState("Fixed Price");
  const [editDescription, setEditDescription] = useState("");
  const [editUrgent, setEditUrgent] = useState(false);
  const [editSkills, setEditSkills] = useState<string[]>([]);
  const [editSkillInput, setEditSkillInput] = useState("");
  const [editStatus, setEditStatus] = useState<JobStatus>("Open");
  const [editCategory, setEditCategory] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editJobId, setEditJobId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState<{ show: boolean; message: string }>({ show: false, message: "" });

  const triggerToast = (message: string) => {
    setShowToast({ show: true, message });
    setTimeout(() => setShowToast({ show: false, message: "" }), 3000);
  };

  const uploadCompanyLogo = async (file: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Use JPG, PNG, or WEBP for the company logo.");
    }

    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new Error("Company logo image must be 2MB or less.");
    }

    const user = firebaseAuth.currentUser;
    if (!user) {
      throw new Error("Please log in again to upload a company logo.");
    }

    const idToken = await user.getIdToken();
    const formData = new FormData();
    formData.append("file", file);

    const uploadResponse = await fetch("/api/company-logo/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
      body: formData,
    });
    const uploadPayload = (await uploadResponse.json()) as {
      companyLogo?: string;
      companyLogoPublicId?: string;
      error?: string;
    };

    if (!uploadResponse.ok || !uploadPayload.companyLogo) {
      throw new Error(uploadPayload.error || "Company logo upload failed.");
    }

    return uploadPayload.companyLogo;
  };

  const handlePostCompanyLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setPostCompanyLogoUploading(true);
      const companyLogo = await uploadCompanyLogo(file);
      setPostCompanyLogo(companyLogo);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not upload company logo. Please retry.");
    } finally {
      setPostCompanyLogoUploading(false);
      event.target.value = "";
    }
  };

  const handleEditCompanyLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setEditCompanyLogoUploading(true);
      const companyLogo = await uploadCompanyLogo(file);
      setEditCompanyLogo(companyLogo);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not upload company logo. Please retry.");
    } finally {
      setEditCompanyLogoUploading(false);
      event.target.value = "";
    }
  };

  useEffect(() => {
    setSelectedProposals({});
  }, [selectedJobId]);

  useEffect(() => {
    let unsubscribeJobs: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) {
        if (unsubscribeJobs) unsubscribeJobs();
        setJobs([]);
        setSelectedJobId("");
        setJobsLoading(false);
        setJobsError("Please log in to view your job posts.");
        return;
      }

      setJobsLoading(true);
      setJobsError("");

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
              uuid: data.uuid,
              title: data.title ?? "",
              description: data.description ?? "",
              status: (data.status as JobStatus) ?? "Open",
              budget: data.budget ?? "",
              duration: data.duration ?? "",
              companyLogo: data.companyLogo ?? "",
              proposals: data.proposals ?? 0,
              tags: Array.isArray(data.skills) ? data.skills : [],
              urgent: !!data.urgent,
              jobType: data.jobType ?? "",
              category: data.category ?? "",
            };
          });
          setJobs(items);
          setJobsLoading(false);
          if (!selectedJobId && items.length) {
            setSelectedJobId(items[0].id);
          }
        },
        () => {
          setJobsLoading(false);
          setJobsError("Unable to load job posts right now.");
        }
      );

      const loadClientProfile = async () => {
        try {
          const [clientSnap, allUsersSnap] = await Promise.all([
            getDoc(doc(firebaseDb, "clients", user.uid)),
            getDoc(doc(firebaseDb, "all_users", user.uid)),
          ]);

          const clientData = clientSnap.exists() ? (clientSnap.data() as any) : {};
          const allUsersData = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};

          setClientCompanyLogoUrl(
            clientData.companyLogo ??
            clientData.companyLogoUrl ??
            allUsersData.companyLogo ??
            allUsersData.companyLogoUrl ??
            ""
          );
          setClientName(
            clientData.fullName ?? allUsersData.fullName ?? user.displayName ?? "Client"
          );
        } catch {
          setClientCompanyLogoUrl("");
          setClientName(user.displayName ?? "Client");
        }
      };

      loadClientProfile();
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeJobs) unsubscribeJobs();
    };
  }, [selectedJobId]);

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
        const items = snapshot.docs.map((docSnap) => {
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

  const [proposals, setProposals] = useState<
    Array<{
      id: string;
      freelancerId: string;
      name: string;
      title: string;
      rate: string;
      cover: string;
      rating: number;
      availability: string;
      status?: string;
    }>
  >([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);

  const selectedCount = Object.values(selectedProposals).filter(Boolean).length;
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0];
  const jobsToShow = jobs.filter((job) => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return job.status === "Open";
    if (activeTab === "review") return job.status === "In Review";
    return job.status === "Paused";
  });
  const formatBudget = (value: string) =>
    value.toLowerCase().includes("sats") ? value : `${value} sats`;

  const editJob = jobs.find((job) => job.id === editJobId) ?? null;
  const createConversationId = (jobId: string, freelancerId: string) => `${jobId}_${freelancerId}`;
  const resolveClientIdentity = async (uid: string) => {
    try {
      const [clientSnap, allUsersSnap] = await Promise.all([
        getDoc(doc(firebaseDb, "clients", uid)),
        getDoc(doc(firebaseDb, "all_users", uid)),
      ]);
      const c = clientSnap.exists() ? (clientSnap.data() as any) : {};
      const a = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
      const composed = `${c.firstName ?? a.firstName ?? ""} ${c.lastName ?? a.lastName ?? ""}`.trim();
      const resolvedName = c.fullName ?? a.fullName ?? c.name ?? a.name ?? a.email ?? composed;
      return {
        name: resolvedName || "Client",
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
      const resolvedName = f.fullName ?? a.fullName ?? fallbackName ?? composed;
      return {
        name: resolvedName || "Freelancer",
        avatarUrl: f.avatarUrl ?? a.avatarUrl ?? "",
      };
    } catch {
      return { name: fallbackName || "Freelancer", avatarUrl: "" };
    }
  };

  useEffect(() => {
    if (!editJob) return;
    setEditTitle(editJob.title ?? "");
    setEditBudget(editJob.budget ?? "");
    setEditDuration(editJob.duration ?? "");
    setEditCompanyLogo(editJob.companyLogo ?? clientCompanyLogoUrl ?? "");
    setEditType(editJob.jobType ?? "Fixed Price");
    setEditDescription(editJob.description ?? "");
    setEditUrgent(!!editJob.urgent);
    setEditSkills(Array.isArray(editJob.tags) ? editJob.tags : []);
    setEditSkillInput("");
    setEditStatus(editJob.status ?? "Open");
    setEditCategory(editJob.category ?? "");
  }, [editJobId, editJob, clientCompanyLogoUrl]);

  return (
    <section className="w-full">
      <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-6 shadow-[0_8px_22px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">
              Job Posts
            </div>
            <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[#1a1a1a]">
              Manage your open roles
            </h1>
            <p className="mt-2 text-[12px] leading-[1.7] text-[#6b6762]">
              Track proposals, adjust budgets, and keep candidates moving through your pipeline.
            </p>
          </div>
          <Button size="sm" className="rounded-full" onClick={() => setIsPostModalOpen(true)}>
            Post New Job
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded-[12px] border border-[#EAE7E2] bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F5A623]">
              Job Status
            </div>
            <div className="text-[12px] text-[#6b6762]">Switch between job states.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] ${activeTab === "all"
                  ? "bg-[#F7F4F0] text-[#1a1a1a] border border-[#EAE7E2]"
                  : "text-[#6b6762] border border-[#EAE7E2] hover:bg-[#F7F4F0]"
                }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("active")}
              className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] ${activeTab === "active"
                  ? "bg-[#F7F4F0] text-[#1a1a1a] border border-[#EAE7E2]"
                  : "text-[#6b6762] border border-[#EAE7E2] hover:bg-[#F7F4F0]"
                }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("review")}
              className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] ${activeTab === "review"
                  ? "bg-[#F7F4F0] text-[#1a1a1a] border border-[#EAE7E2]"
                  : "text-[#6b6762] border border-[#EAE7E2] hover:bg-[#F7F4F0]"
                }`}
            >
              Ongoing
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("paused")}
              className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] ${activeTab === "paused"
                  ? "bg-[#F7F4F0] text-[#1a1a1a] border border-[#EAE7E2]"
                  : "text-[#6b6762] border border-[#EAE7E2] hover:bg-[#F7F4F0]"
                }`}
            >
              Paused
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {jobsLoading ? (
            <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FAF8F5] p-6 text-[12px] text-[#6b6762]">
              Loading job posts...
            </div>
          ) : jobsError ? (
            <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FFF6F2] p-6 text-[12px] text-[#8C4F00]">
              {jobsError}
            </div>
          ) : jobsToShow.length ? (
            jobsToShow.map((job) => (
              <ClientJobPostCard
                key={job.id}
                {...job}
                companyLogoUrl={job.companyLogo || clientCompanyLogoUrl}
                clientName={clientName}
                isSelected={job.id === selectedJobId}
                onSelect={() => {
                  setSelectedJobId(job.id);
                  setIsModalOpen(true);
                }}
                onEdit={() => {
                  setEditJobId(job.id);
                  setIsEditModalOpen(true);
                }}
              />
            ))
          ) : (
            <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FAF8F5] p-6 text-[12px] text-[#6b6762]">
              No job posts in this status yet.
            </div>
          )}
        </div>
      </div>

      {isModalOpen && selectedJob ? (
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
                  Job Post Details
                </div>
                <div className="mt-2 text-[18px] font-semibold text-[#1a1a1a]">
                  {selectedJob.title}
                </div>
                <div className="mt-1 text-[12px] text-[#9e9690]">
                  {selectedJob.status} | {formatBudget(selectedJob.budget)}
                  {selectedJob.duration ? ` | ${selectedJob.duration}` : ""} | {selectedJob.proposals} proposals
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

            {selectedJob.description ? (
              <div className="mt-4 rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-4 py-3 text-[12px] leading-[1.7] text-[#6b6762]">
                {selectedJob.description}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-[11px] text-[#6b6762]">
                Review candidates and select the freelancers you want to hire.
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                <span className="text-[11px] text-[#9e9690]">{selectedCount} selected</span>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {proposalsLoading ? (
                <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FAF8F5] p-4 text-[12px] text-[#6b6762]">
                  Loading proposals...
                </div>
              ) : proposals.length ? (
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
                    onMessage={async () => {
                      if (!selectedJob?.id) return;
                      const clientId = firebaseAuth.currentUser?.uid ?? "";
                      if (!clientId) return;
                      const [clientIdentity, freelancerIdentity] = await Promise.all([
                        resolveClientIdentity(clientId),
                        resolveFreelancerIdentity(proposal.freelancerId, proposal.name),
                      ]);
                      const conversationId = createConversationId(selectedJob.id, proposal.freelancerId);
                      const paymentTotalAmountSats = parseSats(selectedJob.budget);
                      await setDoc(
                        doc(firebaseDb, "conversations", conversationId),
                        {
                          jobId: selectedJob.id,
                          jobTitle: selectedJob.title,
                          proposalId: proposal.id,
                          clientId,
                          clientName: clientIdentity.name,
                          freelancerId: proposal.freelancerId,
                          freelancerName: freelancerIdentity.name,
                          clientAvatarUrl: clientIdentity.avatarUrl,
                          freelancerAvatarUrl: freelancerIdentity.avatarUrl,
                          paymentTotalAmountSats,
                          paymentStatus: "unfunded",
                          createdBy: "client",
                          canFreelancerMessage: true,
                          unread: {
                            [clientId]: 0,
                            [proposal.freelancerId]: 0,
                          },
                          updatedAt: serverTimestamp(),
                          createdAt: serverTimestamp(),
                        },
                        { merge: true }
                      );
                      router.push(`/client/dashboard/messages?chat=${conversationId}`);
                    }}
                  />
                ))
              ) : (
                <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FAF8F5] p-4 text-[12px] text-[#6b6762]">
                  No proposals yet.
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                size="sm"
                className="rounded-full w-full sm:w-auto"
                disabled={selectedCount === 0}
                onClick={async () => {
                  if (!selectedJob?.id) return;
                  const selected = proposals.filter((p) => selectedProposals[p.id]);
                  if (!selected.length) return;

                  const batch = writeBatch(firebaseDb);
                  const freelancerIds = selected.map((p) => p.freelancerId);
                  const freelancerNames = selected.map((p) => p.name);
                  const clientId = firebaseAuth.currentUser?.uid ?? "";
                  const paymentTotalAmountSats = parseSats(selectedJob.budget);
                  const clientIdentity = clientId
                    ? await resolveClientIdentity(clientId)
                    : { name: "Client", avatarUrl: "" };
                  const freelancerIdentityMap = new Map<string, { name: string; avatarUrl: string }>();
                  await Promise.all(
                    selected.map(async (proposal) => {
                      freelancerIdentityMap.set(
                        proposal.freelancerId,
                        await resolveFreelancerIdentity(proposal.freelancerId, proposal.name)
                      );
                    })
                  );
                  selected.forEach((proposal) => {
                    const proposalRef = doc(firebaseDb, "proposals", proposal.id);
                    batch.update(proposalRef, { status: "accepted", updatedAt: serverTimestamp() });

                    const contractId = `${selectedJob.id}_${proposal.freelancerId}`;
                    const contractRef = doc(firebaseDb, "contracts", contractId);
                    batch.set(
                      contractRef,
                      {
                        jobId: selectedJob.id,
                        clientId: firebaseAuth.currentUser?.uid ?? "",
                        freelancerId: proposal.freelancerId,
                        freelancerName: proposal.name,
                        title: selectedJob.title,
                        status: "Active",
                        budget: selectedJob.budget,
                        paymentTotalAmountSats,
                        paymentStatus: "unfunded",
                        progress: 0,
                        nextMilestone: "Kickoff & onboarding",
                        startDate: serverTimestamp(),
                        unreadByClient: false,
                        unreadByFreelancer: true,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                      },
                      { merge: true }
                    );

                    const conversationId = createConversationId(selectedJob.id, proposal.freelancerId);
                    const conversationRef = doc(firebaseDb, "conversations", conversationId);
                    batch.set(
                      conversationRef,
                      {
                        jobId: selectedJob.id,
                        jobTitle: selectedJob.title,
                        proposalId: proposal.id,
                        clientId,
                        clientName: clientIdentity.name,
                        freelancerId: proposal.freelancerId,
                        freelancerName:
                          freelancerIdentityMap.get(proposal.freelancerId)?.name ?? proposal.name,
                        clientAvatarUrl: clientIdentity.avatarUrl,
                        freelancerAvatarUrl:
                          freelancerIdentityMap.get(proposal.freelancerId)?.avatarUrl ?? "",
                        paymentTotalAmountSats,
                        paymentStatus: "unfunded",
                        createdBy: "system",
                        canFreelancerMessage: true,
                        unread: {
                          [clientId]: 0,
                          [proposal.freelancerId]: 0,
                        },
                        updatedAt: serverTimestamp(),
                        createdAt: serverTimestamp(),
                      },
                      { merge: true }
                    );
                  });
                  const jobRef = doc(firebaseDb, "jobs", selectedJob.id);
                  batch.update(jobRef, {
                    selectedFreelancerIds: arrayUnion(...freelancerIds),
                    selectedFreelancerNames: arrayUnion(...freelancerNames),
                    updatedAt: serverTimestamp(),
                  });
                  await batch.commit();
                  selected.forEach((proposal) => {
                    const conversationId = createConversationId(selectedJob.id, proposal.freelancerId);
                    void sendUserNotification({
                      userId: proposal.freelancerId,
                      title: "Proposal accepted",
                      body: `Your proposal for "${selectedJob.title}" was accepted. Contract and chat are ready.`,
                      url: `/freelancer/dashboard/messages?chat=${conversationId}`,
                      tag: `proposal-accepted-${proposal.id}`,
                    }).catch(console.error);
                  });
                  setSelectedProposals({});
                  triggerToast(`Successfully hired ${freelancerNames.join(", ")}!`);
                }}
              >
                Accept Selected
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditModalOpen && editJob ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsEditModalOpen(false)}
          />
          <div className="relative z-[91] w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-[16px] border border-[#EAE7E2] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full border border-[#EAE7E2] bg-white p-2 text-[#6b6762] hover:bg-[#F7F4F0]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="mb-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">
                Edit Job
              </div>
              <h2 className="mt-2 text-[20px] font-semibold text-[#1a1a1a]">Update job details</h2>
              <p className="mt-1 text-[12px] text-[#6b6762]">
                Make changes to your job post and save them.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-[#9e9690]">Job Title</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="rounded-lg border border-[#EAE7E2] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-[#9e9690]">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="rounded-lg border border-[#EAE7E2] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">Select a category</option>
                  {JOB_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-[#9e9690]">Budget</label>
                <input
                  value={editBudget}
                  onChange={(e) => setEditBudget(e.target.value)}
                  className="rounded-lg border border-[#EAE7E2] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-[#9e9690]">Duration</label>
                <input
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  className="rounded-lg border border-[#EAE7E2] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="e.g. 4 weeks"
                />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-[#9e9690]">Company Logo</label>
                <div className="flex flex-col gap-3 rounded-lg border border-[#EAE7E2] px-3 py-3 sm:flex-row sm:items-center">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[8px] bg-[#F7F4F0] ring-1 ring-[#EAE7E2]">
                    {editCompanyLogo ? (
                      <img src={editCompanyLogo} alt="Company logo preview" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-semibold uppercase text-[#8C4F00]">Logo</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex cursor-pointer items-center rounded-full border border-[#EAE7E2] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6b6762] hover:bg-[#F7F4F0]">
                      {editCompanyLogoUploading ? "Uploading..." : editCompanyLogo ? "Change Logo" : "Upload Logo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleEditCompanyLogoUpload}
                        disabled={editCompanyLogoUploading}
                      />
                    </label>
                    <p className="mt-2 text-[10px] text-[#9e9690]">JPG, PNG, or WEBP. Max 2MB.</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-[#9e9690]">Job Type</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="rounded-lg border border-[#EAE7E2] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option>Fixed Price</option>
                  <option>Hourly</option>
                </select>
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-[#9e9690]">Description</label>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="rounded-lg border border-[#EAE7E2] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-[#9e9690]">Skills</label>
                <div className="rounded-lg border border-[#EAE7E2] px-3 py-2">
                  <input
                    value={editSkillInput}
                    onChange={(e) => setEditSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        const cleaned = editSkillInput.trim().replace(/,$/, "");
                        if (!cleaned) return;
                        setEditSkills((prev) => (prev.includes(cleaned) ? prev : [...prev, cleaned]));
                        setEditSkillInput("");
                      }
                      if (e.key === "Backspace" && !editSkillInput && editSkills.length) {
                        setEditSkills((prev) => prev.slice(0, -1));
                      }
                    }}
                    className="w-full bg-transparent text-[12px] focus:outline-none"
                    placeholder="Type a skill and press Enter"
                  />
                  {editSkills.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {editSkills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-2 rounded-full bg-[#F6F3F1] px-3 py-1 text-[10px] font-semibold uppercase text-[#666]"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => setEditSkills((prev) => prev.filter((s) => s !== skill))}
                            className="text-[#9e9690] hover:text-[#1a1a1a]"
                            aria-label={`Remove ${skill}`}
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <p className="text-[10px] text-[#9e9690]">Press Enter or comma to add a skill.</p>
              </div>
              <div className="flex items-center justify-between gap-3 md:col-span-2 rounded-lg border border-[#EAE7E2] px-4 py-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9e9690]">Urgent</div>
                  <div className="text-[12px] text-[#6b6762]">Mark this job as high priority.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditUrgent((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editUrgent ? "bg-orange-500" : "bg-[#EAE7E2]"
                    }`}
                  aria-pressed={editUrgent}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${editUrgent ? "translate-x-5" : "translate-x-1"
                      }`}
                  />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-[#9e9690]">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as JobStatus)}
                  className="rounded-lg border border-[#EAE7E2] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="Open">Open</option>
                  <option value="In Review">In Review</option>
                  <option value="Paused">Paused</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button size="sm" variant="outline" className="rounded-full w-full sm:w-auto" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="rounded-full w-full sm:w-auto"
                onClick={async () => {
                  if (!editJob?.id) return;
                  if (!editTitle.trim() || editTitle.trim().length < 3) {
                    alert("Please enter a job title (at least 3 characters).");
                    return;
                  }
                  if (!editBudget.trim()) {
                    alert("Please enter a budget.");
                    return;
                  }
                  if (!editDuration.trim()) {
                    alert("Please enter a duration.");
                    return;
                  }
                  if (!editCompanyLogo.trim()) {
                    alert("Please upload a company logo.");
                    return;
                  }
                  if (!editDescription.trim() || editDescription.trim().length < 20) {
                    alert("Please write a description (at least 20 characters).");
                    return;
                  }
                  setIsSavingEdit(true);
                  try {
                    await updateDoc(doc(firebaseDb, "jobs", editJob.id), {
                      title: editTitle.trim(),
                      category: editCategory.trim(),
                      budget: editBudget.trim(),
                      duration: editDuration.trim(),
                      companyLogo: editCompanyLogo.trim(),
                      jobType: editType,
                      description: editDescription.trim(),
                      skills: editSkills,
                      urgent: editUrgent,
                      status: editStatus,
                      updatedAt: serverTimestamp(),
                    });
                    setIsEditModalOpen(false);
                  } finally {
                    setIsSavingEdit(false);
                  }
                }}
                disabled={isSavingEdit || editCompanyLogoUploading}
              >
                {isSavingEdit ? "Saving..." : editCompanyLogoUploading ? "Uploading Logo..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isPostModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsPostModalOpen(false)}
          />
          <div className="relative z-[81] w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-[16px] border border-[#EAE7E2] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
            <button
              type="button"
              onClick={() => setIsPostModalOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full border border-[#EAE7E2] bg-white p-2 text-[#6b6762] hover:bg-[#F7F4F0]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="mb-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">
                Post a Job
              </div>
              <h2 className="mt-2 text-[20px] font-semibold text-[#1a1a1a]">Create a new job post</h2>
              <p className="mt-1 text-[12px] text-[#6b6762]">
                Share the role details and the right freelancers will apply.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-[#9e9690]">Job Title</label>
                <input
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="rounded-lg border border-[#EAE7E2] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="e.g. Lightning Node Observability Suite"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-[#9e9690]">Category</label>
                <select
                  value={postCategory}
                  onChange={(e) => setPostCategory(e.target.value)}
                  className="rounded-lg border border-[#EAE7E2] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">Select a category</option>
                  {JOB_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-[#9e9690]">Budget</label>
                <input
                  value={postBudget}
                  onChange={(e) => setPostBudget(e.target.value)}
                  className="rounded-lg border border-[#EAE7E2] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="450,000 sats"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-[#9e9690]">Duration</label>
                <input
                  value={postDuration}
                  onChange={(e) => setPostDuration(e.target.value)}
                  className="rounded-lg border border-[#EAE7E2] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="e.g. 4 weeks"
                />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-[#9e9690]">Company Logo</label>
                <div className="flex flex-col gap-3 rounded-lg border border-[#EAE7E2] px-3 py-3 sm:flex-row sm:items-center">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[8px] bg-[#F7F4F0] ring-1 ring-[#EAE7E2]">
                    {postCompanyLogo ? (
                      <img src={postCompanyLogo} alt="Company logo preview" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-semibold uppercase text-[#8C4F00]">Logo</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex cursor-pointer items-center rounded-full border border-[#EAE7E2] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6b6762] hover:bg-[#F7F4F0]">
                      {postCompanyLogoUploading ? "Uploading..." : postCompanyLogo ? "Change Logo" : "Upload Logo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handlePostCompanyLogoUpload}
                        disabled={postCompanyLogoUploading}
                      />
                    </label>
                    <p className="mt-2 text-[10px] text-[#9e9690]">JPG, PNG, or WEBP. Max 2MB.</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-[#9e9690]">Job Type</label>
                <select
                  value={postType}
                  onChange={(e) => setPostType(e.target.value)}
                  className="rounded-lg border border-[#EAE7E2] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option>Fixed Price</option>
                  <option>Hourly</option>
                </select>
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-[#9e9690]">Description</label>
                <textarea
                  rows={4}
                  value={postDescription}
                  onChange={(e) => setPostDescription(e.target.value)}
                  className="rounded-lg border border-[#EAE7E2] px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Describe the scope, goals, and deliverables."
                />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-[#9e9690]">Skills</label>
                <div className="rounded-lg border border-[#EAE7E2] px-3 py-2">
                  <input
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        const cleaned = skillInput.trim().replace(/,$/, "");
                        if (!cleaned) return;
                        setPostSkills((prev) =>
                          prev.includes(cleaned) ? prev : [...prev, cleaned]
                        );
                        setSkillInput("");
                      }
                      if (e.key === "Backspace" && !skillInput && postSkills.length) {
                        setPostSkills((prev) => prev.slice(0, -1));
                      }
                    }}
                    className="w-full bg-transparent text-[12px] focus:outline-none"
                    placeholder="Type a skill and press Enter"
                  />
                  {postSkills.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {postSkills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-2 rounded-full bg-[#F6F3F1] px-3 py-1 text-[10px] font-semibold uppercase text-[#666]"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => setPostSkills((prev) => prev.filter((s) => s !== skill))}
                            className="text-[#9e9690] hover:text-[#1a1a1a]"
                            aria-label={`Remove ${skill}`}
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <p className="text-[10px] text-[#9e9690]">
                  Press Enter or comma to add a skill.
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 md:col-span-2 rounded-lg border border-[#EAE7E2] px-4 py-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9e9690]">Urgent</div>
                  <div className="text-[12px] text-[#6b6762]">Mark this job as high priority.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPostUrgent((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${postUrgent ? "bg-orange-500" : "bg-[#EAE7E2]"
                    }`}
                  aria-pressed={postUrgent}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${postUrgent ? "translate-x-5" : "translate-x-1"
                      }`}
                  />
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button size="sm" variant="outline" className="rounded-full w-full sm:w-auto">
                Save Draft
              </Button>
              <Button
                size="sm"
                className="rounded-full w-full sm:w-auto"
                onClick={async () => {
                  if (!postTitle.trim() || postTitle.trim().length < 3) {
                    alert("Please enter a job title (at least 3 characters).");
                    return;
                  }
                  if (!postBudget.trim()) {
                    alert("Please enter a budget.");
                    return;
                  }
                  if (!postDuration.trim()) {
                    alert("Please enter a duration.");
                    return;
                  }
                  if (!postCompanyLogo.trim() && !clientCompanyLogoUrl) {
                    alert("Please upload a company logo.");
                    return;
                  }
                  if (!postDescription.trim() || postDescription.trim().length < 20) {
                    alert("Please write a description (at least 20 characters).");
                    return;
                  }
                  const user = firebaseAuth.currentUser;
                  if (!user) {
                    setJobsError("Please log in to publish a job.");
                    return;
                  }
                  setIsPublishing(true);
                  try {
                    const uuid =
                      typeof crypto !== "undefined" && "randomUUID" in crypto
                        ? crypto.randomUUID()
                        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

                    const allUsersSnap = await getDoc(doc(firebaseDb, "all_users", user.uid));
                    const clientsSnap = await getDoc(doc(firebaseDb, "clients", user.uid));
                    const allData = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
                    const clientData = clientsSnap.exists() ? (clientsSnap.data() as any) : {};
                    const clientName =
                      allData.fullName ?? allData.email ?? "Client";
                    const clientCompany =
                      clientData.companyName ?? "";
                    const companyLogo =
                      postCompanyLogo.trim() ||
                      clientData.companyLogo ||
                      clientData.companyLogoUrl ||
                      allData.companyLogo ||
                      allData.companyLogoUrl ||
                      "";

                    await addDoc(collection(firebaseDb, "jobs"), {
                      uuid,
                      title: postTitle.trim(),
                      category: postCategory.trim(),
                      budget: postBudget.trim(),
                      duration: postDuration.trim(),
                      companyLogo,
                      jobType: postType,
                      description: postDescription.trim(),
                      skills: postSkills,
                      urgent: postUrgent,
                      status: "Open",
                      proposals: 0,
                      clientId: user.uid,
                      clientName,
                      clientCompany,
                      createdAt: serverTimestamp(),
                      updatedAt: serverTimestamp(),
                    });

                    setPostTitle("");
                    setPostCategory("");
                    setPostBudget("");
                    setPostDuration("");
                    setPostCompanyLogo("");
                    setPostType("Fixed Price");
                    setPostDescription("");
                    setPostUrgent(false);
                    setPostSkills([]);
                    setSkillInput("");
                    setIsPostModalOpen(false);
                  } finally {
                    setIsPublishing(false);
                  }
                }}
                disabled={isPublishing || postCompanyLogoUploading}
              >
                {isPublishing ? "Publishing..." : postCompanyLogoUploading ? "Uploading Logo..." : "Publish Job"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showToast.show && (
        <div className="fixed bottom-8 left-1/2 z-[100] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 rounded-full bg-[#1a1a1a] px-6 py-3 shadow-2xl border border-[#333]">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="text-[13px] font-medium text-white">{showToast.message}</span>
          </div>
        </div>
      )}
    </section>
  );
}
