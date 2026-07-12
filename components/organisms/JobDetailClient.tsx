'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Send,
  Zap,
  ShieldCheck,
  Globe,
  Bookmark,
  Clock,
  Bold,
  Italic,
  Link2,
  ArrowLeft
} from 'lucide-react';
import { firebaseAuth, firebaseDb } from '@/lib/firebase';
import { sendUserNotification } from '@/lib/notifications';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';

const digitsOnly = (value: string) => value.replace(/\D/g, '');
const formatSats = (value: string | number) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '0 sats';
  return raw.toLowerCase().includes('sats') ? raw : `${raw} sats`;
};

const getTimestampMs = (value: unknown) => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object') {
    const timestampLike = value as {
      toMillis?: () => number;
      seconds?: number;
      nanoseconds?: number;
    };
    if (typeof timestampLike.toMillis === 'function') {
      return timestampLike.toMillis();
    }
    if (typeof timestampLike.seconds === 'number') {
      const extraMs = typeof timestampLike.nanoseconds === 'number'
        ? Math.floor(timestampLike.nanoseconds / 1000000)
        : 0;
      return timestampLike.seconds * 1000 + extraMs;
    }
  }
  return 0;
};

const formatPostedAt = (createdAt: unknown) => {
  const createdAtMs = getTimestampMs(createdAt);
  if (!createdAtMs) return 'Recently';

  const diffMs = Math.max(0, Date.now() - createdAtMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;

  if (diffMs < minute) return 'Just now';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < month) return `${Math.floor(diffMs / day)}d ago`;
  if (diffMs < year) return `${Math.floor(diffMs / month)}mo ago`;

  return `${Math.floor(diffMs / year)}y ago`;
};

type ClientSidebarData = {
  name: string;
  companyLogo: string;
  location: string;
  jobsPosted: number;
  hires: number;
  totalSpent: string;
  memberSince: string;
};

interface JobDetailClientProps {
  job: any;
  initialClientSidebar: ClientSidebarData;
}

