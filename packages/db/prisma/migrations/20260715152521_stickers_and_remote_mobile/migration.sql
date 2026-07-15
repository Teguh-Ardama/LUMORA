-- CreateEnum
CREATE TYPE "sticker_anchor" AS ENUM ('FOREHEAD', 'LEFT_EYE', 'RIGHT_EYE', 'NOSE', 'MOUTH', 'CHIN', 'LEFT_EAR', 'RIGHT_EAR', 'FULL_FACE');

-- AlterEnum
ALTER TYPE "CaptureSource" ADD VALUE 'REMOTE_MOBILE';

-- AlterEnum
ALTER TYPE "PhotoSource" ADD VALUE 'REMOTE_MOBILE';

-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "is_selected" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "timer_duration_seconds" INTEGER,
ADD COLUMN     "timer_expires_at" TIMESTAMP(3),
ADD COLUMN     "timer_started_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "stickers" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "event_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "anchor_point" "sticker_anchor" NOT NULL,
    "default_scale" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "default_offset_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "default_offset_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stickers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_stickers" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "sticker_id" UUID NOT NULL,
    "offset_x" DOUBLE PRECISION,
    "offset_y" DOUBLE PRECISION,
    "scale" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_stickers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stickers_organization_id_event_id_idx" ON "stickers"("organization_id", "event_id");

-- CreateIndex
CREATE INDEX "session_stickers_session_id_idx" ON "session_stickers"("session_id");

-- CreateIndex
CREATE INDEX "session_stickers_sticker_id_idx" ON "session_stickers"("sticker_id");

-- AddForeignKey
ALTER TABLE "stickers" ADD CONSTRAINT "stickers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stickers" ADD CONSTRAINT "stickers_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_stickers" ADD CONSTRAINT "session_stickers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_stickers" ADD CONSTRAINT "session_stickers_sticker_id_fkey" FOREIGN KEY ("sticker_id") REFERENCES "stickers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
