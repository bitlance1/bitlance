"use client";

import AuthGuard from "@/components/organisms/AuthGuard";
import NotificationPermissionPrompt from "@/components/organisms/NotificationPermissionPrompt";

export default function ClientDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRole="client">
      {children}
      <NotificationPermissionPrompt />
    </AuthGuard>
  );
}
