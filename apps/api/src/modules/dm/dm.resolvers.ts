import type { GqlContext } from '../../graphql/context.js';
import type { PaginationArgs } from '../../core/pagination.js';
import { dmService } from './dm.service.js';

interface OpenArgs {
  username: string;
}
interface IdArgs {
  id: string;
}
interface ConversationIdArgs {
  conversationId: string;
}
interface SendArgs extends ConversationIdArgs {
  body: string;
}
interface ListMessagesArgs extends ConversationIdArgs, PaginationArgs {}

export const dmResolvers = {
  Query: {
    async conversations(_p: unknown, _a: unknown, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return dmService.listConversations(viewer.id);
    },
    async conversation(_p: unknown, args: IdArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      const c = await dmService.getConversation(viewer.id, args.id);
      const others = c.participants.filter((p) => p.userId !== viewer.id).map((p) => p.user);
      const last = await ctx.prisma.directMessage.findFirst({
        where: { conversationId: c.id },
        orderBy: { createdAt: 'desc' },
        include: { author: { include: { college: true } } },
      });
      const me = c.participants.find((p) => p.userId === viewer.id);
      const unreadCount = await ctx.prisma.directMessage.count({
        where: {
          conversationId: c.id,
          authorId: { not: viewer.id },
          ...(me?.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}),
        },
      });
      return {
        id: c.id,
        createdAt: c.createdAt,
        lastMessageAt: c.lastMessageAt,
        otherParticipants: others,
        lastMessage: last,
        unreadCount,
      };
    },
    async messages(_p: unknown, args: ListMessagesArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      const conn = await dmService.listMessages(viewer.id, args.conversationId, {
        first: args.first ?? undefined,
        after: args.after,
      });
      // Reverse so the client renders oldest -> newest.
      return { ...conn, nodes: conn.nodes.slice().reverse() };
    },
    async unreadDMCount(_p: unknown, _a: unknown, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return dmService.unreadCount(viewer.id);
    },
  },
  Mutation: {
    async openConversation(_p: unknown, args: OpenArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      const c = await dmService.openConversation(viewer.id, args.username);
      const others = c.participants.filter((p) => p.userId !== viewer.id);
      const fullOthers = await ctx.prisma.user.findMany({
        where: { id: { in: others.map((o) => o.userId) } },
        include: { college: true },
      });
      return {
        id: c.id,
        createdAt: c.createdAt,
        lastMessageAt: c.lastMessageAt,
        otherParticipants: fullOthers,
        lastMessage: null,
        unreadCount: 0,
      };
    },
    async sendMessage(_p: unknown, args: SendArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return dmService.sendMessage(viewer.id, args.conversationId, args.body);
    },
    async markConversationRead(_p: unknown, args: ConversationIdArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return dmService.markRead(viewer.id, args.conversationId);
    },
  },
};
