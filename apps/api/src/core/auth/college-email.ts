import { prisma } from '../prisma.js';

/**
 * Extracts the domain from an email. Lowercased.
 * Returns null if the email is malformed.
 */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain.length ? domain : null;
}

/**
 * Resolves the College for a given email. Domain match is exact;
 * we deliberately do NOT do suffix-matching on `.edu` because not all
 * universities use `.edu` and the College table is the source of truth.
 *
 * Returns the matched College row or null if the domain isn't recognised.
 */
export async function resolveCollegeForEmail(email: string) {
  const domain = emailDomain(email);
  if (!domain) return null;
  return prisma.college.findUnique({ where: { domain } });
}
