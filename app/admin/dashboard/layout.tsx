"use client";

import AuthGuard from "@/components/organisms/AuthGuard";
import AdminDashboardShell from "@/components/organisms/AdminDashboardShell";

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRole="admin">
      <AdminDashboardShell>{children}</AdminDashboardShell>
    </AuthGuard>
  );
}
