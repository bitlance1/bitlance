

// 'use client';

// import React, { useEffect, useMemo, useState } from 'react';
// import { useRouter } from 'next/navigation';
// import {
//   Search,
//   Bookmark,
//   ArrowUpRight,
//   Briefcase,
//   Zap,
// } from 'lucide-react';
// import { firebaseAuth, firebaseDb } from '@/lib/firebase';
// import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';

// const isNonEmptyString = (value: string | undefined): value is string =>
//   !!value && value.trim().length > 0;

// const getCategories = (items: JobFeedItem[]) =>
//   Array.from(new Set(items.map((job) => job.category).filter(isNonEmptyString))).sort();

// const getTimestampMs = (value: unknown) => {
//   if (!value) return 0;

//   if (value instanceof Date) return value.getTime();

//   if (typeof value === 'number') return value;

//   if (typeof value === 'string') {
//     const parsed = Date.parse(value);
//     return Number.isNaN(parsed) ? 0 : parsed;
//   }

//   if (typeof value === 'object') {
//     const timestampLike = value as {
//       toMillis?: () => number;
//       seconds?: number;
//       nanoseconds?: number;
//     };

//     if (typeof timestampLike.toMillis === 'function') {
//       return timestampLike.toMillis();
//     }

//     if (typeof timestampLike.seconds === 'number') {
//       const extraMs = typeof timestampLike.nanoseconds === 'number'
//         ? Math.floor(timestampLike.nanoseconds / 1000000)
//         : 0;
//       return timestampLike.seconds * 1000 + extraMs;
//     }
//   }

//   return 0;
// };

// const formatPostedAt = (createdAt: unknown) => {
//   const createdAtMs = getTimestampMs(createdAt);
//   if (!createdAtMs) return 'Recently';

//   const diffMs = Math.max(0, Date.now() - createdAtMs);
//   const minute = 60 * 1000;
//   const hour = 60 * minute;
//   const day = 24 * hour;
//   const month = 30 * day;
//   const year = 365 * day;

//   if (diffMs < minute) return 'Just now';
//   if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
//   if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
//   if (diffMs < month) return `${Math.floor(diffMs / day)}d ago`;
//   if (diffMs < year) return `${Math.floor(diffMs / month)}mo ago`;

//   return `${Math.floor(diffMs / year)}y ago`;
// };

// type JobFeedItem = {
//   id: string;
//   title: string;
//   description: string;
//   price: string;
//   tags: string[];
//   urgent?: boolean;
//   client?: string;
//   experience?: string;
//   postedAt?: string;
//   category?: string;
// };

// export default function JobFeedContent() {
//   const [searchTerm, setSearchTerm] = useState('');
//   const [activeCategory, setActiveCategory] = useState('All');
//   const [jobs, setJobs] = useState<JobFeedItem[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [errorMessage, setErrorMessage] = useState('');
//   const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
//   const [isSavedOpen, setIsSavedOpen] = useState(false);
//   const [savedLoading, setSavedLoading] = useState(false);

//   useEffect(() => {
//     setLoading(true);
//     const jobsQuery = query(collection(firebaseDb, 'jobs'));
//     const unsubscribe = onSnapshot(
//       jobsQuery,
//       (snapshot) => {
//         const items: JobFeedItem[] = snapshot.docs.map((docSnap) => {
//           const data = docSnap.data() as any;
//           const postedAt = formatPostedAt(data.createdAt);
//           const budget = data.budget ?? '';
//           const price = budget?.trim()
//             ? budget.toLowerCase().includes('sats')
//               ? budget
//               : `${budget} sats`
//             : '';
//           const rawDescription = data.description ?? '';
//           const description = rawDescription.replace(/\s{2,}/g, ' ').trim();
//           return {
//             id: docSnap.id,
//             title: data.title ?? 'Untitled Job',
//             description,
//             price,
//             tags: Array.isArray(data.skills) ? data.skills : [],
//             urgent: !!data.urgent,
//             client: data.clientCompany || data.clientName || 'Client',
//             experience: data.experienceLevel || 'All Levels',
//             postedAt,
//             category: data.category ?? '',
//           };
//         });
//         setJobs(items);
//         setLoading(false);
//         setErrorMessage('');
//       },
//       () => {
//         setLoading(false);
//         setErrorMessage('Unable to load jobs right now.');
//       }
//     );
//     return () => unsubscribe();
//   }, []);

//   useEffect(() => {
//     let unsubscribeSaved: (() => void) | undefined;
//     const unsubscribeAuth = firebaseAuth.onAuthStateChanged((user) => {
//       if (!user) {
//         if (unsubscribeSaved) unsubscribeSaved();
//         setSavedMap({});
//         return;
//       }
//       setSavedLoading(true);
//       const savedQuery = query(
//         collection(firebaseDb, 'saved_jobs'),
//         where('userId', '==', user.uid)
//       );
//       unsubscribeSaved = onSnapshot(
//         savedQuery,
//         (snapshot) => {
//           const map: Record<string, boolean> = {};
//           snapshot.docs.forEach((docSnap) => {
//             const data = docSnap.data() as any;
//             if (data.jobId) map[data.jobId] = true;
//           });
//           setSavedMap(map);
//           setSavedLoading(false);
//         },
//         () => {
//           setSavedLoading(false);
//         }
//       );
//     });
//     return () => {
//       unsubscribeAuth();
//       if (unsubscribeSaved) unsubscribeSaved();
//     };
//   }, []);

//   const filteredJobs = useMemo(() => {
//     return jobs.filter(
//       (job) =>
//         (activeCategory === 'All' ||
//           job.tags.includes(activeCategory) ||
//           job.title.includes(activeCategory) ||
//           job.category === activeCategory) &&
//         (job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
//           job.description.toLowerCase().includes(searchTerm.toLowerCase()))
//     );
//   }, [searchTerm, activeCategory, jobs]);

//   const categories = useMemo(() => ['All', ...getCategories(jobs)], [jobs]);

