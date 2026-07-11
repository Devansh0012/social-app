import { userWithCollege, type GqlContext } from '../../graphql/context.js';
import { AuthService } from './auth.service.js';
import { NotFound } from '../../core/errors.js';

interface SignupArgs {
  input: { email: string; password: string; fullName: string; username?: string };
}
interface LoginArgs {
  input: { email: string; password: string };
}
interface RefreshArgs {
  refreshToken: string;
}
interface VerifyArgs {
  token: string;
}

const requestMeta = (ctx: GqlContext) => ({
  ip: ctx.request.ip,
  userAgent: ctx.request.headers['user-agent'] ?? null,
});

const toViewer = (user: Awaited<ReturnType<AuthService['signup']>>['user']) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  fullName: user.fullName,
  bio: user.bio,
  avatarUrl: user.avatarUrl,
  college: user.college,
  department: user.department,
  graduationYear: user.graduationYear,
  interests: user.interests,
  skills: user.skills,
  socialLinks: user.socialLinks,
  role: user.role,
  status: user.status,
  emailVerified: user.emailVerified,
  isVerifiedStudent: user.isVerifiedStudent,
  onboardingCompleted: user.onboardingCompleted,
  reputationScore: user.reputationScore,
  createdAt: user.createdAt,
});

export const authResolvers = {
  Query: {
    async me(_p: unknown, _a: unknown, ctx: GqlContext) {
      if (!ctx.viewer) return null;
      const user = await userWithCollege(ctx.prisma, ctx.viewer.id);
      return user ? toViewer(user) : null;
    },
  },
  Mutation: {
    async signup(_p: unknown, args: SignupArgs, ctx: GqlContext) {
      const service = new AuthService(ctx.app);
      const meta = requestMeta(ctx);
      const result = await service.signup(args.input, {
        ip: meta.ip,
        userAgent: meta.userAgent ?? undefined,
      });
      return {
        viewer: toViewer(result.user),
        tokens: result.tokens,
        verifyTokenDev: result.verifyTokenDev,
      };
    },
    async login(_p: unknown, args: LoginArgs, ctx: GqlContext) {
      const service = new AuthService(ctx.app);
      const meta = requestMeta(ctx);
      const result = await service.login(args.input, {
        ip: meta.ip,
        userAgent: meta.userAgent ?? undefined,
      });
      return { viewer: toViewer(result.user), tokens: result.tokens };
    },
    async refresh(_p: unknown, args: RefreshArgs, ctx: GqlContext) {
      const service = new AuthService(ctx.app);
      const meta = requestMeta(ctx);
      const result = await service.refresh(args.refreshToken, {
        ip: meta.ip,
        userAgent: meta.userAgent ?? undefined,
      });
      return { viewer: toViewer(result.user), tokens: result.tokens };
    },
    async verifyEmail(_p: unknown, args: VerifyArgs, ctx: GqlContext) {
      const service = new AuthService(ctx.app);
      const user = await service.verifyEmail(args.token);
      if (!user) throw NotFound('User not found after verification.');
      return toViewer(user);
    },
    async resendVerificationEmail(_p: unknown, _a: unknown, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      const service = new AuthService(ctx.app);
      return service.resendEmailVerification(viewer.id);
    },
    async logout(_p: unknown, _a: unknown, ctx: GqlContext) {
      // Refresh-token revocation happens on the next /refresh attempt.
      // With http-only refresh cookies we would clear it here.
      void ctx;
      return true;
    },
  },
};
