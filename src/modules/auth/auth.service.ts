import bcrypt from 'bcryptjs';
import { unauthorized } from '../../shared/http/errors';
import { signToken, type AuthUser } from '../../shared/http/middleware/auth';
import { usersApi } from '../users';
import type { LoginInput } from './auth.schemas';

// No repository: auth owns no tables and reads users through the users module API.
export const authService = {
  async login({ email, password }: LoginInput) {
    const user = await usersApi.findByEmailWithHash(email);
    if (!user || !user.isActive) throw unauthorized('Invalid email or password');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw unauthorized('Invalid email or password');

    const authUser: AuthUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    return { token: signToken(authUser), user: authUser };
  },

  me: (userId: string) => usersApi.getById(userId),
};
