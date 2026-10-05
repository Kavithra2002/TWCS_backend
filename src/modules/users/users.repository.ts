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
  async nextId() {
    const users = await prisma.user.findMany({ select: { id: true } });
    const max = users.reduce((highest, user) => {
      const value = Number(user.id);
      return Number.isInteger(value) && value > highest ? value : highest;
    }, 0);
    return String(max + 1).padStart(3, '0');
  },
  create: (data: Prisma.UserCreateInput) => prisma.user.create({ data, select: publicSelect }),
  update: (id: string, data: Prisma.UserUpdateInput) => prisma.user.update({ where: { id }, data, select: publicSelect }),
};
