"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Search, UserRound } from "lucide-react";
import { roleHasPermission, type SessionUser } from "@lumora/contracts";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@lumora/ui";
import { useLogout } from "@/lib/hooks/use-auth";
import { useNotifications } from "@/lib/hooks/use-admin";
import { NAV_SECTIONS } from "./nav";
import { Sidebar } from "./sidebar";

export function Topbar({ user }: { user: SessionUser }) {
  const router = useRouter();
  const logout = useLogout();
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const { data: notifications } = useNotifications(1);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const unread = notifications?.unreadCount ?? 0;

  return (
    <header className="glass sticky top-0 z-40 flex h-14 items-center gap-3 border-b px-4">
      {/* Mobile nav */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar role={user.role} className="w-full border-r-0" />
        </SheetContent>
      </Sheet>

      <Button
        variant="outline"
        className="hidden w-64 justify-start gap-2 text-muted-foreground sm:flex"
        onClick={() => setPaletteOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span className="text-sm">Search or jump to…</span>
        <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
      </Button>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
          onClick={() => router.push("/dashboard/notifications")}
        >
          <Bell />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-destructive" />
          ) : null}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{user.organizationName}</span>
                <span className="text-xs font-normal">{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
              <UserRound /> Profile & settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => logout.mutate()}>
              <LogOut /> Sign out
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <Badge variant="secondary">{user.role}</Badge>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder="Jump to a page…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter((i) => roleHasPermission(user.role, i.permission));
            if (items.length === 0) return null;
            return (
              <CommandGroup key={section.title} heading={section.title}>
                {items.map((item) => (
                  <CommandItem
                    key={item.href}
                    onSelect={() => {
                      setPaletteOpen(false);
                      router.push(item.href);
                    }}
                  >
                    <item.icon /> {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </header>
  );
}