//   return (
//     <section className="bg-[#FCF9F7] py-16">
//       <div className="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8">

//         {/* HEADER */}
//         <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
//           <div className="space-y-1">
//             <div className="flex items-center gap-3">
//               <div className="p-2 bg-[#F7931A]/10 rounded-xl">
//                 <Zap className="w-6 h-6 text-[#F7931A]" />
//               </div>
//               <h1 className="text-3xl font-extrabold text-[#1a1a1a] tracking-tight">Job Feed</h1>
//             </div>
//             <p className="text-[#6b6560] text-sm md:text-base font-medium">
//               Browse and apply to the best Bitcoin-native opportunities.
//             </p>
//           </div>
//           <button
//             onClick={() => setIsSavedOpen((prev) => !prev)}
//             className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-400 text-white px-8 py-4 rounded-2xl font-bold text-sm hover:shadow-[0_8px_20px_-6px_rgba(249,115,22,0.6)] transition-all active:scale-95 group"
//           >
//             <Bookmark className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
//             {isSavedOpen ? "Back to Feed" : "My Saved Jobs"}
//           </button>
//         </header>

//         {/* SEARCH AND FILTERS */}
//         <div className="flex flex-col md:flex-row gap-4 mb-10">
//           <div className="relative flex-1">
//             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b6560]" />
//             <input
//               type="text"
//               placeholder="Search for bitcoin jobs, stacks, or keywords..."
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//               className="w-full bg-white border border-[#ece7df] rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F7931A]/10 focus:border-[#F7931A] transition-all shadow-sm"
//             />
//           </div>
//           {/* <button className="flex items-center justify-center gap-2 bg-white border border-[#ece7df] px-6 py-4 rounded-2xl font-bold text-sm text-[#1a1a1a] hover:bg-[#F7931A]/5 transition-all shadow-sm">
//             <Filter className="w-4 h-4 text-[#F7931A]" />
//             Filter
//             <ChevronDown className="w-4 h-4 text-[#6b6560]" />
//           </button> */}
//         </div>

//         {/* MAIN FEED */}
//         <div className="space-y-6 min-w-0 overflow-hidden">
//           {/* Category chips */}
//           {!isSavedOpen ? (
//             <div className="w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden pb-2">
//               <div className="inline-flex min-w-max items-center gap-2 pr-1">
//                 {categories.map((cat) => (
//                   <button
//                     key={cat}
//                     onClick={() => setActiveCategory(cat)}
//                     className={`shrink-0 whitespace-nowrap rounded-full border px-6 py-2 text-xs font-bold transition-all ${
//                       activeCategory === cat
//                         ? 'bg-gradient-to-r from-orange-600 to-orange-400 text-white shadow-lg shadow-[#F7931A]/20'
//                         : 'bg-white text-[#6b6560] border-[#ece7df]'
//                     }`}
//                   >
//                     {cat}
//                   </button>
//                 ))}
//               </div>
//             </div>
//           ) : null}

//           <div className="space-y-4">
//             {!isSavedOpen ? (
//               loading ? (
//                 <div className="bg-white rounded-3xl border border-[#ece7df] p-10 text-center text-[#6b6762]">
//                   Loading jobs...
//                 </div>
//               ) : errorMessage ? (
//                 <div className="bg-white rounded-3xl border border-[#F7931A]/20 p-10 text-center text-[#8C4F00]">
//                   {errorMessage}
//                 </div>
//               ) : filteredJobs.length > 0 ? (
//                 filteredJobs.map((job) => (
//                   <JobFeedCard
//                     key={job.id}
//                     job={job}
//                     isSaved={!!savedMap[job.id]}
//                     heightClass="min-h-[180px]"
//                     onToggleSave={async () => {
//                       const user = firebaseAuth.currentUser;
//                       if (!user) {
//                         alert('Please log in to save jobs.');
//                         return;
//                       }
//                       const docId = `${user.uid}_${job.id}`;
//                       if (savedMap[job.id]) {
//                         await deleteDoc(doc(firebaseDb, 'saved_jobs', docId));
//                       } else {
//                         await setDoc(doc(firebaseDb, 'saved_jobs', docId), {
//                           userId: user.uid,
//                           jobId: job.id,
//                           createdAt: serverTimestamp(),
//                           updatedAt: serverTimestamp(),
//                         });
//                       }
//                     }}
//                   />
//                 ))
//               ) : (
//                 <div className="bg-white rounded-3xl border border-[#F7931A]/20 border-dashed p-10 text-center">
//                   <Search className="w-12 h-12 text-[#F7931A]/30 mx-auto mb-4" />
//                   <h3 className="text-lg font-bold text-[#1a1a1a]">No results found</h3>
//                   <p className="text-[#6b6560] text-sm">Try a different search term or filter.</p>
//                 </div>
//               )
//             ) : (
//               <div className="bg-white rounded-3xl border border-[#ece7df] p-6 shadow-sm">
//                 <div className="flex items-center justify-between mb-6">
//                   <div>
//                     <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">
//                       Saved Jobs
//                     </div>
//                     <h2 className="mt-2 text-[20px] font-semibold text-[#1a1a1a]">Your saved opportunities</h2>
//                     <p className="mt-1 text-[12px] text-[#6b6762]">
//                       Review the jobs you bookmarked and apply when you are ready.
//                     </p>
//                   </div>
//                 </div>
//                 {savedLoading ? (
//                   <div className="rounded-[14px] border border-[#EAE7E2] bg-[#FAF8F5] p-6 text-[12px] text-[#6b6762] text-center">
//                     Loading saved jobs...
//                   </div>
//                 ) : jobs.filter((job) => savedMap[job.id]).length ? (
//                   <div className="space-y-4">
//                     {jobs
//                       .filter((job) => savedMap[job.id])
//                       .map((job) => (
//                         <JobFeedCard
//                           key={`saved-${job.id}`}
//                           job={job}
//                           isSaved={!!savedMap[job.id]}
//                           heightClass="min-h-[180px]"
//                           onToggleSave={async () => {
//                             const user = firebaseAuth.currentUser;
//                             if (!user) return;
//                             const docId = `${user.uid}_${job.id}`;
//                             await deleteDoc(doc(firebaseDb, 'saved_jobs', docId));
//                           }}
//                           compact
//                         />
//                       ))}
//                   </div>
//                 ) : (
//                   <div className="rounded-[14px] border border-[#F7931A]/20 border-dashed bg-[#FFF8F2] p-8 text-center">
//                     <Bookmark className="w-10 h-10 text-[#F7931A]/40 mx-auto mb-3" />
//                     <h3 className="text-[16px] font-bold text-[#1a1a1a]">No saved jobs yet</h3>
//                     <p className="text-[12px] text-[#6b6762]">Tap the bookmark icon on a job to save it.</p>
//                   </div>
//                 )}
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </section>
//   );
// }

