/*
  Warnings:

  - Added the required column `size_bytes` to the `stickers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "applied_stickers" JSONB;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "capture_hardware" VARCHAR(50);

-- AlterTable
ALTER TABLE "stickers" ADD COLUMN     "size_bytes" INTEGER NOT NULL DEFAULT 0;
UPDATE "stickers" SET "size_bytes" = 0 WHERE "size_bytes" IS NULL;
ALTER TABLE "stickers" ALTER COLUMN "size_bytes" DROP DEFAULT;
