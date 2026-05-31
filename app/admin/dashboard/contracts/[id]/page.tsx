"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { AdminBackLink, AdminPageHeader, DetailGrid, JsonPanel, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { firebaseDb } from "@/lib/firebase";
import { formatDateTime, formatSats } from "@/lib/admin-dashboard";

export default function AdminContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(firebaseDb, "contracts", id), (snap) => setContract(snap.exists() ? snap.data() : null));
  }, [id]);

  if (!contract) {
    return (
      <>
        <AdminBackLink href="/admin/dashboard/contracts" />
        <AdminPageHeader eyebrow="Contract Detail" title="Contract not found" description="This contract is missing or still loading." />
      </>
    );
  }

  return (
    <>
      <AdminBackLink href="/admin/dashboard/contracts" />
      <AdminPageHeader eyebrow="Contract Detail" title={String(contract.title || "Contract")} description="Full contract state, payment state, work state, milestone data, and linked people." />
      <DetailGrid
        items={[
          { label: "Status", value: <StatusPill status={String(contract.status || "unknown")} /> },
          { label: "Payment", value: <StatusPill status={String(contract.paymentStatus || "unfunded")} /> },
          { label: "Work", value: <StatusPill status={String(contract.workStatus || "not_started")} /> },
          { label: "Client", value: <Link className="text-[#8C4F00]" href={`/admin/dashboard/users/${contract.clientId}`}>{String(contract.clientId || "Client")}</Link> },
          { label: "Freelancer", value: <Link className="text-[#8C4F00]" href={`/admin/dashboard/users/${contract.freelancerId}`}>{String(contract.freelancerName || contract.freelancerId || "Freelancer")}</Link> },
          { label: "Funded", value: formatSats(Number(contract.escrowFundedTotalSats ?? contract.paymentPaidAmountSats ?? 0)) },
          { label: "Released", value: formatSats(Number(contract.escrowReleasedSats ?? 0)) },
          { label: "Updated", value: formatDateTime(contract.updatedAt as never) },
        ]}
      />
      <div className="mt-5">
        <JsonPanel title="Contract document" data={contract} />
      </div>
    </>
  );
}
