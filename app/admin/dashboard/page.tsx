"use client";

import { Activity, Bell, BriefcaseBusiness, CircleDollarSign, FileText, MessageSquare, UserRoundCheck, Users } from "lucide-react";
import { AdminPageHeader, AdminTable, HealthRow, Metric, Panel, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { formatDateTime, formatSats, useAdminDashboardData } from "@/lib/admin-dashboard";

export default function AdminOverviewPage() {
  const { users, jobs, proposals, contracts, conversations, submissions, escrows, tokens, summary, activity, loadError } =
    useAdminDashboardData();

  return (
    <>
      <AdminPageHeader
        eyebrow="Overview"
        title="Operations command center"
        description="A high-level view of everything happening across Bitlance. Use the sidebar pages for focused audits."
      />

      {loadError ? (
        <div className="mb-5 rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{loadError}</div>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Users />} label="Users" value={users.length} detail={`${summary.clients} clients | ${summary.freelancers} freelancers | ${summary.admins} admins`} />
        <Metric icon={<Activity />} label="Online Now" value={summary.online} detail="Active sessions based on presence" />
        <Metric icon={<BriefcaseBusiness />} label="Jobs" value={jobs.length} detail={`${summary.openJobs} open job posts`} />
        <Metric icon={<FileText />} label="Proposals" value={proposals.length} detail={`${summary.pendingProposals} pending | ${summary.acceptedProposals} accepted`} />
        <Metric icon={<UserRoundCheck />} label="Contracts" value={contracts.length} detail={`${summary.activeContracts} active contracts`} />
        <Metric icon={<CircleDollarSign />} label="Escrow Funded" value={formatSats(summary.fundedEscrow)} detail={`${formatSats(summary.releasedEscrow)} released`} />
        <Metric icon={<MessageSquare />} label="Conversations" value={conversations.length} detail="Client and freelancer chats" />
        <Metric icon={<Bell />} label="Push Devices" value={tokens.length} detail="Registered notification tokens" />
      </section>

      <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <Panel title="Recent activity" subtitle="Latest jobs, proposals, contracts, submissions, and messages.">
          <AdminTable
            columns={["Type", "What happened", "Status", "Time"]}
            rows={activity.slice(0, 14).map((item) => [
              <span key="type" className="text-xs font-black text-[#8C4F00]">{item.type}</span>,
              <div key="activity">
                <div className="font-bold text-[#1a1a1a]">{item.title}</div>
                <div className="mt-1 max-w-xl truncate text-xs text-[#6b6762]">{item.detail}</div>
              </div>,
              <StatusPill key="status" status={item.status} />,
              <span key="time" className="text-xs text-[#6b6762]">{formatDateTime(item.at)}</span>,
            ])}
          />
        </Panel>

        <div className="space-y-5">
          <Panel title="Work health" subtitle="Queues that may need operational attention.">
            <HealthRow label="Pending proposals" value={summary.pendingProposals} tone={summary.pendingProposals ? "warn" : "ok"} />
            <HealthRow label="Work awaiting review" value={summary.reviewSubmissions} tone={summary.reviewSubmissions ? "warn" : "ok"} />
            <HealthRow label="Escrows open" value={escrows.filter((escrow) => escrow.status !== "released").length} tone="neutral" />
            <HealthRow label="Rejected submissions" value={submissions.filter((submission) => submission.status === "rejected").length} tone="danger" />
          </Panel>
          <Panel title="Live coverage" subtitle="What this overview is listening to.">
            <div className="grid grid-cols-2 gap-2 text-sm font-bold text-[#6b6762]">
              <div className="rounded-[8px] bg-[#FAF8F5] p-3">Users: {users.length}</div>
              <div className="rounded-[8px] bg-[#FAF8F5] p-3">Jobs: {jobs.length}</div>
              <div className="rounded-[8px] bg-[#FAF8F5] p-3">Contracts: {contracts.length}</div>
              <div className="rounded-[8px] bg-[#FAF8F5] p-3">Messages: {conversations.length}</div>
            </div>
          </Panel>
        </div>
      </section>
    </>
  );
}