// function JobFeedCard({
//   job,
//   isSaved = false,
//   onToggleSave,
//   compact = false,
//   heightClass = "",
// }: {
//   job: JobFeedItem;
//   isSaved?: boolean;
//   onToggleSave?: () => void;
//   compact?: boolean;
//   heightClass?: string;
// }) {
//   const router = useRouter();

//   return (
//     <div
//       className={`bg-white rounded-3xl border border-[#ece7df] p-4 shadow-sm transition-all hover:shadow-xl hover:border-[#F7931A]/30 group overflow-hidden ${compact ? "md:p-4" : ""} ${heightClass}`}
//     >
//       <div className="flex gap-5">
//         <div>
//           {/* the avatar should be fecth here  */}
//           <img src="" alt="" />
//         </div>

//         <div>
//           {/* Top row */}
//           <div className="flex items-center justify-between mb-2">
//         <div className="flex items-center gap-2">
//           {job.urgent && (
//             <span className="bg-[#FCF9F7] text-[#8C4F00] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
//               Urgent
//             </span>
//           )}
//           <span className="text-xs text-[#6b6560] font-medium">{job.postedAt}</span>
//         </div>
//         <button
//           type="button"
//           onClick={(e) => {
//             e.stopPropagation();
//             if (onToggleSave) onToggleSave();
//           }}
//           className={`flex items-center justify-center h-9 w-9 rounded-full border transition-colors ${isSaved
//             ? "bg-[#F7931A] text-white border-[#F7931A]"
//             : "bg-white text-[#8C4F00] border-[#EAE7E2] hover:bg-[#F7F4F0]"
//             }`}
//           aria-label={isSaved ? "Unsave job" : "Save job"}
//         >
//           <Bookmark className="w-4 h-4" fill={isSaved ? "currentColor" : "none"} />
//         </button>
//       </div>

//       {/* Title and price */}
//       <div className="flex items-start justify-between gap-4 mb-1.5">
//         <h3 className="text-lg font-bold text-[#1a1a1a] transition-colors flex-1 break-words min-w-0">
//           {job.title}
//         </h3>
//         {job.price ? (
//           <span className="text-[15px] font-bold text-[#8C4F00] whitespace-nowrap shrink-0">
//             {job.price}
//           </span>
//         ) : null}
//       </div>

//       {/* Client info */}
//       <div className="flex items-center gap-2 mb-2">
//         <Briefcase className="w-4 h-4 text-[#6b6560] shrink-0" />
//         <span className="text-sm font-medium text-[#6b6560] truncate">{job.client}</span>
//         <span className="text-xs text-[#6b6560]">•</span>
//         <span className="text-xs text-[#6b6560] whitespace-nowrap">{job.experience}</span>
//       </div>

//       {/* Description — capped at 2 lines, breaks long words */}
//       {/* {job.description ? (
//         <p className="text-sm text-[#6b6560] leading-relaxed mb-4 line-clamp-2 break-words overflow-hidden">
//           {job.description}
//         </p>
//       ) : null} */}
//       <p className="text-sm text-[#6b6560] leading-relaxed mb-2 overflow-hidden break-all" style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
//         {job.description}
//       </p>

//       {/* Tags */}
//       {job.tags.length > 0 ? (
//         <div className="flex flex-wrap gap-2 mb-3">
//           {job.tags.map((tag: string) => (
//             <span
//               key={tag}
//               className="px-3 py-1 bg-[#FCF9F7] text-[#6b6560] text-[10px] font-bold rounded-full border border-[#ece7df] group-hover:bg-[#F7931A]/10 group-hover:text-[#F7931A] group-hover:border-[#F7931A]/30 transition-colors"
//             >
//               {tag}
//             </span>
//           ))}
//         </div>
//       ) : null}

//       {/* Apply button */}
//       <div className="flex justify-end">
//         <button
//           onClick={() => router.push(`/job/${job.id}`)}
//           className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-400 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-95 group/btn"
//         >
//           Apply Now
//           <ArrowUpRight className="w-4 h-4 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
//         </button>
//       </div>
//         </div>
//       </div>
      
      
//     </div>
//   );
// }




// 'use client';

// import React, { useEffect, useMemo, useState } from 'react';
// import { useRouter } from 'next/navigation';
// import { Search, Bookmark, ArrowUpRight, Briefcase, Zap } from 'lucide-react';
// import { firebaseAuth, firebaseDb } from '@/lib/firebase';
// import {
//   collection,
//   deleteDoc,
//   doc,
//   onSnapshot,
//   query,
//   serverTimestamp,
//   setDoc,
//   where,
// } from 'firebase/firestore';

// // ─── Utilities ────────────────────────────────────────────────────────────────

// const isNonEmptyString = (value: string | undefined): value is string =>
//   !!value && value.trim().length > 0;

// const getCategories = (items: JobFeedItem[]) =>
//   Array.from(new Set(items.map((job) => job.category).filter(isNonEmptyString))).sort();

