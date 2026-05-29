"use client";

import { useMemo, useState, useEffect } from "react";
import Button from "@/components/atoms/Button";
import DashboardMetricCard from "@/components/molecules/DashboardMetricCard";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

type PaymentRow = {
  rowKey: string;
  id: string;
  freelancer: string;
  amount: string;
  amountSats: number;
  status: "Funded" | "Released" | "Invoice Created";
  date: string;
  sortTime: number;
  method: string;
  contract: string;
  memo: string;
  txRef: string;
};

type ContractMilestone = {
  index?: number;
  title?: string;
  name?: string;
  fundedSats?: number;
  releasedSats?: number;
  freelancerAmountSats?: number;
  status?: string;
  fundedAt?: any;
  releasedAt?: any;
};

const FALLBACK_PAYMENTS: PaymentRow[] = [];

const toDate = (value: any) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate() as Date;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatPaymentDate = (value: any) =>
  (toDate(value) ?? new Date()).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

const getSortTime = (value: any) => (toDate(value) ?? new Date(0)).getTime();

const pluralizeMilestones = (count: number, label: string) =>
  `${count} ${label} milestone${count === 1 ? "" : "s"}`;

const getPaymentKey = (payment: PaymentRow, index: number) =>
  payment.rowKey || `${payment.status}-${payment.id}-${payment.txRef}-${index}`;

