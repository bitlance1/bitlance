'use client'

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from '@/lib/firebase';
import Header from '@/components/organisms/Header';

export const dynamic = 'force-dynamic'; // Ensures this page is dynamically rendered, avoiding prerendering issues with useSearchParams

function PartyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.8 11.3L2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/>
      <path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v.01a2.9 2.9 0 0 0 3.68 2.38v0A2.9 2.9 0 0 0 24 5.13V3z"/>
      <path d="m22 13-.82.22a2.9 2.9 0 0 0-1.96 3.12v0a2.9 2.9 0 0 0 3.68 2.38v0A2.9 2.9 0 0 0 24 16.13v-2z"/>
      <path d="m11 2-.82.22a2.9 2.9 0 0 0-1.96 3.12v0a2.9 2.9 0 0 0 3.68 2.38v0A2.9 2.9 0 0 0 13 5.13V3z"/>
    </svg>
  );
}

export default function SignupPage() {
  const [userType, setUserType] = useState<'work' | 'hire'>('work');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Sync URL parameter with the active tab
  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'work' || type === 'hire') {
      setUserType(type);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password) { setErrorMessage('Please fill in all fields.'); return; }
    if (!agreeToTerms) { setErrorMessage('Please agree to the Terms of Service.'); return; }
    setIsSubmitting(true);
    setErrorMessage('');
    const role = userType === 'work' ? 'freelancer' : 'client';
    const isFreelancer = role === 'freelancer';
    const isClient = role === 'client';
    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      const uid = credential.user.uid;
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      await updateProfile(credential.user, { displayName: fullName });
      await setDoc(doc(firebaseDb, 'all_users', uid), { uid, email, role, isFreelancer, isClient, firstName: firstName.trim(), lastName: lastName.trim(), fullName, createdAt: serverTimestamp() });
      const roleCollection = role === 'freelancer' ? 'freelancers' : 'clients';
      await setDoc(doc(firebaseDb, roleCollection, uid), { uid, email, role, isFreelancer, isClient, firstName: firstName.trim(), lastName: lastName.trim(), fullName, createdAt: serverTimestamp() });
      router.push(role === 'freelancer' ? '/freelancer/onboarding' : '/client/onboarding');
    } catch (error: any) {
      const msg = error?.message ?? 'Failed to create account.';
      setErrorMessage(msg.includes('email-already-in-use') ? 'An account with this email already exists.' : msg);
    } finally { setIsSubmitting(false); }
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-[#F5F3F0] flex items-start lg:items-center justify-center max-md:mt-[40px] mt-[15px] px-4 sm:px-6 py-6 pt-20 lg:pt-28">
        <div className="w-full max-w-[1000px] flex flex-col lg:flex-row items-center gap-8 lg:gap-20">

          {/* ── LEFT: Marketing copy (desktop only) ── */}
          <div className="flex-1 hidden lg:block relative min-h-[520px]">
            <div className="absolute top-1/2 -translate-y-1/2 left-0 text-[300px] font-black leading-none select-none pointer-events-none text-[#F7931A]/[0.07]">₿</div>
            <div className="relative z-10 ">
              <div className="inline-flex items-center  gap-2 rounded-full border border-[#F7931A]/40 bg-[#FFF3E0] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8C4F00] mb-7">
                Join Bitlance
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8C4F00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              </div>
              <h1 className="text-[48px] font-black leading-[1.08] tracking-[-0.03em] text-[#1a1a1a]">
                Your skills.<br />
                Your rules.<br />
                <span className="text-[#F7931A]">Bitcoin.</span>{' '}
                <svg className="inline-block align-middle -mt-1" width="36" height="36" viewBox="0 0 24 24" fill="#F7931A">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              </h1>
              <p className="mt-5 text-[14px] leading-[1.75] text-[#6b6762] max-w-[380px]">
                Whether you're a freelancer or a client — Bitlance makes it simple, secure, and paid in Bitcoin.
              </p>
              <div className="mt-9 flex flex-col gap-6">
                {[
                  {
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
                    title: 'Find opportunities',
                    desc: 'Explore quality jobs that match your skills and get paid in Bitcoin.',
                  },
                  {
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>,
                    title: 'Showcase your expertise',
                    desc: 'Build your profile, share your work, and stand out to clients worldwide.',
                  },
                  {
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
                    title: 'Work with confidence',
                    desc: 'Secure payments, clear agreements, and a trusted community.',
                  },
                ].map((f) => (
                  <div key={f.title} className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-9 h-9 rounded-[10px] bg-[#FFF3E0] border border-[#F7931A]/20 flex items-center justify-center">{f.icon}</div>
                    <div>
                      <div className="text-[13px] font-black text-[#1a1a1a]">{f.title}</div>
                      <div className="text-[12px] leading-[1.65] text-[#6b6762] mt-0.5">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Form card ── */}
          <div className="w-full lg:w-[430px] flex-shrink-0">
            <div className="bg-white rounded-[20px] border border-[#E8E4DE] shadow-[0_8px_40px_rgba(0,0,0,0.08)] px-6 sm:px-8 py-7 sm:py-8">

              {/* Logo — hidden on mobile */}
              <div className="hidden lg:flex justify-center mb-5">
                <div className="w-14 h-14 bg-[#F7931A] rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200/60">
                  <Image src="/assets/logo.png" alt="Bitlance" width={34} height={34} className="object-contain" />
                </div>
              </div>

              <div className="text-center mb-5">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <h2 className="text-[19px] sm:text-[20px] font-black text-[#1a1a1a]">Create your account</h2>
                  <PartyIcon />
                </div>
                <p className="text-[12px] leading-[1.6] text-[#6b6762]">Join the Bitcoin freelancing platform.</p>
              </div>

              {/* Role toggle */}
              <div className="flex gap-1.5 mb-5 p-1 bg-[#F5F3F0] rounded-[12px]">
                <button type="button" onClick={() => setUserType('work')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[8px] text-[11px] sm:text-[12px] font-black transition-all ${userType === 'work' ? 'bg-white text-[#1a1a1a] shadow-sm border border-[#E0DBD4]' : 'text-[#9e9690]'}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                  </svg>
                  Work as Freelancer
                </button>
                <button type="button" onClick={() => setUserType('hire')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[8px] text-[11px] sm:text-[12px] font-black transition-all ${userType === 'hire' ? 'bg-white text-[#1a1a1a] shadow-sm border border-[#E0DBD4]' : 'text-[#9e9690]'}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  Hire a Freelancer
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                {/* Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#888] mb-1.5 block">First name</label>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Satoshi"
                      className="w-full px-3.5 py-2.5 sm:py-3 rounded-[10px] bg-white border border-[#E0DBD4] text-[13px] text-[#1a1a1a] placeholder-[#C8A87A] focus:outline-none focus:border-[#F7931A] transition-colors" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#888] mb-1.5 block">Last name</label>
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nakamoto"
                      className="w-full px-3.5 py-2.5 sm:py-3 rounded-[10px] bg-white border border-[#E0DBD4] text-[13px] text-[#1a1a1a] placeholder-[#C8A87A] focus:outline-none focus:border-[#F7931A] transition-colors" />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="text-[11px] font-semibold text-[#888] mb-1.5 block">Email address</label>
                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C8A87A]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                    </svg>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                      className="w-full pl-9 pr-4 py-2.5 sm:py-3 rounded-[10px] bg-white border border-[#E0DBD4] text-[13px] text-[#1a1a1a] placeholder-[#C8A87A] focus:outline-none focus:border-[#F7931A] transition-colors" />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="text-[11px] font-semibold text-[#888] mb-1.5 block">Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters"
                      className="w-full px-4 py-2.5 sm:py-3 rounded-[10px] bg-white border border-[#E0DBD4] text-[13px] text-[#1a1a1a] placeholder-[#C8A87A] focus:outline-none focus:border-[#F7931A] transition-colors" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#C8A87A] hover:text-[#888]">
                      {showPassword
                        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1 4.24 4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      }
                    </button>
                  </div>
                </div>

                {/* Terms */}
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={agreeToTerms} onChange={(e) => setAgreeToTerms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#F7931A] cursor-pointer flex-shrink-0" />
                  <span className="text-[12px] text-[#6b6762]">
                    I agree to the{' '}
                    <Link href="#" className="font-bold text-[#F7931A] hover:underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="#" className="font-bold text-[#F7931A] hover:underline">Privacy Policy</Link>
                  </span>
                </label>

                {errorMessage && (
                  <p className="text-[12px] text-[#B42318] bg-[#FEF2F2] rounded-[8px] px-3 py-2">{errorMessage}</p>
                )}

                <button type="submit" disabled={isSubmitting}
                  className="w-full bg-[#F7931A] hover:bg-[#e8841a] text-white font-black text-[14px] py-3.5 rounded-[10px] transition-colors disabled:opacity-60 mt-1">
                  {isSubmitting ? 'Creating account…' : 'Create account →'}
                </button>
              </form>

              <div className="my-4 flex items-center gap-3">
                <div className="flex-1 h-px bg-[#EAE7E2]" />
                <span className="text-[11px] text-[#C8A87A] uppercase tracking-wider">OR</span>
                <div className="flex-1 h-px bg-[#EAE7E2]" />
              </div>

              <p className="text-center text-[13px] text-[#6b6762]">
                Already have an account?{' '}
                <Link href="/login" className="font-black text-[#F7931A] hover:underline">Log in →</Link>
              </p>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
