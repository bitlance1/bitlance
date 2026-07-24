"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Freelancer Public Profile Page
// Reads from : freelancers/{uid}  +  all_users/{uid}
// No editing — read-only view for clients and visitors
// ─────────────────────────────────────────────────────────────────────────────

import { useParams, useRouter } from "next/navigation";
import { MapPin, Calendar, BadgeCheck, ArrowLeft, X, Send, CheckCircle2, AlertCircle, Briefcase, ChevronDown, ChevronUp, Check, Search } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, arrayUnion, serverTimestamp, setDoc, increment } from "firebase/firestore";
import { sendUserNotification } from "@/lib/notifications";

export default function FreelancerPublicProfilePage() {
  const params = useParams<{ uid: string }>();
  const uid = params?.uid ?? "";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    title: "",
    location: "",
    memberSince: "",
    avatarUrl: "",
    verified: false,
    hourlyRate: "",
    totalEarned: "",
    jobSuccess: 0,
    jobsCompleted: 0,
    // hoursWorked: 0, // not computed — no time-tracking data source
    responseTime: "",
    availability: "",
    lastActive: "",
    bio: "",
    skills: [] as string[],
    performanceData: [] as number[],
    workHistory: [] as Array<{
      title: string;
      amount: string;
      status: string;
      rating: number;
      review: string;
      period: string;
    }>,
    portfolioItems: [] as Array<{
      id: string;
      title: string;
      description: string;
      imageUrl?: string;
      imagePublicId?: string;
      projectLink?: string;
    }>,
  });

  // ── Auth & Role State ──────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isClientUser, setIsClientUser] = useState<boolean>(false);

  // ── Invite Modal State ─────────────────────────────────────────────────────
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
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

  // ── Auth & Role Observer ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userSnap = await getDoc(doc(firebaseDb, "all_users", user.uid));
          if (userSnap.exists()) {
            const uData = userSnap.data() as any;
            const role = String(uData.role ?? uData.userType ?? "").toLowerCase();
            setIsClientUser(role === "client");
          } else {
            const clientSnap = await getDoc(doc(firebaseDb, "clients", user.uid));
            setIsClientUser(clientSnap.exists());
          }
        } catch {
          setIsClientUser(false);
        }
      } else {
        setIsClientUser(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // ── Handle Open Invite Modal ───────────────────────────────────────────────
  const handleOpenInviteModal = async () => {
    if (!currentUser) {
      router.push(`/login?redirect=/freelancer/public/${uid}`);
      return;
    }

    if (!isClientUser) {
      setInviteErrorMsg("Only client accounts can send job invitations. Please log in with a client account.");
      setIsInviteModalOpen(true);
      return;
    }

    setIsInviteModalOpen(true);
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
      console.error("Failed to load client jobs:", err);
      setInviteErrorMsg("Failed to load your open job posts.");
    } finally {
      setLoadingJobs(false);
    }
  };

  // ── Handle Send Invitation ─────────────────────────────────────────────────
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId) {
      setInviteErrorMsg("Please select an open job post to send an invitation.");
      return;
    }

    setSendingInvite(true);
    setInviteErrorMsg("");
    setInviteSuccessMsg("");

    try {
      const selectedJob = clientJobs.find((j) => j.id === selectedJobId);
      const jobTitle = selectedJob?.title || "Job Post";
      const targetName = fullName || "Freelancer";

      const messageText = inviteNote.trim() || `Hi ${targetName}, I saw your profile and would like to invite you to apply for "${jobTitle}".`;

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
        freelancerId: uid,
        freelancerName: targetName,
        message: messageText,
        cover: messageText,
        status: "pending",
        createdAt: serverTimestamp(),
      };

      // 1. Primary: Save exclusively to job_invitations collection
      const inviteRef = await addDoc(collection(firebaseDb, "job_invitations"), invitationPayload);

      // 2. Chat Conversation Creation & Message Send
      try {
        const conversationId = `${selectedJobId}_${uid}`;
        const conversationRef = doc(firebaseDb, "conversations", conversationId);
        const conversationSnap = await getDoc(conversationRef);
        if (!conversationSnap.exists()) {
          await setDoc(conversationRef, {
            jobId: selectedJobId,
            jobTitle,
            clientId: currentUser.uid,
            clientName,
            clientAvatarUrl: clientAvatar,
            freelancerId: uid,
            freelancerName: targetName,
            freelancerAvatarUrl: profile.avatarUrl || "",
            paymentTotalAmountSats: 0,
            paymentStatus: "unfunded",
            createdBy: "client",
            canFreelancerMessage: true,
            unread: {
              [currentUser.uid]: 0,
              [uid]: 1,
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
            [`unread.${uid}`]: increment(1),
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

      // 3. Also record invited freelancer ID on jobs document
      try {
        await updateDoc(doc(firebaseDb, "jobs", selectedJobId), {
          invitedFreelancers: arrayUnion(uid),
        });
      } catch (e) {
        console.warn("jobs update fallback skipped", e);
      }

      // 4. Trigger email / in-app notification to freelancer
      await sendUserNotification({
        userId: uid,
        title: `Job Invitation: ${jobTitle}`,
        body: `${clientName} invited you to apply for "${jobTitle}". Review the details on your proposals dashboard!`,
        url: `/freelancer/dashboard/proposals?tab=invitations`,
      });

      setInviteSuccessMsg(`Invitation sent successfully to ${targetName}!`);
      setTimeout(() => {
        setIsInviteModalOpen(false);
        setInviteNote("");
        setInviteSuccessMsg("");
      }, 2000);
    } catch (err: any) {
      console.error("Failed to send invitation:", err);
      setInviteErrorMsg(err?.message || "Failed to send invitation. Please try again.");
    } finally {
      setSendingInvite(false);
    }
  };

  // ── Load profile by UID from URL ───────────────────────────────────────────
  useEffect(() => {
    if (!uid) { setNotFound(true); setLoading(false); return; }

    const load = async () => {
      try {
        // ── Step 1: Fetch both Firestore docs in parallel ────────────────────
        const [allSnap, freeSnap] = await Promise.all([
          getDoc(doc(firebaseDb, "all_users", uid)),
          getDoc(doc(firebaseDb, "freelancers", uid)),
        ]);

        if (!allSnap.exists() && !freeSnap.exists()) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const a = allSnap.exists() ? (allSnap.data() as Record<string, any>) : {};
        const f = freeSnap.exists() ? (freeSnap.data() as Record<string, any>) : {};

        // ── Member since ─────────────────────────────────────────────────────
        const createdAtRaw = a.createdAt ?? f.createdAt ?? null;
        let memberSince = "";
        if (createdAtRaw) {
          const d = typeof createdAtRaw.toDate === "function" ? createdAtRaw.toDate() : new Date(createdAtRaw);
          memberSince = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        }

        // ── Name — mirrors dashboard exactly ─────────────────────────────────
        const firstName = (f.firstName as string) || (a.firstName as string) || "";
        const lastName  = (f.lastName  as string) || (a.lastName  as string) || "";

        // ── Build the base profile — field-for-field match of dashboard ──────
        const baseProfile = {
          firstName,
          lastName,
          title:           (f.title           as string) ?? "",
          location:        (f.location         as string) ?? "",
          memberSince,
          avatarUrl:       (f.avatarUrl        as string) ?? (a.avatarUrl as string) ?? "",
          verified:        (f.verified         as boolean) ?? false,
          hourlyRate:      (f.hourlyRate        as string) ?? "",
          totalEarned:     "",   // computed from contracts below
          jobSuccess:      0,    // computed from contracts below
          jobsCompleted:   0,    // computed from contracts below
          responseTime:    (f.responseTime      as string) ?? "",
          availability:    (f.availability      as string) ?? "",
          lastActive:      (f.lastActive        as string) ?? "",
          bio:             (f.bio               as string) ?? "",
          skills:          Array.isArray(f.skills)          ? f.skills          : [],
          performanceData: Array.isArray(f.performanceData) ? f.performanceData : [],
          workHistory:     Array.isArray(f.workHistory)     ? f.workHistory     : [],
          portfolioItems:  Array.isArray(f.portfolioItems)  ? f.portfolioItems  : [],
        };

        setProfile((prev) => ({ ...prev, ...baseProfile }));

        // ── Step 2: Fetch contracts — same as dashboard (getDocs, not onSnapshot)
        try {
          const contractsSnap = await getDocs(
            query(collection(firebaseDb, "contracts"), where("freelancerId", "==", uid))
          );

          const formatContractDate = (value: any): string => {
            if (!value) return "";
            const d = typeof value.toDate === "function" ? value.toDate() : new Date(value);
            if (isNaN(d.getTime())) return "";
            return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
          };

          const parseSatsValue = (value: unknown): number => {
            if (typeof value === "number") return value;
            const cleaned = String(value ?? "").replace(/[^0-9]/g, "");
            return cleaned ? Number(cleaned) : 0;
          };

          const isFinished = (data: any) =>
            data.status === "Completed" ||
            data.paymentStatus === "released" ||
            data.workStatus === "approved" ||
            data.workStatus === "completed";

          const isOngoing = (data: any) =>
            !isFinished(data) &&
            (data.paymentStatus === "funded" ||
              Number(data.escrowFundedTotalSats ?? 0) > 0 ||
              data.workStatus === "in_progress" ||
              data.workStatus === "submitted" ||
              data.workStatus === "changes_requested");

          // ── Earnings + completed count ────────────────────────────────────
          let computedTotalEarned = 0;
          let computedJobsCompleted = 0;
          const totalContracts = contractsSnap.docs.length;

          contractsSnap.docs.forEach((d) => {
            const data = d.data() as any;
            if (isFinished(data)) computedJobsCompleted += 1;

            const milestones = Array.isArray(data.milestones) ? data.milestones : [];
            if (milestones.length > 0) {
              milestones.forEach((ms: any) => {
                if (ms.status === "released") {
                  computedTotalEarned += Number(ms.freelancerAmountSats ?? ms.releasedSats ?? 0);
                }
              });
            } else {
              computedTotalEarned += Number(
                data.escrowReleasedSats ??
                data.totalReleasedToFreelancerSats ??
                data.paymentPaidAmountSats ??
                0
              );
            }
          });

          const computedJobSuccess =
            totalContracts > 0
              ? Math.round((computedJobsCompleted / totalContracts) * 100)
              : 0;

          // ── Work history ──────────────────────────────────────────────────
          const workHistoryFromContracts = contractsSnap.docs
            .map((d) => {
              const data = d.data() as any;
              const amountSats =
                typeof data.paymentTotalAmountSats === "number"
                  ? data.paymentTotalAmountSats
                  : parseSatsValue(data.budget);
              const amountLabel = amountSats > 0 ? `${amountSats.toLocaleString()} sats` : data.budget ?? "—";
              const startStr = formatContractDate(data.startDate);
              const endStr = formatContractDate(data.dueDate ?? data.updatedAt);
              const period = startStr && endStr ? `${startStr} – ${endStr}` : startStr || endStr || "";
              const statusLabel = isFinished(data) ? "COMPLETED" : isOngoing(data) ? "ONGOING" : "ACTIVE";
              return {
                title: data.title ?? "Contract",
                amount: amountLabel,
                status: statusLabel,
                rating: typeof data.rating === "number" ? data.rating : 5,
                review: (data.clientReview ?? data.review ?? "") as string,
                period,
              };
            })
            .sort((a, b) => {
              const order: Record<string, number> = { COMPLETED: 0, ONGOING: 1, ACTIVE: 2 };
              return (order[a.status] ?? 3) - (order[b.status] ?? 3);
            });

          setProfile((prev) => ({
            ...prev,
            workHistory: workHistoryFromContracts,
            totalEarned: computedTotalEarned.toLocaleString(),
            jobsCompleted: computedJobsCompleted,
            jobSuccess: computedJobSuccess,
          }));
        } catch (err) {
          console.error("Failed to load work history from contracts:", err);
        }
      } catch (err) {
        console.error("Failed to load public profile:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [uid]);

  // ── derived ────────────────────────────────────────────────────────────────
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Freelancer";
  const initials = [profile.firstName[0], profile.lastName[0]].filter(Boolean).join("").toUpperCase() || "?";

  // ── ledger chart helpers ───────────────────────────────────────────────────
  const maxBar  = profile.performanceData.length ? Math.max(...profile.performanceData) : 1;
  const peakIdx = profile.performanceData.indexOf(maxBar);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FCF9F8] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-[#F7931A] border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="min-h-screen bg-[#FCF9F8] flex items-center justify-center px-4">
        <div className="bg-white rounded-[16px] border border-[#EDEAE5] p-8 text-center max-w-sm">
          <p className="text-[15px] font-bold text-[#1a1a1a] mb-2">Profile not found</p>
          <p className="text-[13px] text-[#999] mb-6">This freelancer profile does not exist or has been removed.</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2.5 rounded-[8px] bg-[#F7931A] text-white text-[12px] font-black uppercase tracking-wide hover:bg-[#E07D0A] transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FCF9F8]">

      {/* ── Page content ──────────────────────────────────────────────── */}
      <div className="px-3 sm:px-5 lg:px-8 py-6 sm:py-8">

        {/* ════════════════════════════════════════════════════════════
            CONTAINER
        ════════════════════════════════════════════════════════════ */}
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-6">

          {/* Back button */}
          <div>
            <button
              onClick={() => router.back()}
              className="group inline-flex items-center gap-2 text-[12px] font-semibold text-[#888] hover:text-[#1a1a1a] transition-colors"
            >
              <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
              Back
            </button>
          </div>

          {/* ────────────────────────────────────────────────────────
              HERO SECTION
              inner div: [DIV-LEFT (avatar+name+stats)] + [DIV-RIGHT (info card)]
          ──────────────────────────────────────────────────────── */}
          <div className="flex flex-col lg:flex-row gap-5">

            {/* DIV-LEFT ─────────────────────────────────────────── */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">

              {/* Avatar + name block */}
              <div className="flex flex-col sm:flex-row items-start gap-4">

                {/* Avatar — read only, no click */}
                <div className="w-[90px] h-[90px] sm:w-[110px] sm:h-[110px] flex-shrink-0 rounded-[12px] overflow-hidden bg-[#E8E2D9] border border-[#DDD8D0]">
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[26px] font-black text-[#8C4F00]">
                      {initials}
                    </div>
                  )}
                </div>

                {/* Name / title / meta */}
                <div className="flex-1 min-w-0">

                  {/* Name row */}
                  <div className="flex items-start gap-2 flex-wrap">
                    <h1 className="text-[26px] sm:text-[34px] lg:text-[40px] font-black text-[#0f0f0f] leading-[1.1] tracking-tight">
                      {fullName}
                    </h1>
                    {profile.verified && (
                      <BadgeCheck size={20} className="flex-shrink-0 mt-1.5 text-[#3B82F6]" />
                    )}
                  </div>

                  {/* Title */}
                  <p className="mt-1 text-[14px] sm:text-[16px] text-[#555] font-medium leading-snug">
                    {profile.title}
                  </p>

                  {/* Location + member since */}
                  <div className="mt-2 flex flex-wrap items-center gap-3 sm:gap-4 text-[10px] sm:text-[11px] text-[#888] font-medium uppercase tracking-[0.08em]">
                    {profile.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={10} />
                        {profile.location}
                      </span>
                    )}
                    {profile.memberSince && (
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        Member since {profile.memberSince}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-3 gap-3 md:mt-[60px]">
                {/* Total Earned */}
                <div className="bg-white rounded-[14px] border border-[#EAE7E2] px-4 py-4 flex flex-col gap-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#B0A89E]">Total Earned</p>
                  <p className="text-[20px] sm:text-[22px] font-black text-[#8C4F00] leading-none tabular-nums">
                    {profile.totalEarned || "0"}
                  </p>
                  <p className="text-[10px] font-semibold text-[#C8A87A]">sats</p>
                </div>

                {/* Job Success */}
                <div className="bg-white rounded-[14px] border border-[#EAE7E2] px-4 py-4 flex flex-col gap-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#B0A89E]">Job Success</p>
                  <div className="flex items-end gap-0.5">
                    <p className="text-[20px] sm:text-[22px] font-black text-[#1a1a1a] leading-none tabular-nums">
                      {profile.jobSuccess}
                    </p>
                    <span className="text-[12px] font-black text-[#999] mb-0.5">%</span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-[3px] w-full bg-[#EAE7E2] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#F7931A] rounded-full transition-all duration-700"
                      style={{ width: `${profile.jobSuccess}%` }}
                    />
                  </div>
                </div>

                {/* Jobs Completed */}
                <div className="bg-white rounded-[14px] border border-[#EAE7E2] px-4 py-4 flex flex-col gap-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#B0A89E]">Completed</p>
                  <p className="text-[20px] sm:text-[22px] font-black text-[#1a1a1a] leading-none tabular-nums">
                    {profile.jobsCompleted}
                  </p>
                  <p className="text-[10px] font-semibold text-[#B0A89E]">contracts</p>
                </div>
              </div>
            </div>
            {/* END DIV-LEFT ─────────────────────────────────────── */}

            {/* DIV-RIGHT — info card ────────────────────────────── */}
            <div className="w-full lg:w-[280px] xl:w-[300px] flex-shrink-0">
              <div className="bg-white rounded-[16px] p-5 sm:p-6 flex flex-col gap-4">

                {/* Hourly Rate */}
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#999] mb-1">Hourly Rate</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[28px] sm:text-[32px] font-black text-[#1a1a1a] tracking-tight leading-none">
                      {profile.hourlyRate || "—"}
                    </span>
                    {profile.hourlyRate && <span className="text-[12px] font-bold text-[#999]">sats/hr</span>}
                  </div>
                </div>

                {/* Hire Now - temporarily disabled */}
                {/* 
                <button className="w-full py-3 rounded-[10px] bg-[#F7931A] hover:bg-[#E07D0A] text-[13px] sm:text-[14px] font-black text-white tracking-wide transition-colors">
                  Hire Now
                </button>
                */}

                {/* Invite to Job */}
                <button
                  onClick={handleOpenInviteModal}
                  className="w-full py-3 rounded-[10px] bg-[#F7931A] hover:bg-[#E07D0A] text-[13px] sm:text-[14px] font-black text-white tracking-wide transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <Send size={15} />
                  Invite to Job
                </button>

                <div className="border-t border-[#F0EDE8]" />

                {/* Meta rows */}
                <div className="flex flex-col gap-2.5">
                  {[
                    { label: "Response Time", value: profile.responseTime },
                    { label: "Availability",   value: profile.availability },
                    { label: "Last Active",    value: profile.lastActive },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <span className="text-[12px] sm:text-[13px] text-[#888]">{label}</span>
                      <span className="text-[12px] sm:text-[13px] font-bold text-[#1a1a1a] text-right">{value || "—"}</span>
                    </div>
                  ))}
                </div>

              </div>
            </div>
            {/* END DIV-RIGHT ────────────────────────────────────── */}

          </div>
          {/* END HERO SECTION ──────────────────────────────────────── */}


          {/* ────────────────────────────────────────────────────────
              BIO / EXPERTISE / CHART SECTION
          ──────────────────────────────────────────────────────── */}
          <div className="flex flex-col lg:flex-row gap-5">

            {/* DIV-1 — Bio + Core Expertise */}
            <div className="w-full lg:flex-1 min-w-0 flex flex-col sm:flex-row gap-6 sm:gap-8">

              {/* Professional Bio */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F7931A] mb-3">
                  Professional Bio
                </p>
                <div className="text-[13px] sm:text-[14px] text-[#444] leading-[1.8] whitespace-pre-line">
                  {profile.bio || <span className="text-[#bbb] italic">No bio provided.</span>}
                </div>
              </div>

              {/* Core Expertise */}
              <div className="w-full sm:w-[220px] flex-shrink-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F7931A] mb-3">
                  Core Expertise
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.length > 0 ? profile.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-2 rounded-[4px] bg-[#E8E5E0] text-[10px] font-black uppercase tracking-[0.1em] text-[#2a2a2a]"
                    >
                      {skill}
                    </span>
                  )) : (
                    <span className="text-[13px] text-[#bbb] italic">No skills listed.</span>
                  )}
                </div>
              </div>

            </div>

            {/* DIV-2 — Ledger Performance chart */}
            <div className="w-full lg:w-[280px] xl:w-[300px] flex-shrink-0">
              <div className="bg-[#1a1a1a] rounded-[14px] p-4 sm:p-5 h-full min-h-[160px] flex flex-col justify-between">

                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#666] mb-3">
                  Ledger Performance
                </p>

                <div className="flex items-end gap-[5px] sm:gap-[6px] h-[60px] sm:h-[70px] relative">
                  {profile.performanceData.length > 0 ? profile.performanceData.map((val, i) => {
                    const isPeak    = i === peakIdx;
                    const heightPct = Math.round((val / maxBar) * 100);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end relative">
                        {isPeak && (
                          <span className="absolute -top-5 text-[7px] font-black uppercase tracking-widest bg-[#F7931A] text-black px-1.5 py-0.5 rounded-[3px] whitespace-nowrap">
                            PEAK
                          </span>
                        )}
                        <div
                          className={`w-full rounded-t-[3px] transition-all ${isPeak ? "bg-[#F7931A]" : "bg-[rgba(247,147,26,0.25)]"}`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                    );
                  }) : (
                    <div className="w-full flex items-center justify-center">
                      <span className="text-[10px] text-[#444]">No data</span>
                    </div>
                  )}
                </div>

                <p className="mt-3 text-[8px] sm:text-[9px] text-[#555] leading-[1.5]">
                  Top 1% Engineering Performance Index. High reliability in mission-critical deployments.
                </p>

              </div>
            </div>

          </div>
          {/* END BIO / EXPERTISE / CHART SECTION ──────────────────── */}


          {/* ────────────────────────────────────────────────────────
              WORK HISTORY SECTION
          ──────────────────────────────────────────────────────── */}
          <div className="lg:w-[70%]">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F7931A]">
                Work History
              </p>
              {profile.workHistory.length > 0 && (
                <p className="text-[11px] sm:text-[12px] text-[#999]">
                  Showing latest {profile.workHistory.length} of {profile.jobsCompleted}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-4">
              {profile.workHistory.length > 0 ? profile.workHistory.map((job, i) => (
                <div key={i} className="bg-white rounded-[12px] border border-[#EDEAE5] px-4 sm:px-6 py-4 sm:py-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <h3 className="text-[14px] sm:text-[15px] font-bold text-[#1a1a1a]">{job.title}</h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[12px] sm:text-[13px] font-semibold text-[#1a1a1a]">{job.amount}</span>
                      <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[#3B82F6] bg-[#EFF6FF] px-2 py-0.5 rounded-full">
                        {job.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mb-2">
                    {[1,2,3,4,5].map((s) => (
                      <svg key={s} width="13" height="13" viewBox="0 0 24 24" fill={s <= job.rating ? "#F7931A" : "#DDD"}>
                        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                      </svg>
                    ))}
                    <span className="ml-1 text-[12px] font-bold text-[#F7931A]">{job.rating.toFixed(1)}</span>
                  </div>
                  {job.review && (
                    <p className="text-[12px] sm:text-[13px] italic text-[#555] leading-[1.6] mb-2">"{job.review}"</p>
                  )}
                  {job.period && <p className="text-[11px] text-[#AAA]">{job.period}</p>}
                </div>
              )) : (
                <p className="text-[13px] text-[#999] italic">No work history yet.</p>
              )}
            </div>
          </div>
          {/* END WORK HISTORY SECTION ──────────────────────────────── */}


          {/* ────────────────────────────────────────────────────────
              PORTFOLIO SECTION
          ──────────────────────────────────────────────────────── */}
          <div className="lg:w-[70%] pb-8">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F7931A] mb-4">
              Portfolio
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profile.portfolioItems.length > 0 ? profile.portfolioItems.map((item) => (
                <div key={item.id} className="rounded-[10px] overflow-hidden bg-[#1a1a1a] relative group">
                  <div className="aspect-[16/10]">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#1a1a1a] to-[#2d1a00] flex items-center justify-center">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(247,147,26,0.4)" strokeWidth="1">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                      </div>
                    )}
                    {(item.title || item.projectLink) && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.title && <p className="text-white text-[12px] font-semibold leading-snug">{item.title}</p>}
                        {item.projectLink && (
                          <a
                            href={item.projectLink}
                            target="_blank"
                            rel="noreferrer noopener"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#F7931A] hover:text-orange-300 transition-colors"
                          >
                            View Project →
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  {item.description && (
                    <div className="px-3 py-2 bg-[#111]">
                      <p className="text-[11px] text-[#999] leading-relaxed line-clamp-2">{item.description}</p>
                    </div>
                  )}
                </div>
              )) : (
                <p className="text-[13px] text-[#999] italic col-span-2">No portfolio items yet.</p>
              )}
            </div>
          </div>
      {/* ── Invite To Job Modal Overlay ────────────────────────────────────── */}
      {isInviteModalOpen && (
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
                    Send a job invitation to <span className="font-bold text-[#1a1a1a]">{fullName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
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
              ) : !isClientUser && currentUser ? (
                <div className="py-6 text-center space-y-4">
                  <p className="text-[14px] text-[#444]">
                    You are currently logged in with a <span className="font-bold text-[#1a1a1a]">Freelancer</span> account.
                  </p>
                  <p className="text-[12px] text-[#888]">
                    Please switch or log in with a Client account to invite freelancers to job posts.
                  </p>
                  <button
                    onClick={() => router.push("/login")}
                    className="px-6 py-2.5 rounded-[10px] bg-[#1a1a1a] text-white text-[13px] font-bold hover:bg-black transition-colors"
                  >
                    Switch to Client Account
                  </button>
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
                            filteredClientJobs.map((job: any) => {
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
                      placeholder={`Hi ${fullName}, I checked out your profile and work history. I'd love to invite you to apply for our project...`}
                      className="w-full px-3.5 py-3 rounded-[10px] bg-[#FCF9F8] border border-[#EDEAE5] text-[13px] text-[#1a1a1a] placeholder-[#AAA] focus:outline-none focus:border-[#F7931A] transition-colors resize-none leading-relaxed"
                    />
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsInviteModalOpen(false)}
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
      </div>
    </div>
  );
}