export default function ClientPaymentsContent() {
  const [selectedId, setSelectedId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [payments, setPayments] = useState(FALLBACK_PAYMENTS);
  const [loading, setLoading] = useState(true);
  const selectedPayment = useMemo(
    () => payments.find((payment, index) => getPaymentKey(payment, index) === selectedId) ?? payments[0],
    [selectedId, payments]
  );

  useEffect(() => {
    const unsubscribeAuth = firebaseAuth.onAuthStateChanged((user) => {
      if (!user) {
        setPayments(FALLBACK_PAYMENTS);
        setLoading(false);
        return;
      }

      const contractsQuery = query(
        collection(firebaseDb, "contracts"),
        where("clientId", "==", user.uid)
      );

      const unsubscribe = onSnapshot(contractsQuery, (snapshot) => {
        const processedPayments: PaymentRow[] = [];

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, any>;
          const contractId = docSnap.id;
          const contractCode = contractId.slice(-6).toUpperCase();
          const freelancer = data.freelancerName || data.freelancer || "Freelancer";
          const contractTitle = data.title || data.jobTitle || "Project";
          const installmentCount = Number(data.paymentInstallments ?? 1) || 1;
          const milestones = Array.isArray(data.milestones)
            ? (data.milestones as ContractMilestone[])
            : [];

          milestones.forEach((milestone, index) => {
            const milestoneIndex = Number(milestone.index ?? index + 1);
            const rowSuffix = `${contractId}-${milestoneIndex}-${index}`;
            const fundedSats = Number(milestone.fundedSats ?? 0);
            const releasedSats = Number(milestone.releasedSats ?? 0);
            const openEscrowSats = Math.max(0, fundedSats - releasedSats);
            const milestoneTitle = milestone.title || milestone.name || `Milestone ${milestoneIndex}`;

            if (openEscrowSats > 0) {
              const paymentDate = milestone.fundedAt || data.paymentReceivedAt || data.updatedAt || data.createdAt;
              processedPayments.push({
                rowKey: `funded-${rowSuffix}`,
                id: `INV-${contractCode}-${milestoneIndex}`,
                freelancer,
                amount: `${openEscrowSats.toLocaleString()} sats`,
                amountSats: openEscrowSats,
                status: "Funded",
                date: formatPaymentDate(paymentDate),
                sortTime: getSortTime(paymentDate),
                method: "Escrow Funded",
                contract: contractTitle,
                memo: `${milestoneTitle} (${milestoneIndex} of ${installmentCount}) is funded and waiting for approved work.`,
                txRef: `ESC-${contractId.slice(-8).toUpperCase()}-${milestoneIndex}`,
              });
            }

            if (releasedSats > 0) {
              const paymentDate = milestone.releasedAt || data.updatedAt || data.createdAt;
              processedPayments.push({
                rowKey: `released-${rowSuffix}`,
                id: `REL-${contractCode}-${milestoneIndex}`,
                freelancer,
                amount: `${releasedSats.toLocaleString()} sats`,
                amountSats: releasedSats,
                status: "Released",
                date: formatPaymentDate(paymentDate),
                sortTime: getSortTime(paymentDate),
                method: "Escrow Release",
                contract: contractTitle,
                memo: `${milestoneTitle} (${milestoneIndex} of ${installmentCount}) paid from escrow.`,
                txRef: `PAY-${contractId.slice(-8).toUpperCase()}-${milestoneIndex}`,
              });
            }
          });

          if (milestones.length === 0) {
            const fundedTotal = Number(data.escrowFundedTotalSats ?? data.paymentPaidAmountSats ?? 0);
            const releasedTotal = Number(data.escrowReleasedSats ?? 0);
            const openEscrowSats = Math.max(0, fundedTotal - releasedTotal);
            const paymentDate = data.paymentReceivedAt || data.updatedAt || data.createdAt;

            if (openEscrowSats > 0) {
              processedPayments.push({
                rowKey: `funded-${contractId}-fallback`,
                id: `INV-${contractCode}-1`,
                freelancer,
                amount: `${openEscrowSats.toLocaleString()} sats`,
                amountSats: openEscrowSats,
                status: "Funded",
                date: formatPaymentDate(paymentDate),
                sortTime: getSortTime(paymentDate),
                method: "Escrow Funded",
                contract: contractTitle,
                memo: "Funded escrow balance for this contract.",
                txRef: `ESC-${contractId.slice(-8).toUpperCase()}`,
              });
            }

            if (releasedTotal > 0) {
              processedPayments.push({
                rowKey: `released-${contractId}-fallback`,
                id: `REL-${contractCode}-1`,
                freelancer,
                amount: `${releasedTotal.toLocaleString()} sats`,
                amountSats: releasedTotal,
                status: "Released",
                date: formatPaymentDate(data.updatedAt || data.createdAt),
                sortTime: getSortTime(data.updatedAt || data.createdAt),
                method: "Escrow Release",
                contract: contractTitle,
                memo: "Released payment from escrow.",
                txRef: `PAY-${contractId.slice(-8).toUpperCase()}`,
              });
            }
          }
        });

        processedPayments.sort((a, b) => b.sortTime - a.sortTime);

        setPayments(processedPayments);
        setSelectedId((current) =>
          processedPayments.some((payment, index) => getPaymentKey(payment, index) === current)
            ? current
            : processedPayments[0]
              ? getPaymentKey(processedPayments[0], 0)
              : ""
        );
        setLoading(false);
      });

      return () => unsubscribe();
    });

    return () => unsubscribeAuth();
  }, []);

  const summary = useMemo(() => {
    const fundedRows = payments.filter((payment) => payment.status === "Funded");
    const releasedRows = payments.filter((payment) => payment.status === "Released");

    return {
      escrowBalance: fundedRows.reduce((sum, payment) => sum + payment.amountSats, 0),
      fundedMilestones: fundedRows.length,
      totalSpent: releasedRows.reduce((sum, payment) => sum + payment.amountSats, 0),
      releasedMilestones: releasedRows.length,
    };
  }, [payments]);

  return (
    <section className="w-full">
      <div className="rounded-[12px] border border-[#EAE7E2] bg-white p-6 shadow-[0_8px_22px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">
              Payments
            </div>
            <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[#1a1a1a]">
              Manage payouts and invoices
            </h1>
            <p className="mt-2 text-[12px] leading-[1.7] text-[#6b6762]">
              Track escrow releases, upcoming invoices, and payout history.
            </p>
          </div>
          <Button size="sm" className="rounded-full">
            Add Payment Method
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardMetricCard 
          label="Escrow Balance" 
          value={`${summary.escrowBalance.toLocaleString()} sats`} 
          change={pluralizeMilestones(summary.fundedMilestones, "active")} 
          tone="neutral" 
        />
        <DashboardMetricCard 
          label="Pending Approvals" 
          value={summary.fundedMilestones.toString()} 
          change="Review today" 
          tone="down" 
        />
        <DashboardMetricCard 
          label="Total Spent" 
          value={`${summary.totalSpent.toLocaleString()} sats`} 
          change={pluralizeMilestones(summary.releasedMilestones, "released")} 
          tone="neutral" 
        />
      </div>

      <div className="mt-8 rounded-[12px] border border-[#EAE7E2] bg-white p-5">
        <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F5A623]">
          Recent Invoices
        </div>
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="text-center py-8 text-[#6b6762]">Loading payments...</div>
          ) : payments.length > 0 ? (
            payments.map((payment, index) => {
              const paymentKey = getPaymentKey(payment, index);

              return (
            <button
              key={paymentKey}
              type="button"
              onClick={() => {
                setSelectedId(paymentKey);
                setIsModalOpen(true);
              }}
              className="text-left flex flex-col gap-2 rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-4 py-3 transition-all md:flex-row md:items-center md:justify-between hover:border-[#F2D8AA]"
            >
              <div>
                <div className="text-[12px] font-semibold text-[#1a1a1a]">{payment.id}</div>
                <div className="text-[11px] text-[#6b6762]">Freelancer: {payment.freelancer}</div>
              </div>
              <div className="text-[11px] text-[#9e9690]">{payment.date}</div>
              <div className="text-[12px] font-semibold text-[#8C4F00]">{payment.amount}</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#1a1a1a]">
                {payment.status}
              </div>
            </button>
              );
            })
          ) : (
            <div className="text-center py-8 text-[#6b6762]">No payments found.</div>
          )}
        </div>
      </div>

      {isModalOpen && selectedPayment ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative z-[81] w-full max-w-2xl rounded-[16px] border border-[#EAE7E2] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full border border-[#EAE7E2] bg-white p-2 text-[#6b6762] hover:bg-[#F7F4F0]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C4F00]">
                  Transaction Details
                </div>
                <div className="mt-2 text-[18px] font-semibold text-[#1a1a1a]">
                  {selectedPayment.id}
                </div>
                <div className="text-[12px] text-[#9e9690]">
                  {selectedPayment.date} • {selectedPayment.status}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-[11px] text-[#6b6762]">
              <div className="rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-3 py-2">
                <div className="uppercase tracking-[0.12em] text-[#9e9690]">Amount</div>
                <div className="mt-1 font-semibold text-[#1a1a1a]">{selectedPayment.amount}</div>
              </div>
              <div className="rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-3 py-2">
                <div className="uppercase tracking-[0.12em] text-[#9e9690]">Method</div>
                <div className="mt-1 font-semibold text-[#1a1a1a]">{selectedPayment.method}</div>
              </div>
              <div className="rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-3 py-2">
                <div className="uppercase tracking-[0.12em] text-[#9e9690]">Contract</div>
                <div className="mt-1 font-semibold text-[#1a1a1a]">{selectedPayment.contract}</div>
              </div>
              <div className="rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-3 py-2">
                <div className="uppercase tracking-[0.12em] text-[#9e9690]">Reference</div>
                <div className="mt-1 font-semibold text-[#1a1a1a]">{selectedPayment.txRef}</div>
              </div>
            </div>

            <div className="mt-4 rounded-[10px] border border-[#EFECE7] bg-[#FAF8F5] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#9e9690]">Memo</div>
              <div className="mt-2 text-[12px] text-[#1a1a1a]">{selectedPayment.memo}</div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="rounded-full">
                Download Receipt
              </Button>
              <Button size="sm" className="rounded-full">
                View Invoice
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
