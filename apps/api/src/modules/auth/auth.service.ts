import crypto from 'node:crypto';
import { z } from 'zod';
import slugify from 'slugify';
import type { FastifyInstance } from 'fastify';
import type { User } from '@prisma/client';
import { AuthRepository } from './auth.repository.js';
import { prisma } from '../../core/prisma.js';
import { hashPassword, verifyPassword } from '../../core/auth/password.js';
import {
  accessTokenTtl,
  refreshTokenTtl,
  hashToken,
  newFamily,
  newJti,
  type AccessTokenPayload,
  type RefreshTokenPayload,
} from '../../core/auth/jwt.js';
import { resolveCollegeForEmail } from '../../core/auth/college-email.js';
import { config } from '../../core/config.js';
import { emailDriver, verificationEmail } from '../../core/email/email.js';
import {
  AccountBanned,
  BadRequest,
  CollegeEmailRequired,
  Conflict,
  EmailNotVerified,
  NotFound,
  Unauthenticated,
  parseOrThrow,
} from '../../core/errors.js';

const SignupSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(80),
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/u, 'Use letters, numbers, or underscores only.')
    .optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
}

export class AuthService {
  private readonly repo: AuthRepository;

  constructor(private readonly app: FastifyInstance) {
    this.repo = new AuthRepository(prisma);
  }

  /* ----------------------------------------------------------- signup */
  async signup(rawInput: unknown, context: { ip?: string; userAgent?: string }) {
    const input = parseOrThrow(SignupSchema, rawInput, 'Invalid signup input');
    const email = input.email.toLowerCase();

    const college = await resolveCollegeForEmail(email);
    if (!college) throw CollegeEmailRequired();

    const existingEmail = await this.repo.findUserByEmail(email);
    if (existingEmail) throw Conflict('An account with that email already exists.');

    const username = await this.ensureUniqueUsername(input.username ?? input.fullName, email);

    const passwordHash = await hashPassword(input.password);

    const user = await this.repo.createUser({
      email,
      username,
      fullName: input.fullName,
      passwordHash,
      college: { connect: { id: college.id } },
      status: 'PENDING_VERIFICATION',
      emailVerified: false,
      onboardingCompleted: false,
    });

    const verifyToken = await this.issueEmailVerification(user.id);
    await this.sendVerificationEmail(user.email, user.fullName, verifyToken);

    const tokens = await this.issueTokenPair(user, context);
    return { user, tokens, verifyTokenDev: config.NODE_ENV === 'development' ? verifyToken : null };
  }

  /* ----------------------------------------------------------- login */
  async login(rawInput: unknown, context: { ip?: string; userAgent?: string }) {
    const input = parseOrThrow(LoginSchema, rawInput, 'Invalid login input');

    const user = await this.repo.findUserByEmail(input.email);
    if (!user) throw Unauthenticated('Invalid email or password');

    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) throw Unauthenticated('Invalid email or password');

    if (user.status === 'BANNED') throw AccountBanned();

