import { prisma } from '../../shared/database/prisma';
import type { CreateScreenInput, CreateViewInput } from './master-data.schemas';

const screenInclude = {
  views: { orderBy: [{ sortOrder: 'asc' as const }, { name: 'asc' as const }] },
  assignments: {
    orderBy: { assignedAt: 'asc' as const },
    include: { user: { select: { id: true, name: true, email: true } } },
  },
};

function toScreen(row: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  views: {
    id: string;
    screenId: string;
    code: string;
    name: string;
    description: string | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }[];
  assignments: { user: { id: string; name: string; email: string } }[];
}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    views: row.views,
    assignedUsers: row.assignments.map((assignment) => assignment.user),
  };
}

export const masterDataRepository = {
  async list() {
    const rows = await prisma.screen.findMany({ include: screenInclude, orderBy: { name: 'asc' } });
    return rows.map(toScreen);
  },

  async findById(id: string) {
    const row = await prisma.screen.findUnique({ where: { id }, include: screenInclude });
    return row ? toScreen(row) : null;
  },

  findByCode: (code: string) => prisma.screen.findUnique({ where: { code }, select: { id: true } }),

  createScreen: (input: CreateScreenInput) =>
    prisma.screen.create({ data: input, include: screenInclude }).then(toScreen),

  deleteScreen: (id: string) => prisma.screen.delete({ where: { id } }),

  async createView(screenId: string, input: CreateViewInput) {
    const sortOrder = await prisma.screenView.count({ where: { screenId } });
    await prisma.screenView.create({ data: { ...input, screenId, sortOrder } });
    return this.findById(screenId);
  },

  deleteView: (id: string) => prisma.screenView.delete({ where: { id } }),

  countByIds: (ids: string[]) => prisma.screen.count({ where: { id: { in: ids } } }),

  replaceUserScreens: (userId: string, screenIds: string[]) =>
    prisma.$transaction([
      prisma.userScreen.deleteMany({ where: { userId } }),
      prisma.userScreen.createMany({ data: screenIds.map((screenId) => ({ userId, screenId })) }),
    ]),
};
