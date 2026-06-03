"use client";

import AuthGuard from "@/components/organisms/AuthGuard";

export default function FreelancerDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRole="freelancer">
      {children}
    </AuthGuard>
  );
}
