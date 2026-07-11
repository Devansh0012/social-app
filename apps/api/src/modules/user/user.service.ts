import { z } from 'zod';
import { prisma } from '../../core/prisma.js';
import { BadRequest, Conflict, NotFound, parseOrThrow } from '../../core/errors.js';

const UsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[a-zA-Z0-9_]+$/u, 'Use letters, numbers, or underscores only.');

const SocialLinksSchema = z
  .object({
    github: z.string().url().optional(),
    linkedin: z.string().url().optional(),
    twitter: z.string().url().optional(),
    website: z.string().url().optional(),
  })
  .strict();

export const UpdateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  username: UsernameSchema.optional(),
  bio: z.string().max(280).optional(),
  avatarUrl: z.string().url().optional(),
  department: z.string().max(80).optional(),
  graduationYear: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 8)
    .optional(),
  interests: z.array(z.string().max(40)).max(20).optional(),
  skills: z.array(z.string().max(40)).max(20).optional(),
  socialLinks: SocialLinksSchema.optional(),
});

export const CompleteOnboardingSchema = z.object({
  username: UsernameSchema,
  department: z.string().max(80),
  graduationYear: z.number().int().min(1900).max(new Date().getFullYear() + 8),
  interests: z.array(z.string().max(40)).min(1).max(20),
  skills: z.array(z.string().max(40)).max(20).optional(),
  bio: z.string().max(280).optional(),
});

export class UserService {
  async getMe(userId: string) {
    return prisma.user.findUnique({ where: { id: userId }, include: { college: true } });
  }

  async getByUsername(username: string) {
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: { college: true },
    });
    if (!user) return null;
    return user;
  }

  async updateProfile(userId: string, rawInput: unknown) {
    const input = parseOrThrow(UpdateProfileSchema, rawInput, 'Invalid profile input');

    if (input.username) {
      await this.assertUsernameFree(userId, input.username.toLowerCase());
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: input.fullName,
        username: input.username?.toLowerCase(),
        bio: input.bio,
        avatarUrl: input.avatarUrl,
        department: input.department,
        graduationYear: input.graduationYear,
        interests: input.interests,
        skills: input.skills,
        socialLinks: input.socialLinks ?? undefined,
      },
      include: { college: true },
    });
    return updated;
  }

  async completeOnboarding(userId: string, rawInput: unknown) {
    const input = parseOrThrow(CompleteOnboardingSchema, rawInput, 'Invalid onboarding input');

    const username = input.username.toLowerCase();
    await this.assertUsernameFree(userId, username);

    return prisma.user.update({
      where: { id: userId },
      data: {
        username,
        department: input.department,
        graduationYear: input.graduationYear,
        interests: input.interests,
        skills: input.skills ?? [],
        bio: input.bio,
        onboardingCompleted: true,
      },
      include: { college: true },
    });
  }

  /** Throw CONFLICT if `username` (already lowercased) belongs to another user. */
  private async assertUsernameFree(userId: string, username: string): Promise<void> {
    const taken = await prisma.user.findFirst({
      where: { username, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) throw Conflict('That username is taken.');
  }

  async listColleges(search: string | null | undefined) {
    return prisma.college.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
      take: 25,
    });
  }

  async checkUsername(username: string) {
    const parsed = UsernameSchema.safeParse(username);
    if (!parsed.success) throw BadRequest(parsed.error.errors[0]?.message ?? 'Invalid username');
    const existing = await prisma.user.findUnique({
      where: { username: parsed.data.toLowerCase() },
      select: { id: true },
    });
    return { available: !existing };
  }

  async getById(id: string) {
    const user = await prisma.user.findUnique({ where: { id }, include: { college: true } });
    if (!user) throw NotFound('User not found');
    return user;
  }
}

export const userService = new UserService();
