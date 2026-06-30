'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { firebaseDb } from '@/lib/firebase';
import { collection, query, limit, getDocs, onSnapshot, where, documentId, doc, getDoc } from 'firebase/firestore';

type JobItem = {
  id: string;
  title: string;
  description: string;
  price: string;
  tags: string[];
  client: string;
  companyLogo: string;
  postedAt: string;
  rawCreatedAt: any;
  urgent?: boolean;
  clientId?: string;
};

type ClientSpotlightItem = {
  name: string;
  title: string;
  rating: number;
  completedJobs: number;
  spent: string;
  avatar: string;
};

// ─── Helper Utilities ────────────────────────────────────────────────────────

const getTimestampMs = (value: any): number => {
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
      return ts.seconds * 1000;
    }
  }
  return 0;
};

const formatPostedAt = (createdAt: any): string => {
  const ms = getTimestampMs(createdAt);
  if (!ms) return 'Recently';

  const diff = Math.max(0, Date.now() - ms);
  const m = 60 * 1000;
  const h = 60 * m;
  const d = 24 * h;

  if (diff < m) return 'Just now';
  if (diff < h) return `${Math.floor(diff / m)}m ago`;
  if (diff < d) return `${Math.floor(diff / h)}h ago`;
  return `${Math.floor(diff / d)}d ago`;
};

const formatBudgetCompact = (value: any): string => {
  const clean = String(value ?? '').replace(/[^0-9.]/g, '');
  if (!clean) return '0 Sats';
  const num = Number(clean);
  if (num >= 1000000) {
    const formatted = (num / 1000000).toFixed(1).replace('.0', '');
    return `${formatted}M Sats`;
  }
  if (num >= 1000) {
    const formatted = (num / 1000).toFixed(0);
    return `${formatted}K Sats`;
  }
  return `${num} Sats`;
};

// ─── Default Mock Fallbacks (Exactly matching the screenshot) ───────────────

const DEFAULT_FEATURED: JobItem = {
  id: 'mock-featured',
  title: 'Senior Rust Engineer for Lightning L3',
  description: 'We are looking for a advanced engineer to build low-latency infrastructure for a new Bitcoin-native scaling solution. Must be Rust native.',
  price: '4.5M Sats',
  tags: ['Rust', 'Lightning', 'Remote'],
  client: 'Zap Labs',
  companyLogo: '',
  postedAt: '2h ago',
  rawCreatedAt: null,
  clientId: 'mock-client',
};

const DEFAULT_OPPORTUNITIES: JobItem[] = [
  {
    id: 'mock-op-1',
    title: 'Bitcoin Writer for Blog',
    description: 'Write educational content for Bitcoin beginners.',
    price: '560K Sats',
    tags: ['Writing', 'Remote'],
    client: 'BTC Inc',
    companyLogo: '',
    postedAt: '3h ago',
    rawCreatedAt: null,
  },
  {
    id: 'mock-op-2',
    title: 'Smart Contract Auditor',
    description: 'Audit our BTC-native lending application for security vulnerabilities.',
    price: '2.2M Sats',
    tags: ['Security', 'Solidity', 'Remote'],
    client: 'Sparrow Finance',
    companyLogo: '',
    postedAt: '5h ago',
    rawCreatedAt: null,
  },
  {
    id: 'mock-op-3',
    title: 'Tech Whitepaper Editor',
    description: 'Review and polish our technical whitepaper for a new Bitcoin L2 protocol.',
    price: '800K Sats',
    tags: ['Technical', 'Writing'],
    client: 'Nostr Tools',
    companyLogo: '',
    postedAt: '6h ago',
    rawCreatedAt: null,
  },
];

const DEFAULT_SPOTLIGHT: ClientSpotlightItem = {
  name: 'Zap Labs',
  title: 'Bitcoin scaling company',
  rating: 5,
  completedJobs: 12,
  spent: '12M Sats',
  avatar: '',
};

// ─── Company logo box component ──────────────────────────────────────────────

