import type { Prisma } from "@prisma/client";
import { prisma } from "../client";

/**
 * FR-08 scoping: a template is visible to an org if it is GLOBAL
 * (organizationId NULL), owned by the org, or bound to one of its events.
 */
function visibilityWhere(organizationId: string, eventId?: string) {
  return {
    isActive: true,
    OR: [
      { organizationId: null, eventId: null },
      { organizationId, eventId: null },
      ...(eventId ? [{ organizationId, eventId }] : [{ organizationId, eventId: { not: null } }]),
    ],
  };
}

export const borderRepo = {
  findById: (id: string) => prisma.border.findUnique({ where: { id } }),

  listVisible(organizationId: string, eventId?: string) {
    return prisma.border.findMany({
      where: visibilityWhere(organizationId, eventId),
      orderBy: [{ organizationId: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    });
  },

  create: (data: Prisma.BorderUncheckedCreateInput) => prisma.border.create({ data }),
  update: (id: string, data: Prisma.BorderUncheckedUpdateInput) =>
    prisma.border.update({ where: { id }, data }),
  delete: (id: string) => prisma.border.delete({ where: { id } }),
};

export const layoutRepo = {
  findById: (id: string) => prisma.layout.findUnique({ where: { id } }),

  listVisible(organizationId: string, eventId?: string) {
    return prisma.layout.findMany({
      where: visibilityWhere(organizationId, eventId),
      orderBy: [{ organizationId: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    });
  },

  create: (data: Prisma.LayoutUncheckedCreateInput) => prisma.layout.create({ data }),
  update: (id: string, data: Prisma.LayoutUncheckedUpdateInput) =>
    prisma.layout.update({ where: { id }, data }),
  delete: (id: string) => prisma.layout.delete({ where: { id } }),
};

export const filterRepo = {
  findById: (id: string) => prisma.filter.findUnique({ where: { id } }),

  listVisible(organizationId: string) {
    return prisma.filter.findMany({
      where: { isActive: true, OR: [{ organizationId: null }, { organizationId }] },
      orderBy: [{ organizationId: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    });
  },

  create: (data: Prisma.FilterUncheckedCreateInput) => prisma.filter.create({ data }),
  update: (id: string, data: Prisma.FilterUncheckedUpdateInput) =>
    prisma.filter.update({ where: { id }, data }),
};

export const stickerRepo = {
  findById: (id: string) => prisma.sticker.findUnique({ where: { id } }),

  listVisible(organizationId: string, eventId?: string) {
    return prisma.sticker.findMany({
      where: visibilityWhere(organizationId, eventId),
      orderBy: [{ organizationId: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    });
  },

  create: (data: Prisma.StickerUncheckedCreateInput) => prisma.sticker.create({ data }),
  update: (id: string, data: Prisma.StickerUncheckedUpdateInput) =>
    prisma.sticker.update({ where: { id }, data }),
  delete: (id: string) => prisma.sticker.delete({ where: { id } }),
};
