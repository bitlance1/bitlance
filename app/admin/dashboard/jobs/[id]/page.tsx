"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { AdminBackLink, AdminPageHeader, AdminTable, DetailGrid, JsonPanel, Panel, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { firebaseDb } from "@/lib/firebase";
import { formatDateTime } from "@/lib/admin-dashboard";

export default function AdminJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Record<string, unknown> | null>(null);
  const [proposals, setProposals] = useState<Array<{ id: string; data: Record<string, unknown> }>>([]);
  const [contracts, setContracts] = useState<Array<{ id: string; data: Record<string, unknown> }>>([]);
  const [conversations, setConversations] = useState<Array<{ id: string; data: Record<string, unknown> }>>([]);

  useEffect(() => {
    if (!id) return;
    const unsubJob = onSnapshot(doc(firebaseDb, "jobs", id), (snap) => setJob(snap.exists() ? snap.data() : null));
    const unsubProposals = onSnapshot(query(collection(firebaseDb, "proposals"), where("jobId", "==", id)), (snap) =>
      setProposals(snap.docs.map((item) => ({ id: item.id, data: item.data() })))
    );
    const unsubContracts = onSnapshot(query(collection(firebaseDb, "contracts"), where("jobId", "==", id)), (snap) =>
      setContracts(snap.docs.map((item) => ({ id: item.id, data: item.data() })))
    );
    const unsubConversations = onSnapshot(query(collection(firebaseDb, "conversations"), where("jobId", "==", id)), (snap) =>
      setConversations(snap.docs.map((item) => ({ id: item.id, data: item.data() })))
    );
    return () => {
      unsubJob();
      unsubProposals();
      unsubContracts();
      unsubConversations();
    };
  }, [id]);

  if (!job) {
    return (
      <>
        <AdminBackLink href="/admin/dashboard/jobs" />
        <AdminPageHeader eyebrow="Job Detail" title="Job not found" description="This job document is missing or still loading." />
      </>
    );
  }

  return (
    <>
      <AdminBackLink href="/admin/dashboard/jobs" />
      <AdminPageHeader eyebrow="Job Detail" title={String(job.title || "Untitled job")} description="Full job record plus proposals, selected freelancers, contracts, and linked conversations." />
      <DetailGrid
        items={[
          { label: "Status", value: <StatusPill status={String(job.status || "unknown")} /> },
          { label: "Budget", value: String(job.budget || "0 sats") },
          { label: "Category", value: String(job.category || "-") },
          { label: "Client", value: <Link className="text-[#8C4F00]" href={`/admin/dashboard/users/${job.clientId}`}>{String(job.clientName || job.clientCompany || job.clientId || "Client")}</Link> },
          { label: "Proposals", value: proposals.length },
          { label: "Created", value: formatDateTime(job.createdAt as never) },
        ]}
      />
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Proposals for this job" subtitle="Click a proposal to inspect bid details and selection status.">
          <AdminTable
            columns={["Freelancer", "Rate", "Status", "Created"]}
            rows={proposals.map((proposal) => ({
              href: `/admin/dashboard/proposals/${proposal.id}`,
              cells: [
                <span key="freelancer" className="font-black">{String(proposal.data.freelancerName || "Freelancer")}</span>,
                <span key="rate" className="font-black text-[#8C4F00]">{String(proposal.data.rate || proposal.data.fixedPrice || proposal.data.hourlyRate || "0 sats")}</span>,
                <StatusPill key="status" status={String(proposal.data.status || "submitted")} />,
                <span key="created" className="text-xs text-[#6b6762]">{formatDateTime(proposal.data.createdAt as never)}</span>,
              ],
            }))}
          />
        </Panel>
        <Panel title="Linked conversations" subtitle="Open the chat exactly as the users exchanged it.">
          <AdminTable
            columns={["Conversation", "Participants", "State"]}
            rows={conversations.map((conversation) => ({
              href: `/admin/dashboard/messages/${conversation.id}`,
              cells: [
                <code key="id" className="text-xs text-[#6b6762]">{conversation.id}</code>,
                <span key="people" className="font-bold">{String(conversation.data.clientName || "Client")} / {String(conversation.data.freelancerName || "Freelancer")}</span>,
                <StatusPill key="state" status={String(conversation.data.workStatus || conversation.data.paymentStatus || "open")} />,
              ],
            }))}
          />
        </Panel>
      </div>
      <div className="mt-5">
        <Panel title="Contracts created from this job" subtitle="Accepted proposals and work agreements tied to this job.">
          <AdminTable
            columns={["Contract", "Freelancer", "Payment", "Work"]}
            rows={contracts.map((contract) => ({
              href: `/admin/dashboard/contracts/${contract.id}`,
              cells: [
                <span key="title" className="font-black">{String(contract.data.title || "Contract")}</span>,
                <span key="freelancer" className="font-bold">{String(contract.data.freelancerName || contract.data.freelancerId || "Freelancer")}</span>,
                <StatusPill key="payment" status={String(contract.data.paymentStatus || "unfunded")} />,
                <StatusPill key="work" status={String(contract.data.workStatus || "not_started")} />,
              ],
            }))}
          />
        </Panel>
      </div>
      <div className="mt-5">
        <JsonPanel title="Job document" data={job} />
      </div>
    </>
  );
}
