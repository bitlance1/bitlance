"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Send,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  BadgeCheck,
  MapPin,
  Calendar,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  addDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  setDoc,
  increment,
} from "firebase/firestore";
import { sendUserNotification } from "@/lib/notifications";

/* ─── Types ────────────────────────────────────────── */
type FreelancerItem = {
  id: string;
  fullName: string;
  title: string;
  bio: string;
  hourlyRate: string;
  avatarUrl: string;
  verified: boolean;
  skills: string[];
  location: string;
};

/* ─── Skill Categories ─────────────────────────────── */
const SKILL_CATEGORIES = [
  "All",
  "Development",
  "Design & Creative",
  "Blockchain & Crypto",
  "Writing",
  "Marketing",
  "Sales",
  "Customer Support",
  "Data & Analytics",
  "DevOps & Infrastructure",
];

export default function ClientFindFreelancersContent() {
  const router = useRouter();

  // ── Search & Filter State ──────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // ── Freelancers Data ───────────────────────────────────────────────────────
  const [freelancers, setFreelancers] = useState<FreelancerItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Current Client Auth ────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState<any>(null);

  // ── Invite Modal State ─────────────────────────────────────────────────────
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [targetFreelancer, setTargetFreelancer] = useState<FreelancerItem | null>(null);
  const [clientJobs, setClientJobs] = useState<Array<{ id: string; title: string; budget?: string }>>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState("");
  const [inviteErrorMsg, setInviteErrorMsg] = useState("");

  // ── Searchable Job Picker Dropdown State ─────────────────────────────────
  const [jobSearchQuery, setJobSearchQuery] = useState("");
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState(false);

  const filteredClientJobs = useMemo(() => {
    if (!jobSearchQuery.trim()) return clientJobs;
    const q = jobSearchQuery.toLowerCase().trim();
    return clientJobs.filter(
      (j) => j.title.toLowerCase().includes(q) || (j.budget && j.budget.toLowerCase().includes(q))
    );
  }, [clientJobs, jobSearchQuery]);

  // ── Sent Invitations State ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"find" | "invitations">("find");
  const [sentInvitations, setSentInvitations] = useState<any[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [invitationPermissionError, setInvitationPermissionError] = useState(false);

  // ── Auth state observer ────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // ── Sent Invitations Fetch ──────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) {
      setSentInvitations([]);
      return;
    }
    setLoadingInvitations(true);
    const q = query(
      collection(firebaseDb, "job_invitations"),
      where("clientId", "==", currentUser.uid)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            id: docSnap.id,
            ...data,
          };
        }).sort((a: any, b: any) => {
          const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
          const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
          return bTime - aTime;
        });
        setSentInvitations(list);
        setLoadingInvitations(false);
      },
      (err) => {
        console.error("Invitations snapshot error:", err);
        setLoadingInvitations(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  // ── Real-time Freelancers Fetch ────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(firebaseDb, "freelancers"),
      async (snapshot) => {
        try {
          const items: FreelancerItem[] = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const freeData = docSnap.data() as any;
              const uid = docSnap.id;
              let allData: any = {};
              try {
                const allUsersSnap = await getDoc(doc(firebaseDb, "all_users", uid));
                allData = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
              } catch {
                allData = {};
              }
              const firstName = (freeData.firstName as string) || (allData.firstName as string) || "";
              const lastName = (freeData.lastName as string) || (allData.lastName as string) || "";
              const fullName =
                freeData.fullName ??
                allData.fullName ??
                ([firstName, lastName].filter(Boolean).join(" ") || "Freelancer");

              const skills = Array.isArray(freeData.skills)
                ? freeData.skills.filter(Boolean)
                : [];

              return {
                id: uid,
                fullName,
                title: freeData.title?.trim() || "Freelancer",
                bio: freeData.bio?.trim() || "Professional freelancer available for contract work.",
                hourlyRate: freeData.hourlyRate ? `${freeData.hourlyRate} sats/hr` : "—",
                avatarUrl: freeData.avatarUrl ?? allData.avatarUrl ?? "",
                verified: freeData.verified ?? false,
                skills,
                location: freeData.location ?? "",
              };
            })
          );
          setFreelancers(items);
        } catch (err) {
          console.error("Failed to fetch freelancers:", err);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error("Freelancers snapshot error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ── Filtered Freelancers ───────────────────────────────────────────────────
  const filteredFreelancers = useMemo(() => {
    return freelancers.filter((f) => {
      // Category skill match
      const categoryMatch =
        selectedCategory === "All" ||
        f.skills.some((s) => s.toLowerCase().includes(selectedCategory.toLowerCase())) ||
        f.title.toLowerCase().includes(selectedCategory.toLowerCase());

      // Search term match
      const searchLower = searchTerm.trim().toLowerCase();
      const searchMatch =
        !searchLower ||
        f.fullName.toLowerCase().includes(searchLower) ||
        f.title.toLowerCase().includes(searchLower) ||
        f.bio.toLowerCase().includes(searchLower) ||
        f.skills.some((s) => s.toLowerCase().includes(searchLower));

      return categoryMatch && searchMatch;
    });
  }, [freelancers, searchTerm, selectedCategory]);

  // ── Open Invite Modal ──────────────────────────────────────────────────────
  const handleOpenInviteModal = async (freelancer: FreelancerItem) => {
    if (!currentUser) {
      router.push(`/login?redirect=/client/dashboard/find-freelancers`);
      return;
    }

    setTargetFreelancer(freelancer);
    setInviteModalOpen(true);
    setLoadingJobs(true);
    setInviteErrorMsg("");
    setInviteSuccessMsg("");

    try {
      const q = query(
        collection(firebaseDb, "jobs"),
        where("clientId", "==", currentUser.uid)
      );
      const snap = await getDocs(q);
      const jobsList = snap.docs
        .map((d) => {
          const data = d.data() as any;
          const status = String(data.status ?? "").toLowerCase();
          if (status === "closed" || status === "paused" || status === "completed") return null;
          return {
            id: d.id,
            title: (data.title as string) || "Untitled Job",
            budget: (data.budget as string) || "",
          };
        })
        .filter(Boolean) as Array<{ id: string; title: string; budget?: string }>;

      setClientJobs(jobsList);
      if (jobsList.length > 0) {
        setSelectedJobId(jobsList[0].id);
      }
    } catch (err) {
      console.error("Error fetching client jobs:", err);
      setInviteErrorMsg("Failed to load your open job posts.");
    } finally {
      setLoadingJobs(false);
    }
  };

  // ── Send Invitation ────────────────────────────────────────────────────────
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId || !targetFreelancer || !currentUser) {
      setInviteErrorMsg("Please select a valid job post.");
      return;
    }

    setSendingInvite(true);
    setInviteErrorMsg("");
    setInviteSuccessMsg("");

    try {
      const selectedJob = clientJobs.find((j) => j.id === selectedJobId);
      const jobTitle = selectedJob?.title || "Job Post";
      const messageText =
        inviteNote.trim() ||
        `Hi ${targetFreelancer.fullName}, I checked out your profile and would like to invite you to apply for "${jobTitle}".`;

      // Fetch client details from all_users for the conversation meta
      let clientName = currentUser.displayName || currentUser.email || "Client";
      let clientAvatar = currentUser.photoURL || "";
      try {
        const clientUserSnap = await getDoc(doc(firebaseDb, "all_users", currentUser.uid));
        if (clientUserSnap.exists()) {
          const clientData = clientUserSnap.data();
          if (clientData.fullName) clientName = clientData.fullName;
          if (clientData.avatarUrl) clientAvatar = clientData.avatarUrl;
        }
      } catch (e) {
        console.warn("Could not load client details from all_users:", e);
      }

      const invitationPayload = {
        isInvitation: true,
        jobId: selectedJobId,
        jobTitle,
        clientId: currentUser.uid,
        clientName,
        freelancerId: targetFreelancer.id,
        freelancerName: targetFreelancer.fullName,
        message: messageText,
        cover: messageText,
        status: "pending",
        createdAt: serverTimestamp(),
      };

      // 1. Primary: Save exclusively to job_invitations collection
      const inviteRef = await addDoc(collection(firebaseDb, "job_invitations"), invitationPayload);

      // 2. Chat Conversation Creation & Message Send
      try {
        const conversationId = `${selectedJobId}_${targetFreelancer.id}`;
        const conversationRef = doc(firebaseDb, "conversations", conversationId);
        const conversationSnap = await getDoc(conversationRef);
        if (!conversationSnap.exists()) {
          await setDoc(conversationRef, {
            jobId: selectedJobId,
            jobTitle,
            clientId: currentUser.uid,
            clientName,
            clientAvatarUrl: clientAvatar,
            freelancerId: targetFreelancer.id,
            freelancerName: targetFreelancer.fullName,
            freelancerAvatarUrl: targetFreelancer.avatarUrl || "",
            paymentTotalAmountSats: 0,
            paymentStatus: "unfunded",
            createdBy: "client",
            canFreelancerMessage: true,
            unread: {
              [currentUser.uid]: 0,
              [targetFreelancer.id]: 1,
            },
            lastMessage: {
              text: messageText,
              senderId: currentUser.uid,
              createdAt: serverTimestamp(),
            },
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          });
        } else {
          await updateDoc(conversationRef, {
            [`unread.${targetFreelancer.id}`]: increment(1),
            lastMessage: {
              text: messageText,
              senderId: currentUser.uid,
              createdAt: serverTimestamp(),
            },
            updatedAt: serverTimestamp(),
          });
        }

        // Send the interactive job invitation message
        await addDoc(collection(firebaseDb, "conversations", conversationId, "messages"), {
          senderId: currentUser.uid,
          senderRole: "client",
          text: messageText,
          messageType: "job_invitation",
          jobId: selectedJobId,
          jobTitle,
          invitationId: inviteRef.id,
          invitationStatus: "pending",
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Error creating conversation/message for invitation:", err);
      }

      // 3. Update jobs document invited list
      try {
        await updateDoc(doc(firebaseDb, "jobs", selectedJobId), {
          invitedFreelancers: arrayUnion(targetFreelancer.id),
        });
      } catch (e) {
        console.warn("jobs update fallback skipped", e);
      }

      // 4. Trigger email / in-app notification
      await sendUserNotification({
        userId: targetFreelancer.id,
        title: `Job Invitation: ${jobTitle}`,
        body: `${clientName} invited you to apply for "${jobTitle}". Check your proposals dashboard to review!`,
        url: `/freelancer/dashboard/proposals?tab=invitations`,
      });

      setInviteSuccessMsg(`Invitation sent successfully to ${targetFreelancer.fullName}!`);
      setTimeout(() => {
        setInviteModalOpen(false);
        setInviteNote("");
        setInviteSuccessMsg("");
      }, 2000);
    } catch (err: any) {
      console.error("Error sending invitation:", err);
      setInviteErrorMsg(err?.message || "Failed to send invitation. Please try again.");
    } finally {
      setSendingInvite(false);
    }
  };

  return (
    <div className="w-full max-w-full min-w-0 space-y-6 overflow-x-hidden">

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] sm:text-[30px] font-black text-[#1a1a1a] tracking-tight">
          Find Freelancers
        </h1>
        <p className="text-[13px] sm:text-[14px] text-[#666] leading-relaxed">
          Browse top talent on Bitlance, inspect profiles, and send direct job invitations.
        </p>
      </div>

      {/* ── Tabs for Find Freelancers vs Sent Invitations ── */}
      <div className="flex border-b border-[#EAE7E2] gap-6">
        <button
          onClick={() => setActiveTab("find")}
          className={`pb-3 text-[14px] sm:text-[15px] font-bold transition-all relative ${
            activeTab === "find"
              ? "text-[#F7931A] border-b-2 border-[#F7931A]"
              : "text-[#666] hover:text-[#1a1a1a]"
          }`}
        >
          Find Freelancers
        </button>
        <button
          onClick={() => setActiveTab("invitations")}
          className={`pb-3 text-[14px] sm:text-[15px] font-bold transition-all relative ${
            activeTab === "invitations"
              ? "text-[#F7931A] border-b-2 border-[#F7931A]"
              : "text-[#666] hover:text-[#1a1a1a]"
          }`}
        >
          Sent Invitations ({sentInvitations.length})
        </button>
      </div>

      {activeTab === "find" ? (
        <>
          {/* ── Search Bar & Category Filters ── */}
          <div className="bg-white rounded-[18px] border border-[#EAE7E2] p-4 sm:p-5 shadow-sm space-y-4 min-w-0 max-w-full overflow-hidden">
            {/* Search input */}
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#999]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search freelancers by name, skill (e.g. Next.js, Lightning), or title..."
                className="w-full pl-11 pr-4 py-3 rounded-[12px] bg-[#FCF9F8] border border-[#EDEAE5] text-[14px] text-[#1a1a1a] placeholder-[#999] focus:outline-none focus:border-[#F7931A] transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#1a1a1a]"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Skill category pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full min-w-0 scrollbar-thin scrollbar-thumb-stone-200 scrollbar-track-transparent">
              {SKILL_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap shrink-0 transition-all ${
                      isSelected
                        ? "bg-[#F7931A] text-white shadow-sm"
                        : "bg-[#F5F0EB] text-[#666] hover:bg-[#EAE7E2] hover:text-[#1a1a1a]"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Freelancers Grid ── */}
          {loading ? (
            <div className="bg-white rounded-[18px] border border-[#EAE7E2] p-12 text-center">
              <div className="h-8 w-8 rounded-full border-2 border-[#F7931A] border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-[13px] text-[#888] font-medium">Loading freelancers...</p>
            </div>
          ) : filteredFreelancers.length === 0 ? (
            <div className="bg-white rounded-[18px] border border-[#EAE7E2] p-12 text-center space-y-3">
              <p className="text-[16px] font-bold text-[#1a1a1a]">No freelancers found</p>
              <p className="text-[13px] text-[#888] max-w-sm mx-auto">
                Try adjusting your search criteria or selecting a different skill category filter.
              </p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("All");
                }}
                className="px-5 py-2 rounded-[10px] bg-[#F5F0EB] text-[#1a1a1a] text-[12px] font-bold hover:bg-[#EAE7E2] transition-colors"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
              {filteredFreelancers.map((freelancer) => (
                <div
                  key={freelancer.id}
                  className="bg-white rounded-[18px] border border-[#EAE7E2] p-5 shadow-sm hover:border-[#F7931A]/40 transition-all flex flex-col justify-between gap-4 min-w-0"
                >
                  {/* Card Header: Avatar + Name + Rate */}
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-14 h-14 rounded-full bg-[#E8E2D9] border border-[#DDD8D0] overflow-hidden flex-shrink-0 flex items-center justify-center font-black text-[#8C4F00] text-[18px]">
                      {freelancer.avatarUrl ? (
                        <img
                          src={freelancer.avatarUrl}
                          alt={freelancer.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (freelancer.fullName?.[0] ?? "F").toUpperCase()
                      )}
                    </div>

                    {/* Name & Title */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-[16px] font-black text-[#1a1a1a] truncate leading-tight">
                          {freelancer.fullName}
                        </h3>
                        {freelancer.verified && (
                          <BadgeCheck size={16} className="text-[#3B82F6] flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[13px] text-[#666] font-medium truncate mt-0.5">
                        {freelancer.title}
                      </p>
                      <p className="text-[12px] font-bold text-[#F7931A] mt-1">
                        {freelancer.hourlyRate}
                      </p>
                    </div>
                  </div>

                  {/* Bio excerpt */}
                  <p className="text-[12px] text-[#555] leading-relaxed line-clamp-2">
                    {freelancer.bio}
                  </p>

                  {/* Skill tags */}
                  {freelancer.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {freelancer.skills.slice(0, 4).map((skill) => (
                        <span
                          key={skill}
                          className="px-2.5 py-1 rounded-[6px] bg-[#F5F0EB] text-[10px] font-bold uppercase tracking-wider text-[#444]"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Card Actions */}
                  <div className="pt-2 border-t border-[#F5F0EB] flex items-center gap-2">
                    <button
                      onClick={() => handleOpenInviteModal(freelancer)}
                      className="flex-1 py-2.5 rounded-[10px] bg-[#F7931A] hover:bg-[#E07D0A] text-white text-[12px] font-black uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Send size={13} />
                      <span>Invite to Job</span>
                    </button>
                    <button
                      onClick={() => router.push(`/freelancer/public/${freelancer.id}`)}
                      className="px-4 py-2.5 rounded-[10px] bg-[#F5F0EB] hover:bg-[#EAE7E2] text-[#1a1a1a] text-[12px] font-bold transition-colors flex items-center gap-1"
                    >
                      <span>Profile</span>
                      <ExternalLink size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ── Sent Invitations View ── */
        <div className="space-y-4">
          {invitationPermissionError ? (
            <div className="bg-[#FFF6F2] rounded-[18px] border border-[#F7931A]/30 p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#F7931A]/10 text-[#F7931A] flex items-center justify-center mx-auto">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-[16px] font-black text-[#8C4F00]">
                Firestore Permission Required
              </h3>
              <p className="text-[13px] text-[#666] max-w-md mx-auto leading-relaxed">
                To view sent invitations on the client side, please update the security rules for the 
                <strong> <code className="bg-[#FCF9F8] px-1.5 py-0.5 rounded border border-[#EDEAE5]">job_invitations</code></strong> 
                collection in your Firebase Console.
              </p>
              <div className="bg-white p-4 rounded-[12px] border border-[#EDEAE5] text-left font-mono text-[11px] text-[#333] max-w-lg mx-auto overflow-x-auto whitespace-pre leading-relaxed">
{`match /job_invitations/{id} {
  allow read: if request.auth != null && (
    request.auth.uid == resource.data.freelancerId || 
    request.auth.uid == resource.data.clientId
  );
  allow write: if request.auth != null;
}`}
              </div>
            </div>
          ) : loadingInvitations ? (
            <div className="bg-white rounded-[18px] border border-[#EAE7E2] p-12 text-center">
              <div className="h-8 w-8 rounded-full border-2 border-[#F7931A] border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-[13px] text-[#888] font-medium">Loading sent invitations...</p>
            </div>
          ) : sentInvitations.length === 0 ? (
            <div className="bg-white rounded-[18px] border border-[#EAE7E2] p-12 text-center space-y-2">
              <p className="text-[16px] font-bold text-[#1a1a1a]">No invitations sent yet</p>
              <p className="text-[13px] text-[#888] max-w-sm mx-auto">
                Any direct invitations you send to freelancers will show up here along with their status.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {sentInvitations.map((inv) => {
                const isAccepted = inv.status === "accepted";
                const isDeclined = inv.status === "declined";

                return (
                  <div
                    key={inv.id}
                    className="bg-white rounded-[18px] border border-[#EAE7E2] p-5 shadow-sm space-y-3 transition-all hover:border-[#F7931A]/20"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-[15px] font-black text-[#1a1a1a] flex items-center gap-1.5 flex-wrap">
                          Invited:{" "}
                          <span
                            onClick={() => router.push(`/freelancer/public/${inv.freelancerId}`)}
                            className="text-[#F7931A] cursor-pointer hover:underline"
                          >
                            {inv.freelancerName}
                          </span>
                        </h4>
                        <p className="text-[12px] text-[#666] mt-1">
                          For Job:{" "}
                          <a
                            href={`/job/${inv.jobId}`}
                            className="font-bold underline hover:text-[#F7931A]"
                          >
                            {inv.jobTitle}
                          </a>
                        </p>
                      </div>
                      <div>
                        <span
                          className={`text-[11px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full ${
                            isAccepted
                              ? "bg-emerald-100 text-emerald-700"
                              : isDeclined
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isAccepted
                            ? "Accepted"
                            : isDeclined
                            ? "Declined"
                            : "Pending Response"}
                        </span>
                      </div>
                    </div>

                    {inv.message && (
                      <div className="p-3 bg-[#FCF9F8] border border-[#EDEAE5] rounded-[10px] text-[12px] text-[#555] leading-relaxed italic">
                        "{inv.message}"
                      </div>
                    )}

                    <div className="text-[11px] text-[#999] flex items-center gap-1.5">
                      <Calendar size={13} className="text-[#888]" />
                      <span>
                        Sent on{" "}
                        {inv.createdAt
                          ? new Date(
                              inv.createdAt.seconds ? inv.createdAt.seconds * 1000 : inv.createdAt
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Recently"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Invite To Job Modal Overlay ── */}
      {inviteModalOpen && targetFreelancer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[20px] border border-[#EAE7E2] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-[#F0EDE8] flex items-center justify-between bg-[#FCF9F8]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#F7931A]/10 flex items-center justify-center text-[#F7931A]">
                  <Send size={18} />
                </div>
                <div>
                  <h3 className="text-[16px] font-black text-[#1a1a1a] leading-tight">
                    Invite to Job
                  </h3>
                  <p className="text-[12px] text-[#777]">
                    Sending invitation to <span className="font-bold text-[#1a1a1a]">{targetFreelancer.fullName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#EAE7E2]/50 hover:bg-[#EAE7E2] text-[#666] flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">

              {/* Success Alert */}
              {inviteSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-[12px] flex items-center gap-2.5 text-emerald-800 text-[13px] font-medium">
                  <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                  <span>{inviteSuccessMsg}</span>
                </div>
              )}

              {/* Error Alert */}
              {inviteErrorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-[12px] flex items-center gap-2.5 text-rose-800 text-[13px] font-medium">
                  <AlertCircle size={18} className="text-rose-600 flex-shrink-0" />
                  <span>{inviteErrorMsg}</span>
                </div>
              )}

              {loadingJobs ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="h-7 w-7 rounded-full border-2 border-[#F7931A] border-t-transparent animate-spin" />
                  <p className="text-[13px] text-[#888] font-medium">Loading your active job posts...</p>
                </div>
              ) : clientJobs.length === 0 ? (
                <div className="py-8 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-[#FCF9F8] border border-[#EAE7E2] mx-auto flex items-center justify-center text-[#999]">
                    <Briefcase size={22} />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-[#1a1a1a]">No Active Open Job Posts</p>
                    <p className="text-[13px] text-[#777] max-w-xs mx-auto mt-1">
                      You need an active job post to invite freelancers to apply.
                    </p>
                  </div>
                  <button
                    onClick={() => router.push("/client/dashboard/job-posts?action=new")}
                    className="px-6 py-2.5 rounded-[10px] bg-[#F7931A] text-white text-[13px] font-black uppercase tracking-wide hover:bg-[#E07D0A] transition-colors"
                  >
                    Post a New Job Now
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendInvite} className="space-y-4">
                  {/* Searchable Custom Job Select Dropdown */}
                  <div className="relative">
                    <label className="block text-[11px] font-black uppercase tracking-[0.08em] text-[#666] mb-1.5">
                      Select Open Job Post <span className="text-rose-500">*</span>
                    </label>

                    {/* Trigger Button */}
                    <div
                      onClick={() => setIsJobDropdownOpen((prev) => !prev)}
                      className={`w-full px-4 py-3 rounded-[12px] bg-[#FCF9F8] border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isJobDropdownOpen
                          ? "border-[#F7931A] ring-2 ring-[#F7931A]/10 shadow-sm"
                          : "border-[#EDEAE5] hover:border-[#CBD5E1]"
                      }`}
                    >
                      {(() => {
                        const activeJob = clientJobs.find((j) => j.id === selectedJobId) || clientJobs[0];
                        return activeJob ? (
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <Briefcase size={16} className="text-[#F7931A] flex-shrink-0" />
                            <span className="text-[13px] font-bold text-[#1a1a1a] truncate">
                              {activeJob.title}
                            </span>
                            {activeJob.budget && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F7931A]/10 text-[#F7931A] flex-shrink-0">
                                {activeJob.budget.includes("sats") ? activeJob.budget : `${activeJob.budget} sats`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[13px] text-[#999]">Select an open job...</span>
                        );
                      })()}
                      {isJobDropdownOpen ? (
                        <ChevronUp size={16} className="text-[#666] flex-shrink-0" />
                      ) : (
                        <ChevronDown size={16} className="text-[#666] flex-shrink-0" />
                      )}
                    </div>

                    {/* Floating Popover Dropdown Menu */}
                    {isJobDropdownOpen && (
                      <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 bg-white border border-[#EDEAE5] rounded-[14px] shadow-2xl p-2.5 space-y-2 animate-in fade-in-50 zoom-in-95 duration-150">
                        {/* Search Input inside Dropdown */}
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" />
                          <input
                            type="text"
                            value={jobSearchQuery}
                            onChange={(e) => setJobSearchQuery(e.target.value)}
                            placeholder="Search job title or budget..."
                            className="w-full pl-8 pr-7 py-2 rounded-[8px] bg-[#FCF9F8] border border-[#EDEAE5] text-[12px] text-[#1a1a1a] placeholder-[#999] focus:outline-none focus:border-[#F7931A]"
                            onClick={(e) => e.stopPropagation()}
                          />
                          {jobSearchQuery && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setJobSearchQuery("");
                              }}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#1a1a1a]"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>

                        {/* Jobs Options List */}
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                          {filteredClientJobs.length === 0 ? (
                            <div className="py-4 text-center text-[12px] text-[#999]">
                              No matching job posts found
                            </div>
                          ) : (
                            filteredClientJobs.map((job) => {
                              const isSelected = job.id === selectedJobId;
                              return (
                                <div
                                  key={job.id}
                                  onClick={() => {
                                    setSelectedJobId(job.id);
                                    setIsJobDropdownOpen(false);
                                    setJobSearchQuery("");
                                  }}
                                  className={`w-full p-2.5 rounded-[10px] text-left cursor-pointer transition-all flex items-center justify-between gap-3 ${
                                    isSelected
                                      ? "bg-[#FFF9F2] border border-[#F7931A]/40 text-[#1a1a1a]"
                                      : "hover:bg-[#FCF9F8] border border-transparent text-[#444]"
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-bold text-[#1a1a1a] truncate leading-snug">
                                      {job.title}
                                    </p>
                                    {job.budget && (
                                      <span className="text-[10px] font-semibold text-[#8C4F00]">
                                        {job.budget.includes("sats") ? job.budget : `${job.budget} sats`}
                                      </span>
                                    )}
                                  </div>
                                  {isSelected && (
                                    <Check size={16} className="text-[#F7931A] flex-shrink-0" />
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Personal Note */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-[0.08em] text-[#666] mb-1.5">
                      Personal Note to Freelancer
                    </label>
                    <textarea
                      rows={4}
                      value={inviteNote}
                      onChange={(e) => setInviteNote(e.target.value)}
                      placeholder={`Hi ${targetFreelancer.fullName}, I checked out your profile and work history. I'd love to invite you to apply for our project...`}
                      className="w-full px-3.5 py-3 rounded-[10px] bg-[#FCF9F8] border border-[#EDEAE5] text-[13px] text-[#1a1a1a] placeholder-[#AAA] focus:outline-none focus:border-[#F7931A] transition-colors resize-none leading-relaxed"
                    />
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setInviteModalOpen(false)}
                      className="px-5 py-2.5 rounded-[10px] text-[13px] font-bold text-[#666] hover:bg-[#EAE7E2]/50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={sendingInvite || !!inviteSuccessMsg}
                      className="px-6 py-2.5 rounded-[10px] bg-[#F7931A] hover:bg-[#E07D0A] disabled:opacity-50 text-white text-[13px] font-black uppercase tracking-wide transition-colors flex items-center gap-2 shadow-sm"
                    >
                      {sendingInvite ? (
                        <>
                          <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <Send size={14} />
                          <span>Send Invitation</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
