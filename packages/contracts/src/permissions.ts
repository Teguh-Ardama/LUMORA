import { OrgRole } from "./enums";

/**
 * Fine-grained permission catalog. RBAC checks always go through
 * `roleHasPermission` — never compare roles directly in feature code.
 */
export const Permission = {
  ORG_READ: "org:read",
  ORG_UPDATE: "org:update",
  ORG_DELETE: "org:delete",

  MEMBER_READ: "member:read",
  MEMBER_INVITE: "member:invite",
  MEMBER_UPDATE: "member:update",
  MEMBER_REMOVE: "member:remove",

  EVENT_READ: "event:read",
  EVENT_CREATE: "event:create",
  EVENT_UPDATE: "event:update",
  EVENT_DELETE: "event:delete",

  TEMPLATE_READ: "template:read",
  TEMPLATE_MANAGE: "template:manage",

  SESSION_READ: "session:read",
  SESSION_OPERATE: "session:operate",

  GALLERY_READ: "gallery:read",
  GALLERY_DOWNLOAD: "gallery:download",
  GALLERY_DELETE: "gallery:delete",

  PRINT_OPERATE: "print:operate",

  BRIDGE_PAIR: "bridge:pair",
  BRIDGE_MANAGE: "bridge:manage",

  ANALYTICS_READ: "analytics:read",
  AUDIT_READ: "audit:read",
  BILLING_READ: "billing:read",
  BILLING_MANAGE: "billing:manage",
  SETTINGS_MANAGE: "settings:manage",
  NOTIFICATION_READ: "notification:read",
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

const ALL_PERMISSIONS = Object.values(Permission) as Permission[];

const OPERATOR_PERMISSIONS: Permission[] = [
  Permission.ORG_READ,
  Permission.EVENT_READ,
  Permission.TEMPLATE_READ,
  Permission.SESSION_READ,
  Permission.SESSION_OPERATE,
  Permission.GALLERY_READ,
  Permission.GALLERY_DOWNLOAD,
  Permission.PRINT_OPERATE,
  Permission.BRIDGE_PAIR,
  Permission.NOTIFICATION_READ,
];

const ADMIN_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter(
  (p) => p !== Permission.ORG_DELETE,
);

export const ROLE_PERMISSIONS: Record<OrgRole, readonly Permission[]> = {
  [OrgRole.OWNER]: ALL_PERMISSIONS,
  [OrgRole.ADMIN]: ADMIN_PERMISSIONS,
  [OrgRole.OPERATOR]: OPERATOR_PERMISSIONS,
};

export function roleHasPermission(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
