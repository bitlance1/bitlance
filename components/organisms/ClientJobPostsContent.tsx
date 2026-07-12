"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, Zap, Clock, UploadCloud } from "lucide-react";
import Button from "@/components/atoms/Button";
import ClientJobPostCard from "@/components/molecules/ClientJobPostCard";
import ClientProposalCard from "@/components/molecules/ClientProposalCard";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { sendUserNotification } from "@/lib/notifications";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
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

type JobStatus = "Open" | "In Review" | "Paused" | "Closed";

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
  const [activeTab, setActiveTab] = useState<"all" | "active" | "review" | "paused" | "closed">("all");
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
  const [showToast, setShowToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({ show: false, message: "", type: "success" });
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [isDeletingJob, setIsDeletingJob] = useState(false);

  const triggerToast = (message: string, type: "success" | "error" = "success") => {
    setShowToast({ show: true, message, type });
    setTimeout(() => setShowToast({ show: false, message: "", type: "success" }), 3500);
  };

  const handleDeleteJob = async () => {
    if (!deleteJobId) return;
    setIsDeletingJob(true);
    try {
      await deleteDoc(doc(firebaseDb, "jobs", deleteJobId));
      if (selectedJobId === deleteJobId) setSelectedJobId("");
      setDeleteJobId(null);
    } catch {
      triggerToast("Failed to delete job post. Please try again.", "error");
    } finally {
      setIsDeletingJob(false);
    }
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
      triggerToast(error instanceof Error ? error.message : "Could not upload company logo. Please retry.", "error");
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
      triggerToast(error instanceof Error ? error.message : "Could not upload company logo. Please retry.", "error");
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

  // ── Applicant avatars per job (for the card avatar stack) ─────────────────
  const [jobAvatars, setJobAvatars] = useState<Record<string, { url?: string; name: string }[]>>({});

  useEffect(() => {
    if (!jobs.length) return;
    jobs.forEach((job) => {
      if (jobAvatars[job.id]) return; // already fetched
      const q = query(collection(firebaseDb, "proposals"), where("jobId", "==", job.id));
      const unsub = onSnapshot(q, async (snap) => {
        const top = snap.docs.slice(0, 4);
        const avatars = await Promise.all(
          top.map(async (d) => {
            const data = d.data() as any;
            const fid = data.freelancerId ?? "";
            const fallbackName = data.freelancerName ?? "F";
            if (!fid) return { name: fallbackName };
            try {
              const [fSnap, aSnap] = await Promise.all([
                getDoc(doc(firebaseDb, "freelancers", fid)),
                getDoc(doc(firebaseDb, "all_users", fid)),
              ]);
              const f = fSnap.exists() ? (fSnap.data() as any) : {};
              const a = aSnap.exists() ? (aSnap.data() as any) : {};
              return {
                url: f.avatarUrl ?? a.avatarUrl ?? undefined,
                name: f.fullName ?? a.fullName ?? fallbackName,
              };
            } catch {
              return { name: fallbackName };
            }
          })
        );
        setJobAvatars((prev) => ({ ...prev, [job.id]: avatars }));
      });
      return unsub;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);

  const selectedCount = Object.values(selectedProposals).filter(Boolean).length;
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0];
  const jobsToShow = jobs.filter((job) => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return job.status === "Open";
    if (activeTab === "review") return job.status === "In Review";
    if (activeTab === "paused") return job.status === "Paused";
    return job.status === "Closed";
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
            + Post New Job
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
              className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${activeTab === "all"
                ? "bg-[#F7931A] text-white border border-[#F7931A]"
                : "text-[#6b6762] border border-[#EAE7E2] hover:bg-[#F7F4F0]"
                }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("active")}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${activeTab === "active"
                ? "bg-[#F7F4F0] text-[#1a1a1a] border border-[#EAE7E2]"
                : "text-[#6b6762] border border-[#EAE7E2] hover:bg-[#F7F4F0]"
                }`}
            >
              <svg width="8" height="9" viewBox="0 0 8 9" fill="currentColor"><path d="M1 1l6 3.5L1 8V1z" /></svg>
              Active
            </button>
            {/* <button
              type="button"
              onClick={() => setActiveTab("review")}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${activeTab === "review"
                ? "bg-[#F7F4F0] text-[#1a1a1a] border border-[#EAE7E2]"
                : "text-[#6b6762] border border-[#EAE7E2] hover:bg-[#F7F4F0]"
                }`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Ongoing
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("paused")}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${activeTab === "paused"
                ? "bg-[#F7F4F0] text-[#1a1a1a] border border-[#EAE7E2]"
                : "text-[#6b6762] border border-[#EAE7E2] hover:bg-[#F7F4F0]"
                }`}
            >
              <svg width="10" height="11" viewBox="0 0 10 11" fill="currentColor">
                <rect x="1" y="1" width="3" height="9" rx="1" /><rect x="6" y="1" width="3" height="9" rx="1" />
              </svg>
              Paused
            </button> */}
            <button
              type="button"
              onClick={() => setActiveTab("closed")}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${activeTab === "closed"
                ? "bg-[#F7F4F0] text-[#1a1a1a] border border-[#EAE7E2]"
                : "text-[#6b6762] border border-[#EAE7E2] hover:bg-[#F7F4F0]"
                }`}
            >
              <svg width="10" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Closed
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
                views={0}
                applicantAvatars={jobAvatars[job.id] ?? []}
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
                onDelete={() => setDeleteJobId(job.id)}
                onClose={async () => {
                  try {
                    await updateDoc(doc(firebaseDb, "jobs", job.id), {
                      status: job.status === "Closed" ? "Open" : "Closed",
                      updatedAt: serverTimestamp(),
                    });
                  } catch (err) {
                    triggerToast("Failed to update job status. Please try again.", "error");
                  }
                }}
              />
            ))
          ) : (
            <div className="rounded-[12px] border border-[#EAE7E2] bg-[#FAF8F5] p-6 text-[12px] text-[#6b6762]">
              No job posts in this status yet.
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="mt-4 flex items-center gap-1.5 text-[11px] text-[#9e9690]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Proposals and views update in real-time.
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
                      const proposedRate = parseSats(proposal.rate);
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
                          proposedRate,
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
                  // each proposal carries its own proposed rate
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
                    const proposedRate = parseSats(proposal.rate);

                    const contractId = `${selectedJob.id}_${proposal.freelancerId}`;
                    const contractRef = doc(firebaseDb, "contracts", contractId);
                    batch.set(
                      contractRef,
                      {
                        jobId: selectedJob.id,
                        proposalId: proposal.id,
                        clientId: firebaseAuth.currentUser?.uid ?? "",
                        freelancerId: proposal.freelancerId,
                        freelancerName: proposal.name,
                        title: selectedJob.title,
                        status: "Active",
                        budget: selectedJob.budget,
                        paymentTotalAmountSats,
                        proposedRate,
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
                        proposedRate,
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
                    status: "Closed",
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
          <div className="relative z-[91] w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col">

            {/* Header */}
            <div className="p-6 pb-4 relative">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                aria-label="Close"
                className="absolute right-6 top-6 text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#F7931A] mb-1">
                Edit Job
              </div>
              <h2 className="text-xl font-bold text-zinc-900">Update job details</h2>
              <p className="text-xs text-zinc-500 mt-1">
                Make changes to your job post and save them.
              </p>
            </div>

            <div className="border-t border-zinc-100" />

            {/* Form Fields */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Job Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-700">Job Title</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-[6px] border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#F7931A] focus:ring-1 focus:ring-[#F7931A] bg-[#FAF9F6] text-zinc-900 placeholder-zinc-400"
                />
              </div>

              {/* Category & Job Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full rounded-[6px] border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#F7931A] focus:ring-1 focus:ring-[#F7931A] bg-[#FAF9F6] text-zinc-900"
                  >
                    <option value="">Select a category</option>
                    {JOB_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Job Type</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="w-full rounded-[6px] border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#F7931A] focus:ring-1 focus:ring-[#F7931A] bg-[#FAF9F6] text-zinc-900"
                  >
                    <option value="Fixed Price">Fixed Price</option>
                    <option value="Hourly">Hourly</option>
                  </select>
                </div>
              </div>

              {/* Budget & Duration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Budget</label>
                  <div className="relative flex items-center">
                    <input
                      value={editBudget}
                      onChange={(e) => setEditBudget(e.target.value)}
                      className="w-full rounded-[6px] border border-zinc-200 pl-3 pr-10 py-2 text-xs focus:outline-none focus:border-[#F7931A] focus:ring-1 focus:ring-[#F7931A] bg-[#FAF9F6] text-zinc-900 placeholder-zinc-400"
                    />
                    <span className="absolute right-3 text-[10px] font-semibold text-zinc-500">sats</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Duration</label>
                  <input
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className="w-full rounded-[6px] border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#F7931A] focus:ring-1 focus:ring-[#F7931A] bg-[#FAF9F6] text-zinc-900 placeholder-zinc-400"
                    placeholder="e.g. 4 weeks"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-700">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as JobStatus)}
                  className="w-full rounded-[6px] border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#F7931A] focus:ring-1 focus:ring-[#F7931A] bg-[#FAF9F6] text-zinc-900"
                >
                  <option value="Open">Open</option>
                  {/* <option value="In Review">In Review</option>
                  <option value="Paused">Paused</option> */}
                </select>
              </div>

              {/* Company Logo */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-700">Company Logo</label>
                <div className="flex items-center gap-4 rounded-md border border-zinc-200 bg-[#FAF9F6] p-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-white flex-shrink-0">
                    {editCompanyLogo ? (
                      <img src={editCompanyLogo} alt="Company logo preview" className="h-full w-full object-cover" />
                    ) : (
                      <UploadCloud className="h-5 w-5 text-zinc-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex cursor-pointer items-center rounded border border-zinc-300 bg-white px-3 py-1.5 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-50 transition">
                      {editCompanyLogoUploading ? "Uploading..." : "Upload Logo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleEditCompanyLogoUpload}
                        disabled={editCompanyLogoUploading}
                      />
                    </label>
                    <span className="ml-2.5 text-[10px] text-zinc-400">JPG, PNG, or WEBP. Max 2MB.</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-700">Description</label>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-[6px] border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#F7931A] focus:ring-1 focus:ring-[#F7931A] bg-[#FAF9F6] text-zinc-900 placeholder-zinc-400"
                />
              </div>

              {/* Skills */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-700">Skills</label>
                <div className="rounded-[6px] border border-zinc-200 bg-[#FAF9F6] p-2 focus-within:bg-white focus-within:border-[#F7931A] transition">
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
                    className="w-full bg-transparent text-xs text-zinc-900 focus:outline-none"
                    placeholder="Type a skill and press Enter"
                  />
                  {editSkills.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {editSkills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1 rounded bg-zinc-200/60 text-zinc-700 px-2 py-0.5 text-[10px] font-semibold border border-zinc-300/40"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => setEditSkills((prev) => prev.filter((s) => s !== skill))}
                            className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Urgent */}
              <div className="flex items-center justify-between p-3 rounded-md border border-zinc-200 bg-[#FAF9F6]">
                <div>
                  <div className="text-xs font-semibold text-zinc-700">Urgent</div>
                  <div className="text-[10px] text-zinc-500 font-semibold mt-0.5">Mark this job as high priority.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditUrgent((v) => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${editUrgent ? "bg-[#F7931A]" : "bg-zinc-200"
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editUrgent ? "translate-x-4" : "translate-x-0.5"
                      }`}
                  />
                </button>
              </div>
            </div>

            <div className="border-t border-zinc-100" />

            {/* Footer Buttons */}
            <div className="p-4 bg-white flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-5 py-2 border border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50 rounded-md text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!editTitle.trim() || editTitle.trim().length < 3) {
                    triggerToast("Please enter a job title (at least 3 characters).", "error");
                    return;
                  }
                  if (!editBudget.trim()) {
                    triggerToast("Please enter a budget.", "error");
                    return;
                  }
                  if (!editDuration.trim()) {
                    triggerToast("Please enter a duration.", "error");
                    return;
                  }
                  if (!editCompanyLogo.trim()) {
                    triggerToast("Please upload a company logo.", "error");
                    return;
                  }
                  if (!editDescription.trim() || editDescription.trim().length < 20) {
                    triggerToast("Please write a description (at least 20 characters).", "error");
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
                className="px-5 py-2 bg-[#F7931A] hover:bg-[#e07f0f] text-white font-bold text-xs rounded-md shadow-sm hover:shadow transition disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </button>
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
          <div className="relative z-[81] w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col">

            {/* Header */}
            <div className="p-6 pb-4 relative">
              <button
                type="button"
                onClick={() => setIsPostModalOpen(false)}
                aria-label="Close"
                className="absolute right-6 top-6 text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#F7931A] mb-1">
                Post a Job
              </div>
              <h2 className="text-xl font-bold text-zinc-900">Create a new job post</h2>
              <p className="text-xs text-zinc-500 mt-1">
                Share the role details and the right freelancers will apply.
              </p>
            </div>

            <div className="border-t border-zinc-100" />

            {/* Form Fields */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Job Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-700">Job Title</label>
                <input
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="w-full rounded-[6px] border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#F7931A] focus:ring-1 focus:ring-[#F7931A] bg-[#FAF9F6] text-zinc-900 placeholder-zinc-400"
                  placeholder="e.g. Senior Smart Contract Engineer"
                />
              </div>

              {/* Category & Job Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Category</label>
                  <select
                    value={postCategory}
                    onChange={(e) => setPostCategory(e.target.value)}
                    className="w-full rounded-[6px] border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#F7931A] focus:ring-1 focus:ring-[#F7931A] bg-[#FAF9F6] text-zinc-900"
                  >
                    <option value="">Select a category</option>
                    {JOB_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Job Type</label>
                  <select
                    value={postType}
                    onChange={(e) => setPostType(e.target.value)}
                    className="w-full rounded-[6px] border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#F7931A] focus:ring-1 focus:ring-[#F7931A] bg-[#FAF9F6] text-zinc-900"
                  >
                    <option value="Fixed Price">Fixed Price</option>
                    <option value="Hourly">Hourly</option>
                  </select>
                </div>
              </div>

              {/* Budget & Duration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Budget</label>
                  <div className="relative flex items-center">
                    <input
                      value={postBudget}
                      onChange={(e) => setPostBudget(e.target.value)}
                      className="w-full rounded-[6px] border border-zinc-200 pl-3 pr-10 py-2 text-xs focus:outline-none focus:border-[#F7931A] focus:ring-1 focus:ring-[#F7931A] bg-[#FAF9F6] text-zinc-900 placeholder-zinc-400"
                      placeholder="450,000"
                    />
                    <span className="absolute right-3 text-[10px] font-semibold text-zinc-500">sats</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Duration</label>
                  <input
                    value={postDuration}
                    onChange={(e) => setPostDuration(e.target.value)}
                    className="w-full rounded-[6px] border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#F7931A] focus:ring-1 focus:ring-[#F7931A] bg-[#FAF9F6] text-zinc-900 placeholder-zinc-400"
                    placeholder="e.g. 4 weeks"
                  />
                </div>
              </div>

              {/* Company Logo */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-700">Company Logo</label>
                <div className="flex items-center gap-4 rounded-md border border-zinc-200 bg-[#FAF9F6] p-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-white flex-shrink-0">
                    {postCompanyLogo ? (
                      <img src={postCompanyLogo} alt="Company logo preview" className="h-full w-full object-cover" />
                    ) : (
                      <UploadCloud className="h-5 w-5 text-zinc-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex cursor-pointer items-center rounded border border-zinc-300 bg-white px-3 py-1.5 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-50 transition">
                      {postCompanyLogoUploading ? "Uploading..." : "Upload Logo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handlePostCompanyLogoUpload}
                        disabled={postCompanyLogoUploading}
                      />
                    </label>
                    <span className="ml-2.5 text-[10px] text-zinc-400">JPG, PNG, or WEBP. Max 2MB.</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-700">Description</label>
                <textarea
                  rows={4}
                  value={postDescription}
                  onChange={(e) => setPostDescription(e.target.value)}
                  className="w-full rounded-[6px] border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#F7931A] focus:ring-1 focus:ring-[#F7931A] bg-[#FAF9F6] text-zinc-900 placeholder-zinc-400"
                  placeholder="Describe the scope, goals, and deliverables in detail..."
                />
              </div>

              {/* Skills */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-700">Skills</label>
                <div className="rounded-[6px] border border-zinc-200 bg-[#FAF9F6] p-2 focus-within:bg-white focus-within:border-[#F7931A] transition">
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
                    className="w-full bg-transparent text-xs text-zinc-900 focus:outline-none"
                    placeholder="Type a skill and press Enter"
                  />
                  {postSkills.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {postSkills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1 rounded bg-zinc-200/60 text-zinc-700 px-2 py-0.5 text-[10px] font-semibold border border-zinc-300/40"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => setPostSkills((prev) => prev.filter((s) => s !== skill))}
                            className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Urgent */}
              <div className="flex items-center justify-between p-3 rounded-md border border-zinc-200 bg-[#FAF9F6]">
                <div>
                  <div className="text-xs font-semibold text-zinc-700">Urgent</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Mark this job as high priority.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPostUrgent((v) => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${postUrgent ? "bg-[#F7931A]" : "bg-zinc-200"
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${postUrgent ? "translate-x-4" : "translate-x-0.5"
                      }`}
                  />
                </button>
              </div>
            </div>

            <div className="border-t border-zinc-100" />

            {/* Footer Buttons */}
            <div className="p-4 bg-white flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsPostModalOpen(false)}
                className="px-5 py-2 border border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50 rounded-md text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!postTitle.trim() || postTitle.trim().length < 3) {
                    triggerToast("Please enter a job title (at least 3 characters).", "error");
                    return;
                  }
                  if (!postBudget.trim()) {
                    triggerToast("Please enter a budget.", "error");
                    return;
                  }
                  if (!postDuration.trim()) {
                    triggerToast("Please enter a duration.", "error");
                    return;
                  }
                  if (!postCompanyLogo.trim() && !clientCompanyLogoUrl) {
                    triggerToast("Please upload a company logo.", "error");
                    return;
                  }
                  if (!postDescription.trim() || postDescription.trim().length < 20) {
                    triggerToast("Please write a description (at least 20 characters).", "error");
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
                className="px-5 py-2 bg-[#F7931A] hover:bg-[#e07f0f] text-white font-bold text-xs rounded-md shadow-sm hover:shadow transition disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
              >
                {isPublishing ? "Publishing..." : "Publish Job"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showToast.show && (
        <div className="fixed bottom-8 left-1/2 z-[100] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 rounded-full bg-[#1a1a1a] px-6 py-3 shadow-2xl border border-[#333]">
            <div className={`flex h-5 w-5 items-center justify-center rounded-full ${showToast.type === "success" ? "bg-green-500" : "bg-red-500"}`}>
              {showToast.type === "success" ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <span className="text-white text-[11px] font-black leading-none">✖</span>
              )}
            </div>
            <span className="text-[13px] font-medium text-white">{showToast.message}</span>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {deleteJobId && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !isDeletingJob && setDeleteJobId(null)}
          />
          <div className="relative z-[91] w-full max-w-sm rounded-[20px] border border-[#EAE7E2] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
            {/* Icon */}
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF2F2]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <div className="mt-4 text-center">
              <div className="text-[16px] font-black text-[#1a1a1a]">Delete job post?</div>
              <p className="mt-2 text-[12px] leading-[1.6] text-[#6b6762]">
                This will permanently remove the job post and all associated data. This action cannot be undone.
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteJobId(null)}
                disabled={isDeletingJob}
                className="flex-1 rounded-full border border-[#EAE7E2] px-4 py-2.5 text-[13px] font-semibold text-[#6b6762] transition-colors hover:bg-[#F7F4F0] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteJob}
                disabled={isDeletingJob}
                className="flex-1 rounded-full bg-[#DC2626] px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#B91C1C] disabled:opacity-60"
              >
                {isDeletingJob ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
