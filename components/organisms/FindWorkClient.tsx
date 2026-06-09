'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  documentId,
  getDocs,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';

const EXPERIENCE_LEVELS = ['All', 'Entry', 'Intermediate', 'Expert'];
const JOB_TYPES = ['All', 'Fixed', 'Hourly'];

const getTimestampMs = (value: unknown): number => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object') {
    const ts = value as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') {
      const extraMs = typeof ts.nanoseconds === 'number' ? Math.floor(ts.nanoseconds / 1_000_000) : 0;
      return ts.seconds * 1000 + extraMs;
    }
  }
  return 0;
};

const formatPostedAt = (createdAt: unknown): string => {
  const ms = getTimestampMs(createdAt);
  if (!ms) return 'Recently';
  const diff = Math.max(0, Date.now() - ms);
  const m = 60 * 1000;
  const h = 60 * m;
  const d = 24 * h;
  const mo = 30 * d;
  const y = 365 * d;
  if (diff < m) return 'Just now';
  if (diff < h) return `${Math.floor(diff / m)}m ago`;
  if (diff < d) return `${Math.floor(diff / h)}h ago`;
  if (diff < mo) return `${Math.floor(diff / d)}d ago`;
  if (diff < y) return `${Math.floor(diff / mo)}mo ago`;
  return `${Math.floor(diff / y)}y ago`;
};

type FindWorkJob = {
  id: string;
  category: string;
  experience: string;
  type: 'Fixed' | 'Hourly';
  icon?: string;
  title: string;
  description: string;
  price: string;
  tags: string[];
  createdAt?: any;
  companyLogo: string;
  duration: string;
  client: string;
  postedAt: string;
};

