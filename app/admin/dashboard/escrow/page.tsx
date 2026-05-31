"use client";

import { AdminPageHeader, AdminTable, Metric, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { formatDateTime, formatSats, useAdminDashboardData } from "@/lib/admin-dashboard";
import { CircleDollarSign, LockKeyhole, Wallet } from "lucide-react";

export default function AdminEscrowPage() {
  const { escrows } = useAdminDashboardData();
  const funded = escrows.reduce((sum, escrow) => sum + escrow.totalFundedSats, 0);
  const payable = escrows.reduce((sum, escrow) => sum + escrow.totalClientPayableSats, 0);
  const released = escrows.reduce((sum, escrow) => sum + escrow.totalReleasedToFreelancerSats, 0);

  return (
    <>
      <AdminPageHeader
        eyebrow="Bitcoin Payments"
        title="Escrow"
        description="Track funded escrow, released payouts, client payable totals, and escrow status across contracts."
      />
      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric icon={<LockKeyhole />} label="Escrows" value={escrows.length} detail="Escrow records created" />
        <Metric icon={<CircleDollarSign />} label="Funded" value={formatSats(funded)} detail={`${formatSats(payable)} total payable`} />
        <Metric icon={<Wallet />} label="Released" value={formatSats(released)} detail="Paid out to freelancers" />
      </section>
      <AdminTable
        columns={["Escrow", "Client", "Freelancer", "Funded", "Released", "Status", "Updated"]}
        rows={escrows.map((escrow) => ({
          href: `/admin/dashboard/escrow/${escrow.id}`,
          cells: [
            <div key="escrow">
              <div className="font-black group-hover:text-[#8C4F00]">{escrow.jobTitle}</div>
              <code className="mt-1 block text-xs text-[#6b6762]">{escrow.id}</code>
            </div>,
            <code key="client" className="text-xs text-[#6b6762]">{escrow.clientId}</code>,
            <code key="freelancer" className="text-xs text-[#6b6762]">{escrow.freelancerId}</code>,
            <span key="funded" className="font-black text-[#8C4F00]">{formatSats(escrow.totalFundedSats)}</span>,
            <span key="released" className="font-black text-green-700">{formatSats(escrow.totalReleasedToFreelancerSats)}</span>,
            <StatusPill key="status" status={escrow.status} />,
            <span key="updated" className="text-xs text-[#6b6762]">{formatDateTime(escrow.updatedAt)}</span>,
          ],
        }))}
      />
    </>
  );
}
