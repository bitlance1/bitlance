"use client";

import AuthGuard from "@/components/organisms/AuthGuard";

export default function ClientDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRole="client">
      {children}
    </AuthGuard>
  );
}
