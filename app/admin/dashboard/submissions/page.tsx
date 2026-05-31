"use client";

import { AdminPageHeader, AdminTable, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { formatDateTime, useAdminDashboardData } from "@/lib/admin-dashboard";

export default function AdminSubmissionsPage() {
  const { submissions } = useAdminDashboardData();

  return (
    <>
      <AdminPageHeader
        eyebrow="Delivery"
        title="Submitted Work"
        description="See every submitted milestone, whether it is pending review, approved, or returned for changes."
      />
      <AdminTable
        columns={["Submission", "Client", "Freelancer", "Status", "Submitted", "Updated"]}
        rows={submissions.map((submission) => ({
          href: `/admin/dashboard/submissions/${submission.id}`,
          cells: [
            <div key="submission">
              <div className="font-black group-hover:text-[#8C4F00]">{submission.contractTitle}</div>
              <div className="mt-1 text-xs text-[#6b6762]">Milestone {submission.milestoneIndex}</div>
            </div>,
            <code key="client" className="text-xs text-[#6b6762]">{submission.clientId}</code>,
            <code key="freelancer" className="text-xs text-[#6b6762]">{submission.freelancerId}</code>,
            <StatusPill key="status" status={submission.status} />,
            <span key="submitted" className="text-xs text-[#6b6762]">{formatDateTime(submission.submittedAt)}</span>,
            <span key="updated" className="text-xs text-[#6b6762]">{formatDateTime(submission.updatedAt)}</span>,
          ],
        }))}
      />
    </>
  );
}
