import React from 'react';
import { notFound } from 'next/navigation';
import { firebaseDb } from '@/lib/firebase';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import JobDetailClient from '@/components/organisms/JobDetailClient';
import type { Metadata } from 'next';

const parseSats = (value: string | number) => {
  const cleaned = String(value ?? '').replace(/[^0-9.]/g, '');
  return cleaned ? Number(cleaned) : 0;
};
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
const formatMemberSince = (value: unknown) => {
  const timestampMs = getTimestampMs(value);
  if (!timestampMs) return '';
  return new Date(timestampMs).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
};

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getJobData(id: string) {
  const snap = await getDoc(doc(firebaseDb, 'jobs', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as any;
}

async function getClientSidebarData(job: any) {
  const clientId = job?.clientId;
  if (!clientId) {
    return {
      name: job?.clientName ?? job?.clientCompany ?? 'Client',
      companyLogo: job?.companyLogo ?? '',
      location: 'Remote',
      jobsPosted: 0,
      hires: 0,
      totalSpent: '0 sats',
      memberSince: '',
    };
  }

  try {
    const [allUsersSnap, clientSnap, jobsSnap, contractsSnap] = await Promise.all([
      getDoc(doc(firebaseDb, 'all_users', clientId)),
      getDoc(doc(firebaseDb, 'clients', clientId)),
      getDocs(query(collection(firebaseDb, 'jobs'), where('clientId', '==', clientId))),
      getDocs(query(collection(firebaseDb, 'contracts'), where('clientId', '==', clientId))),
    ]);

    const allData = allUsersSnap.exists() ? (allUsersSnap.data() as any) : {};
    const clientData = clientSnap.exists() ? (clientSnap.data() as any) : {};

    const jobsPostedFallback = jobsSnap.size;
    const hiresFallback = contractsSnap.size;
    const spentFallback = contractsSnap.docs.reduce((sum, docSnap) => {
      const data = docSnap.data() as any;
      return sum + parseSats(data.budget ?? data.fixedPrice ?? data.rate ?? 0);
    }, 0);

    return {
      name:
        clientData.companyName ??
        clientData.fullName ??
        allData.fullName ??
        job?.clientName ??
        job?.clientCompany ??
        'Client',
      companyLogo:
        job?.companyLogo ??
        clientData.companyLogo ??
        clientData.companyLogoUrl ??
        allData.companyLogo ??
        allData.companyLogoUrl ??
        '',
      location: clientData.location ?? allData.location ?? 'Remote',
      jobsPosted: Number(clientData.jobsPosted ?? jobsPostedFallback ?? 0),
      hires: Number(clientData.hires ?? hiresFallback ?? 0),
      totalSpent: formatSats(clientData.totalSpent ?? spentFallback),
      memberSince: formatMemberSince(allData.createdAt ?? clientData.createdAt),
    };
  } catch (e) {
    return {
      name: job?.clientName ?? job?.clientCompany ?? 'Client',
      companyLogo: job?.companyLogo ?? '',
      location: 'Remote',
      jobsPosted: 0,
      hires: 0,
      totalSpent: '0 sats',
      memberSince: '',
    };
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const job = await getJobData(id);

  if (!job) {
    return {
      title: 'Job Not Found | Bitlance',
      description: 'The requested freelance job post could not be found on Bitlance.',
    };
  }

  const budgetText = job.budget ? ` - Budget: ${job.budget}` : '';
  const descriptionSnippet = job.description
    ? job.description.substring(0, 155) + '...'
    : 'View this Bitcoin-native freelance job opportunity on Bitlance.';

  return {
    title: `${job.title}${budgetText} | Bitlance`,
    description: descriptionSnippet,
    openGraph: {
      title: `${job.title} | Bitlance`,
      description: descriptionSnippet,
      type: 'article',
      url: `https://bitlance.work/job/${id}`,
      images: [
        {
          url: job.companyLogo || 'https://bitlance.work/assets/tech.png',
          width: 800,
          height: 600,
          alt: job.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${job.title} | Bitlance`,
      description: descriptionSnippet,
      images: [job.companyLogo || 'https://bitlance.work/assets/tech.png'],
    },
  };
}

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const job = await getJobData(id);

  if (!job) {
    notFound();
  }

  const initialClientSidebar = await getClientSidebarData(job);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    'title': job.title,
    'description': job.description,
    'datePosted': job.createdAt?.seconds ? new Date(job.createdAt.seconds * 1000).toISOString() : new Date().toISOString(),
    'validThrough': new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    'employmentType': job.jobType === 'Hourly' ? 'PART_TIME' : 'CONTRACTOR',
    'hiringOrganization': {
      '@type': 'Organization',
      'name': initialClientSidebar.name,
      'logo': initialClientSidebar.companyLogo || 'https://bitlance.work/assets/tech.png',
    },
    'jobLocation': {
      '@type': 'Place',
      'address': {
        '@type': 'PostalAddress',
        'addressLocality': initialClientSidebar.location || 'Remote',
        'addressCountry': 'Global',
      },
    },
    'baseSalary': job.budget ? {
      '@type': 'MonetaryAmount',
      'currency': 'SATS',
      'value': {
        '@type': 'QuantitativeValue',
        'value': parseSats(job.budget),
        'unitText': job.jobType === 'Hourly' ? 'HOUR' : 'ONCE',
      },
    } : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <JobDetailClient job={job} initialClientSidebar={initialClientSidebar} />
    </>
  );
}
