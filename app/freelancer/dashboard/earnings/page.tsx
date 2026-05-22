// 'use client';

// import React, { useEffect, useMemo, useState } from 'react';
// import {
//   ArrowRight,
//   Banknote,
//   CircleDollarSign,
//   Clock,
//   Search,
//   ShieldCheck,
//   TrendingUp,
//   X,
//   FileDown,
//   ChevronRight,
//   Layers,
//   Calendar,
//   Briefcase,
//   User
// } from 'lucide-react';
// import FreelancerSidebar from '@/components/molecules/FreelancerSidebar';
// import { firebaseAuth, firebaseDb } from '@/lib/firebase';
// import { collection, onSnapshot } from 'firebase/firestore';

// type MilestoneData = {
//   index: number;
//   title: string;
//   freelancerAmountSats: number;
//   totalClientPaysSats: number;
//   fundedSats: number;
//   releasedSats: number;
//   platformFeeSats: number;
//   status: 'unfunded' | 'funded' | 'submitted' | 'released' | string;
//   submittedAt?: string;
//   releasedAt?: string;
// };

// type ConversationData = {
//   id: string;
//   clientId?: string;
//   clientName?: string;
//   contractId?: string;
//   conversationId?: string;
//   createdAt?: any;
//   escrowId?: string;
//   freelancerId?: string;
//   freelancerName?: string;
//   jobId?: string;
//   jobTitle?: string;
//   jobAmountSats?: number;
//   lastFundedPaymentHash?: string;
//   milestoneCount?: number;
//   milestones?: MilestoneData[];
//   paymentMode?: string;
//   platformFeePercent?: number;
//   platformFeeSats?: number;
//   releasedMilestoneCount?: number;
//   status?: string;
//   totalClientPayableSats?: number;
//   paymentTotalChargedSats?: number;
//   paymentPaidAmountSats?: number;
//   paymentStatus?: string;
//   totalFundedSats?: number;
//   totalReleasedToFreelancerSats?: number;
//   escrowFundedTotalSats?: number;
//   escrowReleasedSats?: number;
//   updatedAt?: any;
// };

// const formatSats = (value?: number) => `${(value || 0).toLocaleString()} Sats`;

// const formatShortDate = (value?: any) => {
//   if (!value) return '-';
//   const date = value?.toDate ? value.toDate() : new Date(value);
//   if (Number.isNaN(date.getTime())) return '-';
//   return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
// };

// const getMilestoneSummary = (job: ConversationData) => {
//   const milestones = Array.isArray(job.milestones) ? job.milestones : [];
//   return milestones.reduce(
//     (summary, milestone) => {
//       const freelancerAmount = milestone.freelancerAmountSats ?? 0;
//       const fundedAmount = milestone.fundedSats ?? milestone.totalClientPaysSats ?? 0;
//       const clientAmount = milestone.totalClientPaysSats ?? 0;
//       const feeAmount = milestone.platformFeeSats ?? 0;

//       return {
//         released: summary.released + (milestone.status === 'released' ? freelancerAmount : 0),
//         funded: summary.funded + ((milestone.status === 'funded' || milestone.status === 'released') ? fundedAmount : 0),
//         clientPayable: summary.clientPayable + clientAmount,
//         fees: summary.fees + feeAmount,
//       };
//     },
//     { released: 0, funded: 0, clientPayable: 0, fees: 0 }
//   );
// };

// const getReleasedAmount = (job: ConversationData) => {
//   const summary = getMilestoneSummary(job);
//   return job.totalReleasedToFreelancerSats ?? job.escrowReleasedSats ?? job.paymentPaidAmountSats ?? summary.released;
// };

// const getFundedAmount = (job: ConversationData) => {
//   const summary = getMilestoneSummary(job);
//   return job.totalFundedSats ?? job.escrowFundedTotalSats ?? summary.funded;
// };

// const getContractValue = (job: ConversationData) => {
//   const summary = getMilestoneSummary(job);
//   return job.totalClientPayableSats ?? job.paymentTotalChargedSats ?? job.jobAmountSats ?? summary.clientPayable;
// };

