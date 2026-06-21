"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  AlertCircle,
  Bell,
  BriefcaseBusiness,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Send,
  ShieldCheck,
  UploadCloud,
  Users,
  XCircle,
} from "lucide-react";
import { firebaseAuth } from "@/lib/firebase";

const NAV_ITEMS = [
  { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Users", href: "/admin/dashboard/users", icon: Users },
  { label: "Jobs", href: "/admin/dashboard/jobs", icon: BriefcaseBusiness },
  { label: "Proposals", href: "/admin/dashboard/proposals", icon: FileText },
  { label: "Contracts", href: "/admin/dashboard/contracts", icon: ShieldCheck },
  { label: "Messages", href: "/admin/dashboard/messages", icon: MessageSquare },
  { label: "Submissions", href: "/admin/dashboard/submissions", icon: UploadCloud },
  { label: "Escrow", href: "/admin/dashboard/escrow", icon: CircleDollarSign },
  { label: "Disputes", href: "/admin/dashboard/disputes", icon: AlertCircle },
  { label: "Terminations", href: "/admin/dashboard/terminations", icon: XCircle },
  { label: "Direct Outreach", href: "/admin/dashboard/outreach", icon: Send },
  { label: "Notifications", href: "/admin/dashboard/notifications", icon: Bell },
];

export default function AdminDashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(firebaseAuth);
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-[#1a1a1a]">
      <div className="flex">
        <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[280px] flex-col border-r border-[#E7E1D8] bg-white px-4 py-5 shadow-sm lg:flex">
          <Link href="/admin/dashboard" className="flex items-center gap-3 px-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[#1a1a1a] text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-black leading-tight">Bitlance</div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8C4F00]">Admin</div>
            </div>
          </Link>

          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/admin/dashboard"
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-[8px] px-4 py-3 text-sm font-black transition ${
                    active
                      ? "bg-[#FFF4E6] text-[#8C4F00]"
                      : "text-[#6b6762] hover:bg-[#FAF8F5] hover:text-[#1a1a1a]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-5 flex w-full items-center gap-3 rounded-[8px] border border-[#E7E1D8] px-4 py-3 text-sm font-black text-[#6b6762] hover:bg-[#FAF8F5]"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </aside>

        <div className="min-w-0 flex-1 lg:pl-[280px]">
          <header className="sticky top-0 z-30 border-b border-[#E7E1D8] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link href="/admin/dashboard" className="flex items-center gap-2 font-black">
                <ShieldCheck className="h-5 w-5 text-[#8C4F00]" />
                Admin
              </Link>
              <button type="button" onClick={handleLogout} className="rounded-full border border-[#E7E1D8] px-3 py-2 text-xs font-black">
                Logout
              </button>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {NAV_ITEMS.map((item) => {
                const active =
                  item.href === "/admin/dashboard"
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-black ${
                      active ? "bg-[#1a1a1a] text-white" : "bg-[#FAF8F5] text-[#6b6762]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </header>
          <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
