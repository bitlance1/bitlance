"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase";

type ClientProfile = {
  fullName: string;
  companyName: string;
  companyLogo: string;
  location: string;
  memberSinceFormatted: string;
  bio: string;
  jobsPosted: number;
  hires: number;
  totalSpentSats: number;
  website: string;
  industry: string;
};

const EMPTY_PROFILE: ClientProfile = {
  fullName: "",
  companyName: "",
  companyLogo: "",
  location: "",
  memberSinceFormatted: "",
  bio: "",
  jobsPosted: 0,
  hires: 0,
  totalSpentSats: 0,
  website: "",
  industry: "",
};

const parseSats = (value: unknown): number => {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "").replace(/[^0-9.]/g, "");
  return cleaned ? Number(cleaned) : 0;
};

const formatSats = (sats: number): string => {
  if (sats === 0) return "—";
  if (sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(2)}M sats`;
  if (sats >= 1_000) return `${(sats / 1_000).toFixed(1)}K sats`;
  return `${sats.toLocaleString()} sats`;
};

export default function ClientPublicProfilePage() {
  const params = useParams<{ uid: string }>();
  const uid = params?.uid ?? "";
  const router = useRouter();

  const [profile, setProfile] = useState<ClientProfile>(EMPTY_PROFILE);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!uid) {
      setErrorMessage("Client ID is missing.");
      setIsLoading(false);
      return;
    }

    const load = async () => {
      try {
        const [allUsersSnap, clientSnap, jobsSnap, contractsSnap] = await Promise.all([
          getDoc(doc(firebaseDb, "all_users", uid)),
          getDoc(doc(firebaseDb, "clients", uid)),
          getDocs(query(collection(firebaseDb, "jobs"), where("clientId", "==", uid))),
          getDocs(query(collection(firebaseDb, "contracts"), where("clientId", "==", uid))),
        ]);

        if (!allUsersSnap.exists() && !clientSnap.exists()) {
          setErrorMessage("This client profile does not exist or has been removed.");
          return;
        }

        const a = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
        const c = clientSnap.exists() ? (clientSnap.data() as any) : {};

        // Member since
        const createdAtRaw = a.createdAt ?? c.createdAt ?? null;
        let memberSinceFormatted = "";
        if (createdAtRaw) {
          const date =
            typeof createdAtRaw.toDate === "function"
              ? createdAtRaw.toDate()
              : new Date(createdAtRaw);
          memberSinceFormatted = `Member since ${date.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}`;
        }

        // Spend from contracts
        const totalSpentSats = contractsSnap.docs.reduce((sum, d) => {
          const data = d.data() as any;
          return (
            sum +
            parseSats(
              data.paymentTotalAmountSats ??
                data.escrowReleasedSats ??
                data.budget ??
                0
            )
          );
        }, 0);

        setProfile({
          fullName: c.fullName ?? a.fullName ?? a.name ?? "",
          companyName: c.companyName ?? c.company ?? a.companyName ?? "",
          companyLogo:
            c.companyLogo ??
            c.companyLogoUrl ??
            a.companyLogo ??
            a.companyLogoUrl ??
            "",
          location: c.location ?? a.location ?? "Remote",
          memberSinceFormatted,
          bio: c.bio ?? a.bio ?? "",
          jobsPosted: jobsSnap.size,
          hires: contractsSnap.size,
          totalSpentSats,
          website: c.website ?? a.website ?? "",
          industry: c.industry ?? a.industry ?? "",
        });
      } catch (err: any) {
        setErrorMessage(`Error: ${err?.message ?? "Unable to load profile"}`);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [uid]);

  const displayName = profile.companyName || profile.fullName || "Client";

  const initials = useMemo(() => {
    return displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p: string) => p[0]?.toUpperCase())
      .join("");
  }, [displayName]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F6F3] text-[12px] text-[#6b6762]">
        Loading profile...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F6F3] px-4">
        <div className="rounded-[16px] border border-[#EAE7E2] bg-white p-8 text-center max-w-md">
          <div className="mb-4 text-[#8C4F00] font-bold">Profile Unavailable</div>
          <p className="text-[13px] text-[#999] mb-6">{errorMessage}</p>
          <button
            onClick={() => router.back()}
            className="inline-block px-6 py-2 bg-[#1a1a1a] text-white text-[12px] font-bold rounded-full uppercase tracking-widest"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F6F3] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Back Button */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[12px] font-bold text-[#8C4F00] shadow-sm transition-all hover:bg-[#8C4F00] hover:text-white border border-[#EAE7E2]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform group-hover:-translate-x-1"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Go Back
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Main Column */}
          <div className="flex-1 w-full">
            {/* Header */}
            <div className="flex items-start gap-4 mb-10">
              <div className="h-24 w-24 overflow-hidden rounded-[16px] border border-[#EAE7E2] bg-[#F1ECE5] flex-shrink-0">
                {profile.companyLogo ? (
                  <img
                    src={profile.companyLogo}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-[#8C4F00] font-bold text-2xl">
                    {initials}
                  </div>
                )}
              </div>
              <div className="pt-2">
                <h1 className="text-[28px] font-bold text-[#1a1a1a] tracking-tight">
                  {displayName}
                </h1>
                {profile.fullName && profile.companyName && (
                  <div className="text-[14px] text-[#6b6762] mt-1">{profile.fullName}</div>
                )}
                {profile.industry && (
                  <div className="text-[14px] font-medium text-[#1a1a1a] mt-1">
                    {profile.industry}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-4 mt-2 text-[12px] text-[#999]">
                  {profile.location && (
                    <span className="flex items-center gap-1">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {profile.location}
                    </span>
                  )}
                  {profile.memberSinceFormatted && (
                    <span className="flex items-center gap-1">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {profile.memberSinceFormatted}
                    </span>
                  )}
                  {profile.website && (
                    <a
                      href={
                        profile.website.startsWith("http")
                          ? profile.website
                          : `https://${profile.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[#CC7000] hover:underline"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                      {profile.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-0 mb-12 rounded-[12px] border border-[#E0DDD8] bg-[#F1F0ED] overflow-hidden">
              {[
                { label: "Jobs Posted", value: profile.jobsPosted },
                { label: "Hires", value: profile.hires },
                { label: "Total Spent", value: formatSats(profile.totalSpentSats) },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className={`py-4 px-2 text-center ${i !== 2 ? "border-r border-[#E0DDD8]" : ""}`}
                >
                  <div className="text-[9px] uppercase tracking-[0.1em] text-[#999] mb-1 font-bold">
                    {stat.label}
                  </div>
                  <div className="text-[18px] font-bold text-[#1a1a1a]">{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Bio */}
            {profile.bio && (
              <div className="border-t border-[#EAE7E2] pt-8 mb-12">
                <div className="mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#E8921A]">
                    About
                  </span>
                </div>
                <p className="text-[13px] leading-[1.8] text-[#555] whitespace-pre-wrap">
                  {profile.bio}
                </p>
              </div>
            )}

            {/* Recent Jobs */}
            <div className="border-t border-[#EAE7E2] pt-8">
              <div className="mb-6">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#E8921A]">
                  Job History
                </span>
              </div>
              <div className="text-[13px] text-[#999] italic">
                {profile.jobsPosted === 0
                  ? "No jobs posted yet."
                  : `${profile.jobsPosted} job${profile.jobsPosted === 1 ? "" : "s"} posted on Bitlance.`}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[300px] space-y-4 flex-shrink-0">
            <div className="rounded-[16px] border border-[#EAE7E2] bg-white p-6 shadow-sm space-y-5">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#999] mb-1">
                  Total Spent
                </div>
                <div className="text-[22px] font-bold text-[#1a1a1a]">
                  {formatSats(profile.totalSpentSats)}
                </div>
              </div>

              <div className="border-t border-[#EAE7E2] pt-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#999] mb-1">
                    Jobs Posted
                  </div>
                  <div className="text-[16px] font-bold text-[#1a1a1a]">{profile.jobsPosted}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#999] mb-1">
                    Hires
                  </div>
                  <div className="text-[16px] font-bold text-[#1a1a1a]">{profile.hires}</div>
                </div>
              </div>

              {profile.location && (
                <div className="border-t border-[#EAE7E2] pt-4">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#999] mb-1">
                    Location
                  </div>
                  <div className="text-[13px] text-[#555]">{profile.location}</div>
                </div>
              )}

              {profile.memberSinceFormatted && (
                <div className="border-t border-[#EAE7E2] pt-4">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#999] mb-1">
                    Member Since
                  </div>
                  <div className="text-[13px] text-[#555]">
                    {profile.memberSinceFormatted.replace("Member since ", "")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
