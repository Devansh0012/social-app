import type { GqlContext } from '../../graphql/context.js';
import { followService } from './follow.service.js';
import { NotFound } from '../../core/errors.js';

interface UsernameArgs {
  username: string;
}
interface ListArgs extends UsernameArgs {
  first?: number | null;
  after?: string | null;
}

async function userIdFromUsername(ctx: GqlContext, username: string): Promise<string> {
  const u = await ctx.prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true },
  });
  if (!u) throw NotFound('User not found');
  return u.id;
}

export const followResolvers = {
  Query: {
    async followers(_p: unknown, args: ListArgs, ctx: GqlContext) {
      const userId = await userIdFromUsername(ctx, args.username);
      return followService.listFollowers(userId, {
        first: args.first ?? undefined,
        after: args.after,
      });
    },
    async following(_p: unknown, args: ListArgs, ctx: GqlContext) {
      const userId = await userIdFromUsername(ctx, args.username);
      return followService.listFollowing(userId, {
        first: args.first ?? undefined,
        after: args.after,
      });
    },
  },
  Mutation: {
    async followUser(_p: unknown, args: UsernameArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return followService.follow(viewer.id, args.username);
    },
    async unfollowUser(_p: unknown, args: UsernameArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return followService.unfollow(viewer.id, args.username);
    },
  },
  PublicUser: {
    async followerCount(parent: { id: string }) {
      return followService.followerCount(parent.id);
    },
    async followingCount(parent: { id: string }) {
      return followService.followingCount(parent.id);
    },
    async viewerIsFollowing(parent: { id: string }, _a: unknown, ctx: GqlContext) {
      return followService.isFollowing(ctx.viewer?.id ?? null, parent.id);
    },
  },
};
