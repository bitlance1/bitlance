"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { AdminPageHeader, AdminTable, StatusPill } from "@/components/organisms/AdminDashboardParts";
import { formatDateTime, useAdminDashboardData } from "@/lib/admin-dashboard";

export default function AdminUsersPage() {
  const { users } = useAdminDashboardData();
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter((user) => [user.fullName, user.email, user.role, user.id].some((value) => value.toLowerCase().includes(q)));
  }, [users, search]);

  const handleExportEmails = () => {
    if (!users || users.length === 0) return;

    const parseDate = (value: any) => {
      if (!value) return "";
      const date =
        typeof value === "object" && "toDate" in value && typeof value.toDate === "function"
          ? value.toDate()
          : typeof value === "object" && "seconds" in value && typeof value.seconds === "number"
            ? new Date(value.seconds * 1000)
            : value instanceof Date
              ? value
              : typeof value === "string" || typeof value === "number"
                ? new Date(value)
                : null;
      return date && !isNaN(date.getTime()) ? date.toISOString() : "";
    };

    const csvContent = [
      ["Name", "Email", "Role", "User ID", "Created At"].join(","),
      ...users.map((user) =>
        [
          `"${(user.fullName || "").replace(/"/g, '""')}"`,
          `"${(user.email || "").replace(/"/g, '""')}"`,
          `"${(user.role || "").replace(/"/g, '""')}"`,
          `"${(user.id || "").replace(/"/g, '""')}"`,
          `"${parseDate(user.createdAt)}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bitlance_user_emails_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Accounts"
        title="Users"
        description="Audit every registered account, role, online state, signup time, and last seen activity."
        action={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleExportEmails}
              disabled={!users || users.length === 0}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#FAF8F5] border border-[#E7E1D8] px-5 text-sm font-black text-[#1a1a1a] hover:bg-[#FFFDF8] hover:border-[#F7931A] disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all outline-none"
            >
              <Download className="h-4 w-4 text-[#8C4F00]" />
              Export Emails
            </button>
            <div className="relative w-full sm:w-[320px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9e9690]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users..." className="h-11 w-full rounded-full border border-[#E7E1D8] bg-[#FAF8F5] pl-10 pr-4 text-sm outline-none focus:border-[#F7931A]" />
            </div>
          </div>
        }
      />
      <AdminTable
        columns={["User", "Role", "Presence", "Created", "UID"]}
        rows={filtered.map((user) => ({
          href: `/admin/dashboard/users/${user.id}`,
          cells: [
            <div key="user">
              <div className="font-black group-hover:text-[#8C4F00]">{user.fullName}</div>
              <div className="mt-1 text-xs text-[#6b6762]">{user.email}</div>
            </div>,
            <StatusPill key="role" status={user.role} />,
            <span key="online" className={user.online ? "font-black text-green-700" : "text-[#6b6762]"}>{user.online ? "Online" : formatDateTime(user.lastSeen)}</span>,
            <span key="created" className="text-xs text-[#6b6762]">{formatDateTime(user.createdAt)}</span>,
            <code key="uid" className="text-xs text-[#6b6762]">{user.id}</code>,
          ],
        }))}
      />
    </>
  );
}