// const getFeeAmount = (job: ConversationData) => {
//   const summary = getMilestoneSummary(job);
//   return job.platformFeeSats ?? summary.fees;
// };

// const getStatusText = (job: ConversationData) => job.status ?? job.paymentStatus ?? 'unknown';

// export default function EarningsPage() {
//   const [searchTerm, setSearchTerm] = useState('');
//   const [conversations, setConversations] = useState<ConversationData[]>([]);
//   const [selectedJob, setSelectedJob] = useState<ConversationData | null>(null);
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [loading, setLoading] = useState(true);

//   // Pure Math State Aggregations
//   const [rawStats, setRawStats] = useState({
//     earned: 0,
//     escrow: 0,
//     available: 0
//   });

//   useEffect(() => {
//     const unsubscribeAuth = firebaseAuth.onAuthStateChanged((user) => {
//       if (!user) {
//         setConversations([]);
//         setRawStats({ earned: 0, escrow: 0, available: 0 });
//         setLoading(false);
//         return;
//       }

//       const conversationsRef = collection(firebaseDb, 'conversations');
//       const unsubscribe = onSnapshot(conversationsRef, (snapshot) => {
//         const jobs = snapshot.docs
//           .map((doc) => {
//             const data = doc.data() as Omit<ConversationData, 'id'>;
//             return { id: doc.id, ...data };
//           })
//           .filter((conv) => conv.freelancerId === user.uid);

//         let totalEarnedCalculated = 0;
//         let totalEscrowCalculated = 0;
//         let totalAvailableCalculated = 0;

//         jobs.forEach((job) => {
//           const released = getReleasedAmount(job);
//           const funded = getFundedAmount(job);
//           const remainingInEscrow = Math.max(0, funded - released);

//           // Total earnings should include both released and the remaining escrowed funds tied to this contract.
//           totalEarnedCalculated += released + remainingInEscrow;
//           totalEscrowCalculated += remainingInEscrow;

//           // Available balance is only confirmed released or completed value.
//           if (job.status === 'released' || job.status === 'completed' || job.status === 'approved') {
//             totalAvailableCalculated += released;
//           }
//         });

//         setConversations(jobs.sort((a, b) => {
//           const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt || 0);
//           const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt || 0);
//           return dateB.getTime() - dateA.getTime();
//         }));

//         setRawStats({
//           earned: totalEarnedCalculated,
//           escrow: totalEscrowCalculated,
//           available: totalAvailableCalculated
//         });
//         setLoading(false);
//       });

//       return () => unsubscribe();
//     });

//     return () => unsubscribeAuth();
//   }, []);

//   const filteredJobs = useMemo(() => {
//     const lower = searchTerm.toLowerCase();
//     return conversations.filter((job) =>
//       (job.jobTitle || '').toLowerCase().includes(lower) ||
//       (job.clientName || '').toLowerCase().includes(lower) ||
//       (job.status || '').toLowerCase().includes(lower)
//     );
//   }, [conversations, searchTerm]);

//   const openDetails = (job: ConversationData) => {
//     setSelectedJob(job);
//     setIsModalOpen(true);
//   };

//   // Monthly series (last 6 months) based on milestone released dates or job updatedAt
//   const monthlySeries = useMemo(() => {
//     const months: { label: string; start: Date; end: Date }[] = Array.from({ length: 6 }).map((_, idx) => {
//       const d = new Date();
//       d.setDate(1);
//       d.setMonth(d.getMonth() - (5 - idx));
//       return { label: d.toLocaleString('en-US', { month: 'short' }), start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 1) };
//     });

//     const accum = new Array(6).fill(0);

//     conversations.forEach((job) => {
//       // use milestones with releasedAt where available
//       if (Array.isArray(job.milestones) && job.milestones.length) {
//         job.milestones.forEach((ms) => {
//           const releasedAt = ms.releasedAt ? new Date(ms.releasedAt) : null;
//           const amount = ms.freelancerAmountSats ?? 0;
//           if (releasedAt) {
//             for (let i = 0; i < months.length; i++) {
//               if (releasedAt >= months[i].start && releasedAt < months[i].end) {
//                 accum[i] += amount;
//                 break;
//               }
//             }
//           }
//         });
//       }

