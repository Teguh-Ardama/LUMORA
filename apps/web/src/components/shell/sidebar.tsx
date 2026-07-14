"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Aperture } from "lucide-react";
import { roleHasPermission, type OrgRole } from "@lumora/contracts";
import { ScrollArea, cn } from "@lumora/ui";
import { NAV_SECTIONS } from "./nav";

export function Sidebar({ role, className }: { role: OrgRole; className?: string }) {
  const pathname = usePathname();

  return (
    <aside className={cn("flex h-full w-60 flex-col border-r bg-sidebar", className)}>
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Aperture className="h-4 w-4" />
        </span>
        <span className="font-semibold tracking-tight">LUMORA</span>
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-6">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter((item) => roleHasPermission(role, item.permission));
            if (items.length === 0) return null;
            return (
              <div key={section.title}>
                <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </p>
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active =
                      item.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                            active
                              ? "bg-accent font-medium text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}
