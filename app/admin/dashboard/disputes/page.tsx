"use client";

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';
import { AdminPageHeader, AdminTable, Metric, StatusPill } from '@/components/organisms/AdminDashboardParts';
import { formatDateTime } from '@/lib/admin-dashboard';
import { AlertCircle } from 'lucide-react';

interface Dispute {
  id: string;
  contractId: string;
  raisedBy: 'client' | 'freelancer';
  title: string;
  description: string;
  status: 'open' | 'in_review' | 'resolved' | 'dismissed';
  createdAt: any;
  updatedAt: any;
}

interface DisputeWithDetails extends Dispute {
  contractTitle?: string;
  freelancerName?: string;
  clientName?: string;
  jobTitle?: string;
  jobId?: string;
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<DisputeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDisputes = async () => {
      try {
        const q = query(collection(firebaseDb, 'disputes'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Dispute));

        const dataWithDetails = await Promise.all(data.map(async (d) => {
          let contractTitle = 'Unknown';
          let freelancerName = 'Unknown';
          let clientName = 'Unknown';
          let jobTitle = 'Unknown';
          let jobId = '';

          try {
            if (d.contractId) {
              const contractSnap = await getDoc(doc(firebaseDb, 'contracts', d.contractId));
              if (contractSnap.exists()) {
                const cData = contractSnap.data();
                contractTitle = cData.title || contractTitle;
                jobId = cData.jobId || '';

                const fId = cData.freelancerId || cData.freelancerUid || cData.freelancer_id || '';
                const cId = cData.clientId || cData.clientUid || cData.client_id || '';

                freelancerName = cData.freelancer || freelancerName;
                if (fId) {
                  try {
                    const freelancerUserSnap = await getDoc(doc(firebaseDb, 'all_users', fId));
                    if (freelancerUserSnap.exists()) {
                      const fuData = freelancerUserSnap.data();
                      freelancerName = fuData.fullName || fuData.name || freelancerName;
                    }
                  } catch (err) {
                    console.error('Failed to fetch freelancer name from all_users', err);
                  }
                }

                clientName = cData.clientName || clientName;
                if (cId) {
                  try {
                    const clientUserSnap = await getDoc(doc(firebaseDb, 'all_users', cId));
                    if (clientUserSnap.exists()) {
                      const cuData = clientUserSnap.data();
                      clientName = cuData.fullName || cuData.name || clientName;
                    }
                  } catch (err) {
                    console.error('Failed to fetch client name from all_users', err);
                  }
                }

                if (jobId) {
                  const jobSnap = await getDoc(doc(firebaseDb, 'jobs', jobId));
                  if (jobSnap.exists()) {
                    const jData = jobSnap.data();
                    jobTitle = jData.title || jobTitle;
                  }
                }
              }
            }
          } catch (err) {
            console.error('Error fetching details for dispute:', d.id, err);
          }

          return {
            ...d,
            contractTitle,
            freelancerName,
            clientName,
            jobTitle,
            jobId,
          };
        }));

        setDisputes(dataWithDetails);
      } catch (e) {
        console.error('Failed to load disputes', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDisputes();
  }, []);

  const openCount = disputes.filter((d) => d.status === 'open').length;
  const inReviewCount = disputes.filter((d) => d.status === 'in_review').length;
  const resolvedCount = disputes.filter((d) => d.status === 'resolved').length;
  const dismissedCount = disputes.filter((d) => d.status === 'dismissed').length;

  return (
    <>
      <AdminPageHeader
        eyebrow="Operations"
        title="Disputes"
        description="Manage and review disputes raised by clients or freelancers."
      />
      <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<AlertCircle />} label="Open" value={openCount} detail="Pending review" />
        <Metric icon={<AlertCircle />} label="In Review" value={inReviewCount} detail="Being examined" />
        <Metric icon={<AlertCircle />} label="Resolved" value={resolvedCount} detail="Closed successfully" />
        <Metric icon={<AlertCircle />} label="Dismissed" value={dismissedCount} detail="Closed without action" />
      </section>
      <section className="mt-5">
        {loading ? (
          <div className="text-sm text-gray-500">Loading disputes…</div>
        ) : (
          <AdminTable
            columns={["Contract", "Job", "Client", "Freelancer", "Raised By", "Title", "Status", "Created"]}
            rows={disputes.map((d) => ({
              href: `/admin/dashboard/disputes/${d.id}`,
              cells: [
                <div className="font-semibold text-gray-900" key="contract">{d.contractTitle}</div>,
                <div className="text-gray-600 font-medium" key="job">{d.jobTitle}</div>,
                <div className="text-gray-600 font-medium" key="client">{d.clientName}</div>,
                <div className="text-gray-600 font-medium" key="freelancer">{d.freelancerName}</div>,
                <div key="by" className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-[#1a1a1a] text-sm">
                    {d.raisedBy === 'client' ? d.clientName : d.freelancerName}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${
                    d.raisedBy === 'client'
                      ? 'border-blue-100 bg-blue-50 text-blue-700'
                      : 'border-emerald-100 bg-emerald-50 text-emerald-700'
                  }`}>
                    {d.raisedBy}
                  </span>
                </div>,
                <div key="title" className="font-medium text-gray-700">{d.title}</div>,
                <StatusPill key="status" status={d.status} />, 
                <div key="created" className="text-xs text-gray-500">{formatDateTime(d.createdAt?.toDate?.() || d.createdAt)}</div>,
              ],
            }))}
          />
        )}
      </section>
    </>
  );
}