function LogoBox({ url, name }: { url?: string; name?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (url && !failed) {
    return (
      <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-[10px] bg-[#FAF8F5] border border-[#EAE7E2] overflow-hidden flex items-center justify-center">
        <img src={url} alt={name || 'Logo'} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      </div>
    );
  }

  const lowerName = String(name ?? '').toLowerCase();
  
  if (lowerName.includes('zap') || lowerName.includes('lightning')) {
    return (
      <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-[10px] bg-[#FFF5E5] border border-[#FEE8C8] flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2.5">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </div>
    );
  }

  if (lowerName.includes('btc') || lowerName.includes('bitcoin')) {
    return (
      <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-[10px] bg-[#FFF5E5] border border-[#FEE8C8] flex items-center justify-center">
        <span className="text-base font-black text-[#F7931A]">B</span>
      </div>
    );
  }

  if (lowerName.includes('sparrow') || lowerName.includes('finance') || lowerName.includes('auditor') || lowerName.includes('dca')) {
    return (
      <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-[10px] bg-[#FFF5E5] border border-[#FEE8C8] flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>
    );
  }

  if (lowerName.includes('nostr') || lowerName.includes('tools') || lowerName.includes('editor')) {
    return (
      <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-[10px] bg-[#FFF5E5] border border-[#FEE8C8] flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          <path d="M2 12h20" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-[10px] bg-[#F4F1EE] border border-[#EAE7E2] flex items-center justify-center">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b6560" strokeWidth="2.5">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    </div>
  );
}

// ─── Main Section Component ──────────────────────────────────────────────────

export default function TopOpportunities() {
  const router = useRouter();
  const [featuredJob, setFeaturedJob] = useState<JobItem>(DEFAULT_FEATURED);
  const [opportunities, setOpportunities] = useState<JobItem[]>(DEFAULT_OPPORTUNITIES);
  const [clientSpotlight, setClientSpotlight] = useState<ClientSpotlightItem>(DEFAULT_SPOTLIGHT);

  useEffect(() => {
    // 1. Subscribe to real jobs collection
    const unsubscribeJobs = onSnapshot(collection(firebaseDb, 'jobs'), async (snapshot) => {
      if (snapshot.empty) {
        setFeaturedJob(DEFAULT_FEATURED);
        setOpportunities(DEFAULT_OPPORTUNITIES);
        return;
      }

      // Collect unique client IDs to query their logos
      const clientIds = Array.from(
        new Set(
          snapshot.docs
            .map((docSnap) => (docSnap.data() as any).clientId)
            .filter((id): id is string => !!id)
        )
      );

      const logoMap: Record<string, string> = {};
      if (clientIds.length > 0) {
        try {
          const chunkSize = 30;
          for (let i = 0; i < clientIds.length; i += chunkSize) {
            const chunk = clientIds.slice(i, i + chunkSize);
            const clientsSnap = await getDocs(
              query(collection(firebaseDb, 'clients'), where(documentId(), 'in', chunk))
            );
            clientsSnap.docs.forEach((cDoc) => {
              const cData = cDoc.data() as any;
              const logo = cData.companyLogo || cData.companyLogoUrl || '';
              if (logo) logoMap[cDoc.id] = logo;
            });
          }
        } catch (err) {
          console.error("Error loading logos for Top Opportunities:", err);
        }
      }

      // Map jobs
      const jobsList: JobItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as any;
        return {
          id: docSnap.id,
          title: data.title ?? 'Untitled Job',
          description: (data.description ?? '').replace(/\s{2,}/g, ' ').trim(),
          price: formatBudgetCompact(data.budget),
          tags: Array.isArray(data.skills) ? data.skills : [],
          client: data.clientCompany || data.clientName || 'Client',
          companyLogo: data.companyLogo || logoMap[data.clientId] || '',
          postedAt: formatPostedAt(data.createdAt),
          rawCreatedAt: data.createdAt,
          urgent: !!data.urgent,
          clientId: data.clientId ?? '',
        };
      });

      // Sort by creation date descending
      jobsList.sort((a, b) => getTimestampMs(b.rawCreatedAt) - getTimestampMs(a.rawCreatedAt));

      if (jobsList.length > 0) {
        const tempJobs = [...jobsList];
        // Try to find the first urgent job or just use the first item as featured
        const featuredIndex = tempJobs.findIndex((j) => !!j.urgent);
        const selectedFeatured = featuredIndex !== -1 ? tempJobs.splice(featuredIndex, 1)[0] : tempJobs.shift()!;
        setFeaturedJob(selectedFeatured);
        
        // Take the next 3 as standard opportunities
        const standardOps = tempJobs.slice(0, 3);
        const paddedOps = [...standardOps];
        while (paddedOps.length < 3) {
          const fallbackIndex = paddedOps.length;
          paddedOps.push(DEFAULT_OPPORTUNITIES[fallbackIndex]);
        }
        setOpportunities(paddedOps);
      }
    });

    return () => {
      unsubscribeJobs();
    };
  }, []);

  // 2. Query Client details dynamically based on the featured job's clientId
  useEffect(() => {
    if (!featuredJob.clientId || featuredJob.id === 'mock-featured') {
      setClientSpotlight({
        name: featuredJob.client,
        title: 'Bitcoin Infrastructure Company',
        rating: 5,
        completedJobs: 12,
        spent: '12M Sats',
        avatar: featuredJob.companyLogo || '',
      });
      return;
    }

    const fetchClientData = async () => {
      const cId = featuredJob.clientId;
      if (!cId) return;

      try {
        let name = featuredJob.client || 'Client';
        let title = 'Bitcoin Client';
        let avatar = featuredJob.companyLogo || '';
        let rating = 5.0;

        // Try getting doc from 'clients' collection
        const clientSnap = await getDoc(doc(firebaseDb, 'clients', cId));
        if (clientSnap.exists()) {
          const cData = clientSnap.data() as any;
          name = cData.companyName || cData.fullName || cData.name || name;
          title = cData.headline || cData.industry || title;
          avatar = cData.companyLogo || cData.companyLogoUrl || cData.avatarUrl || cData.avatar || avatar;
          rating = typeof cData.rating === 'number' ? cData.rating : rating;
        }

        // Try getting doc from 'all_users' collection
        const userSnap = await getDoc(doc(firebaseDb, 'all_users', cId));
        if (userSnap.exists()) {
          const uData = userSnap.data() as any;
          name = uData.fullName || uData.name || name;
          avatar = uData.avatarUrl || uData.avatar || avatar;
        }

        // Count completed contracts & spent sats
        const contractsQuery = query(collection(firebaseDb, 'contracts'), where('clientId', '==', cId));
        const contractsSnap = await getDocs(contractsQuery);
        
        let completedJobsCount = 0;
        let totalSpentSats = 0;

        contractsSnap.docs.forEach((cDoc) => {
          const cData = cDoc.data() as any;
          if (cData.status === 'Completed' || cData.paymentStatus === 'released' || cData.workStatus === 'approved') {
            completedJobsCount += 1;
          }
          const milestones = cData.milestones ?? [];
          if (milestones.length > 0) {
            const releasedSum = milestones.reduce((sum: number, ms: any) => sum + Number(ms.releasedSats ?? 0), 0);
            totalSpentSats += releasedSum;
          } else {
            totalSpentSats += Number(cData.escrowReleasedSats ?? 0);
          }
        });

        // Count all posted jobs as fallback
        const jobsQuery = query(collection(firebaseDb, 'jobs'), where('clientId', '==', cId));
        const jobsSnap = await getDocs(jobsQuery);
        const postedJobsCount = jobsSnap.size;

        setClientSpotlight({
          name,
          title,
          rating,
          completedJobs: completedJobsCount || postedJobsCount || 0,
          spent: formatBudgetCompact(totalSpentSats),
          avatar,
        });
      } catch (err) {
        console.error("Error loading client spotlight:", err);
      }
    };

    fetchClientData();
  }, [featuredJob.clientId, featuredJob.id]);

  return (
    <section className="bg-[#FCF9F7] py-20 border-b border-[#F0EDE8]">
      <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-extrabold text-[#1a1a1a] tracking-tight">Top Opportunities</h2>
            <p className="mt-2 text-sm font-medium text-[#6b6560]">Curated featured jobs from the Bitcoin ecosystem</p>
          </div>
          <button 
            onClick={() => router.push('/freelancer/dashboard/job-feed')}
            className="text-sm font-bold text-[#8C4F00] hover:underline"
          >
            View All Jobs
          </button>
        </div>

        {/* 3-Column Grid Layout */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3 items-stretch">
          
          {/* Left Side: Featured Card (Takes 2 Columns on Desktop) */}
          <div className="lg:col-span-2 flex flex-col justify-between rounded-[24px] border border-[#EAE7E2] bg-white p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative min-h-[190px]">
            {/* Price badge */}
            <div className="absolute top-5 right-5 sm:top-6 sm:right-6 text-lg sm:text-xl font-black text-[#F7931A]">
              {featuredJob.price}
            </div>

            <div className="flex gap-4 sm:gap-5 items-start">
              {/* Logo Box */}
              <LogoBox url={featuredJob.companyLogo} name={featuredJob.client} />

              {/* Job Details */}
              <div className="flex-1 pr-24 min-w-0">
                <span className="inline-block rounded-full bg-[#FFF5E5] border border-[#FEE8C8] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#F7931A] mb-2">
                  Featured
                </span>
                <h3 
                  onClick={() => router.push(`/job/${featuredJob.id}`)}
                  className="text-base sm:text-lg font-extrabold text-[#1a1a1a] mb-1.5 leading-snug cursor-pointer hover:text-[#F7931A] transition-colors"
                >
                  {featuredJob.title}
                </h3>
                <p 
                  className="text-xs sm:text-sm leading-relaxed text-[#6b6560] mb-3 overflow-hidden"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {featuredJob.description}
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {featuredJob.tags.map((tag) => (
                    <span key={tag} className="px-2.5 py-0.5 bg-[#F4F1EE] text-[#6b6560] text-xs font-bold rounded-full border border-[#EAE7E2]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="border-t border-[#F4F1EE] pt-3.5 mt-1.5 flex items-center justify-between text-xs text-[#9e9690] font-semibold">
              <span>{featuredJob.client} • {featuredJob.postedAt}</span>
            </div>
          </div>

          {/* Right Side: Client Spotlight Card (Takes 1 Column on Desktop) */}
          <div className="lg:col-span-1 rounded-[24px] border border-[#EAE7E2] bg-[#FAF8F4] p-5 sm:p-6 flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            <div className="flex items-center gap-3">
              {/* Profile Avatar */}
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-full overflow-hidden border-2 border-white shadow-sm flex-shrink-0 bg-white flex items-center justify-center">
                {clientSpotlight?.avatar ? (
                  <img 
                    src={clientSpotlight.avatar} 
                    alt={clientSpotlight.name} 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="2.5" className="text-[#F7931A]">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                )}
              </div>
              <div className="text-left min-w-0 flex-1">
                <h4 className="text-sm sm:text-base font-extrabold text-[#1a1a1a] truncate">{clientSpotlight?.name}</h4>
                <p className="text-xs font-semibold text-[#8C4F00] mt-0.5 truncate">{clientSpotlight?.title}</p>
              </div>
            </div>

            {/* Stats section */}
            <div className="my-4 border-t border-b border-[#EAE7E2] py-3 grid grid-cols-3 gap-2 text-center">
              <div className="text-left">
                <div className="text-[9px] font-black uppercase tracking-wider text-[#9e9690] mb-1">Rating</div>
                <div className="flex items-center gap-0.5">
                  <div className="flex text-[#F7931A] text-[10px]">
                    {Array.from({ length: Math.round(clientSpotlight?.rating || 5) }).map((_, i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>
                  <span className="text-xs font-black text-[#1a1a1a] ml-1">{Number(clientSpotlight?.rating || 5).toFixed(1)}</span>
                </div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase tracking-wider text-[#9e9690] mb-1">Completed</div>
                <div className="text-xs font-extrabold text-[#1a1a1a] tabular-nums">{clientSpotlight?.completedJobs ?? 0}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-black uppercase tracking-wider text-[#9e9690] mb-1">Spent</div>
                <div className="text-xs font-extrabold text-[#1a1a1a] tabular-nums">{clientSpotlight?.spent || '0 Sats'}</div>
              </div>
            </div>

            {/* View Profile Button */}
            <button 
              onClick={() => {
                if (featuredJob.clientId && featuredJob.clientId !== 'mock-client') {
                  router.push(`/client/public/${featuredJob.clientId}`);
                } else {
                  router.push('/freelancer/dashboard/job-feed');
                }
              }}
              className="w-full bg-[#1b1c1b] text-white py-2.5 px-4 rounded-xl font-bold text-sm hover:bg-[#2c2d2c] transition-colors shadow-sm"
            >
              View Profile
            </button>
          </div>

          {/* Row 2: 3 Opportunity Cards Grid (Spans 3 Columns) */}
          <div className="lg:col-span-3 grid gap-6 grid-cols-1 md:grid-cols-3 mt-4">
            {opportunities.map((job) => (
              <div 
                key={job.id} 
                className="rounded-[20px] border border-[#EAE7E2] bg-white p-5 flex gap-4 shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:border-[#F7931A]/30 hover:shadow-md transition-all group"
              >
                <LogoBox url={job.companyLogo} name={job.client} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 
                      onClick={() => router.push(`/job/${job.id}`)}
                      className="text-sm font-bold text-[#1a1a1a] truncate group-hover:text-[#F7931A] transition-colors cursor-pointer"
                    >
                      {job.title}
                    </h4>
                    <span className="text-xs font-black text-[#1a1a1a] whitespace-nowrap">{job.price}</span>
                  </div>
                  <p className="text-xs text-[#6b6560] leading-relaxed mb-3 line-clamp-2">
                    {job.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {job.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-[#F4F1EE] text-[#6b6560] text-[10px] font-bold rounded-full border border-[#EAE7E2]">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] text-[#9e9690] font-semibold">{job.client} • {job.postedAt}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