export default function JobDetailClient({ job, initialClientSidebar }: JobDetailClientProps) {
  const jobId = job.id;
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [hasApplied, setHasApplied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [clientSidebar, setClientSidebar] = useState<ClientSidebarData>(initialClientSidebar);
  const proposalSectionRef = useRef<HTMLDivElement | null>(null);

  const [coverLetter, setCoverLetter] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState('');

  const jobBudget = digitsOnly(typeof job.budget === 'string' ? job.budget : String(job.budget ?? ''));
  const [hourlyRate, setHourlyRate] = useState(job.jobType === 'Hourly' ? jobBudget : '');
  const [fixedPrice, setFixedPrice] = useState(job.jobType === 'Hourly' ? '' : jobBudget);

  // Sync client sidebar prop changes
  useEffect(() => {
    setClientSidebar(initialClientSidebar);
  }, [initialClientSidebar]);

  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged(async (user) => {
      if (!user || !job?.id) return;
      const proposalsQuery = query(
        collection(firebaseDb, 'proposals'),
        where('jobId', '==', job.id),
        where('freelancerId', '==', user.uid)
      );
      const snap = await getDocs(proposalsQuery);
      setHasApplied(!snap.empty);
    });
    return () => unsubscribe();
  }, [job?.id]);

  useEffect(() => {
    let unsubscribeSaved: (() => void) | undefined;

    const unsubscribeAuth = firebaseAuth.onAuthStateChanged((user) => {
      if (!user || !jobId) {
        if (unsubscribeSaved) unsubscribeSaved();
        setIsSaved(false);
        return;
      }

      const savedQuery = query(
        collection(firebaseDb, 'saved_jobs'),
        where('userId', '==', user.uid),
        where('jobId', '==', jobId)
      );

      unsubscribeSaved = onSnapshot(savedQuery, (snapshot) => {
        setIsSaved(!snapshot.empty);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSaved) unsubscribeSaved();
    };
  }, [jobId]);

  const budgetLabel =
    job?.budget && job.budget.toLowerCase().includes('sats')
      ? job.budget
      : `${job?.budget ?? ''} Sats`;
  const skills = Array.isArray(job?.skills) ? job.skills : [];
  const postedAt = formatPostedAt(job?.createdAt);
  const pricingType = job?.jobType === 'Hourly' ? 'Hourly' : 'Fixed Price';

  const clientInitials = clientSidebar.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CL';

  return (
    <div className="min-h-screen bg-[#F7F6F3] font-sans text-[#1a1a1a]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* Back to Job Feed Button */}
        <div className="mb-4 sm:mb-6">
          <Link href="/freelancer/dashboard/job-feed">
            <button className="flex items-center gap-2 text-[#CC7000] hover:text-[#A85C00] font-bold text-sm sm:text-base transition-colors">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              Back to Job Feed
            </button>
          </Link>
        </div>

        <div>
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <span className="bg-[#FEF3E2] text-[#92400E] text-[9px] sm:text-[10px] font-extrabold px-2 sm:px-3 py-1 rounded-full uppercase tracking-widest">
                {job.status ?? 'Active Posting'}
              </span>
              <span className="text-xs text-gray-400">Posted {postedAt}</span>
            </div>
            <h1 className="text-[28px] sm:text-[40px] lg:text-[50px] font-bold leading-tight mb-3 sm:mb-4 tracking-tight">
              {job.title}
            </h1>
            {/* Quick Stats Row */}
            <div className="flex flex-wrap gap-4 sm:gap-6 lg:gap-8 mb-2">
              {/* Budget */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#FEF3E2] flex items-center justify-center">
                  <span className="font-extrabold text-[#92400E] text-sm sm:text-base">$</span>
                </div>
                <div>
                  <p className="text-[8px] sm:text-[9px] text-gray-400 uppercase font-extrabold tracking-widest">Budget</p>
                  <p className="font-bold text-[13px] sm:text-[15px]">{budgetLabel}</p>
                </div>
              </div>

              {job.duration ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#F6F3F1] flex items-center justify-center">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-[#92400E]" />
                  </div>
                  <div>
                    <p className="text-[8px] sm:text-[9px] text-gray-400 uppercase font-extrabold tracking-widest">Duration</p>
                    <p className="font-bold text-[13px] sm:text-[15px]">{job.duration}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">

          {/* LEFT COLUMN (8/12) */}
          <div className="lg:col-span-8 space-y-4 sm:space-y-5">

            {/* Job Header Card */}
            <div
              ref={proposalSectionRef}
              className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-sm border border-[#e8e6e1] scroll-mt-24"
            >
              {/* Job Description */}
              <div className="space-y-3 sm:space-y-4">
                <h2 className="text-base sm:text-lg font-extrabold">Job Description</h2>
                <p className="text-gray-500 leading-relaxed text-sm break-all whitespace-pre-wrap overflow-hidden">
                  {job.description?.replace(/\s{2,}/g, ' ').trim() ?? 'No description provided for this role yet.'}
                </p>

                {/* Tags */}
                {skills.length ? (
                  <div className="pt-3 sm:pt-4">
                    <p className="text-[8px] sm:text-[9px] font-extrabold uppercase text-gray-400 mb-2 sm:mb-3 tracking-widest">Required Expertise</p>
                    <div className="flex flex-wrap gap-1 sm:gap-2">
                      {skills.map((tag: string) => (
                        <span
                          key={tag}
                          className="px-3 sm:px-4 py-1 sm:py-2 bg-[#F3F2EF] rounded-full text-xs sm:text-sm font-medium text-gray-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Proposal Submission Card */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-sm border border-[#e8e6e1]">
              {/* Header */}
              <div className="flex items-center gap-2 sm:gap-3 mb-5 sm:mb-7">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-orange-600 to-orange-400 to-[#F7931A] flex items-center justify-center">
                  <Send className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold">Submit Your Proposal</h2>
              </div>

              {job?.status === 'Closed' ? (
                <div className="text-center py-8 bg-[#FAF9F6] rounded-2xl border border-dashed border-[#EAE7E2] p-6">
                  <div className="w-12 h-12 mx-auto mb-3 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-gray-800">This Job is Closed</h3>
                  <p className="text-xs text-gray-500 mt-1">The client has closed this job and is no longer accepting new proposals.</p>
                </div>
              ) : (
                <div className="space-y-4 sm:space-y-6">
                  {/* Cover Letter */}
                <div>
                  <label className="block text-[8px] sm:text-[9px] font-extrabold uppercase text-gray-400 mb-2 tracking-widest">
                    Proposal Cover Letter
                  </label>
                  <div className="relative">
                    <textarea
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      placeholder="Describe your experience with Bitcoin protocols and why you're a fit for this role..."
                      className="w-full bg-[#FDFCFB] border border-[#ece7df] rounded-xl sm:rounded-2xl p-4 sm:p-5 text-sm min-h-[150px] sm:min-h-[180px] focus:outline-none focus:ring-2 focus:ring-orange-400/30 resize-none placeholder:text-gray-300"
                    />
                    {/* Formatting toolbar */}
                    <div className="absolute bottom-2 bottom-3 right-3 right-4 flex items-center gap-2 gap-3 text-gray-300">
                      <Bold className="w-3 h-3 w-4 h-4 cursor-pointer hover:text-gray-500 transition-colors" />
                      <Italic className="w-3 h-3 w-4 h-4 cursor-pointer hover:text-gray-500 transition-colors" />
                      <Link2 className="w-3 h-3 w-4 h-4 cursor-pointer hover:text-gray-500 transition-colors" />
                    </div>
                  </div>
                </div>

                {/* Bid Amount + Delivery */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-[8px] sm:text-[9px] font-extrabold uppercase text-gray-400 mb-2 tracking-widest">
                      {pricingType === 'Hourly' ? 'Hourly Rate (Sats/hr)' : 'Fixed Price (Sats)'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={pricingType === 'Hourly' ? hourlyRate : fixedPrice}
                        onChange={(e) =>
                          pricingType === 'Hourly'
                            ? setHourlyRate(digitsOnly(e.target.value))
                            : setFixedPrice(digitsOnly(e.target.value))
                        }
                        className="w-full bg-[#FDFCFB] border border-[#ece7df] rounded-lg sm:rounded-xl px-3 sm:px-4 py-3 sm:py-4 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                        placeholder={digitsOnly(typeof job?.budget === 'string' ? job.budget : String(job?.budget ?? '')) || 'Enter your rate'}
                      />
                      <span className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-[10px] sm:text-[11px] font-extrabold text-[#B45309] tracking-wider">
                        SATS
                      </span>
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-gray-400 mt-1 sm:mt-2">
                      Share your {pricingType === 'Hourly' ? 'hourly' : 'project'} budget in sats.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[8px] sm:text-[9px] font-extrabold uppercase text-gray-400 mb-2 tracking-widest">
                      Hours Per Week
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={hoursPerWeek}
                        onChange={(e) => setHoursPerWeek(digitsOnly(e.target.value))}
                        className="w-full bg-[#FDFCFB] border border-[#ece7df] rounded-lg sm:rounded-xl px-3 sm:px-4 py-3 sm:py-4 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                        placeholder="e.g. 20"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer: fee note + CTA */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-4 sm:pt-5 border-t border-[#f0ede8] gap-3 sm:gap-0">
                  <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-gray-400">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full border border-gray-300 flex items-center justify-center text-[7px] sm:text-[8px] shrink-0">
                      i
                    </div>
                    5% Bitlance platform fee applies to this contract.
                  </div>
                  <button
                    onClick={async () => {
                      const user = firebaseAuth.currentUser;
                      if (!user) {
                        setErrorMessage('Please log in to submit a proposal.');
                        return;
                      }
                      if (job?.status === 'Closed') {
                        setErrorMessage('This job is closed and no longer accepting proposals.');
                        return;
                      }
                      if (hasApplied) {
                        setErrorMessage('You already submitted a proposal for this job.');
                        return;
                      }
                      const proposedAmount =
                        pricingType === 'Hourly' ? hourlyRate.trim() : fixedPrice.trim();
                      if (!coverLetter.trim() || !proposedAmount) {
                        setErrorMessage('Please complete your proposal details.');
                        return;
                      }
                      setSubmitState('submitting');
                      setErrorMessage('');
                      try {
                        const proposalsQuery = query(
                          collection(firebaseDb, 'proposals'),
                          where('jobId', '==', job.id),
                          where('freelancerId', '==', user.uid)
                        );
                        const existing = await getDocs(proposalsQuery);
                        if (!existing.empty) {
                          setHasApplied(true);
                          setErrorMessage('You already submitted a proposal for this job.');
                          setSubmitState('idle');
                          return;
                        }

                        const allUsersSnap = await getDoc(doc(firebaseDb, 'all_users', user.uid));
                        const freelancersSnap = await getDoc(doc(firebaseDb, 'freelancers', user.uid));
                        const allData = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
                        const freeData = freelancersSnap.exists() ? (freelancersSnap.data() as any) : {};
                        const freelancerName = allData.fullName ?? user.displayName ?? 'Freelancer';
                        const clientName =
                          job.clientId
                            ? ((await getDoc(doc(firebaseDb, 'all_users', job.clientId))).data() as any)?.fullName ??
                            job.clientName ??
                            job.clientCompany ??
                            'Client'
                            : job.clientName ?? job.clientCompany ?? 'Client';

                        await addDoc(collection(firebaseDb, 'proposals'), {
                          jobId: job.id,
                          clientId: job.clientId ?? '',
                          jobTitle: job.title ?? 'Job Proposal',
                          clientName,
                          freelancerId: user.uid,
                          freelancerName,
                          freelancerTitle: freeData.title ?? 'Professional',
                          cover: coverLetter.trim(),
                          rate: proposedAmount,
                          pricingType,
                          hourlyRate: pricingType === 'Hourly' ? proposedAmount : '',
                          fixedPrice: pricingType === 'Hourly' ? '' : proposedAmount,
                          hoursPerWeek: hoursPerWeek.trim(),
                          availability: freeData.availability ?? 'Available',
                          rating: freeData.rating ?? 5,
                          status: 'submitted',
                          createdAt: serverTimestamp(),
                          updatedAt: serverTimestamp(),
                        });

                        await updateDoc(doc(firebaseDb, 'jobs', job.id), {
                          proposals: increment(1),
                          updatedAt: serverTimestamp(),
                        });
                        void sendUserNotification({
                          userId: job.clientId ?? '',
                          title: 'New proposal received',
                          body: `${freelancerName} applied for "${job.title ?? 'your job'}".`,
                          url: '/client/dashboard/proposals',
                          tag: `proposal-${job.id}-${user.uid}`,
                        }).catch(console.error);

                        setSubmitState('done');
                        setCoverLetter('');
                        setHourlyRate(pricingType === 'Hourly' ? digitsOnly(typeof job?.budget === 'string' ? job.budget : String(job?.budget ?? '')) : '');
                        setFixedPrice(pricingType === 'Hourly' ? '' : digitsOnly(typeof job?.budget === 'string' ? job.budget : String(job?.budget ?? '')));
                        setHoursPerWeek('');
                        setHasApplied(true);
                      } catch {
                        setErrorMessage('Unable to submit proposal right now.');
                      } finally {
                        setSubmitState('idle');
                      }
                    }}
                    disabled={submitState === 'submitting' || hasApplied || job?.status === 'Closed'}
                    className="bg-gradient-to-r from-orange-600 to-orange-400 to-[#F7931A] active:scale-95 text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-full font-bold text-sm transition-all shadow-md w-full sm:w-auto disabled:opacity-70"
                  >
                    {job?.status === 'Closed' ? 'Job Closed' : hasApplied ? 'Applied' : submitState === 'submitting' ? 'Sending...' : 'Send Proposal'}
                  </button>
                </div>
                {errorMessage ? (
                  <p className="text-[11px] text-red-600">{errorMessage}</p>
                ) : null}
                {submitState === 'done' ? (
                  <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[11px] text-green-700">
                    Proposal submitted successfully.
                  </div>
                ) : null}
              </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Sidebar (4/12) */}
          <div className="lg:col-span-4">
            <div className="bg-[#ECE9E2] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 flex flex-col gap-4 sm:gap-7">
              {/* Action Card */}
              <div>
                <button
                  disabled={hasApplied || job?.status === 'Closed'}
                  onClick={() => {
                    proposalSectionRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }}
                  className="w-full bg-gradient-to-r from-orange-600 to-orange-400 to-[#F7931A] hover:from-[#A85C00] hover:to-[#A85C00] active:scale-95 text-white py-2.5 sm:py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md mb-2 sm:mb-3 disabled:opacity-70"
                >
                  {job?.status === 'Closed' ? 'Closed' : hasApplied ? 'Applied' : 'Apply Now'} <Zap className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                </button>
                <button
                  onClick={async () => {
                    const user = firebaseAuth.currentUser;
                    if (!user) {
                      setErrorMessage('Please log in to save jobs.');
                      return;
                    }

                    const docId = `${user.uid}_${job.id}`;
                    setErrorMessage('');

                    if (isSaved) {
                      await deleteDoc(doc(firebaseDb, 'saved_jobs', docId));
                    } else {
                      await setDoc(doc(firebaseDb, 'saved_jobs', docId), {
                        userId: user.uid,
                        jobId: job.id,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                      });
                    }
                  }}
                  className={`w-full py-2.5 sm:py-3 rounded-full font-bold text-sm border flex items-center justify-center gap-2 transition-all shadow-sm ${isSaved
                      ? 'bg-[#F7931A] text-white border-[#F7931A]'
                      : 'bg-white hover:bg-gray-100 text-[#1a1a1a] border-[#e0e0e0]'
                    }`}
                >
                  <Bookmark className="w-4 h-4 sm:w-5 sm:h-5" fill={isSaved ? 'currentColor' : 'none'} />
                  {isSaved ? 'Saved' : 'Save Job'}
                </button>
              </div>

              <div className="space-y-1 sm:space-y-2 px-1">
                {[
                  { label: 'Proposals', value: String(job?.proposals ?? 0) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm sm:text-[15px]">
                    <span className="text-gray-600 font-medium">{label}</span>
                    <span className="font-bold text-[#1a1a1a]">{value}</span>
                  </div>
                ))}
              </div>

              {/* About Client Card */}
              <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-7 shadow-sm border border-[#e8e6e1] mt-1 sm:mt-2">
                <p className="text-[8px] sm:text-[9px] font-extrabold uppercase text-gray-400 mb-4 sm:mb-6 tracking-widest">About the Client</p>
                {/* Client Identity */}
                <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#0C2D2B] rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                    {clientSidebar.companyLogo ? (
                      <img src={clientSidebar.companyLogo} alt={`${clientSidebar.name} company logo`} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-white text-[8px] sm:text-[9px] font-extrabold">{clientInitials}</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm">{clientSidebar.name}</h4>
                    <div className="mt-1 text-xs text-gray-500">{clientSidebar.location || 'Remote'}</div>
                  </div>
                </div>
                {/* Client Details */}
                <div className="space-y-3 sm:space-y-4 text-sm">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <Globe className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-gray-800">{clientSidebar.totalSpent}</p>
                      <p className="text-xs text-gray-400">Total spent on Bitlance</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <span className="text-gray-400 font-bold mt-0.5 shrink-0 text-sm sm:text-base leading-none">$</span>
                    <div>
                      <p className="font-bold text-gray-800">{clientSidebar.jobsPosted}</p>
                      <p className="text-xs text-gray-400">Jobs posted</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4 text-[#16A34A] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-gray-800">{clientSidebar.hires}</p>
                      <p className="text-xs text-gray-400">Freelancers hired</p>
                    </div>
                  </div>
                  {clientSidebar.memberSince ? (
                    <p className="text-[8px] sm:text-[9px] text-gray-400 uppercase font-extrabold pt-1 tracking-widest">
                      Member since {clientSidebar.memberSince}
                    </p>
                  ) : null}
                </div>
                {job?.clientId ? (
                  <Link href={`/client/public/${job.clientId}`} className="block w-full mt-5 sm:mt-7 text-[#CC7000] hover:text-[#A85C00] font-bold text-sm transition-colors text-center">
                    View Company Profile
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
