import type { GqlContext } from '../../graphql/context.js';
import { adminService } from './admin.service.js';

interface ListReportsArgs {
  status?: 'OPEN' | 'RESOLVED' | 'DISMISSED' | null;
}
interface BanArgs {
  userId: string;
  reason: string;
}
interface UnbanArgs {
  userId: string;
}
interface RemovePostArgs {
  postId: string;
}
interface CreateReportArgs {
  input: {
    targetType: 'POST' | 'COMMENT' | 'USER' | 'COMMUNITY';
    targetId: string;
    reason: string;
  };
}
interface ResolveReportArgs {
  id: string;
  resolution: string;
  status: 'RESOLVED' | 'DISMISSED';
}

export const adminResolvers = {
  Query: {
    async reports(_p: unknown, args: ListReportsArgs, ctx: GqlContext) {
      ctx.requireAdmin();
      return adminService.listReports(args.status ?? null);
    },
    async analyticsSummary(_p: unknown, _a: unknown, ctx: GqlContext) {
      ctx.requireAdmin();
      return adminService.analyticsSummary();
    },
  },
  Mutation: {
    async banUser(_p: unknown, args: BanArgs, ctx: GqlContext) {
      ctx.requireAdmin();
      return adminService.banUser(args.userId, args.reason);
    },
    async unbanUser(_p: unknown, args: UnbanArgs, ctx: GqlContext) {
      ctx.requireAdmin();
      return adminService.unbanUser(args.userId);
    },
    async removePost(_p: unknown, args: RemovePostArgs, ctx: GqlContext) {
      ctx.requireAdmin();
      return adminService.removePost(args.postId);
    },
    async createReport(_p: unknown, args: CreateReportArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return adminService.createReport(viewer.id, args.input);
    },
    async resolveReport(_p: unknown, args: ResolveReportArgs, ctx: GqlContext) {
      ctx.requireAdmin();
      return adminService.resolveReport(args.id, args.resolution, args.status);
    },
  },
};