//       // fallback: if job has top-level released total, bucket by updatedAt
//       const jobReleased = getReleasedAmount(job);
//       if (jobReleased && jobReleased > 0) {
//         const date = job.updatedAt?.toDate ? job.updatedAt.toDate() : new Date(job.updatedAt || Date.now());
//         for (let i = 0; i < months.length; i++) {
//           if (date >= months[i].start && date < months[i].end) {
//             accum[i] += jobReleased;
//             break;
//           }
//         }
//       }
//     });

//     return { months: months.map((m) => m.label), values: accum };
//   }, [conversations]);

//   const chart = useMemo(() => {
//     const vals = monthlySeries.values || [];
//     const n = vals.length || 6;
//     const w = 600;
//     const h = 100;
//     const pad = 8;
//     const max = Math.max(...vals, 1);
//     const points = vals.map((v, i) => {
//       const x = n === 1 ? w / 2 : (i / (n - 1)) * w;
//       const y = h - ((v / max) * (h - pad * 2) + pad);
//       return { x, y };
//     });
//     const line = points.map((pt, i) => (i === 0 ? `M${pt.x},${pt.y}` : `L${pt.x},${pt.y}`)).join(' ');
//     const area = `${line} L ${w},${h} L 0,${h} Z`;
//     return { line, area, max, latest: vals[vals.length - 1] ?? 0 };
//   }, [monthlySeries]);

//   return (
//     <div className="min-h-screen bg-[#F8F9FC] text-[#1E293B]">
//       <main className="w-full">
//         <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-0">
//           <FreelancerSidebar active="/freelancer/dashboard/earnings" />

//           <section className="w-full px-6 py-10 lg:px-12 max-w-[1400px] mx-auto space-y-8">
            
//             {/* Top Row Stat Metrics Display Frame */}
//             <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
//               {/* Card 1: Total Earnings */}
//               <div className="bg-white p-8 rounded-[24px] border border-[#E2E8F0] shadow-[0_4px_20px_rgba(226,232,240,0.4)] relative overflow-hidden group">
//                 <div className="absolute top-0 right-0 w-32 h-32 bg-[#F59E0B]/5 rounded-full translate-x-8 -translate-y-8 transition-transform group-hover:scale-110" />
//                 <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Total Earnings</p>
//                 <div className="mt-3 flex flex-col">
//                   <span className="text-3xl font-extrabold tracking-tight text-[#0F172A]">{rawStats.earned.toLocaleString()}</span>
//                   <span className="text-xl font-bold text-[#0F172A] mt-0.5">Sats</span>
//                 </div>
//               </div>

//               {/* Card 2: Pending In Escrow */}
//               <div className="bg-white p-8 rounded-[24px] border border-[#E2E8F0] shadow-[0_4px_20px_rgba(226,232,240,0.4)] relative overflow-hidden group">
//                 <div className="absolute top-0 right-0 w-32 h-32 bg-[#3B82F6]/5 rounded-full translate-x-8 -translate-y-8 transition-transform group-hover:scale-110" />
//                 <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Pending in Escrow</p>
//                 <div className="mt-3 flex flex-col">
//                   <span className="text-3xl font-extrabold tracking-tight text-[#0F172A]">{rawStats.escrow.toLocaleString()}</span>
//                   <span className="text-xl font-bold text-[#0F172A] mt-0.5">Sats</span>
//                 </div>
//                 <p className="mt-4 text-xs text-[#94A3B8] font-medium">Locked in contract</p>
//               </div>

//               {/* Card 3: Available Balance */}
//               <div className="bg-white p-8 rounded-[24px] border border-[#E2E8F0] shadow-[0_4px_20px_rgba(226,232,240,0.4)] relative overflow-hidden group">
//                 <div className="absolute top-0 right-0 w-32 h-32 bg-[#D97706]/5 rounded-full translate-x-8 -translate-y-8 transition-transform group-hover:scale-110" />
//                 <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Available Balance</p>
//                 <div className="mt-3 flex flex-col">
//                   <span className="text-3xl font-extrabold tracking-tight text-[#D97706]">{rawStats.available.toLocaleString()} Sats</span>
//                 </div>
//                 <p className="mt-4 text-xs text-[#94A3B8] font-medium">Automatic payout pending</p>
//               </div>
//             </div>

