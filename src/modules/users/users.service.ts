import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { badRequest, conflict, notFound } from '../../shared/http/errors';
import { troughsApi } from '../troughs';
import { usersRepository } from './users.repository';
import {
  DEFAULT_EXECUTIVE_CONFIG,
  executiveConfigSchema,
  type CreateUserInput,
  type ExecutiveConfig,
  type UpdateUserInput,
} from './users.schemas';

function asExecutiveConfig(value: unknown): ExecutiveConfig | null {
  if (value == null) return null;
  const parsed = executiveConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function toPublicUser<T extends { role: string; executiveConfig: unknown }>(user: T) {
  return {
    ...user,
    executiveConfig:
      user.role === 'executive'
        ? (asExecutiveConfig(user.executiveConfig) ?? DEFAULT_EXECUTIVE_CONFIG)
        : null,
  };
}

async function assertTroughIds(troughIds: string[]) {
  if (troughIds.length === 0) return;
  const troughs = await troughsApi.listBasic();
  const known = new Set(troughs.map((t) => t.id));
  const missing = troughIds.filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw badRequest('One or more troughs are not available', { troughIds: missing });
  }
}

export const usersService = {
  async list() {
    const users = await usersRepository.list();
    return users.map(toPublicUser);
  },

  async getById(id: string) {
    const user = await usersRepository.findById(id);
    if (!user) throw notFound('User');
    return toPublicUser(user);
  },

  async create(input: CreateUserInput) {
    if (await usersRepository.findByEmailWithHash(input.email)) throw conflict('Email already in use');
    const passwordHash = await bcrypt.hash(input.password, 10);
    const id = await usersRepository.nextId();
    const data: Prisma.UserCreateInput = {
      id,
      email: input.email,
      name: input.name,
      role: input.role,
      passwordHash,
      ...(input.role === 'executive' ? { executiveConfig: DEFAULT_EXECUTIVE_CONFIG } : {}),
    };
    return toPublicUser(await usersRepository.create(data));
  },

  async update(id: string, input: UpdateUserInput) {
    const existing = await this.getById(id);

    if (input.executiveConfig !== undefined) {
      if (existing.role !== 'executive' && input.role !== 'executive') {
        throw badRequest('Executive settings can only be applied to Executive users');
      }
      await assertTroughIds(input.executiveConfig.troughIds);
    }

    const data: Prisma.UserUpdateInput = {
      name: input.name,
      role: input.role,
      isActive: input.isActive,
    };

    if (input.executiveConfig !== undefined) {
      data.executiveConfig = input.executiveConfig;
    }

    // Clear executive settings if the account is moved off the executive role.
    if (input.role && input.role !== 'executive' && existing.role === 'executive') {
      data.executiveConfig = Prisma.DbNull;
    }

    return toPublicUser(await usersRepository.update(id, data));
  },

  findByEmailWithHash: (email: string) => usersRepository.findByEmailWithHash(email.toLowerCase()),
};
