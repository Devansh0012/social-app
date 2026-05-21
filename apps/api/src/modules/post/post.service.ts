import { z } from 'zod';
import type { PostType, Prisma } from '@prisma/client';
import { prisma } from '../../core/prisma.js';
import { Forbidden, NotFound, Validation } from '../../core/errors.js';
import { eventBus } from '../../core/events/event-bus.js';
import {
  buildConnection,
  decodeCursor,
  PaginationInput,
  type Connection,
} from '../../core/pagination.js';
import { rankedFeed } from './ranker.js';

const PostBase = z.object({
  communityId: z.string().cuid().nullish(),
  title: z.string().trim().max(160).optional(),
  body: z.string().max(20000).optional(),
  linkUrl: z.string().url().optional(),
  imageUrls: z.array(z.string().url()).max(4).optional(),
  tags: z.array(z.string().max(30)).max(8).optional(),
});

const CollabSchema = z.object({
  projectTitle: z.string().trim().min(3).max(120),
  requiredSkills: z.array(z.string().max(40)).min(1).max(15),
  projectType: z.enum(['HACKATHON', 'PROJECT', 'RESEARCH', 'STARTUP']),
  duration: z.enum(['SHORT', 'MEDIUM', 'LONG', 'ONGOING']),
  teamSize: z.number().int().min(2).max(50),
  locationType: z.enum(['REMOTE', 'IN_PERSON', 'HYBRID']),
  openSlots: z.number().int().min(1).max(50),
});

const CreatePostSchema = z.discriminatedUnion('type', [
  PostBase.extend({ type: z.literal('TEXT'), body: z.string().min(1).max(2000) }),
  PostBase.extend({ type: z.literal('MARKDOWN'), body: z.string().min(1).max(20000) }),
  PostBase.extend({
    type: z.literal('IMAGE'),
    imageUrls: z.array(z.string().url()).min(1).max(4),
  }),
  PostBase.extend({ type: z.literal('LINK'), linkUrl: z.string().url() }),
  PostBase.extend({ type: z.literal('COLLAB'), collab: CollabSchema }),
]);

const CommentSchema = z.object({
  postId: z.string().cuid(),
  parentId: z.string().cuid().nullish(),
  body: z.string().trim().min(1).max(2000),
});

const UpdatePostSchema = z.object({
  title: z.string().trim().max(160).nullable().optional(),
  body: z.string().max(20000).nullable().optional(),
  linkUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string().max(30)).max(8).optional(),
});

const UpdateCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

const CollabApplySchema = z.object({
  postId: z.string().cuid(),
  message: z.string().trim().min(10).max(1000),
});

export type FeedKind = 'GLOBAL' | 'TRENDING' | 'FOLLOWING' | 'COMMUNITY' | 'PERSONALIZED';