//             {/* Performance Analytics Vector Trend Area Mockup Section */}
//             <div className="bg-white p-8 rounded-[24px] border border-[#E2E8F0] shadow-[0_4px_20px_rgba(226,232,240,0.3)]">
//               <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-5">
//                 <div>
//                   <h3 className="text-lg font-bold text-[#0F172A]">Monthly Performance</h3>
//                   <p className="text-xs text-[#94A3B8] mt-0.5">Earnings trend over the last 6 months</p>
//                 </div>
//                 <div className="bg-[#F1F5F9] p-1 rounded-xl flex gap-1 text-xs font-bold">
//                   <div className="bg-white px-4 py-1.5 rounded-lg shadow-sm text-[#D97706]">Sats</div>
//                 </div>
//               </div>
              
//               {/* Dynamic Earnings Chart */}
//               <div className="h-48 mt-6 relative flex items-end">
//                 <svg className="w-full h-32 overflow-visible" viewBox="0 0 600 100" preserveAspectRatio="none">
//                   <defs>
//                     <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
//                       <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.18" />
//                       <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.02" />
//                     </linearGradient>
//                   </defs>
//                   <path d={chart.area} fill="url(#chartGrad)" />
//                   <path d={chart.line} fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
//                 </svg>
//                 <div className="absolute bottom-0 left-0 w-full flex justify-between text-[11px] font-bold text-[#94A3B8] uppercase px-1">
//                   {monthlySeries.months.map((m, i) => (
//                     <span key={m + i}>{m}</span>
//                   ))}
//                 </div>
//               </div>
//             </div>

//             {/* Transaction Data History Table Panel */}
//             <div className="bg-white rounded-[24px] border border-[#E2E8F0] shadow-[0_4px_20px_rgba(226,232,240,0.3)] overflow-hidden">
//               <div className="p-6 border-b border-[#F1F5F9] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
//                 <div>
//                   <h2 className="text-lg font-bold text-[#0F172A]">Transaction History</h2>
//                 </div>
//                 <div className="flex items-center gap-3">
//                   <div className="relative">
//                     <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] w-4 h-4" />
//                     <input
//                       value={searchTerm}
//                       onChange={(e) => setSearchTerm(e.target.value)}
//                       placeholder="Search parameters..."
//                       className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2 pl-9 pr-4 text-xs font-medium text-[#0F172A] placeholder-[#94A3B8] outline-none transition focus:border-[#F59E0B] w-56"
//                     />
//                   </div>
//                   <button className="flex items-center gap-1.5 border border-[#E2E8F0] px-4 py-2 rounded-xl text-xs font-bold text-[#64748B] hover:bg-[#F8FAFC] transition">
//                     <FileDown className="w-3.5 h-3.5" /> Export CSV
//                   </button>
//                 </div>
//               </div>

