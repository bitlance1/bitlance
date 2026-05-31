"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { AdminBackLink, AdminPageHeader, AdminTable, DetailGrid, JsonPanel, Panel, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { firebaseDb } from "@/lib/firebase";
import { formatDateTime } from "@/lib/admin-dashboard";

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [jobs, setJobs] = useState<Array<{ id: string; data: Record<string, unknown> }>>([]);
  const [proposals, setProposals] = useState<Array<{ id: string; data: Record<string, unknown> }>>([]);
  const [contracts, setContracts] = useState<Array<{ id: string; data: Record<string, unknown> }>>([]);
  const [tokens, setTokens] = useState<Array<{ id: string; data: Record<string, unknown> }>>([]);

  useEffect(() => {
    if (!id) return;
    const unsubUser = onSnapshot(doc(firebaseDb, "all_users", id), (snap) => setUser(snap.exists() ? snap.data() : null));
    const unsubJobs = onSnapshot(query(collection(firebaseDb, "jobs"), where("clientId", "==", id)), (snap) => setJobs(snap.docs.map((item) => ({ id: item.id, data: item.data() }))));
    const unsubProposals = onSnapshot(query(collection(firebaseDb, "proposals"), where("freelancerId", "==", id)), (snap) => setProposals(snap.docs.map((item) => ({ id: item.id, data: item.data() }))));
    const unsubContracts = onSnapshot(query(collection(firebaseDb, "contracts"), where("freelancerId", "==", id)), (snap) => setContracts(snap.docs.map((item) => ({ id: item.id, data: item.data() }))));
    const unsubTokens = onSnapshot(query(collection(firebaseDb, "notification_tokens"), where("userId", "==", id)), (snap) => setTokens(snap.docs.map((item) => ({ id: item.id, data: item.data() }))));
    return () => {
      unsubUser();
      unsubJobs();
      unsubProposals();
      unsubContracts();
      unsubTokens();
    };
  }, [id]);

  if (!user) {
    return (
      <>
        <AdminBackLink href="/admin/dashboard/users" />
        <AdminPageHeader eyebrow="User Detail" title="User not found" description="This user is missing or still loading." />
      </>
    );
  }

  const name = String(user.fullName || user.name || user.email || "User");
  return (
    <>
      <AdminBackLink href="/admin/dashboard/users" />
      <AdminPageHeader eyebrow="User Detail" title={name} description="Account profile, role, presence, notification devices, and linked work records." />
      <DetailGrid
        items={[
          { label: "Role", value: <StatusPill status={String(user.role || "unknown")} /> },
          { label: "Email", value: String(user.email || "-") },
          { label: "Presence", value: user.online ? <span className="text-green-700">Online</span> : formatDateTime(user.lastSeen as never) },
          { label: "Created", value: formatDateTime(user.createdAt as never) },
          { label: "Jobs posted", value: jobs.length },
          { label: "Proposals sent", value: proposals.length },
          { label: "Contracts as freelancer", value: contracts.length },
          { label: "Notification devices", value: tokens.length },
        ]}
      />
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Jobs posted" subtitle="Jobs where this user is the client.">
          <AdminTable
            columns={["Job", "Status", "Created"]}
            rows={jobs.map((job) => ({
              href: `/admin/dashboard/jobs/${job.id}`,
              cells: [
                <span key="title" className="font-black">{String(job.data.title || "Untitled job")}</span>,
                <StatusPill key="status" status={String(job.data.status || "unknown")} />,
                <span key="created" className="text-xs text-[#6b6762]">{formatDateTime(job.data.createdAt as never)}</span>,
              ],
            }))}
          />
        </Panel>
        <Panel title="Proposals sent" subtitle="Proposals where this user is the freelancer.">
          <AdminTable
            columns={["Proposal", "Status", "Created"]}
            rows={proposals.map((proposal) => ({
              href: `/admin/dashboard/proposals/${proposal.id}`,
              cells: [
                <span key="title" className="font-black">{String(proposal.data.jobTitle || "Proposal")}</span>,
                <StatusPill key="status" status={String(proposal.data.status || "submitted")} />,
                <span key="created" className="text-xs text-[#6b6762]">{formatDateTime(proposal.data.createdAt as never)}</span>,
              ],
            }))}
          />
        </Panel>
      </div>
      <div className="mt-5">
        <JsonPanel title="User document" data={user} />
      </div>
    </>
  );
}
