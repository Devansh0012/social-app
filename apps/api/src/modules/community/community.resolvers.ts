import type { Community } from '@prisma/client';
import type { GqlContext } from '../../graphql/context.js';
import type { PaginationArgs } from '../../core/pagination.js';
import { communityService } from './community.service.js';

interface SlugArgs {
  slug: string;
}
interface IdArgs {
  communityId: string;
}
interface ListArgs extends PaginationArgs {
  search?: string | null;
}
interface CreateArgs {
  input: Parameters<(typeof communityService)['create']>[1];
}
interface UpdateArgs extends IdArgs {
  input: Parameters<(typeof communityService)['update']>[2];
}

export const communityResolvers = {
  Query: {
    async community(_p: unknown, args: SlugArgs) {
      return communityService.getBySlug(args.slug);
    },
    async communities(_p: unknown, args: ListArgs) {
      return communityService.list({
        search: args.search,
        first: args.first ?? undefined,
        after: args.after ?? null,
      });
    },
    async myCommunities(_p: unknown, _a: unknown, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return communityService.listMine(viewer.id);
    },
  },
  Mutation: {
    async createCommunity(_p: unknown, args: CreateArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return communityService.create(viewer.id, args.input);
    },
    async updateCommunity(_p: unknown, args: UpdateArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return communityService.update(viewer.id, args.communityId, args.input);
    },
    async joinCommunity(_p: unknown, args: IdArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return communityService.join(viewer.id, args.communityId);
    },
    async leaveCommunity(_p: unknown, args: IdArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return communityService.leave(viewer.id, args.communityId);
    },
  },
  Community: {
    async viewerMembership(parent: Community, _a: unknown, ctx: GqlContext) {
      const m = await communityService.viewerMembership(ctx.viewer?.id ?? null, parent.id);
      return m ? { role: m.role, joinedAt: m.joinedAt } : null;
    },
    async creator(parent: Community, _a: unknown, ctx: GqlContext) {
      return ctx.prisma.user.findUnique({
        where: { id: parent.creatorId },
        include: { college: true },
      });
    },
  },
};
