"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { AdminBackLink, AdminPageHeader, DetailGrid, JsonPanel, Panel, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { firebaseDb } from "@/lib/firebase";
import { formatDateTime } from "@/lib/admin-dashboard";

export default function AdminSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [submission, setSubmission] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(firebaseDb, "submitted_jobs", id), (snap) => setSubmission(snap.exists() ? snap.data() : null));
  }, [id]);

  if (!submission) {
    return (
      <>
        <AdminBackLink href="/admin/dashboard/submissions" />
        <AdminPageHeader eyebrow="Submission Detail" title="Submission not found" description="This submitted work is missing or still loading." />
      </>
    );
  }

  const attachment = submission.attachment as { url?: string; name?: string } | null | undefined;
  return (
    <>
      <AdminBackLink href="/admin/dashboard/submissions" />
      <AdminPageHeader eyebrow="Submission Detail" title={String(submission.contractTitle || "Submitted work")} description="Full delivery message, links, attachment, status, and review timeline." />
      <DetailGrid
        items={[
          { label: "Status", value: <StatusPill status={String(submission.status || "pending")} /> },
          { label: "Milestone", value: String(submission.milestoneIndex || "1") },
          { label: "Client", value: <Link className="text-[#8C4F00]" href={`/admin/dashboard/users/${submission.clientId}`}>{String(submission.clientId || "Client")}</Link> },
          { label: "Freelancer", value: <Link className="text-[#8C4F00]" href={`/admin/dashboard/users/${submission.freelancerId}`}>{String(submission.freelancerId || "Freelancer")}</Link> },
          { label: "Submitted", value: formatDateTime(submission.submittedAt as never) },
          { label: "Updated", value: formatDateTime(submission.updatedAt as never) },
        ]}
      />
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Submission note" subtitle="The freelancer's delivery message.">
          <p className="whitespace-pre-wrap text-sm leading-7 text-[#4f4944]">{String(submission.description || "No description provided.")}</p>
          {submission.link ? <a href={String(submission.link)} target="_blank" rel="noreferrer" className="mt-4 inline-flex font-black text-[#8C4F00]">Open delivery link</a> : null}
        </Panel>
        <Panel title="Attachment" subtitle="Uploaded delivery file, if present.">
          {attachment?.url ? <a href={attachment.url} target="_blank" rel="noreferrer" className="font-black text-[#8C4F00]">{attachment.name || "Open attachment"}</a> : <p className="text-sm text-[#6b6762]">No attachment uploaded.</p>}
        </Panel>
      </div>
      <div className="mt-5">
        <JsonPanel title="Submission document" data={submission} />
      </div>
    </>
  );
}
