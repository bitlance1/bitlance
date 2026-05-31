

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { 
  CircleDollarSign, 
  Briefcase, 
  Trophy, 
  ArrowUpRight, 
  Rocket,
  Plus,
  Clock,
} from 'lucide-react';
import { firebaseAuth, firebaseDb } from '@/lib/firebase';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';

type MilestoneData = {
  freelancerAmountSats?: number;
  totalClientPaysSats?: number;
  fundedSats?: number;
  releasedSats?: number;
  status?: string;
};

type FreelancerEarningSource = {
  freelancerId?: string;
  milestones?: MilestoneData[];
  totalReleasedToFreelancerSats?: number;
  escrowReleasedSats?: number;
  paymentPaidAmountSats?: number;
  totalFundedSats?: number;
  escrowFundedTotalSats?: number;
  status?: string;
};

type UserProfile = {
  fullName?: string;
};

type ProposalSource = {
  createdAt?: { seconds?: number };
  jobTitle?: string;
  clientName?: string;
  rate?: string;
  status?: string;
};

type StatCardProps = {
  title: string;
  value: string;
  sub: string;
  icon: React.ReactElement<{ size?: number }>;
  variant: 'orange' | 'white' | 'dark';
};

const formatSats = (value: number) => `${Math.max(0, value || 0).toLocaleString()} sats`;

const getMilestoneSummary = (job: FreelancerEarningSource) => {
  const milestones = Array.isArray(job.milestones) ? job.milestones : [];
  return milestones.reduce(
    (summary, milestone) => {
      const freelancerAmount = Number(milestone.freelancerAmountSats ?? 0);
      const releasedAmount = Number(milestone.releasedSats ?? freelancerAmount);
      return {
        hasMilestones: true,
        released: summary.released + (milestone.status === 'released' ? releasedAmount : 0),
        funded: summary.funded + ((milestone.status === 'funded' || milestone.status === 'released') ? freelancerAmount : 0),
      };
    },
    { hasMilestones: milestones.length > 0, released: 0, funded: 0 }
  );
};

const getReleasedAmount = (job: FreelancerEarningSource) => {
  const summary = getMilestoneSummary(job);
  if (summary.hasMilestones) return summary.released;
  return Number(job.totalReleasedToFreelancerSats ?? job.escrowReleasedSats ?? job.paymentPaidAmountSats ?? summary.released ?? 0);
};

const getFundedAmount = (job: FreelancerEarningSource) => {
  const summary = getMilestoneSummary(job);
  if (summary.hasMilestones) return summary.funded;
  return Number(job.paymentPaidAmountSats ?? job.totalFundedSats ?? job.escrowFundedTotalSats ?? summary.funded ?? 0);
};

