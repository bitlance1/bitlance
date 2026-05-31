"use client";

import { AdminPageHeader, AdminTable, Metric, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { formatDateTime, formatSats, useAdminDashboardData } from "@/lib/admin-dashboard";
import { CircleDollarSign, FileCheck2, ShieldCheck, UploadCloud } from "lucide-react";

export default function AdminContractsPage() {
  const { contracts } = useAdminDashboardData();
  const funded = contracts.reduce((sum, contract) => sum + contract.escrowFundedTotalSats, 0);
  const released = contracts.reduce((sum, contract) => sum + contract.escrowReleasedSats, 0);

  return (
    <>
      <AdminPageHeader
        eyebrow="Work"
        title="Contracts"
        description="Monitor active work, payment state, work state, escrow funding, and released payouts."
      />
      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<ShieldCheck />} label="Contracts" value={contracts.length} detail="All tracked contracts" />
        <Metric icon={<FileCheck2 />} label="Active" value={contracts.filter((item) => item.status === "Active").length} detail="Currently active work" />
        <Metric icon={<UploadCloud />} label="Submitted" value={contracts.filter((item) => item.workStatus === "submitted").length} detail="Waiting for review" />
        <Metric icon={<CircleDollarSign />} label="Funded" value={formatSats(funded)} detail={`${formatSats(released)} released`} />
      </section>
      <AdminTable
        columns={["Contract", "Freelancer", "Payment", "Work", "Escrow", "Updated"]}
        rows={contracts.map((contract) => ({
          href: `/admin/dashboard/contracts/${contract.id}`,
          cells: [
            <div key="contract">
              <div className="font-black group-hover:text-[#8C4F00]">{contract.title}</div>
              <div className="mt-1 text-xs text-[#6b6762]">{contract.budget}</div>
            </div>,
            <div key="freelancer">
              <div className="font-bold">{contract.freelancerName}</div>
              <code className="mt-1 block text-xs text-[#6b6762]">{contract.freelancerId}</code>
            </div>,
            <StatusPill key="payment" status={contract.paymentStatus} />,
            <StatusPill key="work" status={contract.workStatus} />,
            <div key="escrow" className="text-xs text-[#6b6762]">
              <div className="font-black text-[#1a1a1a]">{formatSats(contract.escrowFundedTotalSats)}</div>
              <div>{formatSats(contract.escrowReleasedSats)} released</div>
            </div>,
            <span key="updated" className="text-xs text-[#6b6762]">{formatDateTime(contract.updatedAt || contract.createdAt)}</span>,
          ],
        }))}
      />
    </>
  );
}