// const getTimestampMs = (value: unknown): number => {
//   if (!value) return 0;
//   if (value instanceof Date) return value.getTime();
//   if (typeof value === 'number') return value;
//   if (typeof value === 'string') {
//     const parsed = Date.parse(value);
//     return Number.isNaN(parsed) ? 0 : parsed;
//   }
//   if (typeof value === 'object') {
//     const ts = value as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
//     if (typeof ts.toMillis === 'function') return ts.toMillis();
//     if (typeof ts.seconds === 'number') {
//       const extraMs = typeof ts.nanoseconds === 'number'
//         ? Math.floor(ts.nanoseconds / 1_000_000)
//         : 0;
//       return ts.seconds * 1000 + extraMs;
//     }
//   }
//   return 0;
// };

// const formatPostedAt = (createdAt: unknown): string => {
//   const ms = getTimestampMs(createdAt);
//   if (!ms) return 'Recently';

//   const diff = Math.max(0, Date.now() - ms);
//   const m = 60 * 1000;
//   const h = 60 * m;
//   const d = 24 * h;
//   const mo = 30 * d;
//   const y = 365 * d;

//   if (diff < m) return 'Just now';
//   if (diff < h) return `${Math.floor(diff / m)}m ago`;
//   if (diff < d) return `${Math.floor(diff / h)}h ago`;
//   if (diff < mo) return `${Math.floor(diff / d)}d ago`;
//   if (diff < y) return `${Math.floor(diff / mo)}mo ago`;
//   return `${Math.floor(diff / y)}y ago`;
// };

// // ─── Types ────────────────────────────────────────────────────────────────────

// type JobFeedItem = {
//   id: string;
//   title: string;
//   description: string;
//   price: string;
//   tags: string[];
//   urgent?: boolean;
//   client?: string;
//   experience?: string;
//   postedAt?: string;
//   category?: string;
//   avatarUrl?: string;
// };

// // ─── Avatar component (mirrors ClientJobPostCard logic) ───────────────────────

// function AvatarBox({ url, name }: { url?: string; name?: string }) {
//   const [failed, setFailed] = useState(false);

//   useEffect(() => {
//     setFailed(false);
//   }, [url]);

//   const showImg = !!url && !failed;

//   return (
//     <div className="h-11 w-11 min-w-[44px] rounded-[8px] bg-[#F7F4F0] ring-1 ring-[#EAE7E2] overflow-hidden flex items-center justify-center flex-shrink-0">
//       {showImg ? (
//         <img
//           src={url}
//           alt={name ? `${name} avatar` : 'Client avatar'}
//           className="h-full w-full object-cover"
//           onError={() => setFailed(true)}
//         />
//       ) : (
//         <svg
//           width="22"
//           height="22"
//           viewBox="0 0 24 24"
//           fill="none"
//           stroke="#8C4F00"
//           strokeWidth="2"
//           aria-hidden="true"
//         >
//           <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" />
//           <path d="M4 21c0-3.314 2.686-6 6-6h4c3.314 0 6 2.686 6 6" />
//         </svg>
//       )}
//     </div>
//   );
// }

// // ─── Main page component ──────────────────────────────────────────────────────

// export default function JobFeedContent() {
//   const [searchTerm, setSearchTerm] = useState('');
//   const [activeCategory, setActiveCategory] = useState('All');
//   const [jobs, setJobs] = useState<JobFeedItem[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [errorMessage, setErrorMessage] = useState('');
//   const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
//   const [isSavedOpen, setIsSavedOpen] = useState(false);
//   const [savedLoading, setSavedLoading] = useState(false);

//   // Subscribe to jobs collection
//   useEffect(() => {
//     setLoading(true);
//     const unsubscribe = onSnapshot(
//       query(collection(firebaseDb, 'jobs')),
//       (snapshot) => {
//         const items: JobFeedItem[] = snapshot.docs.map((docSnap) => {
//           const data = docSnap.data() as Record<string, any>;
//           const budget: string = data.budget ?? '';
//           const price = budget.trim()
//             ? budget.toLowerCase().includes('sats')
//               ? budget
//               : `${budget} sats`
//             : '';

//           return {
//             id: docSnap.id,
//             title: data.title ?? 'Untitled Job',
//             description: (data.description ?? '').replace(/\s{2,}/g, ' ').trim(),
//             price,
//             tags: Array.isArray(data.skills) ? data.skills : [],
//             urgent: !!data.urgent,
//             client: data.clientCompany || data.clientName || 'Client',
//             experience: data.experienceLevel || 'All Levels',
//             postedAt: formatPostedAt(data.createdAt),
//             category: data.category ?? '',
//             avatarUrl:  data.avatarUrl || '',
//           };
//         });
//         setJobs(items);
//         setLoading(false);
//         setErrorMessage('');
//       },
//       () => {
//         setLoading(false);
//         setErrorMessage('Unable to load jobs right now.');
//       }
//     );
//     return () => unsubscribe();
//   }, []);

//   // Subscribe to saved jobs for the current user
//   useEffect(() => {
//     let unsubscribeSaved: (() => void) | undefined;

//     const unsubscribeAuth = firebaseAuth.onAuthStateChanged((user) => {
//       if (!user) {
//         unsubscribeSaved?.();
//         setSavedMap({});
//         return;
//       }

//       setSavedLoading(true);
//       unsubscribeSaved = onSnapshot(
//         query(collection(firebaseDb, 'saved_jobs'), where('userId', '==', user.uid)),
//         (snapshot) => {
//           const map: Record<string, boolean> = {};
//           snapshot.docs.forEach((docSnap) => {
//             const jobId = (docSnap.data() as any).jobId;
//             if (jobId) map[jobId] = true;
//           });
//           setSavedMap(map);
//           setSavedLoading(false);
//         },
//         () => {
//           setSavedLoading(false);
//         }
//       );
//     });

//     return () => {
//       unsubscribeAuth();
//       unsubscribeSaved?.();
//     };
//   }, []);

