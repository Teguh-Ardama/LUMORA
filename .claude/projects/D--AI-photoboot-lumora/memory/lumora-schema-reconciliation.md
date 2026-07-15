---
name: lumora-schema-reconciliation
description: Actual schema.prisma lebih kompleks dari docs — multi-tenant + billing system, masih ada WhatsApp field
metadata:
  type: project
---

## Status

Schema yang di `packages/db/prisma/schema.prisma` jauh lebih advanced daripada yang ada di docs:

**Added features yang tidak di docs:**
- Multi-tenant support (organizationId di semua table)
- Billing system (CreditTransaction, Topup models)
- Audit logs (AuditLog model)
- Bridge device management (BridgeDevice model)
- Delivery tokens + detailed delivery tracking
- Refresh tokens, notifications, invites

**Issue yang perlu fix:**
- Field `guestWaNumber` masih ada di Session model (line 348) padahal WhatsApp dihapus dari requirement
- Perlu remove dari schema
- Perlu create migration untuk drop column ini

## Action Items

1. ✅ Remove `guestWaNumber` from Session model (line 348 schema.prisma)
2. Create migration: `pnpm db:migrate dev --name remove_guest_wa_number`
3. Verify: seed script berjalan without errors
4. Update docs/DATABASE.md untuk reflect actual schema (optional, untuk clarity)

## Decision

Kita proceed dengan schema yang ada sekarang (lebih complete), tapi remove WhatsApp field saja.
Ini lebih robust untuk production-ready system.
