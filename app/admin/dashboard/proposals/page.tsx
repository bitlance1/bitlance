"use client";

import { AdminPageHeader, AdminTable, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { formatDateTime, useAdminDashboardData } from "@/lib/admin-dashboard";

export default function AdminProposalsPage() {
  const { proposals } = useAdminDashboardData();

  return (
    <>
      <AdminPageHeader
        eyebrow="Hiring"
        title="Proposals"
        description="Review proposal flow across all jobs, including submitted, accepted, and rejected bids."
      />
      <AdminTable
        columns={["Proposal", "Freelancer", "Rate", "Status", "Created"]}
        rows={proposals.map((proposal) => ({
          href: `/admin/dashboard/proposals/${proposal.id}`,
          cells: [
            <div key="proposal">
              <div className="font-black group-hover:text-[#8C4F00]">{proposal.jobTitle}</div>
              <code className="mt-1 block text-xs text-[#6b6762]">Client: {proposal.clientId || "unknown"}</code>
            </div>,
            <div key="freelancer">
              <div className="font-bold">{proposal.freelancerName}</div>
              <code className="mt-1 block text-xs text-[#6b6762]">{proposal.freelancerId || "No freelancer id"}</code>
            </div>,
            <span key="rate" className="font-black text-[#8C4F00]">{proposal.rate}</span>,
            <StatusPill key="status" status={proposal.status} />,
            <span key="created" className="text-xs text-[#6b6762]">{formatDateTime(proposal.createdAt)}</span>,
          ],
        }))}
      />
    </>
  );
}