//   const filteredJobs = useMemo(
//     () =>
//       jobs.filter(
//         (job) =>
//           (activeCategory === 'All' ||
//             job.tags.includes(activeCategory) ||
//             job.title.includes(activeCategory) ||
//             job.category === activeCategory) &&
//           (job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
//             job.description.toLowerCase().includes(searchTerm.toLowerCase()))
//       ),
//     [searchTerm, activeCategory, jobs]
//   );

//   const categories = useMemo(() => ['All', ...getCategories(jobs)], [jobs]);

//   const handleToggleSave = async (jobId: string) => {
//     const user = firebaseAuth.currentUser;
//     if (!user) {
//       alert('Please log in to save jobs.');
//       return;
//     }
//     const docId = `${user.uid}_${jobId}`;
//     if (savedMap[jobId]) {
//       await deleteDoc(doc(firebaseDb, 'saved_jobs', docId));
//     } else {
//       await setDoc(doc(firebaseDb, 'saved_jobs', docId), {
//         userId: user.uid,
//         jobId,
//         createdAt: serverTimestamp(),
//         updatedAt: serverTimestamp(),
//       });
//     }
//   };

//   const savedJobs = jobs.filter((job) => savedMap[job.id]);

//   return (
//     <section className="bg-[#FCF9F7] py-16">
//       <div className="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8">

//         {/* HEADER */}
//         <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
//           <div className="space-y-1">
//             <div className="flex items-center gap-3">
//               <div className="p-2 bg-[#F7931A]/10 rounded-xl">
//                 <Zap className="w-6 h-6 text-[#F7931A]" />
//               </div>
//               <h1 className="text-3xl font-extrabold text-[#1a1a1a] tracking-tight">Job Feed</h1>
//             </div>
//             <p className="text-[#6b6560] text-sm md:text-base font-medium">
//               Browse and apply to the best Bitcoin-native opportunities.
//             </p>
//           </div>
//           <button
//             onClick={() => setIsSavedOpen((prev) => !prev)}
//             className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-400 text-white px-8 py-4 rounded-2xl font-bold text-sm hover:shadow-[0_8px_20px_-6px_rgba(249,115,22,0.6)] transition-all active:scale-95 group"
//           >
//             <Bookmark className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
//             {isSavedOpen ? 'Back to Feed' : 'My Saved Jobs'}
//           </button>
//         </header>

//         {/* SEARCH */}
//         <div className="flex flex-col md:flex-row gap-4 mb-10">
//           <div className="relative flex-1">
//             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b6560]" />
//             <input
//               type="text"
//               placeholder="Search for bitcoin jobs, stacks, or keywords..."
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//               className="w-full bg-white border border-[#ece7df] rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F7931A]/10 focus:border-[#F7931A] transition-all shadow-sm"
//             />
//           </div>
//         </div>

//         {/* MAIN FEED */}
//         <div className="space-y-6 min-w-0 overflow-hidden">

//           {/* Category chips — hidden in saved view */}
//           {!isSavedOpen && (
//             <div className="w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden pb-2">
//               <div className="inline-flex min-w-max items-center gap-2 pr-1">
//                 {categories.map((cat) => (
//                   <button
//                     key={cat}
//                     onClick={() => setActiveCategory(cat)}
//                     className={`shrink-0 whitespace-nowrap rounded-full border px-6 py-2 text-xs font-bold transition-all ${
//                       activeCategory === cat
//                         ? 'bg-gradient-to-r from-orange-600 to-orange-400 text-white shadow-lg shadow-[#F7931A]/20'
//                         : 'bg-white text-[#6b6560] border-[#ece7df]'
//                     }`}
//                   >
//                     {cat}
//                   </button>
//                 ))}
//               </div>
//             </div>
//           )}

//           <div className="space-y-4">
//             {!isSavedOpen ? (
//               // ── Feed view ──
//               loading ? (
//                 <div className="bg-white rounded-3xl border border-[#ece7df] p-10 text-center text-[#6b6762]">
//                   Loading jobs...
//                 </div>
//               ) : errorMessage ? (
//                 <div className="bg-white rounded-3xl border border-[#F7931A]/20 p-10 text-center text-[#8C4F00]">
//                   {errorMessage}
//                 </div>
//               ) : filteredJobs.length > 0 ? (
//                 filteredJobs.map((job) => (
//                   <JobFeedCard
//                     key={job.id}
//                     job={job}
//                     isSaved={!!savedMap[job.id]}
//                     heightClass="min-h-[180px]"
//                     onToggleSave={() => handleToggleSave(job.id)}
//                   />
//                 ))
//               ) : (
//                 <div className="bg-white rounded-3xl border border-[#F7931A]/20 border-dashed p-10 text-center">
//                   <Search className="w-12 h-12 text-[#F7931A]/30 mx-auto mb-4" />
//                   <h3 className="text-lg font-bold text-[#1a1a1a]">No results found</h3>
//                   <p className="text-[#6b6560] text-sm">Try a different search term or filter.</p>
//                 </div>
//               )
//             ) : (
//               // ── Saved view ──
//               <div className="bg-white rounded-3xl border border-[#ece7df] p-6 shadow-sm">
//                 <div className="flex items-center justify-between mb-6">
//                   <div>
//                     <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">
//                       Saved Jobs
//                     </div>
//                     <h2 className="mt-2 text-[20px] font-semibold text-[#1a1a1a]">
//                       Your saved opportunities
//                     </h2>
//                     <p className="mt-1 text-[12px] text-[#6b6762]">
//                       Review the jobs you bookmarked and apply when you are ready.
//                     </p>
//                   </div>
//                 </div>