export class PostService {
  /* ----------------------------------------------------------- create */
  async create(authorId: string, rawInput: unknown) {
    const parsed = CreatePostSchema.safeParse(rawInput);
    if (!parsed.success) throw Validation('Invalid post input', parsed.error.flatten());
    const input = parsed.data;

    if (input.communityId) {
      const member = await prisma.communityMember.findUnique({
        where: { userId_communityId: { userId: authorId, communityId: input.communityId } },
      });
      if (!member) throw Forbidden('Join the community before posting in it.');
    }

    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          authorId,
          communityId: input.communityId ?? null,
          type: input.type as PostType,
          title: input.title,
          body: input.type === 'IMAGE' || input.type === 'LINK' ? input.body ?? null : input.body,
          linkUrl: input.type === 'LINK' ? input.linkUrl : null,
          imageUrls: input.type === 'IMAGE' ? input.imageUrls : [],
          tags: input.tags ?? [],
        },
      });

      if (input.type === 'COLLAB') {
        await tx.collabPost.create({
          data: {
            postId: created.id,
            projectTitle: input.collab.projectTitle,
            requiredSkills: input.collab.requiredSkills,
            projectType: input.collab.projectType,
            duration: input.collab.duration,
            teamSize: input.collab.teamSize,
            locationType: input.collab.locationType,
            openSlots: input.collab.openSlots,
          },
        });
      }

      if (input.communityId) {
        await tx.community.update({
          where: { id: input.communityId },
          data: { postCount: { increment: 1 } },
        });
      }

      return created;
    });

    eventBus.emit('post.created', {
      postId: post.id,
      authorId,
      communityId: input.communityId ?? null,
    });
    return post;
  }

  /* ---------------------------------------------------- fetch single */
  async getById(id: string, viewerId: string | null) {
    const post = await prisma.post.findUnique({
      where: { id },
      include: { collab: true },
    });
    if (!post || post.deletedAt || post.removedByAdmin) throw NotFound('Post not found');

    if (viewerId !== post.authorId) {
      eventBus.emit('post.viewed', { postId: post.id, actorId: viewerId });
    }
    return post;
  }

  /* ---------------------------------------------------------- feed */
  async feed(args: {
    kind: FeedKind;
    communityId?: string | null;
    viewerId: string | null;
    first?: number;
    after?: string | null;
  }): Promise<Connection<{ id: string; publishedAt: Date; hotScore: number }>> {
    const pag = PaginationInput.parse({ first: args.first ?? 20, after: args.after ?? null });
    const cursor = decodeCursor(pag.after);

    const baseWhere: Prisma.PostWhereInput = {
      deletedAt: null,
      removedByAdmin: false,
    };

    let orderBy: Prisma.PostOrderByWithRelationInput[];
    let cursorWhere: Prisma.PostWhereInput | null = null;

    switch (args.kind) {
      case 'TRENDING':
        orderBy = [{ hotScore: 'desc' }, { id: 'desc' }];
        if (cursor)
          cursorWhere = {
            OR: [
              { hotScore: { lt: Number(cursor.at) } },
              { hotScore: Number(cursor.at), id: { lt: cursor.id } },
            ],
          };
        break;

      case 'COMMUNITY':
        if (!args.communityId) throw Validation('communityId required for COMMUNITY feed');
        baseWhere.communityId = args.communityId;
        orderBy = [{ publishedAt: 'desc' }, { id: 'desc' }];
        if (cursor)
          cursorWhere = {
            OR: [
              { publishedAt: { lt: new Date(cursor.at) } },
              { publishedAt: new Date(cursor.at), id: { lt: cursor.id } },
            ],
          };
        break;

      case 'PERSONALIZED':
      case 'FOLLOWING': {
        // For PERSONALIZED first page (no cursor) we run the X-inspired
        // ranker. Subsequent pages (and the FOLLOWING feed) fall back to a
        // chronological view of communities the viewer is in.
        if (args.kind === 'PERSONALIZED' && args.viewerId && !cursor) {
          const ranked = await rankedFeed(prisma, args.viewerId, pag.first, new Set());
          return buildConnection(ranked, pag.first, (p) => ({
            at: p.publishedAt.toISOString(),
            id: p.id,
          }));
        }
        if (args.viewerId) {
          const [memberships, follows] = await Promise.all([
            prisma.communityMember.findMany({
              where: { userId: args.viewerId },
              select: { communityId: true },
            }),
            prisma.follow.findMany({
              where: { followerId: args.viewerId },
              select: { followingId: true },
            }),
          ]);
          const communityIds = memberships.map((m) => m.communityId);
          const followedIds = follows.map((f) => f.followingId);
          const ors: Prisma.PostWhereInput[] = [{ authorId: args.viewerId }];
          if (communityIds.length) ors.push({ communityId: { in: communityIds } });
          if (followedIds.length) ors.push({ authorId: { in: followedIds } });
          baseWhere.OR = ors;
        }
        orderBy = [{ publishedAt: 'desc' }, { id: 'desc' }];
        if (cursor)
          cursorWhere = {
            OR: [
              { publishedAt: { lt: new Date(cursor.at) } },
              { publishedAt: new Date(cursor.at), id: { lt: cursor.id } },
            ],
          };
        break;
      }

      case 'GLOBAL':
      default:
        orderBy = [{ publishedAt: 'desc' }, { id: 'desc' }];
        if (cursor)
          cursorWhere = {
            OR: [
              { publishedAt: { lt: new Date(cursor.at) } },
              { publishedAt: new Date(cursor.at), id: { lt: cursor.id } },
            ],
          };
        break;
    }

    const where: Prisma.PostWhereInput = cursorWhere
      ? { AND: [baseWhere, cursorWhere] }
      : baseWhere;

    const rows = await prisma.post.findMany({
      where,
      orderBy,
      take: pag.first + 1,
    });

    return buildConnection(rows, pag.first, (p) => ({
      at: args.kind === 'TRENDING' ? String(p.hotScore) : p.publishedAt.toISOString(),
      id: p.id,
    }));
  }

  /* ---------------------------------------------------------- like */
  async like(viewerId: string, postId: string) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw NotFound('Post not found');

    try {
      await prisma.$transaction([
        prisma.postLike.create({ data: { userId: viewerId, postId } }),
        prisma.post.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 }, hotScore: { increment: 1 } },
        }),
      ]);
      eventBus.emit('post.liked', { postId, postAuthorId: post.authorId, actorId: viewerId });
    } catch (err) {
      // unique-violation = already liked → idempotent
      if ((err as { code?: string }).code !== 'P2002') throw err;
    }
    return prisma.post.findUnique({ where: { id: postId } });
  }

  async unlike(viewerId: string, postId: string) {
    const existing = await prisma.postLike.findUnique({
      where: { userId_postId: { userId: viewerId, postId } },
    });
    if (!existing) return prisma.post.findUnique({ where: { id: postId } });

    await prisma.$transaction([
      prisma.postLike.delete({ where: { userId_postId: { userId: viewerId, postId } } }),
      prisma.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 }, hotScore: { decrement: 1 } },
      }),
    ]);
    eventBus.emit('post.unliked', { postId, actorId: viewerId });
    return prisma.post.findUnique({ where: { id: postId } });
  }

  /* ---------------------------------------------------- bookmark */
  async bookmark(viewerId: string, postId: string) {
    try {
      await prisma.$transaction([
        prisma.bookmark.create({ data: { userId: viewerId, postId } }),
        prisma.post.update({ where: { id: postId }, data: { bookmarkCount: { increment: 1 } } }),
      ]);
      eventBus.emit('post.bookmarked', { postId, actorId: viewerId });
    } catch (err) {
      if ((err as { code?: string }).code !== 'P2002') throw err;
    }
    return prisma.post.findUnique({ where: { id: postId } });
  }

  async unbookmark(viewerId: string, postId: string) {
    const existing = await prisma.bookmark.findUnique({
      where: { userId_postId: { userId: viewerId, postId } },
    });
    if (!existing) return prisma.post.findUnique({ where: { id: postId } });
    await prisma.$transaction([
      prisma.bookmark.delete({ where: { userId_postId: { userId: viewerId, postId } } }),
      prisma.post.update({ where: { id: postId }, data: { bookmarkCount: { decrement: 1 } } }),
    ]);
    return prisma.post.findUnique({ where: { id: postId } });
  }

  /* ------------------------------------------------------ share/view */
  async share(viewerId: string, postId: string) {
    const post = await prisma.post.update({
      where: { id: postId },
      data: { shareCount: { increment: 1 } },
    });
    eventBus.emit('post.shared', { postId, actorId: viewerId });
    return post;
  }

  /* ----------------------------------------------------- comments */
  async addComment(authorId: string, rawInput: unknown) {
    const parsed = CommentSchema.safeParse(rawInput);
    if (!parsed.success) throw Validation('Invalid comment input', parsed.error.flatten());

    const post = await prisma.post.findUnique({ where: { id: parsed.data.postId } });
    if (!post || post.deletedAt) throw NotFound('Post not found');

    let parentAuthorId: string | null = null;
    if (parsed.data.parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parsed.data.parentId } });
      if (!parent || parent.postId !== post.id) throw NotFound('Parent comment not found');
      parentAuthorId = parent.authorId;
    }

    const result = await prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          authorId,
          postId: post.id,
          parentId: parsed.data.parentId ?? null,
          body: parsed.data.body,
        },
      });
      await tx.post.update({
        where: { id: post.id },
        data: { commentCount: { increment: 1 } },
      });
      return comment;
    });

    eventBus.emit('comment.created', {
      commentId: result.id,
      postId: post.id,
      postAuthorId: post.authorId,
      parentAuthorId,
      actorId: authorId,
    });
    return result;
  }

  async listComments(postId: string) {
    return prisma.comment.findMany({
      where: { postId, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  /* ---------------------------------------------------- collab apply */
  async applyToCollab(applicantId: string, rawInput: unknown) {
    const parsed = CollabApplySchema.safeParse(rawInput);
    if (!parsed.success) throw Validation('Invalid application', parsed.error.flatten());

    const collab = await prisma.collabPost.findUnique({
      where: { postId: parsed.data.postId },
      include: { post: true },
    });
    if (!collab) throw NotFound('Collaboration post not found');
    if (collab.isClosed) throw Forbidden('Applications are closed.');
    if (collab.post.authorId === applicantId)
      throw Forbidden('You cannot apply to your own collab.');

    const application = await prisma.collabApplication.create({
      data: {
        collabPostId: parsed.data.postId,
        applicantId,
        message: parsed.data.message,
      },
    });

    eventBus.emit('collab.applied', {
      postId: parsed.data.postId,
      collabOwnerId: collab.post.authorId,
      applicantId,
      applicationId: application.id,
    });
    return application;
  }

  async listMyCollabApplications(applicantId: string) {
    return prisma.collabApplication.findMany({
      where: { applicantId },
      orderBy: { createdAt: 'desc' },
      include: { collabPost: { include: { post: true } } },
    });
  }

  async listApplicationsForPost(viewerId: string, postId: string) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.authorId !== viewerId) throw Forbidden();
    return prisma.collabApplication.findMany({
      where: { collabPostId: postId },
      orderBy: { createdAt: 'desc' },
      include: { applicant: { include: { college: true } } },
    });
  }

  async respondToApplication(
    viewerId: string,
    applicationId: string,
    decision: 'ACCEPTED' | 'REJECTED',
  ) {
    const app = await prisma.collabApplication.findUnique({
      where: { id: applicationId },
      include: { collabPost: { include: { post: true } } },
    });
    if (!app) throw NotFound('Application not found');
    if (app.collabPost.post.authorId !== viewerId) throw Forbidden();

    const updated = await prisma.collabApplication.update({
      where: { id: applicationId },
      data: { status: decision },
    });
    eventBus.emit('collab.responded', {
      applicationId,
      applicantId: app.applicantId,
      decidedById: viewerId,
      decision,
    });
    return updated;
  }

  /* ------------------------------------------------ edit / delete */
  async update(viewerId: string, postId: string, rawInput: unknown) {
    const parsed = UpdatePostSchema.safeParse(rawInput);
    if (!parsed.success) throw Validation('Invalid input', parsed.error.flatten());

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt || post.removedByAdmin) throw NotFound('Post not found');
    if (post.authorId !== viewerId) throw Forbidden('You can only edit your own posts.');

    return prisma.post.update({
      where: { id: postId },
      data: {
        title: parsed.data.title === null ? null : parsed.data.title,
        body: parsed.data.body === null ? null : parsed.data.body,
        linkUrl: parsed.data.linkUrl === null ? null : parsed.data.linkUrl,
        tags: parsed.data.tags,
      },
    });
  }

  async delete(viewerId: string, postId: string) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw NotFound('Post not found');
    if (post.authorId !== viewerId) throw Forbidden('You can only delete your own posts.');

    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: postId },
        data: { deletedAt: new Date() },
      });
      if (post.communityId) {
        await tx.community.update({
          where: { id: post.communityId },
          data: { postCount: { decrement: 1 } },
        });
      }
    });
    return true;
  }

  async updateComment(viewerId: string, commentId: string, rawInput: unknown) {
    const parsed = UpdateCommentSchema.safeParse(rawInput);
    if (!parsed.success) throw Validation('Invalid input', parsed.error.flatten());

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) throw NotFound('Comment not found');
    if (comment.authorId !== viewerId) throw Forbidden('You can only edit your own comments.');

    return prisma.comment.update({
      where: { id: commentId },
      data: { body: parsed.data.body },
    });
  }

  async deleteComment(viewerId: string, commentId: string) {
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.deletedAt) throw NotFound('Comment not found');
    if (comment.authorId !== viewerId) throw Forbidden('You can only delete your own comments.');

    await prisma.$transaction([
      prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } }),
      prisma.post.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 } },
      }),
    ]);
    return true;
  }

  /* -------------------------------------- user-content listings -- */
  async listByAuthor(authorId: string, args: { first?: number; after?: string | null }) {
    return this.paginatePosts(
      { authorId, deletedAt: null, removedByAdmin: false },
      args,
    );
  }

  async listCommentsByAuthor(authorId: string, args: { first?: number; after?: string | null }) {
    const pag = PaginationInput.parse({ first: args.first ?? 25, after: args.after ?? null });
    const cursor = decodeCursor(pag.after);

    const rows = await prisma.comment.findMany({
      where: {
        authorId,
        deletedAt: null,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.at) } },
                { createdAt: new Date(cursor.at), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pag.first + 1,
    });
    return buildConnection(rows, pag.first, (c) => ({
      at: c.createdAt.toISOString(),
      id: c.id,
    }));
  }

  async listLikedByViewer(viewerId: string, args: { first?: number; after?: string | null }) {
    const pag = PaginationInput.parse({ first: args.first ?? 25, after: args.after ?? null });
    const cursor = decodeCursor(pag.after);

    const rows = await prisma.postLike.findMany({
      where: {
        userId: viewerId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.at) } },
                { createdAt: new Date(cursor.at), postId: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: { post: true },
      orderBy: [{ createdAt: 'desc' }, { postId: 'desc' }],
      take: pag.first + 1,
    });
    const filtered = rows.filter((r) => r.post && !r.post.deletedAt && !r.post.removedByAdmin);
    const conn = buildConnection(filtered, pag.first, (r) => ({
      at: r.createdAt.toISOString(),
      id: r.postId,
    }));
    return { ...conn, nodes: conn.nodes.map((r) => r.post) };
  }

  async listBookmarkedByViewer(viewerId: string, args: { first?: number; after?: string | null }) {
    const pag = PaginationInput.parse({ first: args.first ?? 25, after: args.after ?? null });
    const cursor = decodeCursor(pag.after);

    const rows = await prisma.bookmark.findMany({
      where: {
        userId: viewerId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.at) } },
                { createdAt: new Date(cursor.at), postId: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: { post: true },
      orderBy: [{ createdAt: 'desc' }, { postId: 'desc' }],
      take: pag.first + 1,
    });
    const filtered = rows.filter((r) => r.post && !r.post.deletedAt && !r.post.removedByAdmin);
    const conn = buildConnection(filtered, pag.first, (r) => ({
      at: r.createdAt.toISOString(),
      id: r.postId,
    }));
    return { ...conn, nodes: conn.nodes.map((r) => r.post) };
  }

  private async paginatePosts(
    where: Prisma.PostWhereInput,
    args: { first?: number; after?: string | null },
  ): Promise<Connection<{ id: string; publishedAt: Date }>> {
    const pag = PaginationInput.parse({ first: args.first ?? 25, after: args.after ?? null });
    const cursor = decodeCursor(pag.after);
    const rows = await prisma.post.findMany({
      where: cursor
        ? {
            AND: [
              where,
              {
                OR: [
                  { publishedAt: { lt: new Date(cursor.at) } },
                  { publishedAt: new Date(cursor.at), id: { lt: cursor.id } },
                ],
              },
            ],
          }
        : where,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: pag.first + 1,
    });
    return buildConnection(rows, pag.first, (p) => ({
      at: p.publishedAt.toISOString(),
      id: p.id,
    }));
  }
}

export const postService = new PostService();
