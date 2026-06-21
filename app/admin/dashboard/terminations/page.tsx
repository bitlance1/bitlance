"use client";

import Link from "next/link";
import { AdminPageHeader, AdminTable, Metric, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { formatDateTime, formatSats, useAdminDashboardData } from "@/lib/admin-dashboard";
import { AlertCircle, Clock, CheckCircle2, XCircle } from "lucide-react";

export default function AdminTerminationsPage() {
  const { terminationRequests } = useAdminDashboardData();

  const pending = terminationRequests.filter((r) => r.status === "pending");
  const approved = terminationRequests.filter((r) => r.status === "approved");
  const rejected = terminationRequests.filter((r) => r.status === "rejected");

  return (
    <>
      <AdminPageHeader
        eyebrow="Contract Management"
        title="Termination Requests"
        description="Review client-initiated contract termination requests, inspect escrow balances, and approve or reject each case."
      />
      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric icon={<Clock />} label="Pending Review" value={pending.length} detail="Awaiting admin action" />
        <Metric icon={<CheckCircle2 />} label="Approved" value={approved.length} detail="Contracts terminated" />
        <Metric icon={<XCircle />} label="Rejected" value={rejected.length} detail="Requests declined" />
      </section>

      {pending.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm font-bold text-amber-700">
            {pending.length} termination request{pending.length !== 1 ? "s" : ""} pending your review.
          </p>
        </div>
      )}

      <AdminTable
        columns={["Contract", "Client", "Freelancer", "Remaining Escrow", "Status", "Requested"]}
        empty="No termination requests yet."
        rows={terminationRequests
          .sort((a, b) => {
            // pending first
            if (a.status === "pending" && b.status !== "pending") return -1;
            if (b.status === "pending" && a.status !== "pending") return 1;
            return 0;
          })
          .map((req) => ({
            href: `/admin/dashboard/terminations/${req.id}`,
            cells: [
              <div key="contract">
                <div className="font-black group-hover:text-[#8C4F00]">{req.contractTitle}</div>
                <code className="mt-1 block text-xs text-[#6b6762]">{req.contractId}</code>
              </div>,
              <div key="client">
                <div className="font-bold">{req.clientName}</div>
                <code className="mt-1 block text-xs text-[#6b6762]">{req.clientId}</code>
              </div>,
              <div key="freelancer">
                <div className="font-bold">{req.freelancerName}</div>
                <code className="mt-1 block text-xs text-[#6b6762]">{req.freelancerId}</code>
              </div>,
              <div key="escrow">
                <div className="font-black text-[#1a1a1a]">{formatSats(req.remainingEscrowSats)}</div>
                <div className="text-xs text-[#6b6762]">{formatSats(req.escrowFundedTotalSats)} funded total</div>
              </div>,
              <StatusPill key="status" status={req.status} />,
              <span key="date" className="text-xs text-[#6b6762]">{formatDateTime(req.createdAt)}</span>,
            ],
          }))}
      />
    </>
  );
}
