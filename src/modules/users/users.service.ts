import bcrypt from 'bcryptjs';
import { conflict, notFound } from '../../shared/http/errors';
import { usersRepository } from './users.repository';
import type { CreateUserInput, UpdateUserInput } from './users.schemas';

export const usersService = {
  list: () => usersRepository.list(),

  async getById(id: string) {
    const user = await usersRepository.findById(id);
    if (!user) throw notFound('User');
    return user;
  },

  async create(input: CreateUserInput) {
    if (await usersRepository.findByEmailWithHash(input.email)) throw conflict('Email already in use');
    const passwordHash = await bcrypt.hash(input.password, 10);
    const id = await usersRepository.nextId();
    return usersRepository.create({ id, email: input.email, name: input.name, role: input.role, passwordHash });
  },

  async update(id: string, input: UpdateUserInput) {
    await this.getById(id);
    return usersRepository.update(id, input);
  },

  findByEmailWithHash: (email: string) => usersRepository.findByEmailWithHash(email.toLowerCase()),
};