function LogoBox({ url, name }: { url?: string; name?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  const showImg = !!url && !failed;
  return (
    <div className="h-11 w-11 min-w-[44px] rounded-[8px] bg-[#F7F4F0] ring-1 ring-[#EAE7E2] overflow-hidden flex items-center justify-center flex-shrink-0">
      {showImg ? (
        <img
          src={url}
          alt={name ? `${name} company logo` : 'Company logo'}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8C4F00" strokeWidth="2" aria-hidden="true">
          <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" />
          <path d="M4 21c0-3.314 2.686-6 6-6h4c3.314 0 6 2.686 6 6" />
        </svg>
      )}
    </div>
  );
}

const CATEGORY_ICONS: Record<string, string> = {
  Development: '/assets/dev.png',
  'Design & Creative': '/assets/creative.png',
  Marketing: '/assets/sales.png',
  Sales: '/assets/sales.png',
  'Sales & Marketing': '/assets/sales.png',
  Writing: '/assets/writting.png',
  'Finance & Accounting': '/assets/finance.png',
  Finance: '/assets/finance.png',
  'Customer Support': '/assets/admin.png',
  'Project Management': '/assets/admin.png',
  Admin: '/assets/admin.png',
  'Data & Analytics': '/assets/tech.png',
  'DevOps & Infrastructure': '/assets/tech.png',
  Security: '/assets/tech.png',
  'Blockchain & Crypto': '/assets/tech.png',
  'Product Management': '/assets/admin.png',
  'QA & Testing': '/assets/tech.png',
};

const formatBudgetLabel = (budget: string, jobType: string) => {
  const trimmed = String(budget ?? '').trim();
  if (!trimmed) return '';
  if (/sats/i.test(trimmed)) return trimmed;
  return jobType === 'Hourly' ? `${trimmed} Sats/hr` : `${trimmed} Sats`;
};

const parseBudgetValue = (price: string) => {
  const cleaned = String(price ?? '').replace(/[^0-9.]/g, '');
  return cleaned ? Number(cleaned) : 0;
};

interface FindWorkClientProps {
  initialJobs: FindWorkJob[];
}

export default function FindWorkClient({ initialJobs }: FindWorkClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]);
  const [budget, setBudget] = useState(10000000);
  const [selectedExperience, setSelectedExperience] = useState('All');
  const [selectedJobType, setSelectedJobType] = useState('All');
  const [jobs, setJobs] = useState<FindWorkJob[]>(initialJobs);
  const [jobsLoading, setJobsLoading] = useState(initialJobs.length === 0);
  const [jobsError, setJobsError] = useState('');

  // Keep jobs in sync with server component props initial state
  useEffect(() => {
    if (initialJobs && initialJobs.length > 0) {
      setJobs(initialJobs);
      setJobsLoading(false);
    }
  }, [initialJobs]);

  useEffect(() => {
    // Setup real-time listener for client updates
    const jobsQuery = query(collection(firebaseDb, 'jobs'), where('status', '==', 'Open'));
    const unsubscribe = onSnapshot(
      jobsQuery,
      async (snapshot) => {
        try {
          const clientIds = Array.from(
            new Set(
              snapshot.docs
                .map((d) => (d.data() as any).clientId as string | undefined)
                .filter((id): id is string => !!id)
            )
          );

          const logoMap: Record<string, string> = {};
          if (clientIds.length > 0) {
            const chunkSize = 30;
            for (let i = 0; i < clientIds.length; i += chunkSize) {
              const chunk = clientIds.slice(i, i + chunkSize);
              const clientsSnap = await getDocs(
                query(collection(firebaseDb, 'clients'), where(documentId(), 'in', chunk))
              );
              clientsSnap.docs.forEach((clientDoc) => {
                const data = clientDoc.data() as any;
                const logo = data.companyLogo || data.companyLogoUrl;
                if (clientDoc.id && logo) logoMap[clientDoc.id] = logo;
              });
            }
          }

          const items: FindWorkJob[] = snapshot.docs
            .map((docSnap) => {
              const data = docSnap.data() as any;
              const category = typeof data.category === 'string' ? data.category : '';
              const jobType: FindWorkJob['type'] = data.jobType === 'Hourly' ? 'Hourly' : 'Fixed';
              const experience = typeof data.experienceLevel === 'string' ? data.experienceLevel : 'All';
              const title = typeof data.title === 'string' ? data.title : 'Untitled Job';
              const description =
                typeof data.description === 'string'
                  ? data.description.replace(/\s{2,}/g, ' ').trim()
                  : '';
              const tags = Array.isArray(data.skills)
                ? data.skills.filter((skill: unknown): skill is string => typeof skill === 'string')
                : [];
              const clientId: string = data.clientId ?? '';

              return {
                id: docSnap.id,
                category,
                experience,
                type: jobType,
                icon: CATEGORY_ICONS[category] ?? '/assets/tech.png',
                title,
                description,
                price: formatBudgetLabel(data.budget ?? '', jobType),
                tags,
                createdAt: data.createdAt,
                companyLogo: data.companyLogo || logoMap[clientId] || '',
                duration: data.duration ?? '',
                client: data.clientCompany || data.clientName || 'Client',
                postedAt: formatPostedAt(data.createdAt),
              };
            })
            .sort((a, b) => {
              const aTime = a.createdAt?.seconds ? a.createdAt.seconds : 0;
              const bTime = b.createdAt?.seconds ? b.createdAt.seconds : 0;
              return bTime - aTime;
            });

          setJobs(items);
          setJobsLoading(false);
        } catch {
          // If updates fail, keep the previous/initial state
          setJobsLoading(false);
        }
      },
      () => {
        setJobsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const toggleCategory = (category: string) => {
    setSelectedCategory((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const clearAll = () => {
    setSelectedCategory([]);
    setBudget(10000000);
    setSelectedExperience('All');
    setSelectedJobType('All');
    setSearchTerm('');
  };

  const categories = useMemo(
    () =>
      Array.from(
        new Set(jobs.map((job) => job.category).filter((value) => value && value.trim().length > 0))
      ).sort(),
    [jobs]
  );

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory.length === 0 || selectedCategory.includes(job.category);
      const matchesExperience =
        selectedExperience === 'All' ||
        job.experience === selectedExperience ||
        job.experience === 'All';
      const matchesType = selectedJobType === 'All' || job.type === selectedJobType;
      const matchesBudget = parseBudgetValue(job.price) <= budget;
      return matchesSearch && matchesCategory && matchesExperience && matchesType && matchesBudget;
    });
  }, [jobs, searchTerm, selectedCategory, selectedExperience, selectedJobType, budget]);

  return (
    <section className="bg-[#FCF9F7] pt-[30px] pb-16 min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1a1a1a]">Find Work</h1>
          <p className="mt-2 text-sm text-[#666]">Browse the latest Bitcoin-native freelance opportunities.</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">

          <aside className="bg-[#F6F3F1] rounded-[48px] p-5 pl-[30px] h-fit pb-[40px]">

            {/* CATEGORY */}
            <div className="mb-5 mt-[10px]">
              <p className="text-[0.62rem] font-bold uppercase tracking-widest text-[#9A8F82] mb-3">
                Category
              </p>
              <div className="flex flex-col gap-2.5">
                {categories.map((cat) => {
                  const checked = selectedCategory.includes(cat);
                  return (
                    <label key={cat} className="flex items-center gap-2.5 cursor-pointer">
                      <span
                        onClick={() => toggleCategory(cat)}
                        className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                          checked ? "bg-[#8C4F00]" : "border border-[#C4B8A8] bg-transparent"
                        }`}
                      >
                        {checked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.8 7L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className="text-sm text-[#555]">{cat}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* BUDGET */}
            <div className="mb-5">
              <p className="text-[0.62rem] font-bold uppercase tracking-widest text-[#554335] mb-3">
                Budget (Sats)
              </p>
              <input
                type="range"
                min={1000}
                max={10000000}
                step={1000}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full accent-[#554335]"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[0.68rem] text-[#554335]">1k Sats</span>
                <span className="text-[0.68rem] text-[#554335]">10M Sats</span>
              </div>
            </div>

            {/* EXPERIENCE LEVEL */}
            <div className="mb-5">
              <p className="text-[0.62rem] font-bold uppercase tracking-widest text-[#554335] mb-3">
                Experience Level
              </p>
              <div className="flex flex-col gap-2.5">
                {EXPERIENCE_LEVELS.map((level) => {
                  const selected = selectedExperience === level;
                  return (
                    <label key={level} className="flex items-center gap-2.5 cursor-pointer">
                      <span
                        onClick={() => setSelectedExperience(level)}
                        className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                          selected ? "bg-[#8C4F00]" : "border border-[#C4B8A8] bg-transparent"
                        }`}
                      >
                        {selected && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                      </span>
                      <span className="text-sm text-[#555]">{level}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* JOB TYPE */}
            <div className="mb-5">
              <p className="text-[0.62rem] font-bold uppercase tracking-widest text-[#554335] mb-3">
                Job Type
              </p>
              <div className="flex gap-2">
                {JOB_TYPES.map((jt) => {
                  const active = selectedJobType === jt;
                  return (
                    <button
                      key={jt}
                      onClick={() => setSelectedJobType(jt)}
                      className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                        active ? "bg-white text-[#1B1C1B] shadow-sm" : "bg-transparent text-[#777] hover:bg-white/50"
                      }`}
                    >
                      {jt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CLEAR ALL */}
            <button
              onClick={clearAll}
              className="w-full rounded-full bg-[#E4DDD4] hover:bg-[#D9D0C6] text-[#666] text-sm font-medium py-2.5 transition-colors"
            >
              Clear All Filters
            </button>
          </aside>

          <main className="min-w-0">
            {/* Search */}
            <div className="mb-5 w-full">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]"
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search for bitcoin-related jobs, stacks, or keywords..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-full bg-[#F6F3F1] h-[54px] pl-9 pr-4 text-sm text-[#333] placeholder-[#aaa] outline-none focus:border-[#c8a97e]"
                />
              </div>
            </div>

            {/* Title + sort row */}
            <div className="mb-1">
              <h2 className="text-[20px] sm:text-[24px] md:text-[30px] font-semibold text-[#1B1C1B]">Available Jobs</h2>
            </div>
            <div className="mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <p className="text-[13px] sm:text-[14px] md:text-[16px] text-[#554335]">
                {filteredJobs.length} active opportunities in the Circular Economy
              </p>
              <div className="flex items-center gap-1 text-[12px] sm:text-[13px] md:text-[14px] text-[#554335]">
                <span>Sort by:</span>
                <div className="bg-[#F0EDEB] h-[32px] sm:h-[34px] flex items-center px-3 sm:px-[15px] rounded-[999px]">
                  <button className="flex items-center gap-1 font-semibold text-[#1B1C1B]">
                    Newest First
                    <svg width="10" height="10" className="sm:w-[12px] sm:h-[12px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Job list */}
            <div className="flex flex-col gap-4">
              {jobsLoading ? (
                <div className="rounded-2xl border border-[#ece7dd] bg-white p-8 text-center text-[#777]">
                  Loading jobs...
                </div>
              ) : jobsError ? (
                <div className="rounded-2xl border border-[#ece7dd] bg-white p-8 text-center text-[#8C4F00]">
                  {jobsError}
                </div>
              ) : filteredJobs.length ? (
                filteredJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-white rounded-3xl border border-[#ece7df] p-4 shadow-sm transition-all hover:shadow-xl hover:border-[#F7931A]/30 group overflow-hidden"
                  >
                    <div className="flex gap-5">

                      {/* Company logo */}
                      <LogoBox url={job.companyLogo} name={job.client} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">

                        {/* Top row: posted time */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#6b6560] font-medium">{job.postedAt}</span>
                          </div>
                        </div>

                        {/* Title + price */}
                        <div className="flex items-start justify-between gap-4 mb-1.5">
                          <h3 className="text-lg font-bold text-[#1a1a1a] transition-colors flex-1 break-words min-w-0">
                            {job.title}
                          </h3>
                          {job.price && (
                            <span className="text-[15px] font-bold text-[#8C4F00] whitespace-nowrap shrink-0">
                              {job.price}
                            </span>
                          )}
                        </div>

                        {/* Client + experience */}
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-[#6b6560] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                          </svg>
                          <span className="text-sm font-medium text-[#6b6560] truncate">{job.client}</span>
                          <span className="text-xs text-[#6b6560]">•</span>
                          <span className="text-xs text-[#6b6560] whitespace-nowrap">{job.experience}</span>
                          {job.duration ? (
                            <>
                              <span className="text-xs text-[#6b6560]">|</span>
                              <span className="text-xs text-[#6b6560] whitespace-nowrap">{job.duration}</span>
                            </>
                          ) : null}
                        </div>

                        {/* Description */}
                        {job.description && (
                          <p
                            className="text-sm text-[#6b6560] leading-relaxed mb-2 overflow-hidden break-all"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {job.description}
                          </p>
                        )}

                        {/* Tags */}
                        {job.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {job.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-3 py-1 bg-[#FCF9F7] text-[#6b6560] text-[10px] font-bold rounded-full border border-[#ece7df] group-hover:bg-[#F7931A]/10 group-hover:text-[#F7931A] group-hover:border-[#F7931A]/30 transition-colors"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Apply button */}
                        <div className="flex justify-end">
                          <button
                            onClick={() => router.push(`/job/${job.id}`)}
                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-400 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-95 group/btn"
                          >
                            Apply Now
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform">
                              <path d="M7 17L17 7M17 7H7M17 7v10"/>
                            </svg>
                          </button>
                        </div>

                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-[#ece7dd] bg-white p-8 text-center text-[#777]">
                  No jobs match your filters.
                </div>
              )}
            </div>
          </main>

        </div>
      </div>
    </section>
  );
}
