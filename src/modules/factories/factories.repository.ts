import type { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';

export const factoriesRepository = {
  list: () => prisma.factory.findMany({ orderBy: { code: 'asc' } }),
  findById: (id: string) => prisma.factory.findUnique({ where: { id } }),
  create: (data: Prisma.FactoryCreateInput) => prisma.factory.create({ data }),
  update: (id: string, data: Prisma.FactoryUpdateInput) => prisma.factory.update({ where: { id }, data }),
};
