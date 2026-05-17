"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Freelancer Public Profile Page
// Reads from : freelancers/{uid}  +  all_users/{uid}
// No editing — read-only view for clients and visitors
// ─────────────────────────────────────────────────────────────────────────────

import { useParams, useRouter } from "next/navigation";
import { MapPin, Calendar, BadgeCheck, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { firebaseDb } from "@/lib/firebase";
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore";

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
    hoursWorked: 0,
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
    }>,
  });

  // ── Load profile by UID from URL ───────────────────────────────────────────
  useEffect(() => {
    if (!uid) { setNotFound(true); setLoading(false); return; }

    const load = async () => {
      try {
        const [allSnap, freeSnap] = await Promise.all([
          getDoc(doc(firebaseDb, "all_users", uid)),
          getDoc(doc(firebaseDb, "freelancers", uid)),
        ]);

        if (!allSnap.exists() && !freeSnap.exists()) {
          setNotFound(true);
          return;
        }

        const a = allSnap.exists() ? (allSnap.data() as Record<string, any>) : {};
        const f = freeSnap.exists() ? (freeSnap.data() as Record<string, any>) : {};

        // Member since
        const createdAtRaw = a.createdAt ?? f.createdAt ?? null;
        let memberSince = "";
        if (createdAtRaw) {
          const d = typeof createdAtRaw.toDate === "function" ? createdAtRaw.toDate() : new Date(createdAtRaw);
          memberSince = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        }

        // Name
        const firstName = (f.firstName as string) || (a.firstName as string) || "";
        const lastName  = (f.lastName  as string) || (a.lastName  as string) || "";

        setProfile({
          firstName,
          lastName,
          title:           (f.title           as string) ?? "",
          location:        (f.location         as string) ?? "",
          memberSince,
          avatarUrl:       (f.avatarUrl        as string) ?? (a.avatarUrl as string) ?? "",
          verified:        (f.verified         as boolean) ?? false,
          hourlyRate:      (f.hourlyRate        as string) ?? "",
          totalEarned:     (f.totalEarned       as string) ?? "",
          jobSuccess:      typeof f.jobSuccess  === "number" ? f.jobSuccess  : 0,
          jobsCompleted:   typeof f.jobsCompleted === "number" ? f.jobsCompleted : 0,
          hoursWorked:     typeof f.hoursWorked === "number" ? f.hoursWorked : 0,
          responseTime:    (f.responseTime      as string) ?? "",
          availability:    (f.availability      as string) ?? "",
          lastActive:      (f.lastActive        as string) ?? "",
          bio:             (f.bio               as string) ?? "",
          skills:          Array.isArray(f.skills)          ? f.skills          : [],
          performanceData: Array.isArray(f.performanceData) ? f.performanceData : [],
          workHistory:     Array.isArray(f.workHistory)     ? f.workHistory     : [],
          portfolioItems:  Array.isArray(f.portfolioItems)  ? f.portfolioItems  : [],
        });

        // ── Load work history from contracts ─────────────────────────────
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
              const statusLabel = isFinished(data)
                ? "COMPLETED"
                : isOngoing(data)
                  ? "ONGOING"
                  : "ACTIVE";
              return {
                title: data.title ?? "Contract",
                amount: amountLabel,
                status: statusLabel,
                rating: typeof data.rating === "number" ? data.rating : 5,
                review: data.clientReview ?? data.review ?? "",
                period,
              };
            })
            .sort((a) => (a.status === "COMPLETED" ? -1 : 1));

          setProfile((prev) => ({ ...prev, workHistory: workHistoryFromContracts }));
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

              {/* Stats bar */}
              <div className="bg-[#EDEAE5] rounded-[12px] px-4 md:mt-[60px] sm:px-6 py-4 sm:py-5 flex flex-wrap gap-x-6 sm:gap-x-10 gap-y-3">

                <div className="md:w-[150px]">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#999] mb-1">Total Earned</p>
                  <p className="text-[16px] sm:text-[18px] font-black text-[#8C4F00] leading-none">
                    {profile.totalEarned || "—"}
                    {profile.totalEarned && <span className="text-[11px] font-bold ml-1">Sats</span>}
                  </p>
                </div>

                <div className="md:w-[150px]">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#999] mb-1">Job Success</p>
                  <p className="text-[16px] sm:text-[18px] font-black text-[#1a1a1a] leading-none">
                    {profile.jobSuccess}<span className="text-[11px] font-bold ml-0.5">%</span>
                  </p>
                </div>

                <div className="md:w-[150px]">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#999] mb-1">Jobs Completed</p>
                  <p className="text-[16px] sm:text-[18px] font-black text-[#1a1a1a] leading-none">
                    {profile.jobsCompleted}
                  </p>
                </div>

                <div className="md:w-[150px]">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#999] mb-1">Hours Worked</p>
                  <p className="text-[16px] sm:text-[18px] font-black text-[#1a1a1a] leading-none">
                    {profile.hoursWorked.toLocaleString()}
                  </p>
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

                {/* Hire Now */}
                <button className="w-full py-3 rounded-[10px] bg-[#F7931A] hover:bg-[#E07D0A] text-[13px] sm:text-[14px] font-black text-white tracking-wide transition-colors">
                  Hire Now
                </button>

                {/* Invite to Job */}
                <button className="w-full py-3 rounded-[10px] bg-[#EDEAE5] hover:bg-[#E0DDD8] text-[13px] sm:text-[14px] font-black text-[#1a1a1a] tracking-wide transition-colors border border-[#DDD8D0]">
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
                <div key={item.id} className="aspect-[16/10] rounded-[10px] overflow-hidden bg-[#1a1a1a] relative group">
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
                  {item.title && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-[12px] font-semibold">{item.title}</p>
                    </div>
                  )}
                </div>
              )) : (
                <p className="text-[13px] text-[#999] italic col-span-2">No portfolio items yet.</p>
              )}
            </div>
          </div>
          {/* END PORTFOLIO SECTION ─────────────────────────────────── */}

        </div>
        {/* END CONTAINER ─────────────────────────────────────────────── */}

      </div>
    </div>
  );
}
