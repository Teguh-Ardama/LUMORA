"use client";

import { LoadingState } from "@lumora/ui";
import { useMe } from "@/lib/hooks/use-auth";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useMe();

  if (isLoading || !data) {
    return <LoadingState label="Loading workspace…" className="min-h-screen" />;
  }

  return (
    <div className="flex min-h-screen">
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">
        <Sidebar role={data.user.role} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <Topbar user={data.user} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl animate-slide-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
