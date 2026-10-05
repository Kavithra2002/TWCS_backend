import { badRequest, conflict, notFound } from '../../shared/http/errors';
import { usersApi } from '../users';
import { masterDataRepository } from './master-data.repository';
import type { AssignScreensInput, CreateScreenInput, CreateViewInput } from './master-data.schemas';

export const masterDataService = {
  list: () => masterDataRepository.list(),

  async getById(id: string) {
    const screen = await masterDataRepository.findById(id);
    if (!screen) throw notFound('Screen');
    return screen;
  },

  async createScreen(input: CreateScreenInput) {
    if (await masterDataRepository.findByCode(input.code)) throw conflict('A screen with this code already exists');
    return masterDataRepository.createScreen(input);
  },

  async deleteScreen(id: string) {
    await this.getById(id);
    await masterDataRepository.deleteScreen(id);
  },

  async createView(screenId: string, input: CreateViewInput) {
    const screen = await this.getById(screenId);
    if (screen.views.some((view) => view.code === input.code)) {
      throw conflict('A view with this code already exists on this screen');
    }
    const updated = await masterDataRepository.createView(screenId, input);
    if (!updated) throw notFound('Screen');
    return updated;
  },

  async deleteView(screenId: string, viewId: string) {
    const screen = await this.getById(screenId);
    if (!screen.views.some((view) => view.id === viewId)) throw notFound('View');
    await masterDataRepository.deleteView(viewId);
  },

  async assignScreens(userId: string, input: AssignScreensInput) {
    await usersApi.getById(userId);
    const screenIds = [...new Set(input.screenIds)];
    const found = await masterDataRepository.countByIds(screenIds);
    if (found !== screenIds.length) throw badRequest('One or more screens do not exist');
    await masterDataRepository.replaceUserScreens(userId, screenIds);
    return masterDataRepository.list();
  },
};
