import { notFound } from '../../shared/http/errors';
import { factoriesRepository } from './factories.repository';
import type { CreateFactoryInput, UpdateFactoryInput } from './factories.schemas';

export const factoriesService = {
  list: () => factoriesRepository.list(),

  async getById(id: string) {
    const factory = await factoriesRepository.findById(id);
    if (!factory) throw notFound('Factory');
    return factory;
  },

  create: (input: CreateFactoryInput) => factoriesRepository.create(input),

  async update(id: string, input: UpdateFactoryInput) {
    await this.getById(id);
    return factoriesRepository.update(id, input);
  },
};