//               {loading ? (
//                 <div className="py-24 text-center text-xs font-semibold text-[#94A3B8] animate-pulse">
//                   Syncing decentralized ledger nodes...
//                 </div>
//               ) : filteredJobs.length === 0 ? (
//                 <div className="py-20 text-center text-xs font-semibold text-[#94A3B8]">
//                   No matching transaction history records found.
//                 </div>
//               ) : (
//                 <div className="overflow-x-auto">
//                   <table className="w-full text-left border-collapse min-w-[800px]">
//                     <thead>
//                       <tr className="bg-[#FAFBFD] text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider border-b border-[#F1F5F9]">
//                         <th className="px-6 py-4">Date</th>
//                         <th className="px-6 py-4">Client</th>
//                         <th className="px-6 py-4">Contract Name</th>
//                         <th className="px-6 py-4">Amount (Sats)</th>
//                         <th className="px-6 py-4">Status</th>
//                       </tr>
//                     </thead>
//                     <tbody className="divide-y divide-[#F1F5F9]">
//                       {filteredJobs.map((job) => (
//                         <tr 
//                           key={job.id} 
//                           onClick={() => openDetails(job)}
//                           className="hover:bg-[#F8FAFC]/80 cursor-pointer transition-colors group"
//                         >
//                           <td className="px-6 py-4.5 text-xs font-bold text-[#64748B]">
//                             {formatShortDate(job.updatedAt)}
//                           </td>
//                           <td className="px-6 py-4.5">
//                             <div className="flex items-center gap-2.5">
//                               <div className="w-7 h-7 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#64748B] font-bold text-xs uppercase border border-[#E2E8F0]">
//                                 {job.clientName ? job.clientName.charAt(0) : 'C'}
//                               </div>
//                               <span className="text-xs font-bold text-[#0F172A]">{job.clientName || 'External Client'}</span>
//                             </div>
//                           </td>
//                           <td className="px-6 py-4.5">
//                             <div className="text-xs font-bold text-[#0F172A] group-hover:text-[#F59E0B] transition-colors">{job.jobTitle || 'Scope Contract'}</div>
//                           </td>
//                           <td className="px-6 py-4.5">
//                             <div className="text-xs font-extrabold text-[#0F172A]">{getContractValue(job).toLocaleString()} Sats</div>
//                           </td>
//                           <td className="px-6 py-4.5">
//                             <div className="flex items-center justify-between gap-2">
//                               <StatusPill status={job.status || ''} />
//                               <ChevronRight className="w-4 h-4 text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-4px] group-hover:translate-x-0" />
//                             </div>
//                           </td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               )}
//               <div className="p-4 bg-[#FAFBFD] border-t border-[#F1F5F9] text-center">
//                 <button className="text-xs font-bold text-[#64748B] hover:text-[#0F172A] inline-flex items-center gap-1 transition">
//                   View All Transactions <ArrowRight className="w-3 h-3" />
//                 </button>
//               </div>
//             </div>
//           </section>
//         </div>
//       </main>

//       {/* Modern Slide-Over Detail Modal Component Panel View */}
//       {isModalOpen && selectedJob && (
//         <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
//           {/* Backdrop Blur Backdrop Layer */}
//           <div 
//             className="absolute inset-0 bg-[#0F172A]/30 backdrop-blur-sm transition-opacity"
//             onClick={() => setIsModalOpen(false)}
//           />

//           {/* Core Content Shell Chassis Container Box */}
//           <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10 animate-slide-in border-l border-[#E2E8F0]">
            
//             {/* Header Area */}
//             <div className="p-6 border-b border-[#F1F5F9] flex items-center justify-between bg-[#FAFBFD]">
//               <div>
//                 <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#94A3B8] flex items-center gap-1">
//                   <Briefcase className="w-3 h-3" /> Contract Matrix Tracking Details
//                 </span>
//                 <h3 className="text-md font-extrabold text-[#0F172A] mt-1">{selectedJob.jobTitle}</h3>
//               </div>
//               <button 
//                 onClick={() => setIsModalOpen(false)}
//                 className="p-2 text-[#94A3B8] hover:text-[#0F172A] rounded-xl hover:bg-[#F1F5F9] transition"
//               >
//                 <X className="w-5 h-5" />
//               </button>
//             </div>

//             {/* Scrollable Interior Target Metrics Pane */}
//             <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
//               {/* Financial Snapshot Splitting Badges Grid Layout */}
//               <div className="grid grid-cols-2 gap-4">
//                 <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
//                   <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Contract Budget Price</span>
//                   <span className="text-base font-extrabold text-[#0F172A] mt-1 block">{formatSats(getContractValue(selectedJob))}</span>
//                 </div>
//                 <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
//                   <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Total Locked in Escrow</span>
//                   <span className="text-base font-extrabold text-amber-600 mt-1 block">{formatSats(getFundedAmount(selectedJob))}</span>
//                 </div>
//                 <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
//                   <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Released / Paid to You</span>
//                   <span className="text-base font-extrabold text-emerald-600 mt-1 block">{formatSats(getReleasedAmount(selectedJob))}</span>
//                 </div>
//                 <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
//                   <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Network Platform Fees</span>
//                   <span className="text-base font-extrabold text-[#64748B] mt-1 block">{formatSats(getFeeAmount(selectedJob))}</span>
//                 </div>
//               </div>