//                 {savedLoading ? (
//                   <div className="rounded-[14px] border border-[#EAE7E2] bg-[#FAF8F5] p-6 text-[12px] text-[#6b6762] text-center">
//                     Loading saved jobs...
//                   </div>
//                 ) : savedJobs.length > 0 ? (
//                   <div className="space-y-4">
//                     {savedJobs.map((job) => (
//                       <JobFeedCard
//                         key={`saved-${job.id}`}
//                         job={job}
//                         isSaved
//                         heightClass="min-h-[180px]"
//                         onToggleSave={async () => {
//                           const user = firebaseAuth.currentUser;
//                           if (!user) return;
//                           await deleteDoc(
//                             doc(firebaseDb, 'saved_jobs', `${user.uid}_${job.id}`)
//                           );
//                         }}
//                         compact
//                       />
//                     ))}
//                   </div>
//                 ) : (
//                   <div className="rounded-[14px] border border-[#F7931A]/20 border-dashed bg-[#FFF8F2] p-8 text-center">
//                     <Bookmark className="w-10 h-10 text-[#F7931A]/40 mx-auto mb-3" />
//                     <h3 className="text-[16px] font-bold text-[#1a1a1a]">No saved jobs yet</h3>
//                     <p className="text-[12px] text-[#6b6762]">
//                       Tap the bookmark icon on a job to save it.
//                     </p>
//                   </div>
//                 )}
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </section>
//   );
// }

// // ─── Job card ─────────────────────────────────────────────────────────────────

// function JobFeedCard({
//   job,
//   isSaved = false,
//   onToggleSave,
//   compact = false,
//   heightClass = '',
// }: {
//   job: JobFeedItem;
//   isSaved?: boolean;
//   onToggleSave?: () => void;
//   compact?: boolean;
//   heightClass?: string;
// }) {
//   const router = useRouter();

//   return (
//     <div
//       className={`bg-white rounded-3xl border border-[#ece7df] p-4 shadow-sm transition-all hover:shadow-xl hover:border-[#F7931A]/30 group overflow-hidden ${compact ? 'md:p-4' : ''} ${heightClass}`}
//     >
//       <div className="flex gap-5">

//         {/* Avatar */}
//         <AvatarBox url={job.avatarUrl} name={job.client} />

//         {/* Content */}
//         <div className="flex-1 min-w-0">

//           {/* Top row: urgent badge + posted time + save button */}
//           <div className="flex items-center justify-between mb-2">
//             <div className="flex items-center gap-2">
//               {job.urgent && (
//                 <span className="bg-[#FCF9F7] text-[#8C4F00] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
//                   Urgent
//                 </span>
//               )}
//               <span className="text-xs text-[#6b6560] font-medium">{job.postedAt}</span>
//             </div>
//             <button
//               type="button"
//               onClick={(e) => {
//                 e.stopPropagation();
//                 onToggleSave?.();
//               }}
//               className={`flex items-center justify-center h-9 w-9 rounded-full border transition-colors ${
//                 isSaved
//                   ? 'bg-[#F7931A] text-white border-[#F7931A]'
//                   : 'bg-white text-[#8C4F00] border-[#EAE7E2] hover:bg-[#F7F4F0]'
//               }`}
//               aria-label={isSaved ? 'Unsave job' : 'Save job'}
//             >
//               <Bookmark className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} />
//             </button>
//           </div>

//           {/* Title + price */}
//           <div className="flex items-start justify-between gap-4 mb-1.5">
//             <h3 className="text-lg font-bold text-[#1a1a1a] transition-colors flex-1 break-words min-w-0">
//               {job.title}
//             </h3>
//             {job.price && (
//               <span className="text-[15px] font-bold text-[#8C4F00] whitespace-nowrap shrink-0">
//                 {job.price}
//               </span>
//             )}
//           </div>

//           {/* Client + experience */}
//           <div className="flex items-center gap-2 mb-2">
//             <Briefcase className="w-4 h-4 text-[#6b6560] shrink-0" />
//             <span className="text-sm font-medium text-[#6b6560] truncate">{job.client}</span>
//             <span className="text-xs text-[#6b6560]">•</span>
//             <span className="text-xs text-[#6b6560] whitespace-nowrap">{job.experience}</span>
//           </div>

//           {/* Description — 1 line clamp */}
//           {job.description && (
//             <p
//               className="text-sm text-[#6b6560] leading-relaxed mb-2 overflow-hidden break-all"
//               style={{
//                 display: '-webkit-box',
//                 WebkitLineClamp: 1,
//                 WebkitBoxOrient: 'vertical',
//                 overflow: 'hidden',
//               }}
//             >
//               {job.description}
//             </p>
//           )}

//           {/* Tags */}
//           {job.tags.length > 0 && (
//             <div className="flex flex-wrap gap-2 mb-3">
//               {job.tags.map((tag) => (
//                 <span
//                   key={tag}
//                   className="px-3 py-1 bg-[#FCF9F7] text-[#6b6560] text-[10px] font-bold rounded-full border border-[#ece7df] group-hover:bg-[#F7931A]/10 group-hover:text-[#F7931A] group-hover:border-[#F7931A]/30 transition-colors"
//                 >
//                   {tag}
//                 </span>
//               ))}
//             </div>
//           )}

//           {/* Apply button */}
//           <div className="flex justify-end">
//             <button
//               onClick={() => router.push(`/job/${job.id}`)}
//               className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-400 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-95 group/btn"
//             >
//               Apply Now
//               <ArrowUpRight className="w-4 h-4 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
//             </button>
//           </div>

//         </div>
//       </div>
//     </div>
//   );
// }


'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bookmark, ArrowUpRight, Briefcase, Zap } from 'lucide-react';
import { firebaseAuth, firebaseDb } from '@/lib/firebase';
import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';

// ─── Utilities ────────────────────────────────────────────────────────────────

const isNonEmptyString = (value: string | undefined): value is string =>
  !!value && value.trim().length > 0;

const getCategories = (items: JobFeedItem[]) =>
  Array.from(new Set(items.map((job) => job.category).filter(isNonEmptyString))).sort();

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
      const extraMs = typeof ts.nanoseconds === 'number'
        ? Math.floor(ts.nanoseconds / 1_000_000)
        : 0;
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

// ─── Types ────────────────────────────────────────────────────────────────────

