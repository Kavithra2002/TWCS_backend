import { asyncHandler } from '../../shared/http/async-handler';
import { authService } from './auth.service';

export const authController = {
  login: asyncHandler(async (req, res) => {
    res.json(await authService.login(req.body));
  }),

  me: asyncHandler(async (req, res) => {
    res.json(await authService.me(req.user!.id));
  }),
};
