"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Loader2 } from "lucide-react";
// Removed direct LightningConnect imports; using LightningWalletButton component for wallet handling
import { getAddressFromConnection, useLightningTheme, LightningWalletButton } from "@/components/organisms/LightningAddressModal";
import Image from "next/image";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;
const TOTAL_STEPS = 7;

const CATEGORIES = [
  { name: "Web Development", iconBg: "#FFF3E0", iconColor: "#F7931A", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
  { name: "Mobile Development", iconBg: "#EFF6FF", iconColor: "#3B82F6", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> },
  { name: "UI / UX Design", iconBg: "#F5F3FF", iconColor: "#8B5CF6", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg> },
  { name: "Graphic Design", iconBg: "#FEF2F2", iconColor: "#EF4444", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg> },
  { name: "Writing & Content", iconBg: "#FFFBEB", iconColor: "#F59E0B", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
  { name: "Video & Animation", iconBg: "#EFF6FF", iconColor: "#3B82F6", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg> },
  { name: "Marketing & SEO", iconBg: "#FDF2F8", iconColor: "#EC4899", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
  { name: "Data Science & AI", iconBg: "#ECFDF5", iconColor: "#10B981", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg> },
  { name: "Blockchain & Bitcoin", iconBg: "#FFF3E0", iconColor: "#F7931A", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="13" y1="2" x2="13" y2="6"/><line x1="13" y1="18" x2="13" y2="22"/><path d="M17 7H9.5a3.5 3.5 0 0 0 0 7H15a3.5 3.5 0 0 1 0 7H6"/><line x1="9" y1="2" x2="9" y2="6"/><line x1="9" y1="18" x2="9" y2="22"/></svg> },
  { name: "DevOps & Cloud", iconBg: "#F0FDF4", iconColor: "#22C55E", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> },
  { name: "Finance & Accounting", iconBg: "#FFF7ED", iconColor: "#EA580C", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { name: "Other", iconBg: "#F3F4F6", iconColor: "#6B7280", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg> },
];

const SKILL_SUGGESTIONS: Record<string, string[]> = {
  "Web Development": ["React", "Next.js", "TypeScript", "Node.js", "Tailwind CSS", "PostgreSQL", "GraphQL"],
  "Mobile Development": ["React Native", "Flutter", "Swift", "Kotlin", "Expo"],
  "UI / UX Design": ["Figma", "Sketch", "Prototyping", "User Research", "Wireframing"],
  "Graphic Design": ["Illustrator", "Photoshop", "Branding", "Logo Design", "Print Design"],
  "Writing & Content": ["Copywriting", "SEO Writing", "Technical Writing", "Ghostwriting", "Editing"],
  "Video & Animation": ["After Effects", "Premiere Pro", "Motion Graphics", "3D Animation"],
  "Data Science & AI": ["Python", "TensorFlow", "Machine Learning", "SQL", "Data Visualization"],
  "Blockchain & Bitcoin": ["Solidity", "Lightning Network", "Bitcoin Script", "Web3.js", "Smart Contracts"],
  "DevOps & Cloud": ["AWS", "Docker", "Kubernetes", "CI/CD", "Terraform"],
  "Marketing & SEO": ["Google Ads", "SEO", "Social Media", "Email Marketing", "Analytics"],
  "Finance & Accounting": ["Bookkeeping", "Tax Preparation", "Financial Modeling", "QuickBooks"],
  "Other": [],
};

const EXPERIENCE_LEVELS = [
  { value: "entry", label: "Entry Level", desc: "I'm relatively new to this field and building my experience." },
  { value: "intermediate", label: "Intermediate", desc: "I have solid experience and have completed several projects." },
  { value: "expert", label: "Expert", desc: "I have extensive experience and deep expertise in my field." },
];

const AVAILABILITY_OPTIONS = ["Available", "Full Time", "Part Time", "Busy / Booked"];
const RESPONSE_TIME_OPTIONS = ["Within an hour", "Within a few hours", "Within a day", "Asynchronous"];

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

export default function FreelancerOnboardingPage() {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [uid, setUid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [bio, setBio] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [location, setLocation] = useState("");
  const [availability, setAvailability] = useState("Available");
  const [responseTime, setResponseTime] = useState("Within a few hours");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPublicId, setAvatarPublicId] = useState("");

  const [lightningAddress, setLightningAddress] = useState("");
  const [lightningConnectorType, setLightningConnectorType] = useState("");

  // Lightning wallet UI and handling via LightningWalletButton component
  useEffect(() => {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('lightningconnect')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.error('Failed to clear LightningConnect storage:', e);
    }
  }, []);

  const handleLightningModalSave = (address: string, connectorType: string) => {
    setLightningAddress(address);
    setLightningConnectorType(connectorType);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) { router.replace("/login"); return; }
      setUid(user.uid);
      const snap = await getDoc(doc(firebaseDb, "freelancers", user.uid));
      const data = snap.exists() ? (snap.data() as any) : {};
      if (data.onboardingComplete) { router.replace("/freelancer/dashboard"); return; }
    });
    return () => unsub();
  }, [router]);

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !skills.includes(trimmed) && skills.length < 15) setSkills((prev) => [...prev, trimmed]);
    setSkillInput("");
  };
  const removeSkill = (skill: string) => setSkills((prev) => prev.filter((s) => s !== skill));
  const suggestions = category ? (SKILL_SUGGESTIONS[category] ?? []).filter((s) => !skills.includes(s)) : [];

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
          title, category, skills, experienceLevel, bio, hourlyRate, location, availability, responseTime,
          ...(avatarUrl ? { avatarUrl, avatarPublicId } : {}),
          // Store address at top level (legacy)
          ...(lightningAddress ? { lightningAddress, lightningConnectorType } : {}),
          // Also store inside nested settings.payment for settings page & contracts
          ...(lightningAddress ? { settings: { payment: { lightningAddress, lightningConnectorType } } } : {}),
          onboardingComplete: true,
          updatedAt: serverTimestamp(),
        };
      await updateDoc(doc(firebaseDb, "freelancers", uid), fields);
        await updateDoc(doc(firebaseDb, "all_users", uid), {
          ...(avatarUrl ? { avatarUrl, avatarPublicId } : {}),
          // Store top‑level legacy fields
          ...(lightningAddress ? { lightningAddress, lightningConnectorType } : {}),
          // Also store nested settings.payment
          ...(lightningAddress ? { settings: { payment: { lightningAddress, lightningConnectorType } } } : {}),
          onboardingComplete: true,
          updatedAt: serverTimestamp(),
        });
      router.push("/freelancer/dashboard");
    } catch (err) { console.error("Failed to save onboarding:", err); setSaving(false); }
  };

  const canProceed = () => {
    if (step === 1) return title.trim().length > 0 && category.length > 0;
    if (step === 2) return skills.length > 0;
    if (step === 3) return experienceLevel.length > 0;
    if (step === 4) return bio.trim().length > 10;
    return true;
  };

  const next = () => { if (step < TOTAL_STEPS) setStep((s) => (s + 1) as Step); else handleFinish(); };
  const back = () => { if (step > 1) setStep((s) => (s - 1) as Step); };

  const stepTitles: Record<number, { headline: string; subtitle: string }> = {
    1: { headline: "What's your main expertise?", subtitle: "This helps clients find you for the right jobs." },
    2: { headline: "What are your top skills?", subtitle: "Add up to 15 skills. These appear on your profile." },
    3: { headline: "What's your experience level?", subtitle: "This helps set client expectations." },
    4: { headline: "Tell clients about yourself", subtitle: "A strong bio and clear rate attract the right clients." },
    5: { headline: "Where are you & how do you work?", subtitle: "Clients use this to find the right fit." },
    6: { headline: "Connect your wallet", subtitle: "Add a Lightning wallet to receive instant Bitcoin payments. You can skip this and add it later." },
    7: { headline: "Add a profile photo", subtitle: "Profiles with photos get significantly more views. You can always change it later." },
  };

  const isSkippable = (s: number) => [3, 4, 5, 6, 7].includes(s);

  return (
    <div className="min-h-screen bg-[#F5F0EA] flex flex-col items-center justify-center px-4 py-10">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 overflow-hidden rounded-[12px] bg-[#F7931A] flex items-center justify-center shadow-md shadow-orange-200/60 flex-shrink-0">
          <Image src="/assets/logo.png" alt="Bitlance Logo" width={30} height={30} className="object-contain" />
        </div>
        <p className="text-[17px] font-bold tracking-tight text-[#1a1a1a] leading-none">Bitlance</p>
      </div>

      <div className="w-full max-w-[720px] bg-white rounded-[20px] shadow-[0_4px_24px_rgba(0,0,0,0.07)] border border-[#E8E2D9] overflow-hidden">
        <div className="h-1 bg-[#EEE9E2] w-full">
          <div
            className="h-full bg-[#F7931A] transition-all duration-500"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        <div className="px-8 pt-6 pb-8">
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

          <h2 className="text-[19px] font-black text-[#1a1a1a] leading-tight mb-1">
            {stepTitles[step].headline}{" "}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#F7931A" style={{ display: "inline", verticalAlign: "middle", marginLeft: 2 }}>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </h2>
          <p className="text-[13px] text-[#888] mb-7 leading-[1.6]">{stepTitles[step].subtitle}</p>

        {step === 1 && (
          <div>
            <div className="mb-6">
              <p className="text-[14px] font-bold text-[#1a1a1a] mb-0.5">What should clients hire you for?</p>
              <p className="text-[12px] text-[#9e9690] mb-3">Add a short, clear title that describes what you do best.</p>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C8A87A]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                </span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Frontend Developer"
                  className="w-full bg-white border border-[#E5E0DA] rounded-[12px] pl-10 pr-4 py-3 text-[13px] text-[#1a1a1a] focus:border-[#F7931A] focus:outline-none transition-colors"
                />
              </div>
            </div>
            <div>
              <p className="text-[14px] font-bold text-[#1a1a1a] mb-0.5">Choose your primary skill area</p>
              <p className="text-[12px] text-[#9e9690] mb-3">Select the category that best represents your expertise.</p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] md:grid-cols-4 gap-2">
                {CATEGORIES.slice(0, 8).map((cat) => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setCategory(cat.name)}
                    className={`flex items-center gap-1.5 px-2 py-2 sm:gap-2 sm:px-3 sm:py-2.5 rounded-[12px] border text-left transition-all ${
                      category === cat.name
                        ? "border-[#F7931A] bg-[#FFFAF5]"
                        : "border-[#E8E2D9] bg-white hover:border-[#F7931A]/50"
                    }`}
                  >
                    <span
                      className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-[8px] flex items-center justify-center"
                      style={{ backgroundColor: cat.iconBg, color: cat.iconColor }}
                    >
                      {cat.icon}
                    </span>
                    <span className="text-[10px] sm:text-[12px] font-semibold text-[#1a1a1a] leading-tight">{cat.name}</span>
                  </button>
                ))}
              </div>
              {CATEGORIES.length > 8 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] md:grid-cols-4 gap-2 mt-2">
                  {CATEGORIES.slice(8).map((cat) => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setCategory(cat.name)}
                      className={`flex items-center gap-1.5 px-2 py-2 sm:gap-2 sm:px-3 sm:py-2.5 rounded-[12px] border text-left transition-all ${
                        category === cat.name
                          ? "border-[#F7931A] bg-[#FFFAF5]"
                          : "border-[#E8E2D9] bg-white hover:border-[#F7931A]/50"
                      }`}
                    >
                      <span
                        className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-[8px] flex items-center justify-center"
                        style={{ backgroundColor: cat.iconBg, color: cat.iconColor }}
                      >
                        {cat.icon}
                      </span>
                      <span className="text-[10px] sm:text-[12px] font-semibold text-[#1a1a1a] leading-tight">{cat.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(skillInput); } }}
                placeholder="Type a skill and press Enter"
                className="flex-1 bg-white border border-[#E5E0DA] rounded-[12px] px-4 py-3 text-[13px] text-[#1a1a1a] focus:border-[#F7931A] focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => addSkill(skillInput)}
                className="px-4 py-3 rounded-[12px] bg-[#F7931A] text-white text-[12px] font-black hover:bg-[#e0840f] transition-colors"
              >
                Add
              </button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {skills.map((skill) => (
                  <span key={skill} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF3E0] border border-[#F7931A]/30 text-[11px] font-bold text-[#8C4F00]">
                    {skill}
                    <button type="button" onClick={() => removeSkill(skill)} className="text-[#C8A87A] hover:text-[#8C4F00]">×</button>
                  </span>
                ))}
              </div>
            )}
            {suggestions.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#999] mb-2">Suggested for {category}</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addSkill(s)}
                      className="px-3 py-1.5 rounded-full bg-white border border-[#E5E0DA] text-[11px] font-semibold text-[#555] hover:border-[#F7931A] hover:text-[#8C4F00] transition-all"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            {EXPERIENCE_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => setExperienceLevel(level.value)}
                className={`text-left px-5 py-4 rounded-[14px] border-2 transition-all ${
                  experienceLevel === level.value
                    ? "border-[#F7931A] bg-[#FFF8F0]"
                    : "border-[#E5E0DA] bg-white hover:border-[#F7931A]/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-black text-[#1a1a1a]">{level.label}</span>
                  {experienceLevel === level.value && <CheckCircleIcon size={18} color="#F7931A" />}
                </div>
                <p className="text-[12px] text-[#888] mt-1">{level.desc}</p>
              </button>
            ))}
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="mb-5">
              <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#999] mb-2 block">Professional Bio</label>
              <textarea
                rows={5}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe your background, what you do best, and how you work with clients..."
                className="w-full bg-white border border-[#E5E0DA] rounded-[12px] px-4 py-3 text-[13px] text-[#1a1a1a] focus:border-[#F7931A] focus:outline-none transition-colors resize-none"
              />
              <p className="text-[10px] text-[#B0A89E] mt-1 text-right">{bio.length} chars</p>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#999] mb-2 block">Hourly Rate (sats/hr)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="e.g. 5000"
                  min={0}
                  className="w-40 bg-white border border-[#E5E0DA] rounded-[12px] px-4 py-3 text-[13px] text-[#1a1a1a] focus:border-[#F7931A] focus:outline-none transition-colors"
                />
                <span className="text-[12px] font-bold text-[#B0A89E]">sats / hr</span>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <div className="mb-5">
              <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#999] mb-2 block">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Lagos, Nigeria or Remote"
                className="w-full bg-white border border-[#E5E0DA] rounded-[12px] px-4 py-3 text-[13px] text-[#1a1a1a] focus:border-[#F7931A] focus:outline-none transition-colors"
              />
            </div>
            <div className="mb-5">
              <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#999] mb-2 block">Availability</label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABILITY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAvailability(opt)}
                    className={`px-4 py-3 rounded-[14px] border text-[13px] font-semibold text-[#1a1a1a] transition-all ${
                      availability === opt
                        ? "border-[#F7931A] bg-[#FFF8F0]"
                        : "border-[#E5E0DA] bg-white hover:border-[#F7931A]/50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#999] mb-2 block">Response Time</label>
              <div className="grid grid-cols-2 gap-2">
                {RESPONSE_TIME_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setResponseTime(opt)}
                    className={`px-4 py-3 rounded-[14px] border text-[13px] font-semibold text-[#1a1a1a] transition-all ${
                      responseTime === opt
                        ? "border-[#F7931A] bg-[#FFF8F0]"
                        : "border-[#E5E0DA] bg-white hover:border-[#F7931A]/50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="flex flex-col items-center gap-4 mt-4">
            <LightningWalletButton
              uid={uid!}
              collection="freelancers"
              lightningAddress={lightningAddress}
              lightningConnectorType={lightningConnectorType}
              onSaved={handleLightningModalSave}
            />
          </div>
        )}

        {step === 7 && (
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
