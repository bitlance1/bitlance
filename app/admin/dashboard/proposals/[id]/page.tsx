"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { AdminBackLink, AdminPageHeader, DetailGrid, JsonPanel, Panel, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { firebaseDb } from "@/lib/firebase";
import { formatDateTime } from "@/lib/admin-dashboard";

export default function AdminProposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<Record<string, unknown> | null>(null);
  const [job, setJob] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!id) return;
    let unsubJob: (() => void) | undefined;
    const unsubProposal = onSnapshot(doc(firebaseDb, "proposals", id), (snap) => {
      const data = snap.exists() ? snap.data() : null;
      setProposal(data);
      unsubJob?.();
      const jobId = data?.jobId;
      if (typeof jobId === "string" && jobId) {
        unsubJob = onSnapshot(doc(firebaseDb, "jobs", jobId), (jobSnap) => setJob(jobSnap.exists() ? jobSnap.data() : null));
      } else {
        setJob(null);
      }
    });
    return () => {
      unsubProposal();
      unsubJob?.();
    };
  }, [id]);

  if (!proposal) {
    return (
      <>
        <AdminBackLink href="/admin/dashboard/proposals" />
        <AdminPageHeader eyebrow="Proposal Detail" title="Proposal not found" description="This proposal is missing or still loading." />
      </>
    );
  }

  const jobId = String(proposal.jobId || "");
  return (
    <>
      <AdminBackLink href="/admin/dashboard/proposals" />
      <AdminPageHeader eyebrow="Proposal Detail" title={String(proposal.jobTitle || job?.title || "Proposal")} description="Inspect the full bid, cover letter, linked job, client, freelancer, and selection state." />
      <DetailGrid
        items={[
          { label: "Status", value: <StatusPill status={String(proposal.status || "submitted")} /> },
          { label: "Rate", value: String(proposal.rate || proposal.fixedPrice || proposal.hourlyRate || "0 sats") },
          { label: "Pricing", value: String(proposal.pricingType || "-") },
          { label: "Freelancer", value: <Link className="text-[#8C4F00]" href={`/admin/dashboard/users/${proposal.freelancerId}`}>{String(proposal.freelancerName || proposal.freelancerId || "Freelancer")}</Link> },
          { label: "Client", value: <Link className="text-[#8C4F00]" href={`/admin/dashboard/users/${proposal.clientId}`}>{String(proposal.clientName || proposal.clientId || "Client")}</Link> },
          { label: "Created", value: formatDateTime(proposal.createdAt as never) },
        ]}
      />
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Cover letter" subtitle="The full message the freelancer sent with the proposal.">
          <p className="whitespace-pre-wrap text-sm leading-7 text-[#4f4944]">{String(proposal.cover || "No cover letter was provided.")}</p>
        </Panel>
        <Panel title="Linked job" subtitle="Job context for this proposal.">
          <div className="space-y-3 text-sm">
            <div className="font-black">{String(job?.title || proposal.jobTitle || "Unknown job")}</div>
            <div className="text-[#6b6762]">{String(job?.description || "No job description loaded.")}</div>
            {jobId ? <Link className="font-black text-[#8C4F00]" href={`/admin/dashboard/jobs/${jobId}`}>Open job detail</Link> : null}
          </div>
        </Panel>
      </div>
      <div className="mt-5">
        <JsonPanel title="Proposal document" data={{ proposal, job }} />
      </div>
    </>
  );
}
