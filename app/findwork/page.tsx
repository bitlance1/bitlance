import Header from '@/components/organisms/Header';
import FindWorkClient from '@/components/organisms/FindWorkClient';
import Footer from '@/components/organisms/Footer';
import { firebaseDb } from '@/lib/firebase';
import { collection, getDocs, query, where, documentId } from 'firebase/firestore';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Find Bitcoin Freelance Jobs & Projects | Bitlance',
  description: 'Browse the latest Bitcoin-native freelance job opportunities and circular economy projects on Bitlance.',
};

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

const formatBudgetLabel = (budget: string, jobType: string) => {
  const trimmed = String(budget ?? '').trim();
  if (!trimmed) return '';
  if (/sats/i.test(trimmed)) return trimmed;
  return jobType === 'Hourly' ? `${trimmed} Sats/hr` : `${trimmed} Sats`;
};

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

async function getInitialJobs() {
  try {
    const jobsQuery = query(collection(firebaseDb, 'jobs'), where('status', '==', 'Open'));
    const snapshot = await getDocs(jobsQuery);
    
    // 1. collect unique clientIds
    const clientIds = Array.from(
      new Set(
        snapshot.docs
          .map((d) => (d.data() as any).clientId as string | undefined)
          .filter((id): id is string => !!id)
      )
    );

    // 2. batch-fetch clients -> company logo map
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

    const items = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data() as any;
        const category = typeof data.category === 'string' ? data.category : '';
        const jobType = data.jobType === 'Hourly' ? 'Hourly' : 'Fixed';
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
          type: jobType as 'Fixed' | 'Hourly',
          icon: CATEGORY_ICONS[category] ?? '/assets/tech.png',
          title,
          description,
          price: formatBudgetLabel(data.budget ?? '', jobType),
          tags,
          createdAt: data.createdAt ? { seconds: data.createdAt.seconds || 0, nanoseconds: data.createdAt.nanoseconds || 0 } : null,
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

    return items;
  } catch (error) {
    console.error("Failed to get initial jobs on server:", error);
    return [];
  }
}

export default async function FindWorkPage() {
  const initialJobs = await getInitialJobs();

  return (
    <div className="relative min-h-screen bg-[#FAF8F5] overflow-x-hidden">
      <Header />
      <main className="pt-20">
        <FindWorkClient initialJobs={initialJobs} />
      </main>
      <Footer />
    </div>
  );
}
