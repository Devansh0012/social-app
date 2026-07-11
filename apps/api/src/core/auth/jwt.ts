import crypto from 'node:crypto';
import { config } from '../config.js';

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: 'USER' | 'ADMIN';
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  family: string;
  jti: string;
  type: 'refresh';
}

export const accessTokenSecret = config.JWT_ACCESS_SECRET;

export const accessTokenTtl = config.JWT_ACCESS_TTL_SECONDS;
export const refreshTokenTtl = config.JWT_REFRESH_TTL_SECONDS;

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function newJti(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function newFamily(): string {
  return crypto.randomBytes(16).toString('hex');
}
