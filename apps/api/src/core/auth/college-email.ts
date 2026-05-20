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
 * Domain looks like a university email host?
 * Patterns we accept:
 *   - foo.edu                 (US universities)
 *   - foo.edu.<cc>            (e.g. edu.au, edu.cn, edu.ng)
 *   - foo.ac.<cc>             (UK, India, Japan, etc.)
 *   - foo.university          (newer gTLD)
 */
export function isAcademicDomain(domain: string): boolean {
  if (/\.edu$/.test(domain)) return true;
  if (/\.edu\.[a-z]{2,3}$/.test(domain)) return true;
  if (/\.ac\.[a-z]{2,3}$/.test(domain)) return true;
  if (/\.university$/.test(domain)) return true;
  return false;
}

/**
 * Yield domain candidates to look up. Tries the full domain first, then
 * one-level subdomain strip (so `cs.stanford.edu` falls back to `stanford.edu`).
 */
function suffixCandidates(domain: string): string[] {
  const cands: string[] = [domain];
  const parts = domain.split('.');
  if (parts.length >= 3) {
    cands.push(parts.slice(1).join('.'));
  }
  return cands;
}

/**
 * Pick a reasonable display name from a domain. Strips academic-TLD labels
 * (edu / ac / country code / .university) and Title-cases what's left.
 *
 *   stanford.edu     → Stanford
 *   cs.stanford.edu  → Stanford
 *   iitb.ac.in       → Iitb
 *   cam.ac.uk        → Cam
 */
function humanizeName(domain: string): string {
  const parts = domain.split('.');
  let i = parts.length - 1;
  // strip the TLD chain right-to-left until we hit a meaningful label
  while (
    i >= 0 &&
    /^(edu|ac|university|[a-z]{2,3})$/i.test(parts[i] ?? '') &&
    parts.length - i <= 3
  ) {
    i -= 1;
  }
  const main = parts[i] ?? parts[0] ?? domain;
  return main.charAt(0).toUpperCase() + main.slice(1);
}

/** Best-effort country from the email tld. */
function inferCountry(domain: string): string | null {
  const cc = domain.match(/\.(?:edu|ac)\.([a-z]{2,3})$/);
  if (cc) return cc[1]!.toUpperCase();
  if (/\.edu$/.test(domain)) return 'US';
  return null;
}

/**
 * Resolves (and lazily creates) the College for a given email.
 *
 *   1. Exact-match the email's domain against the College table.
 *   2. If no match, retry with one subdomain stripped (cs.stanford.edu → stanford.edu).
 *   3. If still no match AND the domain looks academic, auto-create a row.
 *   4. Otherwise return null — caller surfaces COLLEGE_EMAIL_REQUIRED.
 *
 * Auto-created colleges land in the table with a derived display name —
 * admins can rename or merge them later from the admin dashboard.
 */
export async function resolveCollegeForEmail(email: string) {
  const domain = emailDomain(email);
  if (!domain) return null;

  for (const candidate of suffixCandidates(domain)) {
    const existing = await prisma.college.findUnique({ where: { domain: candidate } });
    if (existing) return existing;
  }

  if (!isAcademicDomain(domain)) return null;

  try {
    return await prisma.college.create({
      data: {
        domain,
        name: humanizeName(domain),
        country: inferCountry(domain),
      },
    });
  } catch (err) {
    // Two concurrent signups can race here — both saw "no college exists"
    // and both tried to create. Postgres' unique constraint on `domain`
    // makes one of them fail with P2002; re-fetch and return the winner.
    if ((err as { code?: string }).code === 'P2002') {
      return prisma.college.findUnique({ where: { domain } });
    }
    throw err;
  }
}
