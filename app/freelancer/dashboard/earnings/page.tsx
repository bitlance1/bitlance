'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronRight,
  Layers,
  Briefcase,
  X,
  Search,
  FileDown,
  TrendingUp,
  Wallet,
  Lock,
} from 'lucide-react';
import FreelancerSidebar from '@/components/molecules/FreelancerSidebar';
import { firebaseAuth, firebaseDb } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

type MilestoneData = {
  index: number;
  title: string;
  freelancerAmountSats: number;
  totalClientPaysSats: number;
  fundedSats: number;
  releasedSats: number;
  platformFeeSats: number;
  status: 'unfunded' | 'funded' | 'submitted' | 'released' | string;
  submittedAt?: string;
  releasedAt?: string;
};

type ConversationData = {
  id: string;
  clientId?: string;
  clientName?: string;
  contractId?: string;
  conversationId?: string;
  createdAt?: any;
  escrowId?: string;
  freelancerId?: string;
  freelancerName?: string;
  jobId?: string;
  jobTitle?: string;
  jobAmountSats?: number;
  lastFundedPaymentHash?: string;
  milestoneCount?: number;
  milestones?: MilestoneData[];
  paymentMode?: string;
  platformFeePercent?: number;
  platformFeeSats?: number;
  releasedMilestoneCount?: number;
  status?: string;
  totalClientPayableSats?: number;
  paymentTotalChargedSats?: number;
  paymentPaidAmountSats?: number;
  paymentStatus?: string;
  totalFundedSats?: number;
  totalReleasedToFreelancerSats?: number;
  escrowFundedTotalSats?: number;
  escrowReleasedSats?: number;
  updatedAt?: any;
};

const formatSats = (value?: number) => `${(value || 0).toLocaleString()} sats`;

