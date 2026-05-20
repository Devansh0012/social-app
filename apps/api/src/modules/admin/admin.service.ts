import type { ReportTargetType } from '@prisma/client';
import { prisma } from '../../core/prisma.js';
import { NotFound, Validation } from '../../core/errors.js';

export class AdminService {
  async banUser(userId: string, reason: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw NotFound('User not found');
    return prisma.user.update({
      where: { id: userId },
      data: { status: 'BANNED' },
    });
  }

  async unbanUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw NotFound('User not found');
    return prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
  }

  async removePost(postId: string) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw NotFound('Post not found');
    return prisma.post.update({
      where: { id: postId },
      data: { removedByAdmin: true, deletedAt: new Date() },
    });
  }

  async listReports(status: 'OPEN' | 'RESOLVED' | 'DISMISSED' | null) {
    return prisma.report.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createReport(reporterId: string, args: {
    targetType: ReportTargetType;
    targetId: string;
    reason: string;
  }) {
    if (!args.reason.trim()) throw Validation('A reason is required');
    let targetUserId: string | null = null;
    if (args.targetType === 'USER') targetUserId = args.targetId;
    if (args.targetType === 'POST') {
      const post = await prisma.post.findUnique({ where: { id: args.targetId } });
      targetUserId = post?.authorId ?? null;
    }
    if (args.targetType === 'COMMENT') {
      const comment = await prisma.comment.findUnique({ where: { id: args.targetId } });
      targetUserId = comment?.authorId ?? null;
    }
    return prisma.report.create({
      data: {
        reporterId,
        targetType: args.targetType,
        targetId: args.targetId,
        targetUserId,
        reason: args.reason,
      },
    });
  }

  async resolveReport(id: string, resolution: string, status: 'RESOLVED' | 'DISMISSED') {
    return prisma.report.update({
      where: { id },
      data: { status, resolvedAt: new Date(), resolution },
    });
  }

  async analyticsSummary() {
    const [users, posts, communities, studyMaterials, openReports, eventsLast7d] = await Promise.all([
      prisma.user.count(),
      prisma.post.count({ where: { deletedAt: null, removedByAdmin: false } }),
      prisma.community.count({ where: { deletedAt: null } }),
      prisma.studyMaterial.count({ where: { deletedAt: null } }),
      prisma.report.count({ where: { status: 'OPEN' } }),
      prisma.analyticsEvent.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
      }),
    ]);
    return { users, posts, communities, studyMaterials, openReports, eventsLast7d };
  }
}

export const adminService = new AdminService();
