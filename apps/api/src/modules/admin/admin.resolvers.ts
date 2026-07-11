import type { College, Role, UserStatus } from '@prisma/client';
import type { GqlContext } from '../../graphql/context.js';
import type { PaginationArgs } from '../../core/pagination.js';
import { adminService } from './admin.service.js';

interface ListReportsArgs {
  status?: 'OPEN' | 'RESOLVED' | 'DISMISSED' | null;
}
interface BanArgs {
  userId: string;
  reason: string;
}
interface UserIdArgs {
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

interface AdminUsersArgs extends PaginationArgs {
  status?: UserStatus | null;
  search?: string | null;
}
interface AdminCreateUserArgs {
  input: Parameters<(typeof adminService)['createUser']>[0];
}
interface SetRoleArgs {
  userId: string;
  role: Role;
}
interface AdminCollegeSearchArgs {
  search?: string | null;
}
interface AdminCreateCollegeArgs {
  input: Parameters<(typeof adminService)['createCollege']>[0];
}
interface AdminUpdateCollegeArgs {
  id: string;
  input: Parameters<(typeof adminService)['updateCollege']>[1];
}
interface AdminDeleteCollegeArgs {
  id: string;
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
    async adminUsers(_p: unknown, args: AdminUsersArgs, ctx: GqlContext) {
      ctx.requireAdmin();
      return adminService.listUsers({
        status: args.status ?? null,
        search: args.search ?? null,
        first: args.first ?? undefined,
        after: args.after ?? null,
      });
    },
    async adminColleges(_p: unknown, args: AdminCollegeSearchArgs, ctx: GqlContext) {
      ctx.requireAdmin();
      const rows = await adminService.listColleges(args.search ?? null);
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        domain: r.domain,
        country: r.country,
        createdAt: r.createdAt,
        userCount: r._count.users,
      }));
    },
  },
  Mutation: {
    async banUser(_p: unknown, args: BanArgs, ctx: GqlContext) {
      ctx.requireAdmin();
      return adminService.banUser(args.userId, args.reason);
    },
    async unbanUser(_p: unknown, args: UserIdArgs, ctx: GqlContext) {
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
    async adminCreateUser(_p: unknown, args: AdminCreateUserArgs, ctx: GqlContext) {
      ctx.requireAdmin();
      return adminService.createUser(args.input);
    },
    async adminVerifyUser(_p: unknown, args: UserIdArgs, ctx: GqlContext) {
      ctx.requireAdmin();
      return adminService.verifyUser(args.userId);
    },
    async adminSetUserRole(_p: unknown, args: SetRoleArgs, ctx: GqlContext) {
      ctx.requireAdmin();
      return adminService.setUserRole(args.userId, args.role);
    },
    async adminCreateCollege(_p: unknown, args: AdminCreateCollegeArgs, ctx: GqlContext) {
      ctx.requireAdmin();
      return adminService.createCollege(args.input);
    },
    async adminUpdateCollege(_p: unknown, args: AdminUpdateCollegeArgs, ctx: GqlContext) {
      ctx.requireAdmin();
      return adminService.updateCollege(args.id, args.input);
    },
    async adminDeleteCollege(_p: unknown, args: AdminDeleteCollegeArgs, ctx: GqlContext) {
      ctx.requireAdmin();
      return adminService.deleteCollege(args.id);
    },
  },
  AdminUserView: {
    college(parent: { college: College | null }) {
      return parent.college;
    },
  },
};
