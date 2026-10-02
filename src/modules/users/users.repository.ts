import type { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';

const publicSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const usersRepository = {
  list: () => prisma.user.findMany({ select: publicSelect, orderBy: { createdAt: 'asc' } }),
  findById: (id: string) => prisma.user.findUnique({ where: { id }, select: publicSelect }),
  findByEmailWithHash: (email: string) => prisma.user.findUnique({ where: { email } }),
  create: (data: Prisma.UserCreateInput) => prisma.user.create({ data, select: publicSelect }),
  update: (id: string, data: Prisma.UserUpdateInput) => prisma.user.update({ where: { id }, data, select: publicSelect }),
};
