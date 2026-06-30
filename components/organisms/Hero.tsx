'use client'

import { useEffect, useState } from "react";
import Link from "next/link";
import { firebaseDb } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const DEFAULT_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&h=100&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&h=100&q=80"
];

const DEFAULT_PAYMENTS = [
  { amount: "+560,000 Sats", timeAgo: "21 minutes ago" },
  { amount: "+50,000 Sats", timeAgo: "2 hours ago" },
  { amount: "+4,500,000 Sats", timeAgo: "5 hours ago" },
  { amount: "+800,000 Sats", timeAgo: "1 day ago" },
  { amount: "+2,200,000 Sats", timeAgo: "3 days ago" }
];

const getTimestampMs = (val: any) => {
  if (!val) return Date.now();
  if (typeof val.toMillis === "function") return val.toMillis();
  if (val.seconds) return val.seconds * 1000;
  return new Date(val).getTime();
};

const formatTimeAgo = (val: any) => {
  const ms = getTimestampMs(val);
  const diffMinutes = Math.max(1, Math.floor((Date.now() - ms) / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

export default function Hero() {
  const [payIndex, setPayIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [avatars, setAvatars] = useState<string[]>(DEFAULT_AVATARS);
  const [payments, setPayments] = useState<{ amount: string; timeAgo: string }[]>(DEFAULT_PAYMENTS);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setPayIndex((i) => (i + 1) % payments.length);
        setVisible(true);
      }, 350);
    }, 3000);
    return () => clearInterval(interval);
  }, [payments.length]);

  // Fetch dynamic avatars & real payments from Firestore
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch user avatars
        const usersSnap = await getDocs(collection(firebaseDb, "all_users"));
        if (!usersSnap.empty) {
          const avatarList: string[] = [];
          usersSnap.docs.forEach((docSnap) => {
            const data = docSnap.data() as any;
            const avatar = data.avatar || data.avatarUrl || data.companyLogo || data.companyLogoUrl;
            if (avatar && typeof avatar === 'string' && avatar.trim().startsWith('http')) {
              avatarList.push(avatar);
            }
          });

          if (avatarList.length >= 4) {
            const shuffled = avatarList.sort(() => 0.5 - Math.random());
            setAvatars(shuffled.slice(0, 4));
          } else if (avatarList.length > 0) {
            const uniqueList = Array.from(new Set(avatarList));
            const combined = [...uniqueList];
            for (const fallback of DEFAULT_AVATARS) {
              if (combined.length >= 4) break;
              if (!combined.includes(fallback)) {
                combined.push(fallback);
              }
            }
            setAvatars(combined.slice(0, 4));
          }
        }

        // 2. Fetch real payments from contracts
        const contractsSnap = await getDocs(collection(firebaseDb, "contracts"));
        if (!contractsSnap.empty) {
          const paymentList: { amount: string; timeAgo: string; rawTime: number }[] = [];
          contractsSnap.docs.forEach((docSnap) => {
            const data = docSnap.data() as any;
            const milestones = data.milestones ?? [];
            const updatedAt = data.updatedAt || data.createdAt;
            const rawTime = getTimestampMs(updatedAt);

            if (milestones.length > 0) {
              milestones.forEach((ms: any) => {
                const isReleased = ms.status === 'released' || ms.status === 'approved' || Number(ms.releasedSats ?? 0) > 0;
                if (isReleased) {
                  const amt = Number(ms.releasedSats ?? ms.amount ?? 0);
                  if (amt > 0) {
                    const timeAgo = formatTimeAgo(ms.releasedAt || updatedAt);
                    paymentList.push({
                      amount: `+${amt.toLocaleString()} Sats`,
                      timeAgo,
                      rawTime: getTimestampMs(ms.releasedAt || updatedAt)
                    });
                  }
                }
              });
            } else {
              const escrowReleased = Number(data.escrowReleasedSats ?? 0);
              if (escrowReleased > 0) {
                const timeAgo = formatTimeAgo(updatedAt);
                paymentList.push({
                  amount: `+${escrowReleased.toLocaleString()} Sats`,
                  timeAgo,
                  rawTime
                });
              }
            }
          });

          if (paymentList.length > 0) {
            const sorted = paymentList.sort((a, b) => b.rawTime - a.rawTime);
            setPayments(sorted.map(item => ({
              amount: item.amount,
              timeAgo: item.timeAgo
            })));
          }
        }
      } catch (err) {
        console.error("Error fetching landing page Hero metrics:", err);
      }
    };

    fetchData();
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .font-inter { font-family: 'Inter', sans-serif; }
      `}</style>

      <section className="font-inter bg-[#FCF9F7] pt-[130px] sm:pt-[140px] lg:pt-[160px] pb-12 sm:pb-16 lg:pb-20 px-4 sm:px-6 lg:px-20 overflow-x-hidden">
        <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row justify-between gap-12 lg:gap-16 items-center">

          {/* LEFT COLUMN */}
          <div className="w-full lg:max-w-[620px] flex flex-col items-start">
            
            {/* Top Badge */}
            <div className="inline-flex items-center gap-1.5 bg-[#FFF4E5] border border-orange-100/50 text-[#F7931A] text-xs sm:text-[13px] font-bold px-4 py-1.5 rounded-full mb-6">
              <span className="text-sm">⚡</span> The Bitcoin Freelance Marketplace
            </div>

            {/* Heading */}
            <h1 className="font-inter text-4xl sm:text-5xl md:text-[54px] lg:text-[64px] font-black leading-[1.08] text-[#1A1A1A] tracking-[-0.02em]">
              Work Online.<br />
              Get Paid in <span className="text-[#F7931A]">Bitcoin.</span>
            </h1>

            {/* Description */}
            <p className="mt-6 text-base sm:text-[17px] leading-[1.7] text-gray-500 max-w-[490px]">
              The simplest freelance platform built for the Bitcoin economy.
              Find jobs, hire talent, and earn sats globally — without borders.
            </p>

            {/* Buttons */}
            <div className="mt-8 flex flex-row flex-wrap items-center justify-start gap-4 w-full">
              <Link
                href="/signup?type=work"
                className="font-inter inline-flex items-center justify-center bg-[#F7931A] text-white text-sm sm:text-base font-bold rounded-xl px-7 py-3.5 hover:bg-[#e07f0f] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-lg hover:shadow-orange-500/10 cursor-pointer min-w-[140px]"
              >
                Find Work
              </Link>

              <Link
                href="/signup?type=hire"
                className="font-inter inline-flex items-center justify-center bg-white text-[#F7931A] border border-[#F7931A] text-sm sm:text-base font-bold rounded-xl px-7 py-3.5 hover:bg-orange-50/50 transition-all duration-200 hover:-translate-y-[2px] hover:shadow-lg hover:shadow-gray-200/50 cursor-pointer min-w-[140px]"
              >
                Post a Job
              </Link>
            </div>

            {/* Social Proof */}
            <div className="mt-10 flex flex-row items-center gap-4 sm:gap-5">
              <div className="flex -space-x-3 shrink-0">
                {avatars.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`User Avatar ${i + 1}`}
                    className="w-10 h-10 rounded-full border-2 border-[#FCF9F7] object-cover bg-white"
                  />
                ))}
              </div>
              <p className="text-xs sm:text-sm text-gray-500 font-medium leading-[1.5] max-w-[280px]">
                Trusted by <span className="font-bold text-gray-800">1,000+ Bitcoin companies</span> and talented freelancers worldwide.
              </p>
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="w-full max-w-[460px] lg:max-w-[480px] flex-shrink-0">
            <div className="bg-[#FAF2E8] rounded-[40px] w-full h-[320px] sm:h-[420px] relative flex items-end justify-center overflow-visible shadow-sm">

              {/* Hero Image */}
              <img
                src="/assets/heroimage.png"
                alt="Freelancer at computer"
                className="absolute inset-0 w-full h-full object-cover rounded-[40px]"
              />

              {/* Payment notification overlay */}
              <div
                className={`
                  absolute bottom-6 sm:bottom-8 left-[-16px] sm:left-[-32px]
                  bg-white rounded-2xl p-4 pl-4 pr-5
                  flex items-center gap-3.5
                  shadow-[0_12px_40px_rgba(0,0,0,0.08)]
                  border border-gray-100/80
                  whitespace-nowrap w-[90%] sm:w-[330px]
                  transition-all duration-300 select-none
                  ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                `}
              >
                {/* Lightning circle icon */}
                <div className="w-11 h-11 bg-[#F7931A] rounded-full flex items-center justify-center shrink-0 shadow-md shadow-orange-500/10">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="white" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* Text and labels */}
                <div className="flex-1 min-w-0">
                  <span className="block text-[10px] font-bold text-gray-400 tracking-[0.06em] uppercase mb-[2px]">
                    Payment received
                  </span>
                  <div className="font-inter text-base sm:text-[18px] font-black text-gray-900 leading-tight">
                    {payments[payIndex]?.amount}
                  </div>
                  <span className="block text-[11px] text-gray-400 font-medium mt-[2px]">
                    {payments[payIndex]?.timeAgo}
                  </span>
                </div>

                {/* Status completed badge */}
                <span className="text-[11px] font-bold px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100/20 shrink-0">
                  Completed
                </span>
              </div>

            </div>
          </div>

        </div>
      </section>
    </>
  );
}