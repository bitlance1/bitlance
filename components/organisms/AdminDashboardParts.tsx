"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CheckCircle2, XCircle } from "lucide-react";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 rounded-[8px] border border-[#E7E1D8] bg-white px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#8C4F00]">{eyebrow}</div>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-[#6b6762]">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-[8px] border border-[#E7E1D8] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8f8780]">{label}</div>
          <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#FFF4E6] text-[#8C4F00]">
          <span className="[&_svg]:h-5 [&_svg]:w-5">{icon}</span>
        </div>
      </div>
      <div className="mt-3 text-xs font-semibold text-[#6b6762]">{detail}</div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className =
    normalized.includes("reject") || normalized.includes("expired")
      ? "border-red-100 bg-red-50 text-red-700"
      : normalized.includes("accepted") ||
          normalized.includes("approved") ||
          normalized.includes("funded") ||
          normalized.includes("released") ||
          normalized.includes("admin") ||
          normalized.includes("granted")
        ? "border-green-100 bg-green-50 text-green-700"
        : normalized.includes("submitted") || normalized.includes("pending") || normalized.includes("review")
          ? "border-orange-100 bg-orange-50 text-orange-700"
          : "border-[#E7E1D8] bg-[#FAF8F5] text-[#6b6762]";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${className}`}>
      {status || "unknown"}
    </span>
  );
}

export function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] border border-[#E7E1D8] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black">{title}</h2>
      <p className="mt-1 text-xs text-[#6b6762]">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function HealthRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "danger" | "neutral";
}) {
  const toneClass = {
    ok: "bg-green-50 text-green-700",
    warn: "bg-orange-50 text-orange-700",
    danger: "bg-red-50 text-red-700",
    neutral: "bg-[#FAF8F5] text-[#6b6762]",
  }[tone];
  const Icon = tone === "danger" ? XCircle : CheckCircle2;

  return (
    <div className="mb-2 flex items-center justify-between gap-3 rounded-[8px] border border-[#EFEAE3] p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="truncate text-sm font-bold">{label}</span>
      </div>
      <span className="text-lg font-black">{value}</span>
    </div>
  );
}

export function AdminTable({
  columns,
  rows,
  empty = "No records yet.",
}: {
  columns: string[];
  rows: Array<React.ReactNode[] | { href?: string; cells: React.ReactNode[] }>;
  empty?: string;
}) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-[#EFEAE3] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-[#FAF8F5] text-[11px] uppercase tracking-[0.12em] text-[#8f8780]">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 font-black">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFEAE3]">
            {rows.length ? (
              rows.map((row, rowIndex) => {
                const cells = Array.isArray(row) ? row : row.cells;
                const href = Array.isArray(row) ? undefined : row.href;
                return (
                  <tr key={rowIndex} className={`align-top ${href ? "group hover:bg-[#FFFDF8]" : ""}`}>
                    {cells.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-3">
                        {href ? (
                          <Link href={href} className="block min-h-full text-inherit">
                            {cell}
                          </Link>
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-[#6b6762]">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminBackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="mb-4 inline-flex items-center gap-2 text-sm font-black text-[#8C4F00] hover:text-[#5f3500]">
      <ArrowLeft className="h-4 w-4" />
      Back
    </Link>
  );
}

export function DetailGrid({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-[8px] border border-[#EFEAE3] bg-white p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8f8780]">{item.label}</div>
          <div className="mt-2 break-words text-sm font-bold text-[#1a1a1a]">{item.value || "-"}</div>
        </div>
      ))}
    </div>
  );
}

export function JsonPanel({ title, data }: { title: string; data: unknown }) {
  return (
    <Panel title={title} subtitle="Raw Firestore document data for deeper inspection.">
      <pre className="max-h-[520px] overflow-auto rounded-[8px] bg-[#1a1a1a] p-4 text-xs leading-5 text-white">
        {JSON.stringify(data, null, 2)}
      </pre>
    </Panel>
  );
}