export default function OverviewContent() {
  const [displayName, setDisplayName] = useState('Freelancer');
  const [recentApplications, setRecentApplications] = useState<
    Array<{ id: string; project: string; client: string; amount: string; status: string; date: string }>
  >([]);
  const [earningsStats, setEarningsStats] = useState({ earned: 0, escrow: 0, available: 0 });

  useEffect(() => {
    const unsubscribeAuth = firebaseAuth.onAuthStateChanged((user) => {
      if (!user) return;
      const loadProfile = async () => {
        try {
          const snap = await getDoc(doc(firebaseDb, 'all_users', user.uid));
          const data = snap.exists() ? (snap.data() as UserProfile) : null;
          setDisplayName(data?.fullName ?? user.displayName ?? 'Freelancer');
        } catch {
          setDisplayName(user.displayName ?? 'Freelancer');
        }
      };
      loadProfile();
      const proposalsQuery = query(
        collection(firebaseDb, 'proposals'),
        where('freelancerId', '==', user.uid)
      );
      const unsubscribeProposals = onSnapshot(proposalsQuery, (snapshot) => {
        const items = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as ProposalSource;
          const createdAt = data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0;
          const date = createdAt ? `${Math.max(1, Math.round((Date.now() - createdAt) / 3600000))}h ago` : 'Recently';
          const statusMap: Record<string, string> = {
            accepted: 'Approved',
            submitted: 'Pending',
            rejected: 'Rejected',
          };
          return {
            id: docSnap.id,
            project: data.jobTitle ?? 'Job Proposal',
            client: data.clientName ?? 'Client',
            amount: data.rate ?? '—',
            status: data.status ? statusMap[data.status] ?? 'Pending' : 'Pending',
            date,
          };
        });
        setRecentApplications(items.slice(0, 5));
      });

      const unsubscribeEarnings = onSnapshot(collection(firebaseDb, 'conversations'), (snapshot) => {
        const jobs = snapshot.docs
          .map((docSnap) => docSnap.data() as FreelancerEarningSource)
          .filter((conv) => conv.freelancerId === user.uid);

        let totalEarned = 0;
        let totalEscrow = 0;
        let totalAvailable = 0;

        jobs.forEach((job) => {
          const released = getReleasedAmount(job);
          const funded = getFundedAmount(job);
          const remaining = Math.max(0, funded - released);
          totalEarned += released + remaining;
          totalEscrow += remaining;
          totalAvailable += released;
        });

        setEarningsStats({ earned: totalEarned, escrow: totalEscrow, available: totalAvailable });
      });

      return () => {
        unsubscribeProposals();
        unsubscribeEarnings();
      };
    });
    return () => unsubscribeAuth();
  }, []);

  const proposalsCount = recentApplications.length;
  const pendingCount = useMemo(
    () => recentApplications.filter((app) => app.status === 'Pending').length,
    [recentApplications]
  );
  const approvedCount = useMemo(
    () => recentApplications.filter((app) => app.status === 'Approved').length,
    [recentApplications]
  );

  return (
    <section className="bg-[#FCF9F7] py-16">
      <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
        
        {/* 1. HEADER SECTION */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#F7931A]/10 rounded-xl">
                <Rocket className="w-6 h-6 text-[#F7931A]" />
              </div>
              <h1 className="text-3xl md:font-extrabold text-[#1a1a1a] tracking-tight">
                Welcome, {displayName}!
              </h1>
            </div>
            <p className="text-[#6b6560] text-sm md:text-base font-medium">Ready to stack some more sats today?</p>
          </div>
          <button
            onClick={() => (window.location.href = "/freelancer/dashboard/job-feed")}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-400 to-[#F7931A] text-white px-8 py-4 rounded-2xl font-bold text-sm hover:shadow-[0_8px_20px_-6px_rgba(249,115,22,0.6)] transition-all active:scale-95 group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
            Find New Gigs
          </button>
        </header>

        {/* 2. STATS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <StatCard 
            title="Total Earnings" 
            value={formatSats(earningsStats.earned)} 
            sub={`${formatSats(earningsStats.available)} received`} 
            icon={<CircleDollarSign className="w-6 h-6" />}
            variant="orange"
          />
          <StatCard 
            title="Pending Proposals" 
            value={`${pendingCount}`} 
            sub="Awaiting response" 
            icon={<Briefcase className="w-6 h-6" />}
            variant="white"
          />
          <StatCard 
            title="Proposals Sent" 
            value={`${proposalsCount}`} 
            sub={`${approvedCount} approved`} 
            icon={<Trophy className="w-6 h-6" />}
            variant="white"
          />
        </div>

        {/* 3. RECENT APPLICATIONS TABLE - now full width */}
        <div className="bg-white rounded-3xl border border-[#ece7df] p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-[#F7931A] rounded-full"></div>
              <h2 className="text-lg sm:text-xl font-bold text-[#1a1a1a]">Recent Activity</h2>
            </div>
            <button className="text-sm font-bold text-[#8C4F00] hover:text-[#F7931A] transition-colors flex items-center gap-1 group">
              View Log 
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-[#FCF9F7] text-[11px] uppercase tracking-wider text-[#6b6560] font-bold">
                  <th className="px-6 py-4">Project / Client</th>
                  <th className="px-6 py-4">Bid Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece7df]">
                {recentApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-[#FCF9F7] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#1a1a1a] group-hover:text-[#F7931A] transition-colors">{app.project}</div>
                      <div className="text-xs text-[#6b6560]">{app.client}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm font-bold text-[#1a1a1a]">{app.amount}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-6 py-4 text-xs text-[#6b6560]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {app.date}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- SUB-COMPONENTS ---

function StatCard({ title, value, sub, icon, variant }: StatCardProps) {
  const isDark = variant === 'dark';
  return (
    <div className={`p-6 rounded-[28px] border transition-all hover:translate-y-[-2px] ${
      isDark ? 'bg-[#1a1a1a] border-gray-800 text-white' : 'bg-white border-gray-100 shadow-sm'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${isDark ? 'bg-orange-500/20 text-orange-500' : 'bg-orange-50 text-orange-500'}`}>
          {React.cloneElement(icon, { size: 18 })}
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-orange-400' : 'bg-green-50 text-green-600'}`}>
          {sub}
        </span>
      </div>
      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{title}</p>
      <h3 className="text-xl font-black tracking-tight">{value}</h3>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Approved: "bg-green-50 text-green-600 border-green-100",
    Pending: "bg-orange-50 text-orange-600 border-orange-100",
    Rejected: "bg-gray-50 text-gray-500 border-gray-100",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${styles[status]}`}>
      {status}
    </span>
  );
}
