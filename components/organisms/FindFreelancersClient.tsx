'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';

/* ─── Types ────────────────────────────────────────── */
type Freelancer = {
  id: string;
  icon: string;
  title: string;
  fullName: string;
  description: string;
  price: string;
  tags: string[];
  skills: string[];
  profileHref: string;
  avatarUrl: string;
};

/* ─── Avatar ───────────────────────────────────────── */
function AvatarBox({ url, name }: { url?: string; name?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  const showImg = !!url && !failed;
  return (
    <div className="h-14 w-14 min-w-[56px] rounded-full bg-[#F7F4F0] ring-1 ring-[#EAE7E2] overflow-hidden flex items-center justify-center flex-shrink-0">
      {showImg ? (
        <img
          src={url}
          alt={name ? `${name} avatar` : 'Freelancer avatar'}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8C4F00" strokeWidth="2" aria-hidden="true">
          <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" />
          <path d="M4 21c0-3.314 2.686-6 6-6h4c3.314 0 6 2.686 6 6" />
        </svg>
      )}
    </div>
  );
}

/* ─── Skill categories ─────────────────────────────── */
const SKILL_CATEGORIES = [
  'Development',
  'Design & Creative',
  'Marketing',
  'Writing',
  'Finance & Accounting',
  'Blockchain & Crypto',
  'Customer Support',
  'Data & Analytics',
  'DevOps & Infrastructure',
  'Security',
  'Product Management',
  'QA & Testing',
];

/* ─── Main Component ───────────────────────────────── */
interface FindFreelancersClientProps {
  initialFreelancers: Freelancer[];
}

export default function FindFreelancersClient({ initialFreelancers }: FindFreelancersClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [freelancers, setFreelancers] = useState<Freelancer[]>(initialFreelancers);
  const [loading, setLoading] = useState(initialFreelancers.length === 0);

  // Keep in sync with server component props
  useEffect(() => {
    if (initialFreelancers && initialFreelancers.length > 0) {
      setFreelancers(initialFreelancers);
      setLoading(false);
    }
  }, [initialFreelancers]);

  // Real-time listener for client-side updates
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(firebaseDb, 'freelancers'),
      async (snapshot) => {
        try {
          const items: Freelancer[] = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const freeData = docSnap.data() as any;
              const uid = docSnap.id;
              let allData: any = {};
              try {
                const allUsersSnap = await getDoc(doc(firebaseDb, 'all_users', uid));
                allData = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
              } catch {
                allData = {};
              }
              const skills = Array.isArray(freeData.skills) ? freeData.skills.filter(Boolean) : [];
              const fullName =
                freeData.fullName ??
                allData.fullName ??
                `${freeData.firstName ?? allData.firstName ?? ''} ${freeData.lastName ?? allData.lastName ?? ''}`.trim() ??
                'Freelancer';
              return {
                id: uid,
                icon: '',
                title: freeData.title?.trim() || fullName || 'Freelancer',
                fullName,
                description: freeData.bio?.trim() || 'Professional freelancer available for Bitcoin-native work.',
                price: `${freeData.hourlyRate ?? '0'} ${freeData.currency ?? 'SATS'}/hr`,
                tags: skills.slice(0, 3),
                skills,
                profileHref: `/freelancer/public/${uid}`,
                avatarUrl: freeData.avatarUrl ?? allData.avatarUrl ?? '',
              };
            })
          );
          setFreelancers(items);
          setLoading(false);
        } catch {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const clearAll = () => {
    setSelectedSkills([]);
    setSearchTerm('');
  };

  // Derive available skill tags from the freelancers
  const availableSkills = useMemo(
    () =>
      Array.from(
        new Set(freelancers.flatMap((f) => f.skills).filter((s) => s && s.trim().length > 0))
      ).sort(),
    [freelancers]
  );

  const filteredFreelancers = useMemo(() => {
    return freelancers.filter((f) => {
      const matchesSearch =
        f.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.skills.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesSkills =
        selectedSkills.length === 0 ||
        selectedSkills.some((skill) =>
          f.skills.some((s) => s.toLowerCase() === skill.toLowerCase())
        );
      return matchesSearch && matchesSkills;
    });
  }, [freelancers, searchTerm, selectedSkills]);

  return (
    <section className="bg-[#FCF9F7] pt-[30px] pb-16 min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1a1a1a]">Find Freelancers</h1>
          <p className="mt-2 text-sm text-[#666]">
            Discover skilled Bitcoin-native freelancers for your projects.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">

          {/* ─── Sidebar filters ─── */}
          <aside className="bg-[#F6F3F1] rounded-[48px] p-5 pl-[30px] h-fit pb-[40px]">

            {/* Skills filter */}
            <div className="mb-5 mt-[10px]">
              <p className="text-[0.62rem] font-bold uppercase tracking-widest text-[#9A8F82] mb-3">
                Skills
              </p>
              <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-2">
                {availableSkills.map((skill) => {
                  const checked = selectedSkills.includes(skill);
                  return (
                    <label key={skill} className="flex items-center gap-2.5 cursor-pointer">
                      <span
                        onClick={() => toggleSkill(skill)}
                        className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                          checked ? 'bg-[#8C4F00]' : 'border border-[#C4B8A8] bg-transparent'
                        }`}
                      >
                        {checked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.8 7L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className="text-sm text-[#555]">{skill}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Clear all */}
            <button
              onClick={clearAll}
              className="w-full rounded-full bg-[#E4DDD4] hover:bg-[#D9D0C6] text-[#666] text-sm font-medium py-2.5 transition-colors"
            >
              Clear All Filters
            </button>
          </aside>

          {/* ─── Main content ─── */}
          <main className="min-w-0">

            {/* Search */}
            <div className="mb-5 w-full">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]"
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Search freelancers by name, skill, or keyword..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-full bg-[#F6F3F1] h-[54px] pl-9 pr-4 text-sm text-[#333] placeholder-[#aaa] outline-none focus:border-[#c8a97e]"
                />
              </div>
            </div>

            {/* Title + count */}
            <div className="mb-1">
              <h2 className="text-[20px] sm:text-[24px] md:text-[30px] font-semibold text-[#1B1C1B]">Available Freelancers</h2>
            </div>
            <div className="mb-5">
              <p className="text-[13px] sm:text-[14px] md:text-[16px] text-[#554335]">
                {filteredFreelancers.length} freelancer{filteredFreelancers.length !== 1 ? 's' : ''} ready for Bitcoin-native work
              </p>
            </div>

            {/* Freelancer cards */}
            <div className="flex flex-col gap-4">
              {loading ? (
                <div className="rounded-2xl border border-[#ece7dd] bg-white p-8 text-center text-[#777]">
                  Loading freelancers...
                </div>
              ) : filteredFreelancers.length ? (
                filteredFreelancers.map((f) => (
                  <div
                    key={f.id}
                    className="bg-white rounded-3xl border border-[#ece7df] p-4 shadow-sm transition-all hover:shadow-xl hover:border-[#F7931A]/30 group overflow-hidden"
                  >
                    <div className="flex gap-5">

                      {/* Avatar */}
                      <AvatarBox url={f.avatarUrl} name={f.fullName} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">

                        {/* Name + rate */}
                        <div className="flex items-start justify-between gap-4 mb-1.5">
                          <h3 className="text-lg font-bold text-[#1a1a1a] transition-colors flex-1 break-words min-w-0">
                            {f.fullName}
                          </h3>
                          {f.price && (
                            <span className="text-[15px] font-bold text-[#8C4F00] whitespace-nowrap shrink-0">
                              {f.price}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-[#6b6560] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                          </svg>
                          <span className="text-sm font-medium text-[#6b6560] truncate">{f.title}</span>
                        </div>

                        {/* Description */}
                        {f.description && (
                          <p
                            className="text-sm text-[#6b6560] leading-relaxed mb-2 overflow-hidden break-all"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {f.description}
                          </p>
                        )}

                        {/* Tags */}
                        {f.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {f.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-3 py-1 bg-[#FCF9F7] text-[#6b6560] text-[10px] font-bold rounded-full border border-[#ece7df] group-hover:bg-[#F7931A]/10 group-hover:text-[#F7931A] group-hover:border-[#F7931A]/30 transition-colors"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* View profile button */}
                        <div className="flex justify-end">
                          <button
                            onClick={() => router.push(f.profileHref)}
                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-400 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-95 group/btn"
                          >
                            View Profile
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform">
                              <path d="M7 17L17 7M17 7H7M17 7v10" />
                            </svg>
                          </button>
                        </div>

                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-[#ece7dd] bg-white p-8 text-center text-[#777]">
                  No freelancers match your filters.
                </div>
              )}
            </div>
          </main>

        </div>
      </div>
    </section>
  );
}