const formatShortDate = (value?: any) => {
  if (!value) return '—';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getMilestoneSummary = (job: ConversationData) => {
  const milestones = Array.isArray(job.milestones) ? job.milestones : [];
  return milestones.reduce(
    (summary, milestone) => {
      const freelancerAmount = milestone.freelancerAmountSats ?? 0;
      const releasedAmount = milestone.releasedSats ?? freelancerAmount;
      const clientAmount = milestone.totalClientPaysSats ?? 0;
      const feeAmount = milestone.platformFeeSats ?? 0;
      return {
        hasMilestones: true,
        released: summary.released + (milestone.status === 'released' ? releasedAmount : 0),
        funded: summary.funded + ((milestone.status === 'funded' || milestone.status === 'released') ? freelancerAmount : 0),
        clientPayable: summary.clientPayable + clientAmount,
        fees: summary.fees + feeAmount,
      };
    },
    { hasMilestones: milestones.length > 0, released: 0, funded: 0, clientPayable: 0, fees: 0 }
  );
};

const getReleasedAmount = (job: ConversationData) => {
  const summary = getMilestoneSummary(job);
  if (summary.hasMilestones) return summary.released;
  return job.totalReleasedToFreelancerSats ?? job.escrowReleasedSats ?? job.paymentPaidAmountSats ?? summary.released;
};

const getFundedAmount = (job: ConversationData) => {
  const summary = getMilestoneSummary(job);
  if (summary.hasMilestones) return summary.funded;
  return job.paymentPaidAmountSats ?? job.totalFundedSats ?? job.escrowFundedTotalSats ?? summary.funded;
};

const getContractValue = (job: ConversationData) => {
  const summary = getMilestoneSummary(job);
  return job.totalClientPayableSats ?? job.paymentTotalChargedSats ?? job.jobAmountSats ?? summary.clientPayable;
};

const getFeeAmount = (job: ConversationData) => {
  const summary = getMilestoneSummary(job);
  return job.platformFeeSats ?? summary.fees;
};

export default function EarningsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [selectedJob, setSelectedJob] = useState<ConversationData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rawStats, setRawStats] = useState({ earned: 0, escrow: 0, available: 0 });

  useEffect(() => {
    const unsubscribeAuth = firebaseAuth.onAuthStateChanged((user) => {
      if (!user) {
        setConversations([]);
        setRawStats({ earned: 0, escrow: 0, available: 0 });
        setLoading(false);
        return;
      }
      const conversationsRef = collection(firebaseDb, 'conversations');
      const unsubscribe = onSnapshot(conversationsRef, (snapshot) => {
        const jobs = snapshot.docs
          .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<ConversationData, 'id'>) }))
          .filter((conv) => conv.freelancerId === user.uid);

        let totalEarned = 0, totalEscrow = 0, totalAvailable = 0;
        jobs.forEach((job) => {
          const released = getReleasedAmount(job);
          const funded = getFundedAmount(job);
          const remaining = Math.max(0, funded - released);
          totalEarned += released + remaining;
          totalEscrow += remaining;
          totalAvailable += released;
        });

        setConversations(jobs.sort((a, b) => {
          const da = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt || 0);
          const db2 = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt || 0);
          return db2.getTime() - da.getTime();
        }));
        setRawStats({ earned: totalEarned, escrow: totalEscrow, available: totalAvailable });
        setLoading(false);
      });
      return () => unsubscribe();
    });
    return () => unsubscribeAuth();
  }, []);

  const filteredJobs = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return conversations.filter((job) =>
      (job.jobTitle || '').toLowerCase().includes(lower) ||
      (job.clientName || '').toLowerCase().includes(lower) ||
      (job.status || '').toLowerCase().includes(lower)
    );
  }, [conversations, searchTerm]);

  const monthlySeries = useMemo(() => {
    const months = Array.from({ length: 6 }).map((_, idx) => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - idx));
      return { label: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(), start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 1) };
    });
    const accum = new Array(6).fill(0);
    conversations.forEach((job) => {
      if (Array.isArray(job.milestones)) {
        job.milestones.forEach((ms) => {
          const releasedAt = ms.releasedAt ? new Date(ms.releasedAt) : null;
          if (releasedAt) {
            for (let i = 0; i < months.length; i++) {
              if (releasedAt >= months[i].start && releasedAt < months[i].end) { accum[i] += ms.freelancerAmountSats ?? 0; break; }
            }
          }
        });
      }
      const jobReleased = getReleasedAmount(job);
      if (jobReleased > 0) {
        const date = job.updatedAt?.toDate ? job.updatedAt.toDate() : new Date(job.updatedAt || Date.now());
        for (let i = 0; i < months.length; i++) {
          if (date >= months[i].start && date < months[i].end) { accum[i] += jobReleased; break; }
        }
      }
    });
    return { months: months.map((m) => m.label), values: accum };
  }, [conversations]);

  const chart = useMemo(() => {
    const vals = monthlySeries.values;
    const n = vals.length || 6;
    const w = 600; const h = 110; const pad = 14;
    const max = Math.max(...vals, 1);
    const points = vals.map((v, i) => ({
      x: n === 1 ? w / 2 : (i / (n - 1)) * w,
      y: h - ((v / max) * (h - pad * 2) + pad),
    }));
    const line = points.map((pt, i) =>
      i === 0 ? `M${pt.x},${pt.y}` : `C${(points[i-1].x+pt.x)/2},${points[i-1].y} ${(points[i-1].x+pt.x)/2},${pt.y} ${pt.x},${pt.y}`
    ).join(' ');
    const area = `${line} L${w},${h} L0,${h} Z`;
    return { line, area, points };
  }, [monthlySeries]);

  return (
    <div className="min-h-screen bg-[#F5F0EB] text-[#1A1A1A]">
      <style>{`
        
        .stat-card {
          background: #FFFFFF;
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 16px;
          padding: 18px 20px;
          position: relative;
          overflow: hidden;
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .stat-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.07); transform: translateY(-1px); }
        .stat-icon {
          width: 34px; height: 34px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .chart-card {
          background: #FFFFFF;
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 18px;
          padding: 22px 24px;
        }
        .table-card {
          background: #FFFFFF;
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 18px;
          overflow: hidden;
        }
        .trow { transition: background 0.15s; cursor: pointer; }
        .trow:hover { background: #FFF8F4; }
        .badge-escrow {
          background: #FFF3E0; color: #E07B00;
          border: 1px solid #FFD699;
          border-radius: 20px; padding: 3px 10px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.07em;
        }
        .badge-done {
          background: #E8F5E9; color: #2E7D32;
          border: 1px solid #C8E6C9;
          border-radius: 20px; padding: 3px 10px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.07em;
        }
        .search-in {
          background: #F5F0EB; border: 1px solid rgba(0,0,0,0.08);
          border-radius: 12px; font-size: 12px; color: #1A1A1A;
          padding: 7px 12px 7px 34px; outline: none;
          transition: border-color 0.2s, background 0.2s;
        }
        .search-in:focus { border-color: #F07B00; background: #FFF8F2; }
        .search-in::placeholder { color: #B0A89E; }
        .export-btn {
          background: #F5F0EB; border: 1px solid rgba(0,0,0,0.08);
          border-radius: 12px; color: #8A8078; font-size: 12px;
          font-weight: 500; padding: 7px 14px; cursor: pointer;
          display: flex; align-items: center; gap: 5px;
          transition: all 0.2s;
        }
        .export-btn:hover { border-color: #F07B00; color: #F07B00; background: #FFF8F2; }
        .modal-bg { background: rgba(30,20,10,0.35); backdrop-filter: blur(10px); }
        .modal-panel {
          background: #FDFAF7;
          border-left: 1px solid rgba(0,0,0,0.08);
          box-shadow: -8px 0 40px rgba(0,0,0,0.1);
        }
        .slide-in { animation: slideIn 0.3s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .ms-card {
          background: #F9F5F1; border: 1px solid rgba(0,0,0,0.06);
          border-radius: 13px; padding: 14px;
          transition: border-color 0.2s;
        }
        .ms-card:hover { border-color: #F0A040; }
        .meta-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.04);
        }
        .meta-row:last-child { border-bottom: none; }
        .avatar {
          background: linear-gradient(135deg, #FFE8CC, #FFD0A0);
          border-radius: 50%; display: flex; align-items: center;
          justify-content: center; font-weight: 700;
          font-size: 11px; color: #C05A00;
          border: 1.5px solid rgba(200,90,0,0.15);
        }
        .pulse-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #F07B00;
          animation: pd 2s ease-in-out infinite;
        }
        @keyframes pd { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.6)} }
        .fin-card {
          background: #FFFFFF; border: 1px solid rgba(0,0,0,0.06);
          border-radius: 13px; padding: 14px;
        }
      `}</style>

      <main className="ep-root w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
          <FreelancerSidebar active="/freelancer/dashboard/earnings" />

          <section className="px-6 py-8 lg:px-10 space-y-5 max-w-[1100px]">

            {/* Page Header */}
            <div className="flex items-end justify-between">
              <div>
                {/* <p className="text-[10px] font-bold tracking-[0.16em] text-[#F07B00] uppercase mb-0.5">Dashboard</p> */}
                <h1 className="text-xl font-bold text-[#1A1A1A] tracking-tight">Earnings Overview</h1>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#B0A89E] font-medium">
                <div className="pulse-dot" />
                Live sync
              </div>
            </div>

            {/* ── Compact Stat Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

              {/* Total Earnings */}
              <div className="stat-card">
                <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-orange-50 translate-x-6 -translate-y-6" />
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold tracking-[0.13em] text-[#9A9088] uppercase">Total Earnings</p>
                  <div className="stat-icon bg-orange-50">
                    <TrendingUp className="w-4 h-4 text-[#F07B00]" />
                  </div>
                </div>
                <p className="text-2xl font-semibold text-[#1A1A1A] tracking-tight tabular-nums">
                  {rawStats.earned.toLocaleString()}
                </p>
                <p className="text-[11px] font-semibold text-[#F07B00]/70 mt-0.5">sats</p>
              </div>

              {/* Pending In Escrow */}
              <div className="stat-card">
                <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-amber-50 translate-x-6 -translate-y-6" />
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold tracking-[0.13em] text-[#9A9088] uppercase">In Escrow</p>
                  <div className="stat-icon bg-amber-50">
                    <Lock className="w-4 h-4 text-[#D97706]" />
                  </div>
                </div>
                <p className="text-2xl font-semibold text-[#1A1A1A] tracking-tight tabular-nums">
                  {rawStats.escrow.toLocaleString()}
                </p>
                <p className="text-[11px] font-semibold text-[#D97706]/70 mt-0.5">sats locked</p>
              </div>

              {/* Available Balance */}
              <div className="stat-card">
                <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-green-50 translate-x-6 -translate-y-6" />
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold tracking-[0.13em] text-[#9A9088] uppercase">Available</p>
                  <div className="stat-icon bg-green-50">
                    <Wallet className="w-4 h-4 text-[#2E7D32]" />
                  </div>
                </div>
                <p className="text-2xl font-semibold text-[#2E7D32] tracking-tight tabular-nums">
                  {rawStats.available.toLocaleString()}
                </p>
                <p className="text-[11px] font-semibold text-[#2E7D32]/60 mt-0.5">sats ready</p>
              </div>
            </div>

            {/* ── Chart ── */}
            <div className="chart-card">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">Monthly Performance</h3>
                  <p className="text-[11px] text-[#B0A89E] mt-0.5">Earnings trend — last 6 months</p>
                </div>
                <span className="text-[10px] font-bold tracking-[0.12em] text-[#F07B00] bg-orange-50 border border-orange-100 rounded-lg px-3 py-1.5 uppercase">Sats</span>
              </div>
              <div className="relative">
                <svg className="w-full overflow-visible" viewBox="0 0 600 110" preserveAspectRatio="none" style={{ height: 110 }}>
                  <defs>
                    <linearGradient id="og" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F07B00" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="#F07B00" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>
                  <path d={chart.area} fill="url(#og)" />
                  <path d={chart.line} fill="none" stroke="#F07B00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {chart.points.map((pt, i) => (
                    <circle key={i} cx={pt.x} cy={pt.y} r="3.5" fill="#FFFFFF" stroke="#F07B00" strokeWidth="2" />
                  ))}
                </svg>
                <div className="flex justify-between mt-2.5 px-0.5">
                  {monthlySeries.months.map((m, i) => (
                    <span key={i} className="text-[10px] font-bold tracking-[0.1em] text-[#C0B8B0]">{m}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Transaction History ── */}
            <div className="table-card">
              <div className="px-6 py-4 border-b border-[#F0EBE4] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#1A1A1A]">Transaction History</h2>
                  <p className="text-[11px] text-[#B0A89E] mt-0.5">{filteredJobs.length} contracts</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#C0B8B0] w-3.5 h-3.5" />
                    <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..." className="search-in w-44" />
                  </div>
                  <button className="export-btn"><FileDown className="w-3.5 h-3.5" /> Export</button>
                </div>
              </div>

              {loading ? (
                <div className="py-16 text-center text-xs font-medium text-[#C0B8B0] animate-pulse tracking-widest uppercase">Syncing...</div>
              ) : filteredJobs.length === 0 ? (
                <div className="py-16 text-center text-xs text-[#C0B8B0]">No transactions found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[680px]">
                    <thead>
                      <tr className="border-b border-[#F0EBE4]">
                        {['Date','Client','Contract','Amount (Sats)','Status'].map(h => (
                          <th key={h} className="px-5 py-3 text-[10px] font-bold tracking-[0.12em] text-[#C0B8B0] uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJobs.map((job) => (
                        <tr key={job.id} onClick={() => { setSelectedJob(job); setIsModalOpen(true); }} className="trow border-b border-[#F7F2ED] group">
                          <td className="px-5 py-3.5">
                            <span className="text-[11px] text-[#9A9088]">{formatShortDate(job.updatedAt)}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="avatar w-6 h-6 text-[10px] shrink-0">{(job.clientName || 'C').charAt(0).toUpperCase()}</div>
                              <span className="text-[12px] font-semibold text-[#1A1A1A]">{job.clientName || 'External Client'}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-[12px] font-medium text-[#4A4040] group-hover:text-[#F07B00] transition-colors">{job.jobTitle || 'Scope Contract'}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-[12px] font-semibold text-[#1A1A1A]">
                              {getContractValue(job).toLocaleString()} <span className="text-[#C0B8B0] font-normal">sats</span>
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-between gap-2">
                              <StatusPill status={job.status || ''} />
                              <ChevronRight className="w-3.5 h-3.5 text-[#C0B8B0] opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="border-t border-[#F0EBE4] px-6 py-3 flex justify-center">
                <button className="text-[11px] font-semibold text-[#B0A89E] hover:text-[#F07B00] flex items-center gap-1 transition-colors">
                  View all transactions <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

          </section>
        </div>
      </main>

      {/* Slide-Over Detail Modal */}
      {isModalOpen && selectedJob && (
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
          <div className="modal-bg absolute inset-0" onClick={() => setIsModalOpen(false)} />
          <div className="modal-panel relative w-full max-w-md h-full flex flex-col z-10 slide-in">

            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-[#EDE8E2] flex items-start justify-between bg-[#FDFAF7]">
              <div>
                <span className="text-[9px] font-bold tracking-[0.18em] text-[#F07B00]/60 uppercase flex items-center gap-1.5">
                  <Briefcase className="w-2.5 h-2.5" /> Contract Details
                </span>
                <h3 className="text-sm font-bold text-[#1A1A1A] mt-1.5 pr-4">{selectedJob.jobTitle}</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-[#C0B8B0] hover:text-[#1A1A1A] rounded-lg hover:bg-[#F0EBE4] transition shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">

              {/* Financial Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Contract Value', value: formatSats(getContractValue(selectedJob)), color: 'text-[#1A1A1A]' },
                  { label: 'Locked in Escrow', value: formatSats(getFundedAmount(selectedJob)), color: 'text-[#D97706]' },
                  { label: 'Released to You', value: formatSats(getReleasedAmount(selectedJob)), color: 'text-[#2E7D32]' },
                  { label: 'Platform Fees', value: formatSats(getFeeAmount(selectedJob)), color: 'text-[#9A9088]' },
                ].map((item) => (
                  <div key={item.label} className="fin-card">
                    <span className="text-[9px] font-bold tracking-[0.12em] text-[#B0A89E] uppercase block mb-1.5">{item.label}</span>
                    <span className={`text-[12px] font-semibold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Meta Info */}
              <div className="bg-white border border-[#EDE8E2] rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#F0EBE4]">
                  <span className="text-[9px] font-bold tracking-[0.14em] text-[#B0A89E] uppercase">Contract Info</span>
                </div>
                <div className="px-4 py-1">
                  {[
                    { key: 'Client', val: selectedJob.clientName },
                    { key: 'Contract ID', val: <span className="text-[10px] bg-[#F5F0EB] px-1.5 py-0.5 rounded text-[#9A9088]">{(selectedJob.contractId || selectedJob.id || '').slice(0, 16)}…</span> },
                    { key: 'Payment Mode', val: <span className="capitalize">{selectedJob.paymentMode || 'Milestone'}</span> },
                    { key: 'Last Updated', val: formatShortDate(selectedJob.updatedAt) },
                  ].map((row) => (
                    <div key={row.key} className="meta-row">
                      <span className="text-[11px] text-[#9A9088]">{row.key}</span>
                      <span className="text-[11px] font-semibold text-[#1A1A1A]">{row.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Milestones */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Layers className="w-3.5 h-3.5 text-[#F07B00]/60" />
                  <span className="text-[10px] font-bold tracking-[0.12em] text-[#9A9088] uppercase">Milestones</span>
                </div>
                {selectedJob.milestones && selectedJob.milestones.length > 0 ? (
                  <div className="space-y-2">
                    {selectedJob.milestones.map((ms, idx) => (
                      <div key={idx} className="ms-card">
                        <div className="flex items-start justify-between mb-2.5">
                          <div>
                            <span className="text-[9px] font-bold tracking-[0.1em] text-[#C0B8B0] uppercase">Stage {ms.index || idx + 1}</span>
                            <p className="text-[11px] font-semibold text-[#1A1A1A] mt-0.5">{ms.title || `Milestone ${idx + 1}`}</p>
                          </div>
                          <MiniMilestoneBadge status={ms.status} />
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-[#EDE8E2]">
                          {[
                            { label: 'Client pays', val: formatSats(ms.totalClientPaysSats), color: 'text-[#4A4040]' },
                            { label: 'Fee', val: `−${formatSats(ms.platformFeeSats)}`, color: 'text-[#B0A89E]' },
                            { label: 'You receive', val: formatSats(ms.freelancerAmountSats), color: 'text-[#2E7D32]' },
                          ].map((col) => (
                            <div key={col.label}>
                              <span className="text-[9px] text-[#B0A89E] uppercase tracking-wide block mb-1">{col.label}</span>
                              <span className={`text-[11px] font-semibold ${col.color}`}>{col.val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-7 border border-dashed border-[#E8E0D8] rounded-xl text-[11px] text-[#C0B8B0]">No milestones found</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const norm = status.toLowerCase();
  const done = norm === 'released' || norm === 'completed' || norm === 'approved';
  return done
    ? <span className="badge-done">COMPLETED</span>
    : <span className="badge-escrow">ESCROW</span>;
}

function MiniMilestoneBadge({ status }: { status: string }) {
  const norm = (status || '').toLowerCase();
  const map: Record<string, { bg: string; text: string; border: string; label: string }> = {
    released: { bg: '#E8F5E9', text: '#2E7D32', border: '#C8E6C9', label: 'PAID' },
    submitted: { bg: '#E3F2FD', text: '#1565C0', border: '#BBDEFB', label: 'REVIEW' },
    funded:    { bg: '#FFF3E0', text: '#E07B00', border: '#FFD699', label: 'FUNDED' },
  };
  const s = map[norm] || { bg: '#F5F0EB', text: '#9A9088', border: '#E8E0D8', label: 'PENDING' };
  return (
    <span style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}`, borderRadius: 8, padding: '2px 8px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>
      {s.label}
    </span>
  );
}