//               {/* General Metadata Details List Field Elements */}
//               <div className="border border-[#E2E8F0] rounded-xl overflow-hidden text-xs">
//                 <div className="bg-[#FAFBFD] p-3 border-b border-[#E2E8F0] font-bold text-[#64748B] uppercase tracking-wider text-[10px]">
//                   Contract Registry Spec Overview
//                 </div>
//                 <div className="divide-y divide-[#F1F5F9] font-medium">
//                   <div className="p-3.5 flex justify-between"><span className="text-[#64748B]">Client Principal</span><span className="text-[#0F172A] font-bold">{selectedJob.clientName}</span></div>
//                   <div className="p-3.5 flex justify-between"><span className="text-[#64748B]">Contract Identifier</span><span className="font-mono text-[#475569] bg-[#F1F5F9] px-1 rounded">{selectedJob.contractId || selectedJob.id}</span></div>
//                   <div className="p-3.5 flex justify-between"><span className="text-[#64748B]">Payment Mode Profile</span><span className="text-[#0F172A] capitalize font-bold">{selectedJob.paymentMode || 'Milestone Split'}</span></div>
//                   <div className="p-3.5 flex justify-between"><span className="text-[#64748B]">Last Update Node Registry</span><span>{formatShortDate(selectedJob.updatedAt)}</span></div>
//                 </div>
//               </div>

//               {/* Milestone Segment List Framework Stack Grid */}
//               <div className="space-y-3">
//                 <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
//                   <Layers className="w-3.5 h-3.5 text-[#F59E0B]" /> Milestone Distribution Sequence Breaks
//                 </h4>

//                 {selectedJob.milestones && selectedJob.milestones.length > 0 ? (
//                   <div className="space-y-3">
//                     {selectedJob.milestones.map((ms, idx) => (
//                       <div key={idx} className="border border-[#E2E8F0] rounded-xl p-4 space-y-3 hover:border-[#CBD5E1] transition-colors bg-white">
//                         <div className="flex items-start justify-between">
//                           <div>
//                             <span className="text-[10px] font-bold text-[#94A3B8]">STAGE {ms.index || idx + 1}</span>
//                             <h5 className="text-xs font-bold text-[#0F172A] mt-0.5">{ms.title || `Milestone Assignment Segment ${idx + 1}`}</h5>
//                           </div>
//                           <MiniMilestoneBadge status={ms.status} />
//                         </div>

//                         <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F1F5F9] text-[11px] font-mono">
//                           <div>
//                             <span className="text-[#94A3B8] block text-[9px] uppercase tracking-tight font-sans">Client Cost</span>
//                             <span className="text-[#475569] font-semibold">{formatSats(ms.totalClientPaysSats)}</span>
//                           </div>
//                           <div>
//                             <span className="text-[#94A3B8] block text-[9px] uppercase tracking-tight font-sans">Network Fee</span>
//                             <span className="text-[#94A3B8] font-semibold">-{formatSats(ms.platformFeeSats)}</span>
//                           </div>
//                           <div className="text-right">
//                             <span className="text-[#94A3B8] block text-[9px] uppercase tracking-tight font-sans">Net Payout</span>
//                             <span className="text-emerald-600 font-extrabold">{formatSats(ms.freelancerAmountSats)}</span>
//                           </div>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 ) : (
//                   <div className="text-center py-8 border border-dashed border-[#E2E8F0] rounded-xl text-xs text-[#94A3B8] font-medium">
//                     No structured sequential sub-milestone nodes detected inside current registry mapping data blocks.
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// {/* Status Badges Matching Design Screenshots Exactly */}
// function StatusPill({ status }: { status: string }) {
//   const norm = status.toLowerCase();
//   if (norm === 'released' || norm === 'completed' || norm === 'approved') {
//     return (
//       <span className="inline-flex items-center rounded-full bg-[#E6F4EA] px-3 py-1 text-[10px] font-extrabold tracking-wider text-[#137333] uppercase border border-[#CEEAD6]">
//         COMPLETED
//       </span>
//     );
//   }
//   return (
//     <span className="inline-flex items-center rounded-full bg-[#FEF3C7] px-3 py-1 text-[10px] font-extrabold tracking-wider text-[#D97706] uppercase border border-[#FDE68A]">
//       ESCROW
//     </span>
//   );
// }

