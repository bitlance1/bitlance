"use client"
import { useEffect, useState } from 'react';
import { doc, getDoc, getDocs, updateDoc, serverTimestamp, collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';
import { AdminPageHeader, Metric, StatusPill, DetailGrid, Panel, AdminBackLink } from '@/components/organisms/AdminDashboardParts';
import { formatDateTime } from '@/lib/admin-dashboard';
import { AlertCircle, ExternalLink, MessageSquare, Paperclip, User } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

interface Dispute {
  id: string;
  contractId: string;
  raisedBy: 'client' | 'freelancer';
  title: string;
  description: string;
  status: 'open' | 'in_review' | 'resolved' | 'dismissed';
  adminNotes?: string;
  attachmentUrl?: string;
  createdAt: any;
  updatedAt: any;
}

interface DisputeDetails {
  contractTitle: string;
  freelancerName: string;
  clientName: string;
  jobTitle: string;
  jobId: string;
  conversationId: string;
  freelancerId: string;
  clientId: string;
}

export default function AdminDisputeDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();

  const openOutreach = (role: 'client' | 'freelancer') => {
    const userId = role === 'client' ? details.clientId : details.freelancerId;
    const name = role === 'client' ? details.clientName : details.freelancerName;
    router.push(
      `/admin/dashboard/outreach/new?recipientId=${userId}&recipientRole=${role}&recipientName=${encodeURIComponent(name)}&subject=${encodeURIComponent(`Re: Dispute — ${dispute?.title ?? details.contractTitle}`)}`
    );
  };
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [details, setDetails] = useState<DisputeDetails>({
    contractTitle: 'Loading…',
    freelancerName: 'Loading…',
    clientName: 'Loading…',
    jobTitle: 'Loading…',
    jobId: '',
    conversationId: '',
    freelancerId: '',
    clientId: '',
  });
  const [job, setJob] = useState<any | null>(null);
  const [contract, setContract] = useState<any | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Form states
  const [status, setStatus] = useState<Dispute['status']>('open');
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!id) return;
    const fetchDispute = async () => {
      try {
        const docRef = doc(firebaseDb, 'disputes', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const dispData = { id: snap.id, ...snap.data() } as Dispute;
          setDispute(dispData);
          setStatus(dispData.status);
          setAdminNotes(dispData.adminNotes || '');

          // Fetch contract and job
          if (dispData.contractId) {
            const contractSnap = await getDoc(doc(firebaseDb, 'contracts', dispData.contractId));
            if (contractSnap.exists()) {
              const cData = contractSnap.data();
              setContract({ id: contractSnap.id, ...cData });
              
              const cTitle = cData.title || 'Unknown';
              const jId = cData.jobId || '';
              const fId = cData.freelancerId || cData.freelancerUid || cData.freelancer_id || '';
              const cId = cData.clientId || cData.clientUid || cData.client_id || '';
              const convId = jId && fId ? `${jId}_${fId}` : dispData.contractId;

              // Fetch Freelancer Name from all_users
              let fName = cData.freelancer || 'Unknown';
              if (fId) {
                try {
                  const freelancerUserSnap = await getDoc(doc(firebaseDb, 'all_users', fId));
                  if (freelancerUserSnap.exists()) {
                    const fuData = freelancerUserSnap.data();
                    fName = fuData.fullName || fuData.name || fName;
                  }
                } catch (err) {
                  console.error('Failed to fetch freelancer name from all_users', err);
                }
              }

              // Fetch Client Name from all_users
              let cName = cData.clientName || 'Unknown';
              if (cId) {
                try {
                  const clientUserSnap = await getDoc(doc(firebaseDb, 'all_users', cId));
                  if (clientUserSnap.exists()) {
                    const cuData = clientUserSnap.data();
                    cName = cuData.fullName || cuData.name || cName;
                  }
                } catch (err) {
                  console.error('Failed to fetch client name from all_users', err);
                }
              }

              let jTitle = 'Unknown';
              if (jId) {
                const jobSnap = await getDoc(doc(firebaseDb, 'jobs', jId));
                if (jobSnap.exists()) {
                  const jobData = jobSnap.data();
                  setJob({ id: jobSnap.id, ...jobData });
                  jTitle = jobData.title || 'Unknown';
                }
              }

              setDetails({
                contractTitle: cTitle,
                freelancerName: fName,
                clientName: cName,
                jobTitle: jTitle,
                jobId: jId,
                conversationId: convId,
                freelancerId: fId,
                clientId: cId,
              });

              // Fetch submissions without composite index
              setLoadingSubmissions(true);
              try {
                const allSubsSnap = await getDocs(collection(firebaseDb, 'submitted_jobs'));
// Define a type for the submitted job documents
type SubmittedJob = {
  id: string;
  contractId: string;
  submittedAt?: any;
  // allow any other fields
  [key: string]: any;
};
const allSubs = allSubsSnap.docs.map(
  (d) => ({ id: d.id, ...d.data() } as SubmittedJob)
);
const filtered = allSubs.filter(
  (s) => s.contractId === dispData.contractId
);
                filtered.sort((a: any, b: any) => {
                  const dateA = a.submittedAt?.toDate?.() || (a.submittedAt ? new Date(a.submittedAt) : new Date(0));
                  const dateB = b.submittedAt?.toDate?.() || (b.submittedAt ? new Date(b.submittedAt) : new Date(0));
                  return dateB.getTime() - dateA.getTime();
                });
                setSubmissions(filtered);
              } catch (subErr) {
                console.error('Failed to fetch submissions', subErr);
              } finally {
                setLoadingSubmissions(false);
              }
            } else {
              setDetails({
                contractTitle: 'Not Found',
                freelancerName: 'Not Found',
                clientName: 'Not Found',
                jobTitle: 'Not Found',
                jobId: '',
                conversationId: dispData.contractId,
                freelancerId: '',
                clientId: '',
              });
            }
          }
        }
      } catch (e) {
        console.error('Failed to load dispute details', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDispute();
  }, [id]);

  useEffect(() => {
    if (!id || !details.conversationId) return;
    setLoadingMessages(true);
    const msgRef = collection(firebaseDb, 'conversations', details.conversationId, 'messages');
    const msgQuery = query(msgRef, orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(msgQuery, (snapshot) => {
      const msgList = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setMessages(msgList);
      setLoadingMessages(false);
    }, (err) => {
      console.error("Failed to stream messages:", err);
      setLoadingMessages(false);
    });
    return () => unsub();
  }, [id, details.conversationId]);

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setSaveSuccess(false);
    setSaveError('');
    try {
      const docRef = doc(firebaseDb, 'disputes', id);
      await updateDoc(docRef, {
        status,
        adminNotes,
        updatedAt: serverTimestamp(),
      });
      setDispute((prev) => prev ? { ...prev, status, adminNotes } : null);
      setSaveSuccess(true);
    } catch (err: any) {
      console.error('Failed to save dispute status', err);
      setSaveError(err.message || 'Failed to update dispute details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading dispute details…</div>;
  }

  if (!dispute) {
    return <div className="text-sm text-gray-500">Dispute not found.</div>;
  }

  return (
    <>
      <AdminBackLink href="/admin/dashboard/disputes" />
      
      <AdminPageHeader
        eyebrow="Dispute Detail"
        title={dispute.title}
        description={`Raised by ${dispute.raisedBy === 'client' ? details.clientName : details.freelancerName} (${dispute.raisedBy}) · Job: "${details.jobTitle}" · Contract: "${details.contractTitle}"`}
      />

      <section className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Metric
          icon={<AlertCircle />}
          label="Status"
          value={<StatusPill status={dispute.status} />}
        />
        <Metric
          icon={<AlertCircle />}
          label="Created"
          value={formatDateTime(dispute.createdAt?.toDate?.() || dispute.createdAt)}
        />
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Associations</h2>
        <DetailGrid
          items={[
            {
              label: 'Raised By',
              value: (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-[#1a1a1a]">
                    {dispute.raisedBy === 'client' ? details.clientName : details.freelancerName}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] ${
                    dispute.raisedBy === 'client'
                      ? 'border-blue-100 bg-blue-50 text-blue-700'
                      : 'border-emerald-100 bg-emerald-50 text-emerald-700'
                  }`}>
                    {dispute.raisedBy}
                  </span>
                </div>
              ),
            },
            {
              label: 'Contract',
              value: (
                <div>
                  <span className="font-semibold">{details.contractTitle}</span>
                  <span className="block text-[11px] text-gray-400 mt-0.5">{dispute.contractId}</span>
                </div>
              ),
            },
            {
              label: 'Job Post',
              value: (
                <div>
                  <span className="font-semibold">{details.jobTitle}</span>
                  {details.jobId && <span className="block text-[11px] text-gray-400 mt-0.5">{details.jobId}</span>}
                </div>
              ),
            },
            { label: 'Client Name', value: details.clientName },
            { label: 'Freelancer Name', value: details.freelancerName },
          ]}
        />
      </section>

      {/* Reach out panel */}
      <section className="mt-6 rounded-[8px] border border-[#E7E1D8] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-[#1a1a1a]">Reach Out</h2>
        <p className="mt-1 text-xs text-[#6b6762]">
          Send a direct message to the client or freelancer regarding this dispute. They will receive a notification and can reply from their Admin Inbox.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => openOutreach('client')}
            disabled={!details.clientId}
            className="flex items-center gap-2 rounded-[8px] border border-[#E7E1D8] bg-white px-4 py-2.5 text-sm font-black text-[#1a1a1a] hover:bg-[#FFF4E6] hover:border-[#F7931A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <User className="h-4 w-4 text-[#8C4F00]" />
            Message Client
            {details.clientName && details.clientName !== 'Loading…' && (
              <span className="ml-1 text-[11px] font-semibold text-[#6b6762]">({details.clientName})</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => openOutreach('freelancer')}
            disabled={!details.freelancerId}
            className="flex items-center gap-2 rounded-[8px] border border-[#E7E1D8] bg-white px-4 py-2.5 text-sm font-black text-[#1a1a1a] hover:bg-[#FFF4E6] hover:border-[#F7931A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MessageSquare className="h-4 w-4 text-[#8C4F00]" />
            Message Freelancer
            {details.freelancerName && details.freelancerName !== 'Loading…' && (
              <span className="ml-1 text-[11px] font-semibold text-[#6b6762]">({details.freelancerName})</span>
            )}
          </button>
        </div>
        <p className="mt-3 text-[11px] text-[#8f8780]">
          Dispute: <span className="font-bold text-[#1a1a1a]">{dispute?.title}</span> · Contract: <span className="font-bold text-[#1a1a1a]">{details.contractTitle}</span> · Job: <span className="font-bold text-[#1a1a1a]">{details.jobTitle}</span>
        </p>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">        {/* Left column: Evidence Description & Resolution Controls */}
        <div className="space-y-6">
          <Panel title="Description & Evidence" subtitle="Provided by the reporter of the dispute.">
            <div className="space-y-4">
              <div className="text-sm text-gray-700 whitespace-pre-wrap bg-[#FAF8F5] rounded-xl p-4 border border-[#E7E1D8] leading-relaxed">
                {dispute.description}
              </div>

              {dispute.attachmentUrl && (
                <div className="mt-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Evidence Attachment</h4>
                  <a
                    href={dispute.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors"
                  >
                    View Attachment <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Resolution Controls" subtitle="Manage status and internal notes.">
            <form onSubmit={handleSaveChanges} className="space-y-4">
              {saveSuccess && (
                <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-xs text-green-700 font-semibold">
                  Changes saved successfully!
                </div>
              )}
              {saveError && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700 font-semibold">
                  {saveError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Update Status
                </label>
                <select
                  disabled={saving}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-[#E7E1D8] bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                >
                  <option value="open">Open</option>
                  <option value="in_review">In Review</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Admin Resolution Notes
                </label>
                <textarea
                  disabled={saving}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Record dispute details, decisions, and logic for resolution..."
                  rows={6}
                  className="w-full rounded-xl border border-[#E7E1D8] bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-orange-500 resize-none disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-orange-600 hover:bg-orange-700 py-3 text-sm font-bold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving ? 'Saving changes…' : 'Save Resolution Details'}
              </button>
            </form>
          </Panel>
        </div>

        {/* Right column: Linked Job details & Linked Contract details */}
        <div className="space-y-6">
          <Panel title="Linked Job Post" subtitle="Job context for this dispute.">
            {job ? (
              <div className="space-y-4 text-sm text-gray-700">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="font-bold text-gray-900 text-base">{job.title || 'Unknown Job'}</span>
                  {job.id && (
                    <a
                      href={`/admin/dashboard/jobs/${job.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors"
                    >
                      View Full Job Details <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Pricing Type</span>
                    <span className="font-semibold text-gray-800 capitalize">{job.pricingType || job.paymentMode || 'Fixed Price'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Budget / Price</span>
                    <span className="font-semibold text-gray-800">{job.budget ? `${job.budget} sats` : 'Not Specified'}</span>
                  </div>
                  {job.category && (
                    <div className="col-span-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Category</span>
                      <span className="font-semibold text-gray-800">{job.category}</span>
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Description</span>
                  <p className="bg-[#FAF8F5] rounded-xl p-3 border border-[#E7E1D8] text-xs whitespace-pre-wrap leading-relaxed max-h-[160px] overflow-y-auto">
                    {job.description || 'No description provided.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 py-4">No job post linked to this contract or still loading…</div>
            )}
          </Panel>

          <Panel title="Linked Contract & Milestones" subtitle="Contract settings and milestone progression.">
            {contract ? (
              <div className="space-y-4 text-sm text-gray-700">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="font-bold text-gray-900 text-base">{contract.title || 'Unknown Contract'}</span>
                  <span className="text-xs font-semibold text-gray-400">ID: {contract.id}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#FAF8F5] p-2 rounded-lg border border-[#EFEAE3] text-center">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#8f8780] block">Budget</span>
                    <span className="font-bold text-gray-900 block mt-0.5">{contract.budget || contract.paymentTotalAmountSats || '0'} sats</span>
                  </div>
                  <div className="bg-[#FAF8F5] p-2 rounded-lg border border-[#EFEAE3] text-center">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#8f8780] block">Work Status</span>
                    <span className="text-xs font-bold text-orange-600 block capitalize mt-0.5">{contract.workStatus || 'Not Started'}</span>
                  </div>
                  <div className="bg-[#FAF8F5] p-2 rounded-lg border border-[#EFEAE3] text-center">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#8f8780] block">Payment Status</span>
                    <span className="text-xs font-bold text-green-600 block capitalize mt-0.5">{contract.paymentStatus || 'Unfunded'}</span>
                  </div>
                </div>

                {/* Milestones List */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-2">Contract Milestones</span>
                  {Array.isArray(contract.milestones) && contract.milestones.length > 0 ? (
                    <div className="space-y-2 max-h-[160px] overflow-y-auto">
                      {contract.milestones.map((milestone: any, index: number) => {
                        const mIndex = milestone.index ?? (index + 1);
                        const mStatus = milestone.status ?? 'pending';
                        let statusBadge = 'bg-gray-100 text-gray-600 border-gray-200';
                        if (mStatus === 'funded') statusBadge = 'bg-amber-100 text-amber-700 border-amber-200';
                        else if (mStatus === 'released') statusBadge = 'bg-green-100 text-green-700 border-green-200';

                        return (
                          <div key={index} className="flex items-center justify-between bg-white border border-[#EFEAE3] rounded-lg p-2.5 shadow-sm">
                            <div className="overflow-hidden">
                              <span className="font-semibold text-xs text-gray-900 block truncate">
                                Milestone {mIndex}: {milestone.title || 'Work Milestone'}
                              </span>
                              <span className="text-[10px] text-gray-400 font-semibold block">
                                Amount: {milestone.freelancerAmountSats || milestone.amountSats || '0'} sats
                              </span>
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadge}`}>
                              {mStatus}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 py-2 border border-dashed border-gray-200 rounded-lg text-center">
                      No milestones found on this contract (Full Payment mode).
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 py-4">No contract details linked or still loading…</div>
            )}
          </Panel>
        </div>
      </section>

      {/* Work Submission & Feedback Timeline Section */}
      <section className="mt-6">
        <Panel title="Work Submission & Feedback Timeline" subtitle="Logs of all work submissions by the freelancer and actions/reviews taken by the client.">
          {loadingSubmissions ? (
            <div className="text-sm text-[#8f8780] py-4">Loading submission logs...</div>
          ) : submissions.length === 0 ? (
            <div className="text-sm text-[#8f8780] py-4">No work submissions recorded for this contract yet.</div>
          ) : (
            <div className="relative pl-6 border-l border-[#E7E1D8] space-y-6 max-h-[400px] overflow-y-auto py-2">
              {submissions.map((sub: any) => {
                const subDate = sub.submittedAt?.toDate?.() || (sub.submittedAt ? new Date(sub.submittedAt) : null);
                const subDateStr = subDate ? subDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + subDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'Unknown Date';

                let statusBadge = 'bg-gray-100 text-gray-600 border-gray-200';
                if (sub.status === 'approved') statusBadge = 'bg-green-50 text-green-700 border-green-200';
                else if (sub.status === 'rejected') statusBadge = 'bg-red-50 text-red-700 border-red-200';
                else if (sub.status === 'pending') statusBadge = 'bg-amber-50 text-amber-700 border-amber-200';

                return (
                  <div key={sub.id} className="relative group">
                    {/* Timeline bullet */}
                    <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-orange-500 border-2 border-white ring-4 ring-orange-50 shadow-sm" />
                    
                    <div className="bg-white border border-[#EFEAE3] rounded-xl p-3.5 shadow-sm space-y-2.5">
                      <div className="flex items-center justify-between gap-2 border-b border-[#FAF8F5] pb-2">
                        <div>
                          <span className="font-bold text-xs text-gray-900">
                            Milestone {sub.milestoneIndex}: {sub.milestoneTitle || 'Submission'}
                          </span>
                          <span className="text-[10px] text-gray-400 block font-semibold mt-0.5">{subDateStr}</span>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadge}`}>
                          {sub.status || 'Submitted'}
                        </span>
                      </div>

                      <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                        <strong className="block text-[10px] text-gray-400 uppercase tracking-wider mb-1">Freelancer Description</strong>
                        {sub.description || 'No work description provided.'}
                      </div>

                      {(sub.link || sub.attachment) && (
                        <div className="flex flex-wrap gap-2 pt-1 border-t border-[#FAF8F5]">
                          {sub.link && (
                            <a
                              href={sub.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 whitespace-nowrap"
                            >
                              View Submission Link <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {sub.attachment && (
                            <a
                              href={sub.attachment.url || sub.attachment}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 whitespace-nowrap ml-2"
                            >
                              Download Attachment <Paperclip className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}

                      {sub.status === 'rejected' && sub.revisionMessage && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-900 mt-2">
                          <strong className="block text-[9px] font-bold uppercase tracking-wider text-red-500 mb-1">
                            Client Changes Request Note
                          </strong>
                          {sub.revisionMessage}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </section>

      {/* Contract Chat Log Section */}
      <section className="mt-6">
        <Panel title="Contract Chat Log" subtitle="Real-time message history between the client and the freelancer for this contract.">
          {loadingMessages ? (
            <div className="text-sm text-[#8f8780] py-4">Loading message logs...</div>
          ) : messages.length === 0 ? (
            <div className="text-sm text-[#8f8780] py-4">No message logs found for this contract conversation.</div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto space-y-4 p-4 bg-[#FAF8F5] border border-[#E7E1D8] rounded-xl">
              {messages.map((msg: any) => {
                const isSystem = msg.senderRole === 'system' || msg.senderId === 'system';
                const isClient = msg.senderRole === 'client' || msg.senderId === details.clientId;
                const isFreelancer = msg.senderRole === 'freelancer' || msg.senderId === details.freelancerId;

                let senderName = 'Unknown';
                let roleLabel = '';
                let badgeClass = '';

                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <div className="text-[11px] text-[#8f8780] bg-[#EFEAE3] rounded-full px-3 py-1 font-medium border border-[#E7E1D8] italic max-w-lg text-center">
                        {msg.text}
                      </div>
                    </div>
                  );
                }

                if (isClient) {
                  senderName = details.clientName || 'Client';
                  roleLabel = 'Client';
                  badgeClass = 'bg-blue-50 text-blue-700 border-blue-100';
                } else if (isFreelancer) {
                  senderName = details.freelancerName || 'Freelancer';
                  roleLabel = 'Freelancer';
                  badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                } else {
                  senderName = `User (${msg.senderId?.substring(0, 6) || 'Unknown'})`;
                  roleLabel = msg.senderRole || 'User';
                  badgeClass = 'bg-gray-50 text-gray-700 border-gray-100';
                }

                const msgDate = msg.createdAt?.toDate?.() || (msg.createdAt ? new Date(msg.createdAt) : null);
                const timeStr = msgDate ? msgDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'Now';
                const dateStr = msgDate ? msgDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

                return (
                  <div key={msg.id} className="flex flex-col space-y-1 bg-white border border-[#EFEAE3] rounded-xl p-3.5 shadow-sm">
                    <div className="flex items-center justify-between gap-2 border-b border-[#FAF8F5] pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm">{senderName}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeClass}`}>
                          {roleLabel}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium">
                        {dateStr} {timeStr}
                      </span>
                    </div>

                    <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {msg.text}
                    </div>

                    {msg.attachment && (
                      <div className="mt-3 bg-[#FAF8F5] rounded-xl p-3 border border-[#E7E1D8] flex items-center justify-between gap-4 max-w-md">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className="p-2 bg-white rounded-lg text-gray-400 border border-[#E7E1D8]">
                            <Paperclip className="h-4 w-4" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold text-gray-700 truncate">{msg.attachment.name || 'Attachment'}</p>
                            {msg.attachment.size && (
                              <p className="text-[10px] text-gray-400 font-semibold">{msg.attachment.size}</p>
                            )}
                          </div>
                        </div>
                        <a
                          href={msg.attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors whitespace-nowrap"
                        >
                          View Attachment <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </section>
    </>
  );
}
