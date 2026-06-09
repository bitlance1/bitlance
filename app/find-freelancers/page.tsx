import Header from '@/components/organisms/Header';
import Footer from '@/components/organisms/Footer';
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';

export const metadata = {
  title: 'Find Bitcoin Freelancers | Bitlance',
  description: 'Discover skilled Bitcoin-native freelancers for your projects on Bitlance.',
};

async function getInitialFreelancers() {
  try {
    const freelancersSnap = await getDocs(collection(firebaseDb, 'freelancers'));
    const items = await Promise.all(
      freelancersSnap.docs.map(async (docSnap) => {
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
          icon: '', // icon handled in client component
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
    return items;
  } catch (error) {
    console.error('Failed to load freelancers on server:', error);
    return [];
  }
}

export default async function FindFreelancersPage() {
  const initialFreelancers = await getInitialFreelancers();
  return (
    <>
      <Header />
      <FindFreelancers initialFreelancers={initialFreelancers} />
      <Footer />
    </>
  );
}


type FreelancerCardItem = {
  id: string;
  icon?: string;
  title: string;
  fullName: string;
  description: string;
  price: string;
  tags: string[];
  skills: string[];
  profileHref: string;
  avatarUrl: string;
};

// ── LogoBox (Avatar) ─────────────────────────────────────────────────────────
function LogoBox({ url, name }: { url?: string; name?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  const showImg = !!url && !failed;
  return (
    <div className="h-11 w-11 min-w-[44px] rounded-[8px] bg-[#F7F4F0] ring-1 ring-[#EAE7E2] overflow-hidden flex items-center justify-center flex-shrink-0">
      {showImg ? (
        <img
          src={url}
          alt={name ? `${name} avatar` : 'Freelancer avatar'}
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
  lightning: '/assets/dev.png',
  bitcoin: '/assets/tech.png',
  go: '/assets/dev.png',
  'node.js': '/assets/tech.png',
  api: '/assets/tech.png',
  security: '/assets/tech.png',
  audit: '/assets/tech.png',
  figma: '/assets/creative.png',
  'ui/ux': '/assets/creative.png',
  branding: '/assets/creative.png',
  logo: '/assets/creative.png',
  growth: '/assets/sales.png',
  seo: '/assets/sales.png',
  email: '/assets/sales.png',
  partnerships: '/assets/sales.png',
  strategy: '/assets/sales.png',
  tax: '/assets/finance.png',
  compliance: '/assets/finance.png',
  finance: '/assets/finance.png',
  writing: '/assets/writting.png',
  documentation: '/assets/writting.png',
  communication: '/assets/admin.png',
  admin: '/assets/admin.png',
};

const getFreelancerIcon = (skills: string[]) => {
  for (const skill of skills) {
    const icon = CATEGORY_ICONS[skill.toLowerCase()];
    if (icon) return icon;
  }
  return '/assets/tech.png';
};

const formatHourlyRate = (hourlyRate: string, currency: string) => {
  const cleanRate = String(hourlyRate ?? '').trim();
  const cleanCurrency = String(currency ?? 'SATS').trim() || 'SATS';
  if (!cleanRate) return `0 ${cleanCurrency}/hr`;
  return `${cleanRate} ${cleanCurrency}/hr`;
};

export default function FindFreelancers({ initialFreelancers }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]);
  const [freelancers, setFreelancers] = useState<FreelancerCardItem[]>(initialFreelancers ?? []);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const toggleCategory = (category: string) => {
    setSelectedCategory((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const clearAll = () => {
    setSelectedCategory([]);
    setSearchTerm('');
  };

  useEffect(() => {
    let isActive = true;

    const loadFreelancers = async () => {
      setLoading(true);
      setErrorMessage('');

      try {
        const freelancersSnap = await getDocs(collection(firebaseDb, 'freelancers'));

        const items = await Promise.all(
          freelancersSnap.docs.map(async (docSnap) => {
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
              icon: getFreelancerIcon(skills),
              title: freeData.title?.trim() || fullName || 'Freelancer',
              fullName,
              description: freeData.bio?.trim() || 'Professional freelancer available for Bitcoin-native work.',
              price: formatHourlyRate(freeData.hourlyRate ?? '0', freeData.currency ?? 'SATS'),
              tags: skills.slice(0, 3),
              skills,
              profileHref: `/freelancer/public/${uid}`,
              avatarUrl: freeData.avatarUrl ?? allData.avatarUrl ?? '',
            } satisfies FreelancerCardItem;
          })
        );

        if (!isActive) return;
        setFreelancers(items.filter((item) => item.title || item.description || item.skills.length));
        setLoading(false);
      } catch {
        if (!isActive) return;
        setFreelancers([]);
        setLoading(false);
        setErrorMessage('Unable to load freelancers right now.');
      }
    };

    loadFreelancers();

    return () => {
      isActive = false;
    };
  }, []);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          freelancers
            .flatMap((freelancer) => freelancer.skills)
            .map((skill) => skill.trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [freelancers]
  );

  const filteredFreelancers = useMemo(() => {
    return freelancers.filter((freelancer) => {
      const matchesSearch =
        freelancer.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        freelancer.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        freelancer.skills.some((skill) => skill.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory =
        selectedCategory.length === 0 ||
        selectedCategory.some((skill) => freelancer.skills.includes(skill));

      return matchesSearch && matchesCategory;
    });
  }, [freelancers, searchTerm, selectedCategory]);

  return (
    <>
      <Header />
      <section className="bg-[#FCF9F7] pt-[120px] sm:pt-[140px] pb-16 min-h-screen">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1a1a1a]">Find Freelancers</h1>
            <p className="mt-2 text-sm text-[#666]">Discover talented Bitcoin-native freelancers for your projects.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="bg-[#F6F3F1] rounded-[48px] p-5 pl-[30px] h-fit pb-[40px]">
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
                            checked
                              ? 'bg-[#8C4F00]'
                              : 'border border-[#C4B8A8] bg-transparent'
                          }`}
                        >
                          {checked && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path
                                d="M1 4L3.8 7L9 1"
                                stroke="white"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>
                        <span className="text-sm text-[#555]">{cat}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={clearAll}
                className="w-full rounded-full bg-[#E4DDD4] hover:bg-[#D9D0C6] text-[#666] text-sm font-medium py-2.5 transition-colors"
              >
                Clear All Filters
              </button>
            </aside>

            <main className="min-w-0">
              <div className="mb-5 w-full">
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search for freelancers, skills, or keywords..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-full bg-[#F6F3F1] h-[54px] pl-9 pr-4 text-sm text-[#333] placeholder-[#aaa] outline-none focus:border-[#c8a97e]"
                  />
                </div>
              </div>

              <div className="mb-1">
                <h2 className="text-[20px] sm:text-[24px] md:text-[30px] font-semibold text-[#1B1C1B]">Available Freelancers</h2>
              </div>
              <div className="mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <p className="text-[13px] sm:text-[14px] md:text-[16px] text-[#554335]">
                  {filteredFreelancers.length} verified professionals ready to work
                </p>
                <div className="flex items-center gap-1 text-[12px] sm:text-[13px] md:text-[14px] text-[#554335]">
                  <span>Sort by:</span>
                  <div className="bg-[#F0EDEB] h-[32px] sm:h-[34px] flex items-center px-3 sm:px-[15px] rounded-[999px]">
                    <button className="flex items-center gap-1 font-semibold text-[#1B1C1B]">
                      Top Rated
                      <svg width="10" height="10" className="sm:w-[12px] sm:h-[12px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {loading ? (
                  <div className="rounded-2xl border border-[#ece7dd] bg-white p-8 text-center text-[#777]">
                    Loading freelancers...
                  </div>
                ) : errorMessage ? (
                  <div className="rounded-2xl border border-[#ece7dd] bg-white p-8 text-center text-[#8C4F00]">
                    {errorMessage}
                  </div>
                ) : filteredFreelancers.length ? (
                  filteredFreelancers.map((freelancer) => (
                    <div
                      key={freelancer.id}
                      className="bg-white rounded-3xl border border-[#ece7df] p-4 shadow-sm transition-all hover:shadow-xl hover:border-[#F7931A]/30 group overflow-hidden"
                    >
                      <div className="flex gap-5">
                        {/* Freelancer Avatar */}
                        <LogoBox url={freelancer.avatarUrl} name={freelancer.fullName} />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {/* Top row: Status/Placeholder */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#6b6560] font-medium">Available now</span>
                            </div>
                          </div>

                          {/* Title + Rate */}
                          <div className="flex items-start justify-between gap-4 mb-1.5">
                            <h3 className="text-lg font-bold text-[#1a1a1a] transition-colors flex-1 break-words min-w-0">
                              {freelancer.title}
                            </h3>
                            {freelancer.price && (
                              <span className="text-[15px] font-bold text-[#8C4F00] whitespace-nowrap shrink-0">
                                {freelancer.price}
                              </span>
                            )}
                          </div>

                          {/* Name + Experience placeholder */}
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-[#6b6560] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                            <span className="text-sm font-medium text-[#6b6560] truncate">{freelancer.fullName}</span>
                            <span className="text-xs text-[#6b6560]">•</span>
                            <span className="text-xs text-[#6b6560] whitespace-nowrap">Verified Professional</span>
                          </div>

                          {/* Bio — 1 line clamp */}
                          {freelancer.description && (
                            <p
                              className="text-sm text-[#6b6560] leading-relaxed mb-2 overflow-hidden break-all"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {freelancer.description}
                            </p>
                          )}

                          {/* Tags/Skills */}
                          {freelancer.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {freelancer.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-3 py-1 bg-[#FCF9F7] text-[#6b6560] text-[10px] font-bold rounded-full border border-[#ece7df] group-hover:bg-[#F7931A]/10 group-hover:text-[#F7931A] group-hover:border-[#F7931A]/30 transition-colors"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Profile button */}
                          <div className="flex justify-end">
                            <button
                              onClick={() => window.location.href = freelancer.profileHref}
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
      <Footer />
    </>
  );
}
