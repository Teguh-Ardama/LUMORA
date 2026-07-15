/**
 * Canonical enums shared across web, worker, and bridge.
 * Values are persisted in the database — never rename, only add.
 */

export const OrgRole = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  OPERATOR: "OPERATOR",
} as const;
export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole];

export const EventStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
} as const;
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const SessionStatus = {
  CAPTURING: "CAPTURING",
  COMPOSING: "COMPOSING",
  READY: "READY",
  FAILED: "FAILED",
  CLOSED: "CLOSED",
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const CaptureSource = {
  WEBCAM: "WEBCAM",
  BRIDGE: "BRIDGE",
  REMOTE_MOBILE: "REMOTE_MOBILE",
} as const;
export type CaptureSource = (typeof CaptureSource)[keyof typeof CaptureSource];

export const PhotoStatus = {
  UPLOADED: "UPLOADED",
  QUARANTINED: "QUARANTINED",
  DISCARDED: "DISCARDED",
} as const;
export type PhotoStatus = (typeof PhotoStatus)[keyof typeof PhotoStatus];

export const DeliveryChannel = {
  QR: "QR",
  EMAIL: "EMAIL",
} as const;
export type DeliveryChannel = (typeof DeliveryChannel)[keyof typeof DeliveryChannel];

export const DeliveryStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
  REVOKED: "REVOKED",
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const PrintJobStatus = {
  QUEUED: "QUEUED",
  PRINTING: "PRINTING",
  PRINTED: "PRINTED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type PrintJobStatus = (typeof PrintJobStatus)[keyof typeof PrintJobStatus];

export const LayoutMode = {
  GRID: "GRID",
  STRIP: "STRIP",
} as const;
export type LayoutMode = (typeof LayoutMode)[keyof typeof LayoutMode];

export const TemplateScope = {
  GLOBAL: "GLOBAL",
  ORGANIZATION: "ORGANIZATION",
  EVENT: "EVENT",
} as const;
export type TemplateScope = (typeof TemplateScope)[keyof typeof TemplateScope];

export const FilterKind = {
  NORMAL: "NORMAL",
  GRAYSCALE: "GRAYSCALE",
  VINTAGE: "VINTAGE",
  SEPIA: "SEPIA",
  COOL: "COOL",
  WARM: "WARM",
} as const;
export type FilterKind = (typeof FilterKind)[keyof typeof FilterKind];

export const BridgeDeviceStatus = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  REVOKED: "REVOKED",
} as const;
export type BridgeDeviceStatus = (typeof BridgeDeviceStatus)[keyof typeof BridgeDeviceStatus];

export const NotificationKind = {
  SESSION_READY: "SESSION_READY",
  COMPOSE_FAILED: "COMPOSE_FAILED",
  DELIVERY_SENT: "DELIVERY_SENT",
  DELIVERY_FAILED: "DELIVERY_FAILED",
  BRIDGE_ONLINE: "BRIDGE_ONLINE",
  BRIDGE_OFFLINE: "BRIDGE_OFFLINE",
  MEMBER_INVITED: "MEMBER_INVITED",
  MEMBER_JOINED: "MEMBER_JOINED",
  EVENT_CREATED: "EVENT_CREATED",
  LOW_BALANCE: "LOW_BALANCE",
  TOPUP_PAID: "TOPUP_PAID",
} as const;
export type NotificationKind = (typeof NotificationKind)[keyof typeof NotificationKind];

export const StickerAnchor = {
  FOREHEAD: "FOREHEAD",
  LEFT_EYE: "LEFT_EYE",
  RIGHT_EYE: "RIGHT_EYE",
  NOSE: "NOSE",
  MOUTH: "MOUTH",
  CHIN: "CHIN",
  LEFT_EAR: "LEFT_EAR",
  RIGHT_EAR: "RIGHT_EAR",
  FULL_FACE: "FULL_FACE",
} as const;
export type StickerAnchor = (typeof StickerAnchor)[keyof typeof StickerAnchor];

export const AuditAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  INVITE: "INVITE",
  REVOKE: "REVOKE",
  UPLOAD: "UPLOAD",
  COMPOSE: "COMPOSE",
  DELIVER: "DELIVER",
  PRINT: "PRINT",
  PAIR: "PAIR",
  SESSION_START: "SESSION_START",
  SESSION_CLOSE: "SESSION_CLOSE",
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