type JobFeedItem = {
  id: string;
  title: string;
  description: string;
  price: string;
  tags: string[];
  urgent?: boolean;
  client?: string;
  experience?: string;
  postedAt?: string;
  category?: string;
  avatarUrl?: string;
};

// ─── Avatar component (mirrors ClientJobPostCard logic) ───────────────────────

function AvatarBox({ url, name }: { url?: string; name?: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const showImg = !!url && !failed;

  return (
    <div className="h-11 w-11 min-w-[44px] rounded-[8px] bg-[#F7F4F0] ring-1 ring-[#EAE7E2] overflow-hidden flex items-center justify-center flex-shrink-0">
      {showImg ? (
        <img
          src={url}
          alt={name ? `${name} avatar` : 'Client avatar'}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8C4F00"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" />
          <path d="M4 21c0-3.314 2.686-6 6-6h4c3.314 0 6 2.686 6 6" />
        </svg>
      )}
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

export default function JobFeedContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [jobs, setJobs] = useState<JobFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [isSavedOpen, setIsSavedOpen] = useState(false);
  const [savedLoading, setSavedLoading] = useState(false);

  // Subscribe to jobs, then resolve each client's avatarUrl from the clients collection
  useEffect(() => {
    setLoading(true);

    const unsubscribe = onSnapshot(
      query(collection(firebaseDb, 'jobs')),
      async (snapshot) => {
        try {
          // 1. Collect all unique clientIds from the jobs snapshot
          const clientIds = Array.from(
            new Set(
              snapshot.docs
                .map((d) => (d.data() as Record<string, any>).clientId as string | undefined)
                .filter((id): id is string => !!id)
            )
          );

          // 2. Fetch matching client docs and build a clientId → avatarUrl map
          const avatarMap: Record<string, string> = {};
          if (clientIds.length > 0) {
            // Firestore 'in' queries support up to 30 items per call
            const chunkSize = 30;
            for (let i = 0; i < clientIds.length; i += chunkSize) {
              const chunk = clientIds.slice(i, i + chunkSize);
              const clientsSnap = await getDocs(
                query(collection(firebaseDb, 'clients'), where(documentId(), 'in', chunk))
              );
              clientsSnap.docs.forEach((clientDoc) => {
                const clientData = clientDoc.data() as Record<string, any>;
                const id = clientDoc.id;
                if (id && clientData.avatarUrl) {
                  avatarMap[id] = clientData.avatarUrl;
                }
              });
            }
          }

          // 3. Build the final job list, attaching the resolved avatarUrl
          const items: JobFeedItem[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Record<string, any>;
            const budget: string = data.budget ?? '';
            const price = budget.trim()
              ? budget.toLowerCase().includes('sats')
                ? budget
                : `${budget} sats`
              : '';

            const clientId: string = data.clientId ?? '';

            return {
              id: docSnap.id,
              title: data.title ?? 'Untitled Job',
              description: (data.description ?? '').replace(/\s{2,}/g, ' ').trim(),
              price,
              tags: Array.isArray(data.skills) ? data.skills : [],
              urgent: !!data.urgent,
              client: data.clientCompany || data.clientName || 'Client',
              experience: data.experienceLevel || 'All Levels',
              postedAt: formatPostedAt(data.createdAt),
              category: data.category ?? '',
              avatarUrl: avatarMap[clientId] || '',
            };
          });

          setJobs(items);
          setErrorMessage('');
        } catch {
          setErrorMessage('Unable to load jobs right now.');
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setErrorMessage('Unable to load jobs right now.');
      }
    );

    return () => unsubscribe();
  }, []);

  // Subscribe to saved jobs for the current user
  useEffect(() => {
    let unsubscribeSaved: (() => void) | undefined;

    const unsubscribeAuth = firebaseAuth.onAuthStateChanged((user) => {
      if (!user) {
        unsubscribeSaved?.();
        setSavedMap({});
        return;
      }

      setSavedLoading(true);
      unsubscribeSaved = onSnapshot(
        query(collection(firebaseDb, 'saved_jobs'), where('userId', '==', user.uid)),
        (snapshot) => {
          const map: Record<string, boolean> = {};
          snapshot.docs.forEach((docSnap) => {
            const jobId = (docSnap.data() as any).jobId;
            if (jobId) map[jobId] = true;
          });
          setSavedMap(map);
          setSavedLoading(false);
        },
        () => {
          setSavedLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSaved?.();
    };
  }, []);

  const filteredJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          (activeCategory === 'All' ||
            job.tags.includes(activeCategory) ||
            job.title.includes(activeCategory) ||
            job.category === activeCategory) &&
          (job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.description.toLowerCase().includes(searchTerm.toLowerCase()))
      ),
    [searchTerm, activeCategory, jobs]
  );

  const categories = useMemo(() => ['All', ...getCategories(jobs)], [jobs]);

  const handleToggleSave = async (jobId: string) => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      alert('Please log in to save jobs.');
      return;
    }
    const docId = `${user.uid}_${jobId}`;
    if (savedMap[jobId]) {
      await deleteDoc(doc(firebaseDb, 'saved_jobs', docId));
    } else {
      await setDoc(doc(firebaseDb, 'saved_jobs', docId), {
        userId: user.uid,
        jobId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  };

  const savedJobs = jobs.filter((job) => savedMap[job.id]);

  return (
    <section className="bg-[#FCF9F7] py-16">
      <div className="mx-auto w-full min-w-0 max-w-7xl px-6 lg:px-8">

        {/* HEADER */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#F7931A]/10 rounded-xl">
                <Zap className="w-6 h-6 text-[#F7931A]" />
              </div>
              <h1 className="text-3xl font-extrabold text-[#1a1a1a] tracking-tight">Job Feed</h1>
            </div>
            <p className="text-[#6b6560] text-sm md:text-base font-medium">
              Browse and apply to the best Bitcoin-native opportunities.
            </p>
          </div>
          <button
            onClick={() => setIsSavedOpen((prev) => !prev)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-400 text-white px-8 py-4 rounded-2xl font-bold text-sm hover:shadow-[0_8px_20px_-6px_rgba(249,115,22,0.6)] transition-all active:scale-95 group"
          >
            <Bookmark className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
            {isSavedOpen ? 'Back to Feed' : 'My Saved Jobs'}
          </button>
        </header>

        {/* SEARCH */}
        <div className="flex flex-col md:flex-row gap-4 mb-10">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b6560]" />
            <input
              type="text"
              placeholder="Search for bitcoin jobs, stacks, or keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-[#ece7df] rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F7931A]/10 focus:border-[#F7931A] transition-all shadow-sm"
            />
          </div>
        </div>

        {/* MAIN FEED */}
        <div className="space-y-6 min-w-0 overflow-hidden">

          {/* Category chips — hidden in saved view */}
          {!isSavedOpen && (
            <div className="w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden pb-2">
              <div className="inline-flex min-w-max items-center gap-2 pr-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`shrink-0 whitespace-nowrap rounded-full border px-6 py-2 text-xs font-bold transition-all ${
                      activeCategory === cat
                        ? 'bg-gradient-to-r from-orange-600 to-orange-400 text-white shadow-lg shadow-[#F7931A]/20'
                        : 'bg-white text-[#6b6560] border-[#ece7df]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {!isSavedOpen ? (
              // ── Feed view ──
              loading ? (
                <div className="bg-white rounded-3xl border border-[#ece7df] p-10 text-center text-[#6b6762]">
                  Loading jobs...
                </div>
              ) : errorMessage ? (
                <div className="bg-white rounded-3xl border border-[#F7931A]/20 p-10 text-center text-[#8C4F00]">
                  {errorMessage}
                </div>
              ) : filteredJobs.length > 0 ? (
                filteredJobs.map((job) => (
                  <JobFeedCard
                    key={job.id}
                    job={job}
                    isSaved={!!savedMap[job.id]}
                    heightClass="min-h-[180px]"
                    onToggleSave={() => handleToggleSave(job.id)}
                  />
                ))
              ) : (
                <div className="bg-white rounded-3xl border border-[#F7931A]/20 border-dashed p-10 text-center">
                  <Search className="w-12 h-12 text-[#F7931A]/30 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-[#1a1a1a]">No results found</h3>
                  <p className="text-[#6b6560] text-sm">Try a different search term or filter.</p>
                </div>
              )
            ) : (
              // ── Saved view ──
              <div className="bg-white rounded-3xl border border-[#ece7df] p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">
                      Saved Jobs
                    </div>
                    <h2 className="mt-2 text-[20px] font-semibold text-[#1a1a1a]">
                      Your saved opportunities
                    </h2>
                    <p className="mt-1 text-[12px] text-[#6b6762]">
                      Review the jobs you bookmarked and apply when you are ready.
                    </p>
                  </div>
                </div>

                {savedLoading ? (
                  <div className="rounded-[14px] border border-[#EAE7E2] bg-[#FAF8F5] p-6 text-[12px] text-[#6b6762] text-center">
                    Loading saved jobs...
                  </div>
                ) : savedJobs.length > 0 ? (
                  <div className="space-y-4">
                    {savedJobs.map((job) => (
                      <JobFeedCard
                        key={`saved-${job.id}`}
                        job={job}
                        isSaved
                        heightClass="min-h-[180px]"
                        onToggleSave={async () => {
                          const user = firebaseAuth.currentUser;
                          if (!user) return;
                          await deleteDoc(
                            doc(firebaseDb, 'saved_jobs', `${user.uid}_${job.id}`)
                          );
                        }}
                        compact
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[14px] border border-[#F7931A]/20 border-dashed bg-[#FFF8F2] p-8 text-center">
                    <Bookmark className="w-10 h-10 text-[#F7931A]/40 mx-auto mb-3" />
                    <h3 className="text-[16px] font-bold text-[#1a1a1a]">No saved jobs yet</h3>
                    <p className="text-[12px] text-[#6b6762]">
                      Tap the bookmark icon on a job to save it.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobFeedCard({
  job,
  isSaved = false,
  onToggleSave,
  compact = false,
  heightClass = '',
}: {
  job: JobFeedItem;
  isSaved?: boolean;
  onToggleSave?: () => void;
  compact?: boolean;
  heightClass?: string;
}) {
  const router = useRouter();

  return (
    <div
      className={`bg-white rounded-3xl border border-[#ece7df] p-4 shadow-sm transition-all hover:shadow-xl hover:border-[#F7931A]/30 group overflow-hidden ${compact ? 'md:p-4' : ''} ${heightClass}`}
    >
      <div className="flex gap-5">

        {/* Avatar */}
        <AvatarBox url={job.avatarUrl} name={job.client} />

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* Top row: urgent badge + posted time + save button */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {job.urgent && (
                <span className="bg-[#FCF9F7] text-[#8C4F00] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                  Urgent
                </span>
              )}
              <span className="text-xs text-[#6b6560] font-medium">{job.postedAt}</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave?.();
              }}
              className={`flex items-center justify-center h-9 w-9 rounded-full border transition-colors ${
                isSaved
                  ? 'bg-[#F7931A] text-white border-[#F7931A]'
                  : 'bg-white text-[#8C4F00] border-[#EAE7E2] hover:bg-[#F7F4F0]'
              }`}
              aria-label={isSaved ? 'Unsave job' : 'Save job'}
            >
              <Bookmark className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} />
            </button>
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
            <Briefcase className="w-4 h-4 text-[#6b6560] shrink-0" />
            <span className="text-sm font-medium text-[#6b6560] truncate">{job.client}</span>
            <span className="text-xs text-[#6b6560]">•</span>
            <span className="text-xs text-[#6b6560] whitespace-nowrap">{job.experience}</span>
          </div>

          {/* Description — 1 line clamp */}
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
              <ArrowUpRight className="w-4 h-4 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}