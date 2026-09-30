import type { AppModule } from '../../shared/module';
import { usersRouter } from './users.routes';
import { usersService } from './users.service';

export const usersModule: AppModule = {
  name: 'users',
  basePath: 'users',
  router: usersRouter,
};

/** Public API for other modules. */
export const usersApi = {
  getById: usersService.getById.bind(usersService),
  findByEmailWithHash: usersService.findByEmailWithHash,
};
