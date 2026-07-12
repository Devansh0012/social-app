import slugify from 'slugify';
import { z } from 'zod';
import type { Prisma, ReportTargetType, Role, UserStatus } from '@prisma/client';
import { prisma } from '../../core/prisma.js';
import { Conflict, NotFound, Validation, parseOrThrow } from '../../core/errors.js';
import { hashPassword } from '../../core/auth/password.js';
import {
  buildConnection,
  decodeCursor,
  PaginationInput,
} from '../../core/pagination.js';

/* ----------------------------------------------------------- schemas */

const CreateUserSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(80),
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/u)
    .optional(),
  collegeId: z.string().cuid(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  emailVerified: z.boolean().optional(),
});

const CreateCollegeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  domain: z.string().trim().min(3).max(255).toLowerCase(),
  country: z.string().trim().max(8).optional(),
});

const UpdateCollegeSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  domain: z.string().trim().min(3).max(255).toLowerCase().optional(),
  country: z.string().trim().max(8).nullable().optional(),
});

/* =================================================================== */

export class AdminService {
  /* ---------------------------------------------------- moderation */
  async banUser(userId: string, _reason: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw NotFound('User not found');
    return prisma.user.update({ where: { id: userId }, data: { status: 'BANNED' } });
  }

  async unbanUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw NotFound('User not found');
    return prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
  }

  async removePost(postId: string) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw NotFound('Post not found');
    return prisma.$transaction(async (tx) => {
      const removed = await tx.post.update({
        where: { id: postId },
        data: { removedByAdmin: true, deletedAt: new Date() },
      });
      // Keep the community's denormalized counter in sync, same as post.delete.
      if (post.communityId && !post.deletedAt) {
        await tx.community.update({
          where: { id: post.communityId },
          data: { postCount: { decrement: 1 } },
        });
      }
      return removed;
    });
  }

  /* -------------------------------------------------------- reports */
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

  /* ------------------------------------------------------ analytics */
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

  /* =================================================================
     User management
     ================================================================= */

  async listUsers(args: {
    status?: UserStatus | null;
    search?: string | null;
    first?: number;
    after?: string | null;
  }) {
    const pag = PaginationInput.parse({ first: args.first ?? 25, after: args.after ?? null });
    const cursor = decodeCursor(pag.after);

    const where: Prisma.UserWhereInput = {
      ...(args.status ? { status: args.status } : {}),
      ...(args.search
        ? {
            OR: [
              { email: { contains: args.search, mode: 'insensitive' } },
              { username: { contains: args.search, mode: 'insensitive' } },
              { fullName: { contains: args.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.at) } },
              { createdAt: new Date(cursor.at), id: { lt: cursor.id } },
            ],
          }
        : {}),
    };

    const [rows, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { college: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: pag.first + 1,
      }),
      prisma.user.count({
        where: {
          ...(args.status ? { status: args.status } : {}),
          ...(args.search
            ? {
                OR: [
                  { email: { contains: args.search, mode: 'insensitive' } },
                  { username: { contains: args.search, mode: 'insensitive' } },
                  { fullName: { contains: args.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
      }),
    ]);

    const conn = buildConnection(rows, pag.first, (u) => ({
      at: u.createdAt.toISOString(),
      id: u.id,
    }));
    return { ...conn, totalCount };
  }

  async verifyUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw NotFound('User not found');
    return prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        isVerifiedStudent: true,
        status: user.status === 'BANNED' ? 'BANNED' : 'ACTIVE',
      },
      include: { college: true },
    });
  }

  async setUserRole(userId: string, role: Role) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw NotFound('User not found');
    return prisma.user.update({
      where: { id: userId },
      data: { role },
      include: { college: true },
    });
  }

  async createUser(rawInput: unknown) {
    const input = parseOrThrow(CreateUserSchema, rawInput, 'Invalid input');
    const email = input.email.toLowerCase();

    const college = await prisma.college.findUnique({ where: { id: input.collegeId } });
    if (!college) throw NotFound('College not found');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw Conflict('A user with that email already exists.');

    const username = await this.ensureUniqueUsername(input.username ?? input.fullName, email);
    const passwordHash = await hashPassword(input.password);

    return prisma.user.create({
      data: {
        email,
        username,
        fullName: input.fullName,
        passwordHash,
        collegeId: college.id,
        status: 'ACTIVE',
        emailVerified: input.emailVerified ?? true,
        isVerifiedStudent: input.emailVerified ?? true,
        onboardingCompleted: false,
        role: input.role ?? 'USER',
      },
      include: { college: true },
    });
  }

  /* =================================================================
     College management
     ================================================================= */

  async listColleges(search: string | null | undefined) {
    return prisma.college.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { domain: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });
  }

  async createCollege(rawInput: unknown) {
    const input = parseOrThrow(CreateCollegeSchema, rawInput, 'Invalid input');
    try {
      return await prisma.college.create({
        data: {
          name: input.name,
          domain: input.domain,
          country: input.country ?? null,
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw Conflict('A college with that name or domain already exists.');
      }
      throw err;
    }
  }

  async updateCollege(id: string, rawInput: unknown) {
    const input = parseOrThrow(UpdateCollegeSchema, rawInput, 'Invalid input');
    const existing = await prisma.college.findUnique({ where: { id } });
    if (!existing) throw NotFound('College not found');
    try {
      return await prisma.college.update({
        where: { id },
        data: {
          name: input.name,
          domain: input.domain,
          country: input.country,
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw Conflict('A college with that name or domain already exists.');
      }
      throw err;
    }
  }

  async deleteCollege(id: string) {
    const userCount = await prisma.user.count({ where: { collegeId: id } });
    if (userCount > 0) {
      throw Conflict(
        `Cannot delete: ${userCount} user(s) still belong to this college. Move them first.`,
      );
    }
    await prisma.college.delete({ where: { id } });
    return true;
  }

  /* ------------------------------------------------------------- */

  private async ensureUniqueUsername(seed: string, email: string): Promise<string> {
    const base =
      slugify(seed || email.split('@')[0] || 'user', { lower: true, strict: true }).slice(0, 18) ||
      'user';
    let candidate = base;
    for (let i = 0; i < 20; i++) {
      const exists = await prisma.user.findUnique({ where: { username: candidate } });
      if (!exists) return candidate;
      candidate = `${base}${Math.floor(Math.random() * 9999)}`;
    }
    throw Conflict('Could not generate a unique username — please specify one.');
  }
}

export const adminService = new AdminService();
