"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
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

  return (
    <>
      <AdminPageHeader
        eyebrow="Accounts"
        title="Users"
        description="Audit every registered account, role, online state, signup time, and last seen activity."
        action={
          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9e9690]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users..." className="h-11 w-full rounded-full border border-[#E7E1D8] bg-[#FAF8F5] pl-10 pr-4 text-sm outline-none focus:border-[#F7931A]" />
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
