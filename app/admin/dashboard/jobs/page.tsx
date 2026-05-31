"use client";

import { AdminPageHeader, AdminTable, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { formatDateTime, useAdminDashboardData } from "@/lib/admin-dashboard";

export default function AdminJobsPage() {
  const { jobs } = useAdminDashboardData();

  return (
    <>
      <AdminPageHeader
        eyebrow="Marketplace"
        title="Jobs"
        description="Track every job post, client owner, budget, category, proposal count, and current publishing state."
      />
      <AdminTable
        columns={["Job", "Client", "Budget", "Proposals", "Status", "Created"]}
        rows={jobs.map((job) => ({
          href: `/admin/dashboard/jobs/${job.id}`,
          cells: [
            <div key="job">
              <div className="font-black group-hover:text-[#8C4F00]">{job.title}</div>
              <div className="mt-1 text-xs text-[#6b6762]">{job.category}</div>
            </div>,
            <div key="client">
              <div className="font-bold">{job.clientName}</div>
              <code className="mt-1 block text-xs text-[#6b6762]">{job.clientId || "No client id"}</code>
            </div>,
            <span key="budget" className="font-black text-[#8C4F00]">{job.budget}</span>,
            <span key="proposals" className="font-black">{job.proposals}</span>,
            <StatusPill key="status" status={job.status} />,
            <span key="created" className="text-xs text-[#6b6762]">{formatDateTime(job.createdAt)}</span>,
          ],
        }))}
      />
    </>
  );
}
