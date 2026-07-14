import {
  Activity,
  Bell,
  CalendarDays,
  Camera,
  Download,
  Images,
  LayoutDashboard,
  Printer,
  ScrollText,
  Send,
  Settings,
  Shapes,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Permission } from "@lumora/contracts";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
}

export const NAV_SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Operate",
    items: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboard, permission: Permission.ORG_READ },
      { label: "Events", href: "/dashboard/events", icon: CalendarDays, permission: Permission.EVENT_READ },
      { label: "Operator Console", href: "/operator", icon: Camera, permission: Permission.SESSION_OPERATE },
    ],
  },
  {
    title: "Library",
    items: [
      { label: "Templates", href: "/dashboard/templates", icon: Shapes, permission: Permission.TEMPLATE_READ },
      { label: "Gallery", href: "/dashboard/gallery", icon: Images, permission: Permission.GALLERY_READ },
      { label: "Downloads", href: "/dashboard/downloads", icon: Download, permission: Permission.GALLERY_DOWNLOAD },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Deliveries", href: "/dashboard/deliveries", icon: Send, permission: Permission.SESSION_READ },
      { label: "Print Queue", href: "/dashboard/print-queue", icon: Printer, permission: Permission.SESSION_READ },
      { label: "Analytics", href: "/dashboard/analytics", icon: Activity, permission: Permission.ANALYTICS_READ },
    ],
  },
  {
    title: "Organization",
    items: [
      { label: "Billing", href: "/dashboard/billing", icon: Wallet, permission: Permission.BILLING_READ },
      { label: "Members", href: "/dashboard/members", icon: Users, permission: Permission.MEMBER_READ },
      { label: "Audit Log", href: "/dashboard/audit", icon: ScrollText, permission: Permission.AUDIT_READ },
      { label: "Notifications", href: "/dashboard/notifications", icon: Bell, permission: Permission.NOTIFICATION_READ },
      { label: "Settings", href: "/dashboard/settings", icon: Settings, permission: Permission.SETTINGS_MANAGE },
    ],
  },
];
