import type { Post } from '@prisma/client';
import type { GqlContext } from '../../graphql/context.js';
import { postService, type FeedKind } from './post.service.js';
import { NotFound } from '../../core/errors.js';

interface IdArgs {
  id: string;
}
interface PostIdArgs {
  postId: string;
}
interface FeedArgs {
  kind: FeedKind;
  communityId?: string | null;
  first?: number | null;
  after?: string | null;
}
interface CreatePostArgs {
  input: Parameters<(typeof postService)['create']>[1];
}
interface CommentArgs {
  input: Parameters<(typeof postService)['addComment']>[1];
}
interface CollabApplyArgs {
  input: Parameters<(typeof postService)['applyToCollab']>[1];
}
interface RespondArgs {
  applicationId: string;
  decision: 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'WITHDRAWN';
}
interface UpdatePostArgs {
  postId: string;
  input: Parameters<(typeof postService)['update']>[2];
}
interface UpdateCommentArgs {
  commentId: string;
  body: string;
}
interface UsernamePagArgs {
  username: string;
  first?: number | null;
  after?: string | null;
}
interface MyPagArgs {
  first?: number | null;
  after?: string | null;
}

async function userIdByUsername(ctx: GqlContext, username: string): Promise<string> {
  const u = await ctx.prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true },
  });
  if (!u) throw NotFound('User not found');
  return u.id;
}

export const postResolvers = {
  Query: {
    async post(_p: unknown, args: IdArgs, ctx: GqlContext) {
      return postService.getById(args.id, ctx.viewer?.id ?? null);
    },
    async feed(_p: unknown, args: FeedArgs, ctx: GqlContext) {
      return postService.feed({
        kind: args.kind,
        communityId: args.communityId,
        viewerId: ctx.viewer?.id ?? null,
        first: args.first ?? undefined,
        after: args.after,
      });
    },
    async postComments(_p: unknown, args: PostIdArgs) {
      return postService.listComments(args.postId);
    },
    async myCollabApplications(_p: unknown, _a: unknown, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return postService.listMyCollabApplications(viewer.id);
    },
    async collabApplicationsForPost(_p: unknown, args: PostIdArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return postService.listApplicationsForPost(viewer.id, args.postId);
    },
    async userPosts(_p: unknown, args: UsernamePagArgs, ctx: GqlContext) {
      const userId = await userIdByUsername(ctx, args.username);
      return postService.listByAuthor(userId, {
        first: args.first ?? undefined,
        after: args.after,
      });
    },
    async userComments(_p: unknown, args: UsernamePagArgs, ctx: GqlContext) {
      const userId = await userIdByUsername(ctx, args.username);
      const conn = await postService.listCommentsByAuthor(userId, {
        first: args.first ?? undefined,
        after: args.after,
      });
      return conn.nodes;
    },
    async myLikedPosts(_p: unknown, args: MyPagArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return postService.listLikedByViewer(viewer.id, {
        first: args.first ?? undefined,
        after: args.after,
      });
    },
    async myBookmarkedPosts(_p: unknown, args: MyPagArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return postService.listBookmarkedByViewer(viewer.id, {
        first: args.first ?? undefined,
        after: args.after,
      });
    },
  },
  Mutation: {
    async createPost(_p: unknown, args: CreatePostArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return postService.create(viewer.id, args.input);
    },
    async likePost(_p: unknown, args: PostIdArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return postService.like(viewer.id, args.postId);
    },
    async unlikePost(_p: unknown, args: PostIdArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return postService.unlike(viewer.id, args.postId);
    },
    async bookmarkPost(_p: unknown, args: PostIdArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return postService.bookmark(viewer.id, args.postId);
    },
    async unbookmarkPost(_p: unknown, args: PostIdArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return postService.unbookmark(viewer.id, args.postId);
    },
    async sharePost(_p: unknown, args: PostIdArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return postService.share(viewer.id, args.postId);
    },
    async addComment(_p: unknown, args: CommentArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return postService.addComment(viewer.id, args.input);
    },
    async applyToCollab(_p: unknown, args: CollabApplyArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return postService.applyToCollab(viewer.id, args.input);
    },
    async respondToCollabApplication(_p: unknown, args: RespondArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      if (args.decision !== 'ACCEPTED' && args.decision !== 'REJECTED') {
        throw new Error('Decision must be ACCEPTED or REJECTED');
      }
      return postService.respondToApplication(viewer.id, args.applicationId, args.decision);
    },
    async updatePost(_p: unknown, args: UpdatePostArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return postService.update(viewer.id, args.postId, args.input);
    },
    async deletePost(_p: unknown, args: PostIdArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return postService.delete(viewer.id, args.postId);
    },
    async updateComment(_p: unknown, args: UpdateCommentArgs, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return postService.updateComment(viewer.id, args.commentId, { body: args.body });
    },
    async deleteComment(_p: unknown, args: { commentId: string }, ctx: GqlContext) {
      const viewer = ctx.requireViewer();
      return postService.deleteComment(viewer.id, args.commentId);
    },
  },
  Post: {
    async author(parent: Post, _a: unknown, ctx: GqlContext) {
      return ctx.prisma.user.findUnique({
        where: { id: parent.authorId },
        include: { college: true },
      });
    },
    async community(parent: Post, _a: unknown, ctx: GqlContext) {
      if (!parent.communityId) return null;
      return ctx.prisma.community.findUnique({ where: { id: parent.communityId } });
    },
    async collab(parent: Post, _a: unknown, ctx: GqlContext) {
      if (parent.type !== 'COLLAB') return null;
      return ctx.prisma.collabPost.findUnique({ where: { postId: parent.id } });
    },
    async viewerHasLiked(parent: Post, _a: unknown, ctx: GqlContext) {
      if (!ctx.viewer) return false;
      const like = await ctx.prisma.postLike.findUnique({
        where: { userId_postId: { userId: ctx.viewer.id, postId: parent.id } },
      });
      return Boolean(like);
    },
    async viewerHasBookmarked(parent: Post, _a: unknown, ctx: GqlContext) {
      if (!ctx.viewer) return false;
      const bm = await ctx.prisma.bookmark.findUnique({
        where: { userId_postId: { userId: ctx.viewer.id, postId: parent.id } },
      });
      return Boolean(bm);
    },
  },
  CollabDetails: {
    projectTitle: (p: { projectTitle: string }) => p.projectTitle,
  },
  Comment: {
    async author(parent: { authorId: string }, _a: unknown, ctx: GqlContext) {
      return ctx.prisma.user.findUnique({
        where: { id: parent.authorId },
        include: { college: true },
      });
    },
  },
  CollabApplication: {
    async applicant(parent: { applicantId: string }, _a: unknown, ctx: GqlContext) {
      return ctx.prisma.user.findUnique({
        where: { id: parent.applicantId },
        include: { college: true },
      });
    },
    async post(parent: { collabPostId: string }, _a: unknown, ctx: GqlContext) {
      return ctx.prisma.post.findUnique({ where: { id: parent.collabPostId } });
    },
  },
};