// {/* Micro Target Indicator Items Badge Tag Helper */}
// function MiniMilestoneBadge({ status }: { status: string }) {
//   const norm = (status || '').toLowerCase();
//   if (norm === 'released') {
//     return <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide">Paid Out</span>;
//   }
//   if (norm === 'submitted') {
//     return <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide">In Review</span>;
//   }
//   if (norm === 'funded') {
//     return <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide">Funded</span>;
//   }
//   return <span className="bg-neutral-50 text-neutral-500 border border-neutral-200 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide">Unfunded</span>;
// }

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
      const fundedAmount = milestone.fundedSats ?? milestone.totalClientPaysSats ?? 0;
      const clientAmount = milestone.totalClientPaysSats ?? 0;
      const feeAmount = milestone.platformFeeSats ?? 0;
      return {
        released: summary.released + (milestone.status === 'released' ? freelancerAmount : 0),
        funded: summary.funded + ((milestone.status === 'funded' || milestone.status === 'released') ? fundedAmount : 0),
        clientPayable: summary.clientPayable + clientAmount,
        fees: summary.fees + feeAmount,
      };
    },
    { released: 0, funded: 0, clientPayable: 0, fees: 0 }
  );
};

const getReleasedAmount = (job: ConversationData) => {
  const summary = getMilestoneSummary(job);
  return job.totalReleasedToFreelancerSats ?? job.escrowReleasedSats ?? job.paymentPaidAmountSats ?? summary.released;
};

const getFundedAmount = (job: ConversationData) => {
  const summary = getMilestoneSummary(job);
  return job.totalFundedSats ?? job.escrowFundedTotalSats ?? summary.funded;
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
          if (['released', 'completed', 'approved'].includes(job.status || '')) totalAvailable += released;
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
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        .ep-root { font-family: 'DM Sans', sans-serif; }
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
          font-family: 'DM Sans', sans-serif;
        }
        .search-in:focus { border-color: #F07B00; background: #FFF8F2; }
        .search-in::placeholder { color: #B0A89E; }
        .export-btn {
          background: #F5F0EB; border: 1px solid rgba(0,0,0,0.08);
          border-radius: 12px; color: #8A8078; font-size: 12px;
          font-weight: 500; padding: 7px 14px; cursor: pointer;
          display: flex; align-items: center; gap: 5px;
          transition: all 0.2s; font-family: 'DM Sans', sans-serif;
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
                <p className="text-[10px] font-bold tracking-[0.16em] text-[#F07B00] uppercase mb-0.5">Dashboard</p>
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
                <p style={{ fontFamily: "'DM Mono', monospace" }} className="text-2xl font-semibold text-[#1A1A1A] tracking-tight tabular-nums">
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
                <p style={{ fontFamily: "'DM Mono', monospace" }} className="text-2xl font-semibold text-[#1A1A1A] tracking-tight tabular-nums">
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
                <p style={{ fontFamily: "'DM Mono', monospace" }} className="text-2xl font-semibold text-[#2E7D32] tracking-tight tabular-nums">
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
                            <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-[11px] text-[#9A9088]">{formatShortDate(job.updatedAt)}</span>
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
                            <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-[12px] font-semibold text-[#1A1A1A]">
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
                    <span style={{ fontFamily: "'DM Mono', monospace" }} className={`text-[12px] font-semibold ${item.color}`}>{item.value}</span>
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
                    { key: 'Contract ID', val: <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-[10px] bg-[#F5F0EB] px-1.5 py-0.5 rounded text-[#9A9088]">{(selectedJob.contractId || selectedJob.id || '').slice(0, 16)}…</span> },
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
                              <span style={{ fontFamily: "'DM Mono', monospace" }} className={`text-[11px] font-semibold ${col.color}`}>{col.val}</span>
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