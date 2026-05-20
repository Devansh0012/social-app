import type { Prisma, PrismaClient, RefreshToken } from '@prisma/client';

export class AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { college: true },
    });
  }

  findUserByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username: username.toLowerCase() } });
  }

  findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, include: { college: true } });
  }

  createUser(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data, include: { college: true } });
  }

  storeRefreshToken(input: {
    userId: string;
    tokenHash: string;
    family: string;
    expiresAt: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
    replacedById?: string | null;
  }) {
    return this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        family: input.family,
        expiresAt: input.expiresAt,
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
        replacedById: input.replacedById ?? null,
      },
    });
  }

  findActiveRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  async revokeRefreshTokenFamily(family: string) {
    await this.prisma.refreshToken.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeRefreshToken(id: string, replacedById?: string) {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedById: replacedById ?? null },
    });
  }

  storeEmailVerificationToken(userId: string, tokenHash: string, expiresAt: Date) {
    return this.prisma.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  findEmailVerificationToken(tokenHash: string) {
    return this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  }

  async consumeEmailVerificationToken(tokenId: string, userId: string) {
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: tokenId },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true, isVerifiedStudent: true, status: 'ACTIVE' },
      }),
    ]);
  }
}
