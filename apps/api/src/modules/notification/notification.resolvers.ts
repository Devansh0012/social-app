import { userWithCollege, type GqlContext } from '../../graphql/context.js';
import { notificationService } from './notification.service.js';

interface ListArgs {
  unreadOnly?: boolean | null;
  limit?: number | null;
}
interface IdArgs {
  id: string;
}

export const notificationResolvers = {
  Query: {
    async notifications(_p: unknown, args: ListArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return notificationService.list(viewer.id, {
        unreadOnly: args.unreadOnly ?? false,
        limit: args.limit ?? undefined,
      });
    },
    async unreadNotificationCount(_p: unknown, _a: unknown, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return notificationService.unreadCount(viewer.id);
    },
  },
  Mutation: {
    async markNotificationRead(_p: unknown, args: IdArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return notificationService.markRead(viewer.id, args.id);
    },
    async markAllNotificationsRead(_p: unknown, _a: unknown, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return notificationService.markAllRead(viewer.id);
    },
  },
  Notification: {
    async actor(parent: { actorId: string | null }, _a: unknown, ctx: GqlContext) {
      if (!parent.actorId) return null;
      return userWithCollege(ctx.prisma, parent.actorId);
    },
  },
};
