"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { LightningConnect, useWalletConnect, type Connection } from "lightningconnect";
import { getAddressFromConnection, useLightningTheme, DARK_THEME, LIGHT_THEME } from "@/components/organisms/LightningAddressModal";
import Image from "next/image";

type Step = 1 | 2 | 3 | 4 | 5 | 6;
const TOTAL_STEPS = 6;

const INDUSTRIES = [
  { name: "Technology", iconBg: "#EFF6FF", iconColor: "#3B82F6", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
  { name: "Finance & Fintech", iconBg: "#ECFDF5", iconColor: "#10B981", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { name: "Blockchain & Bitcoin", iconBg: "#FFF3E0", iconColor: "#F7931A", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
  { name: "E-Commerce", iconBg: "#FDF2F8", iconColor: "#EC4899", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> },
  { name: "Healthcare", iconBg: "#FEF2F2", iconColor: "#EF4444", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> },
  { name: "Education", iconBg: "#FFFBEB", iconColor: "#F59E0B", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
  { name: "Media & Entertainment", iconBg: "#F5F3FF", iconColor: "#8B5CF6", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg> },
  { name: "Marketing & Advertising", iconBg: "#FDF2F8", iconColor: "#EC4899", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
  { name: "Real Estate", iconBg: "#F0FDF4", iconColor: "#22C55E", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { name: "Legal", iconBg: "#EFF6FF", iconColor: "#3B82F6", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
  { name: "Non-Profit", iconBg: "#ECFDF5", iconColor: "#10B981", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
  { name: "Other", iconBg: "#F3F4F6", iconColor: "#6B7280", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg> },
];

const TEAM_SIZES = ["Just me", "2–10", "11–50", "51–200", "201–500", "500+"];

const ROLE_TITLES = [
  "Founder / CEO", "CTO / Tech Lead", "Product Manager", "Hiring Manager",
  "Marketing Manager", "Operations Manager", "Freelancer / Contractor", "Other",
];

// Inline SVG icons
const LightningBoltIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#F7931A" xmlns="http://www.w3.org/2000/svg" style={{ display: "inline", marginLeft: 6, verticalAlign: "middle" }}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9e9690" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const CheckCircleIcon = ({ size = 18, color = "#2E7D32" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const SunIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

export default function ClientOnboardingPage() {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [uid, setUid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [roleTitle, setRoleTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [about, setAbout] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPublicId, setAvatarPublicId] = useState("");

  // Step 4 — Lightning wallet
  const [lightningConnection, setLightningConnection] = useState<Connection | null>(null);
  const { connect: connectWallet, isConnected: walletConnected, walletInfo: walletConnectedInfo, connectionType: walletConnectionType } = useWalletConnect();
  const { isDark: walletIsDark, mode: walletMode, toggle: toggleWalletTheme } = useLightningTheme();

  useEffect(() => {
    if (!walletConnected || !walletConnectedInfo) return;
    const fakeConn = { type: walletConnectionType, address: walletConnectedInfo.address } as any;
    setLightningConnection(fakeConn);
  }, [walletConnected, walletConnectedInfo?.address]);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) { router.replace("/login"); return; }
      setUid(user.uid);
      const snap = await getDoc(doc(firebaseDb, "clients", user.uid));
      const data = snap.exists() ? (snap.data() as any) : {};
      if (data.onboardingComplete) { router.replace("/client/dashboard"); return; }
    });
    return () => unsub();
  }, [router]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uid) return;
    setAvatarUploading(true);
    try {
      const idToken = await firebaseAuth.currentUser?.getIdToken();
      if (!idToken) return;
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/avatar/upload", { method: "POST", headers: { Authorization: `Bearer ${idToken}` }, body: formData });
      const payload = await res.json() as { avatarUrl?: string; avatarPublicId?: string; error?: string };
      if (!res.ok || !payload.avatarUrl) throw new Error(payload.error ?? "Upload failed");
      setAvatarUrl(payload.avatarUrl);
      setAvatarPublicId(payload.avatarPublicId ?? "");
    } catch (err) { console.error("Avatar upload failed:", err); }
    finally { setAvatarUploading(false); e.target.value = ""; }
  };

  const handleFinish = async () => {
    if (!uid) return;
    setSaving(true);
    try {
      const fields = {
        roleTitle, companyName, industry, teamSize, location, website, phone, about,
        ...(avatarUrl ? { avatarUrl, avatarPublicId } : {}),
        ...(lightningConnection
          ? { lightningAddress: getAddressFromConnection(lightningConnection), lightningConnectorType: lightningConnection.type }
          : {}),
        onboardingComplete: true,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(firebaseDb, "clients", uid), fields);
      await updateDoc(doc(firebaseDb, "all_users", uid), {
        ...(avatarUrl ? { avatarUrl, avatarPublicId } : {}),
        ...(lightningConnection
          ? { lightningAddress: getAddressFromConnection(lightningConnection), lightningConnectorType: lightningConnection.type }
          : {}),
        onboardingComplete: true,
        updatedAt: serverTimestamp(),
      });
      router.push("/client/dashboard");
    } catch (err) { console.error("Failed to save onboarding:", err); setSaving(false); }
  };

  const canProceed = () => {
    if (step === 1) return roleTitle.length > 0;
    if (step === 2) return industry.length > 0 && teamSize.length > 0;
    if (step === 5) return about.trim().length > 10;
    return true;
  };

  const next = () => { if (step < TOTAL_STEPS) setStep((s) => (s + 1) as Step); else handleFinish(); };
  const back = () => { if (step > 1) setStep((s) => (s - 1) as Step); };

  const stepTitles: Record<number, { headline: string; subtitle: string }> = {
    1: { headline: "Tell us about yourself", subtitle: "This helps freelancers understand who they're working with." },
    2: { headline: "About your company", subtitle: "Helps freelancers understand your context." },
    3: { headline: "Contact & location", subtitle: "All optional — add what you're comfortable sharing." },
    4: { headline: "Connect your wallet", subtitle: "Add a Lightning wallet to send instant Bitcoin payments to freelancers. You can skip this and add it later." },
    5: { headline: "About your company", subtitle: "Tell freelancers what you do, your goals, and how you like to collaborate." },
    6: { headline: "Add a profile photo", subtitle: "A photo builds trust with freelancers. You can always change it later." },
  };

  const isSkippable = (s: number) => [3, 4, 6].includes(s);

  return (
    <div className="min-h-screen bg-[#F5F0EA] flex flex-col items-center justify-center px-4 py-10">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 overflow-hidden rounded-[12px] bg-[#F7931A] flex items-center justify-center shadow-md shadow-orange-200/60 flex-shrink-0">
          <Image src="/assets/logo.png" alt="Bitlance Logo" width={30} height={30} className="object-contain" />
        </div>
        <p className="text-[17px] font-bold tracking-tight text-[#1a1a1a] leading-none">Bitlance</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-[720px] bg-white rounded-[20px] shadow-[0_4px_24px_rgba(0,0,0,0.07)] border border-[#E8E2D9] overflow-hidden">
        {/* Orange progress bar */}
        <div className="h-1 bg-[#EEE9E2] w-full">
          <div
            className="h-full bg-[#F7931A] transition-all duration-500"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        <div className="px-8 pt-6 pb-8">
        </div>

        <div className="px-8 pt-6 pb-8">
          {/* Step indicator row */}
          <div className="flex items-center justify-between mb-5">
            <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#F7931A]">
              Step {step} of {TOTAL_STEPS}
            </span>
            {isSkippable(step) && (
              <button onClick={next} className="text-[13px] font-medium text-[#9e9690] hover:text-[#555] transition-colors">
                Skip for now
              </button>
            )}
          </div>

          {/* Headline */}
          <h2 className="text-[19px] font-black text-[#1a1a1a] leading-tight mb-1">
            {stepTitles[step].headline}{" "}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#F7931A" style={{ display: "inline", verticalAlign: "middle", marginLeft: 2 }}>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </h2>
          <p className="text-[13px] text-[#888] mb-7 leading-[1.6]">{stepTitles[step].subtitle}</p>

        {/* Step 1 — Role & Company */}
        {step === 1 && (
          <div>
            <div className="mb-5">
              <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#999] mb-2 block">Your Role / Title</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_TITLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setRoleTitle(role)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-[14px] border text-left transition-all ${
                      roleTitle === role
                        ? "border-[#F7931A] bg-[#FFF8F0]"
                        : "border-[#E5E0DA] bg-white hover:border-[#F7931A]/50"
                    }`}
                  >
                    <span className="text-[13px] font-semibold text-[#1a1a1a]">{role}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#999] mb-2 block">
                Company Name <span className="text-[#B0A89E] normal-case font-normal">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C8A87A]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                </span>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Atlas Ventures"
                  className="w-full bg-white border border-[#E5E0DA] rounded-[12px] pl-9 pr-4 py-3 text-[13px] text-[#1a1a1a] focus:border-[#F7931A] focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Industry & Team Size */}
        {step === 2 && (
          <div>
            <div className="mb-5">
              <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#999] mb-2 block">Industry</label>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] md:grid-cols-4 gap-2">
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind.name}
                    type="button"
                    onClick={() => setIndustry(ind.name)}
                    className={`flex items-center gap-1.5 px-2 py-2 sm:gap-2 sm:px-3 sm:py-2.5 rounded-[12px] border text-left transition-all ${
                      industry === ind.name
                        ? "border-[#F7931A] bg-[#FFFAF5]"
                        : "border-[#E8E2D9] bg-white hover:border-[#F7931A]/50"
                    }`}
                  >
                    <span
                      className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-[8px] flex items-center justify-center"
                      style={{ backgroundColor: ind.iconBg, color: ind.iconColor }}
                    >
                      {ind.icon}
                    </span>
                    <span className="text-[10px] sm:text-[12px] font-semibold text-[#1a1a1a] leading-tight">{ind.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#999] mb-2 block">Team Size</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {TEAM_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setTeamSize(size)}
                    className={`px-4 py-3 rounded-[14px] border text-[13px] font-semibold text-[#1a1a1a] transition-all ${
                      teamSize === size
                        ? "border-[#F7931A] bg-[#FFF8F0]"
                        : "border-[#E5E0DA] bg-white hover:border-[#F7931A]/50"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Contact & Location */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#999] mb-2 block">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. New York, USA or Remote"
                className="w-full bg-white border border-[#E5E0DA] rounded-[12px] px-4 py-3 text-[13px] text-[#1a1a1a] focus:border-[#F7931A] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#999] mb-2 block">Website</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourcompany.com"
                className="w-full bg-white border border-[#E5E0DA] rounded-[12px] px-4 py-3 text-[13px] text-[#1a1a1a] focus:border-[#F7931A] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#999] mb-2 block">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 000 0000"
                className="w-full bg-white border border-[#E5E0DA] rounded-[12px] px-4 py-3 text-[13px] text-[#1a1a1a] focus:border-[#F7931A] focus:outline-none transition-colors"
              />
            </div>
          </div>
        )}

        {/* Step 4 — Connect Wallet */}
        {step === 4 && (
          <div>
            <LightningConnect 
              theme={DARK_THEME} 
              lightTheme={LIGHT_THEME} 
              defaultMode={walletMode} 
            />

            {lightningConnection ? (
              <div className="flex flex-col items-center gap-4 mt-4">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[#2E7D32]">
                  <CheckCircleIcon size={18} color="#2E7D32" />
                  Wallet connected: {getAddressFromConnection(lightningConnection)}
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={connectWallet} className="text-[11px] font-semibold text-[#F7931A] hover:underline">
                    Change wallet
                  </button>
                  <button
                    type="button"
                    onClick={toggleWalletTheme}
                    title={walletIsDark ? "Switch to light mode" : "Switch to dark mode"}
                    className="w-7 h-7 rounded-full border border-[#EAE7E2] bg-white flex items-center justify-center text-[#888] hover:border-[#F7931A] hover:text-[#F7931A] transition-all"
                  >
                    {walletIsDark ? <SunIcon /> : <MoonIcon />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={connectWallet}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#F7931A] hover:bg-[#e0840f] text-white text-[13px] font-black transition-all"
                >
                  <span>⚡</span> Connect Wallet
                </button>
                <button
                  type="button"
                  onClick={toggleWalletTheme}
                  title={walletIsDark ? "Switch to light mode" : "Switch to dark mode"}
                  className="w-10 h-10 rounded-full border border-[#EAE7E2] bg-white flex items-center justify-center text-[#888] hover:border-[#F7931A] hover:text-[#F7931A] transition-all"
                >
                  {walletIsDark ? <SunIcon /> : <MoonIcon />}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 5 — About */}
        {step === 5 && (
          <div>
            <textarea
              rows={7}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="We're a fintech startup building Bitcoin payment infrastructure. We value clear communication, fast iteration, and long-term partnerships..."
              className="w-full bg-white border border-[#E5E0DA] rounded-[12px] px-4 py-3 text-[13px] text-[#1a1a1a] focus:border-[#F7931A] focus:outline-none transition-colors resize-none"
            />
            <p className="text-[10px] text-[#B0A89E] mt-1 text-right">{about.length} chars</p>
          </div>
        )}

        {/* Step 6 — Photo */}
        {step === 6 && (
          <div>
            <div className="flex flex-col items-center gap-5">
              <div
                onClick={() => !avatarUploading && avatarInputRef.current?.click()}
                className="w-[120px] h-[120px] rounded-full overflow-hidden bg-[#E8E2D9] border-2 border-dashed border-[#C8A87A] cursor-pointer relative group flex items-center justify-center"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-[#C8A87A]">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span className="text-[10px] font-bold uppercase tracking-wide">Upload</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/30 hidden group-hover:flex items-center justify-center rounded-full">
                  {avatarUploading
                    ? <Loader2 size={20} className="text-white animate-spin" />
                    : <span className="text-white text-[10px] font-bold uppercase">Change</span>
                  }
                </div>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarChange} />
              <p className="text-[11px] text-[#B0A89E] text-center">JPG, PNG or WEBP · Max 2MB</p>
              {avatarUrl && (
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#2E7D32]">
                  <CheckCircleIcon size={14} color="#2E7D32" /> Photo uploaded successfully
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom bar */}
        <div className="border-t border-[#EEE9E2] mt-8 pt-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={back}
              className={`flex items-center gap-1.5 text-[13px] font-medium text-[#888] hover:text-[#1a1a1a] transition-colors ${step === 1 ? "invisible" : ""}`}
            >
              <ArrowLeftIcon /> Back
            </button>
            {/* <div className="flex items-center gap-1.5">
              <ShieldIcon />
              <span className="text-[12px] text-[#9e9690]">Secure. Private. Bitcoin-powered.</span>
            </div> */}
          </div>
          <button
            type="button"
            onClick={next}
            disabled={!canProceed() || saving || avatarUploading}
            className="flex items-center gap-2 bg-[#F7931A] hover:bg-[#e0840f] disabled:bg-[#F7931A]/40 text-white font-bold text-[14px] px-7 py-3 rounded-full transition-all"
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Saving...</>
            ) : step === TOTAL_STEPS ? (
              <>Go to Dashboard <ArrowRightIcon /></>
            ) : (
              <>Continue <ArrowRightIcon /></>
            )}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
