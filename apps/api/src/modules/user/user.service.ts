import { z } from 'zod';
import { prisma } from '../../core/prisma.js';
import { BadRequest, Conflict, NotFound, Validation } from '../../core/errors.js';

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
    const parsed = UpdateProfileSchema.safeParse(rawInput);
    if (!parsed.success) throw Validation('Invalid profile input', parsed.error.flatten());

    if (parsed.data.username) {
      const taken = await prisma.user.findFirst({
        where: { username: parsed.data.username.toLowerCase(), NOT: { id: userId } },
        select: { id: true },
      });
      if (taken) throw Conflict('That username is taken.');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: parsed.data.fullName,
        username: parsed.data.username?.toLowerCase(),
        bio: parsed.data.bio,
        avatarUrl: parsed.data.avatarUrl,
        department: parsed.data.department,
        graduationYear: parsed.data.graduationYear,
        interests: parsed.data.interests,
        skills: parsed.data.skills,
        socialLinks: parsed.data.socialLinks ?? undefined,
      },
      include: { college: true },
    });
    return updated;
  }

  async completeOnboarding(userId: string, rawInput: unknown) {
    const parsed = CompleteOnboardingSchema.safeParse(rawInput);
    if (!parsed.success) throw Validation('Invalid onboarding input', parsed.error.flatten());

    const username = parsed.data.username.toLowerCase();
    const taken = await prisma.user.findFirst({
      where: { username, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) throw Conflict('That username is taken.');

    return prisma.user.update({
      where: { id: userId },
      data: {
        username,
        department: parsed.data.department,
        graduationYear: parsed.data.graduationYear,
        interests: parsed.data.interests,
        skills: parsed.data.skills ?? [],
        bio: parsed.data.bio,
        onboardingCompleted: true,
      },
      include: { college: true },
    });
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
