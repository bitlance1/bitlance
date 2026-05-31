"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { AdminBackLink, AdminPageHeader, DetailGrid, JsonPanel, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { firebaseDb } from "@/lib/firebase";
import { formatDateTime, formatSats } from "@/lib/admin-dashboard";

export default function AdminEscrowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [escrow, setEscrow] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(firebaseDb, "escrows", id), (snap) => setEscrow(snap.exists() ? snap.data() : null));
  }, [id]);

  if (!escrow) {
    return (
      <>
        <AdminBackLink href="/admin/dashboard/escrow" />
        <AdminPageHeader eyebrow="Escrow Detail" title="Escrow not found" description="This escrow record is missing or still loading." />
      </>
    );
  }

  return (
    <>
      <AdminBackLink href="/admin/dashboard/escrow" />
      <AdminPageHeader eyebrow="Escrow Detail" title={String(escrow.jobTitle || "Escrow")} description="Funding, release, participant, and milestone details for this escrow record." />
      <DetailGrid
        items={[
          { label: "Status", value: <StatusPill status={String(escrow.status || "unknown")} /> },
          { label: "Funded", value: formatSats(Number(escrow.totalFundedSats ?? 0)) },
          { label: "Released", value: formatSats(Number(escrow.totalReleasedToFreelancerSats ?? 0)) },
          { label: "Client Payable", value: formatSats(Number(escrow.totalClientPayableSats ?? 0)) },
          { label: "Client", value: <Link className="text-[#8C4F00]" href={`/admin/dashboard/users/${escrow.clientId}`}>{String(escrow.clientId || "Client")}</Link> },
          { label: "Freelancer", value: <Link className="text-[#8C4F00]" href={`/admin/dashboard/users/${escrow.freelancerId}`}>{String(escrow.freelancerId || "Freelancer")}</Link> },
          { label: "Updated", value: formatDateTime(escrow.updatedAt as never) },
        ]}
      />
      <div className="mt-5">
        <JsonPanel title="Escrow document" data={escrow} />
      </div>
    </>
  );
}
