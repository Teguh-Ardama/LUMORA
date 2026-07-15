-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('CAPTURING', 'COMPOSING', 'READY', 'FAILED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CaptureSource" AS ENUM ('WEBCAM', 'BRIDGE');

-- CreateEnum
CREATE TYPE "PhotoStatus" AS ENUM ('UPLOADED', 'QUARANTINED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "PhotoSource" AS ENUM ('WEBCAM', 'BRIDGE');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('QR', 'EMAIL');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PrintJobStatus" AS ENUM ('QUEUED', 'PRINTING', 'PRINTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LayoutMode" AS ENUM ('GRID', 'STRIP');

-- CreateEnum
CREATE TYPE "FilterKind" AS ENUM ('NORMAL', 'GRAYSCALE', 'VINTAGE', 'SEPIA', 'COOL', 'WARM');

-- CreateEnum
CREATE TYPE "BridgeDeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'REVOKED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'BRIDGE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('TOPUP', 'SESSION_CHARGE', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TopupStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "support_email" VARCHAR(255),
    "brand_color" VARCHAR(9),
    "session_price_idr" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" "OrgRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "OrgRole" NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "invited_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "user_agent" VARCHAR(300),
    "ip" VARCHAR(64),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "client_name" VARCHAR(160),
    "venue" VARCHAR(200),
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "default_border_id" UUID,
    "default_layout_id" UUID,
    "frames_per_session" INTEGER NOT NULL DEFAULT 4,
    "countdown_seconds" INTEGER NOT NULL DEFAULT 3,
    "created_by_id" UUID,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_operators" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borders" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "event_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "borders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "layouts" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "event_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "mode" "LayoutMode" NOT NULL,
    "photo_count" INTEGER NOT NULL,
    "template_config" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filters" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "kind" "FilterKind" NOT NULL,
    "params" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "border_id" UUID,
    "layout_id" UUID NOT NULL,
    "filter_id" UUID NOT NULL,
    "capture_source" "CaptureSource" NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'CAPTURING',
    "guest_name" VARCHAR(120),
    "guest_email" VARCHAR(255),
    "started_by_id" UUID,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "composed_key" VARCHAR(500),
    "composed_at" TIMESTAMP(3),
    "compose_ms" INTEGER,
    "compose_error" VARCHAR(1000),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "session_id" UUID,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "source" "PhotoSource" NOT NULL,
    "status" "PhotoStatus" NOT NULL DEFAULT 'UPLOADED',
    "storage_key" VARCHAR(500) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "original_filename" VARCHAR(255),
    "idempotency_key" VARCHAR(128) NOT NULL,
    "captured_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_tokens" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "last_viewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "recipient" VARCHAR(255) NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "error" VARCHAR(1000),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'QUEUED',
    "failure_reason" VARCHAR(500),
    "requested_by_id" UUID,
    "printed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bridge_devices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "platform" VARCHAR(60) NOT NULL,
    "app_version" VARCHAR(30) NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "status" "BridgeDeviceStatus" NOT NULL DEFAULT 'ONLINE',
    "queue_depth" INTEGER NOT NULL DEFAULT 0,
    "watched_folder" VARCHAR(500),
    "last_seen_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bridge_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" VARCHAR(300),
    "session_id" UUID,
    "topup_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topups" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "TopupStatus" NOT NULL DEFAULT 'PENDING',
    "provider" VARCHAR(30) NOT NULL,
    "provider_ref" VARCHAR(120),
    "payment_url" VARCHAR(600),
    "paid_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" UUID,
    "actor_name" VARCHAR(160),
    "action" VARCHAR(40) NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB,
    "ip" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "meta" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "memberships_organization_id_idx" ON "memberships"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_organization_id_key" ON "memberships"("user_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_hash_key" ON "invites"("token_hash");

-- CreateIndex
CREATE INDEX "invites_organization_id_email_idx" ON "invites"("organization_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "events_organization_id_status_idx" ON "events"("organization_id", "status");

-- CreateIndex
CREATE INDEX "events_organization_id_starts_at_idx" ON "events"("organization_id", "starts_at");

-- CreateIndex
CREATE INDEX "event_operators_user_id_idx" ON "event_operators"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_operators_event_id_user_id_key" ON "event_operators"("event_id", "user_id");

-- CreateIndex
CREATE INDEX "borders_organization_id_event_id_idx" ON "borders"("organization_id", "event_id");

-- CreateIndex
CREATE INDEX "layouts_organization_id_event_id_idx" ON "layouts"("organization_id", "event_id");

-- CreateIndex
CREATE INDEX "filters_organization_id_idx" ON "filters"("organization_id");

-- CreateIndex
CREATE INDEX "sessions_event_id_status_idx" ON "sessions"("event_id", "status");

-- CreateIndex
CREATE INDEX "sessions_organization_id_created_at_idx" ON "sessions"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_event_id_idempotency_key_key" ON "sessions"("event_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "photos_session_id_sequence_idx" ON "photos"("session_id", "sequence");

-- CreateIndex
CREATE INDEX "photos_event_id_status_idx" ON "photos"("event_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "photos_event_id_idempotency_key_key" ON "photos"("event_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_tokens_token_hash_key" ON "delivery_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "delivery_tokens_session_id_idx" ON "delivery_tokens"("session_id");

-- CreateIndex
CREATE INDEX "deliveries_organization_id_created_at_idx" ON "deliveries"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "deliveries_session_id_idx" ON "deliveries"("session_id");

-- CreateIndex
CREATE INDEX "print_jobs_event_id_status_idx" ON "print_jobs"("event_id", "status");

-- CreateIndex
CREATE INDEX "print_jobs_organization_id_created_at_idx" ON "print_jobs"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bridge_devices_token_hash_key" ON "bridge_devices"("token_hash");

-- CreateIndex
CREATE INDEX "bridge_devices_event_id_status_idx" ON "bridge_devices"("event_id", "status");

-- CreateIndex
CREATE INDEX "credit_transactions_organization_id_created_at_idx" ON "credit_transactions"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "credit_transactions_session_id_type_key" ON "credit_transactions"("session_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "credit_transactions_topup_id_type_key" ON "credit_transactions"("topup_id", "type");

-- CreateIndex
CREATE INDEX "topups_organization_id_created_at_idx" ON "topups"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "topups_provider_ref_idx" ON "topups"("provider_ref");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_entity_type_entity_id_idx" ON "audit_logs"("organization_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_organization_id_created_at_idx" ON "notifications"("organization_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_default_border_id_fkey" FOREIGN KEY ("default_border_id") REFERENCES "borders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_default_layout_id_fkey" FOREIGN KEY ("default_layout_id") REFERENCES "layouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_operators" ADD CONSTRAINT "event_operators_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_operators" ADD CONSTRAINT "event_operators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borders" ADD CONSTRAINT "borders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borders" ADD CONSTRAINT "borders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layouts" ADD CONSTRAINT "layouts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layouts" ADD CONSTRAINT "layouts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filters" ADD CONSTRAINT "filters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_border_id_fkey" FOREIGN KEY ("border_id") REFERENCES "borders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_layout_id_fkey" FOREIGN KEY ("layout_id") REFERENCES "layouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_filter_id_fkey" FOREIGN KEY ("filter_id") REFERENCES "filters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_started_by_id_fkey" FOREIGN KEY ("started_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_tokens" ADD CONSTRAINT "delivery_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_devices" ADD CONSTRAINT "bridge_devices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bridge_devices" ADD CONSTRAINT "bridge_devices_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_topup_id_fkey" FOREIGN KEY ("topup_id") REFERENCES "topups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topups" ADD CONSTRAINT "topups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
