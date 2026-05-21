import { prisma } from '../../core/prisma.js';
import { BadRequest, NotFound } from '../../core/errors.js';
import { eventBus } from '../../core/events/event-bus.js';
import {
  buildConnection,
  decodeCursor,
  PaginationInput,
} from '../../core/pagination.js';

export class FollowService {
  async follow(followerId: string, followedUsername: string) {
    if (!followedUsername) throw BadRequest('Missing target username');
    const target = await prisma.user.findUnique({
      where: { username: followedUsername.toLowerCase() },
    });
    if (!target) throw NotFound('User not found');
    if (target.id === followerId) throw BadRequest('You cannot follow yourself.');

    try {
      await prisma.follow.create({
        data: { followerId, followingId: target.id },
      });
      eventBus.emit('user.followed', { followerId, followedId: target.id });
    } catch (err) {
      // Idempotent: already following
      if ((err as { code?: string }).code !== 'P2002') throw err;
    }
    return target;
  }

  async unfollow(followerId: string, followedUsername: string) {
    const target = await prisma.user.findUnique({
      where: { username: followedUsername.toLowerCase() },
    });
    if (!target) throw NotFound('User not found');

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId: target.id } },
    });
    if (!existing) return target;

    await prisma.follow.delete({
      where: { followerId_followingId: { followerId, followingId: target.id } },
    });
    eventBus.emit('user.unfollowed', { followerId, followedId: target.id });
    return target;
  }

  async isFollowing(viewerId: string | null, userId: string): Promise<boolean> {
    if (!viewerId || viewerId === userId) return false;
    const row = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: userId } },
    });
    return Boolean(row);
  }

  async followerCount(userId: string) {
    return prisma.follow.count({ where: { followingId: userId } });
  }

  async followingCount(userId: string) {
    return prisma.follow.count({ where: { followerId: userId } });
  }

  async listFollowers(userId: string, args: { first?: number; after?: string | null }) {
    return this.listSocial({
      whereField: 'followingId',
      pickField: 'followerId',
      userId,
      args,
    });
  }

  async listFollowing(userId: string, args: { first?: number; after?: string | null }) {
    return this.listSocial({
      whereField: 'followerId',
      pickField: 'followingId',
      userId,
      args,
    });
  }

  /** IDs of users this viewer follows — used by the feed ranker / FOLLOWING feed. */
  async followingIds(viewerId: string): Promise<string[]> {
    const rows = await prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });
    return rows.map((r) => r.followingId);
  }

  private async listSocial(opts: {
    whereField: 'followerId' | 'followingId';
    pickField: 'followerId' | 'followingId';
    userId: string;
    args: { first?: number; after?: string | null };
  }) {
    const pag = PaginationInput.parse({
      first: opts.args.first ?? 25,
      after: opts.args.after ?? null,
    });
    const cursor = decodeCursor(pag.after);

    const rows = await prisma.follow.findMany({
      where: {
        [opts.whereField]: opts.userId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.at) } },
                {
                  createdAt: new Date(cursor.at),
                  [opts.pickField]: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      include: {
        follower: { include: { college: true } },
        following: { include: { college: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { [opts.pickField]: 'desc' }],
      take: pag.first + 1,
    });

    const conn = buildConnection(rows, pag.first, (r) => ({
      at: r.createdAt.toISOString(),
      id: opts.pickField === 'followerId' ? r.followerId : r.followingId,
    }));
    return {
      ...conn,
      nodes: conn.nodes.map((r) => (opts.pickField === 'followerId' ? r.follower : r.following)),
    };
  }
}

export const followService = new FollowService();
