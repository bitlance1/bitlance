"use client";

import AuthGuard from "@/components/organisms/AuthGuard";
import NotificationPermissionPrompt from "@/components/organisms/NotificationPermissionPrompt";

export default function FreelancerDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRole="freelancer">
      {children}
      <NotificationPermissionPrompt />
    </AuthGuard>
  );
}