    const tokens = await this.issueTokenPair(user, context);
    return { user, tokens };
  }

  /* --------------------------------------------------- refresh rotate */
  async refresh(refreshToken: string, context: { ip?: string; userAgent?: string }) {
    let payload: RefreshTokenPayload;
    try {
      payload = this.app.jwt.verify<RefreshTokenPayload>(refreshToken, {
        key: config.JWT_REFRESH_SECRET,
      } as never);
    } catch {
      throw Unauthenticated('Invalid refresh token');
    }
    if (payload.type !== 'refresh') throw Unauthenticated('Invalid refresh token');

    const stored = await this.repo.findActiveRefreshToken(hashToken(refreshToken));
    if (!stored) {
      // Token replay → revoke the entire family for safety.
      await this.repo.revokeRefreshTokenFamily(payload.family);
      throw Unauthenticated('Refresh token replay detected');
    }

    // Grace window for multi-tab refreshes: when the user has several tabs
    // open, all of them notice the access token expired at roughly the same
    // moment and race to refresh with the same token. The first one wins
    // and rotates; the rest hit a revoked token. Without a grace window,
    // we'd kill the whole family and log the user out. Instead, allow
    // already-rotated tokens within REFRESH_ROTATION_GRACE_MS to mint a
    // fresh pair off the same family.
    const REFRESH_ROTATION_GRACE_MS = 60_000;
    if (stored.revokedAt) {
      const withinGrace = Date.now() - stored.revokedAt.getTime() < REFRESH_ROTATION_GRACE_MS;
      if (!withinGrace) {
        await this.repo.revokeRefreshTokenFamily(stored.family);
        throw Unauthenticated('Refresh token revoked');
      }
      // fall through — race-friendly path
    }
    if (stored.expiresAt < new Date()) throw Unauthenticated('Refresh token expired');

    const user = await this.repo.findUserById(payload.sub);
    if (!user) throw Unauthenticated();
    if (user.status === 'BANNED') throw AccountBanned();

    const newTokens = await this.issueTokenPair(user, context, { family: stored.family });
    if (!stored.revokedAt) {
      await this.repo.revokeRefreshToken(stored.id);
    }
    return { user, tokens: newTokens };
  }

  /* ------------------------------------------------- email verify flow */
  async verifyEmail(token: string) {
    const tokenHash = hashToken(token);
    const row = await this.repo.findEmailVerificationToken(tokenHash);
    if (!row) throw BadRequest('Invalid verification token');

    // Idempotent: if the token's already been consumed AND the user is verified,
    // treat the second hit as success. Covers React StrictMode's double-effect
    // and any honest reload of the verify URL.
    if (row.consumedAt) {
      const user = await this.repo.findUserById(row.userId);
      if (user?.emailVerified) return user;
      throw BadRequest('Verification token already used');
    }

    if (row.expiresAt < new Date()) throw BadRequest('Verification token expired');
    await this.repo.consumeEmailVerificationToken(row.id, row.userId);
    return this.repo.findUserById(row.userId);
  }

  async resendEmailVerification(userId: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) throw NotFound('User not found');
    if (user.emailVerified) throw BadRequest('Email already verified');
    const token = await this.issueEmailVerification(userId);
    await this.sendVerificationEmail(user.email, user.fullName, token);
    return true;
  }

  private async sendVerificationEmail(email: string, fullName: string, token: string) {
    const verifyUrl = `${config.APP_PUBLIC_URL}/verify-email?token=${token}`;
    // Always log in non-prod so devs without a Resend key can grab the link from logs.
    if (config.NODE_ENV !== 'production') {
      this.app.log.info(`[auth] email-verification link: ${verifyUrl}`);
    }
    try {
      const tmpl = verificationEmail({ fullName, verifyUrl });
      await emailDriver.send({ ...tmpl, to: email });
    } catch (err) {
      this.app.log.error({ err }, '[auth] failed to send verification email');
    }
  }

  /* --------------------------------------------------- token issuance */
  private async issueTokenPair(
    user: User,
    context: { ip?: string; userAgent?: string },
    opts: { family?: string } = {},
  ): Promise<TokenPair> {
    const family = opts.family ?? newFamily();
    const jti = newJti();
    const refreshExpiresAt = new Date(Date.now() + refreshTokenTtl * 1000);

    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      type: 'access',
    };
    const accessToken = this.app.jwt.sign(accessPayload, {
      expiresIn: accessTokenTtl,
    });

    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      family,
      jti,
      type: 'refresh',
    };
    const refreshToken = this.app.jwt.sign(refreshPayload, {
      key: config.JWT_REFRESH_SECRET,
      expiresIn: refreshTokenTtl,
    } as never);

    await this.repo.storeRefreshToken({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      family,
      expiresAt: refreshExpiresAt,
      userAgent: context.userAgent ?? null,
      ipAddress: context.ip ?? null,
    });

    return {
      accessToken,
      refreshToken,
      accessExpiresIn: accessTokenTtl,
      refreshExpiresIn: refreshTokenTtl,
    };
  }

  private async issueEmailVerification(userId: string): Promise<string> {
    const raw = crypto.randomBytes(32).toString('base64url');
    const hashed = hashToken(raw);
    const expiresAt = new Date(Date.now() + config.EMAIL_VERIFY_TTL_SECONDS * 1000);
    await this.repo.storeEmailVerificationToken(userId, hashed, expiresAt);
    return raw;
  }

  private async ensureUniqueUsername(seed: string, email: string): Promise<string> {
    const base = slugify(seed || email.split('@')[0] || 'user', {
      lower: true,
      strict: true,
    }).slice(0, 18) || 'user';
    let candidate = base;
    for (let i = 0; i < 20; i++) {
      const exists = await this.repo.findUserByUsername(candidate);
      if (!exists) return candidate;
      candidate = `${base}${crypto.randomInt(10, 9999)}`;
    }
    throw BadRequest('Unable to generate a unique username — please specify one.');
  }
}
