import { z } from 'zod';

/**
 * Opaque cursor pagination. Cursors are base64(JSON({ at, id })).
 * `at` is the order key (date / score / count), `id` is the tiebreaker.
 * Direction is always descending in MVP.
 */
export interface Cursor {
  at: string;
  id: string;
}

export const PaginationInput = z.object({
  first: z.number().int().min(1).max(50).default(20),
  after: z.string().nullish(),
});
export type PaginationInputT = z.infer<typeof PaginationInput>;

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

export function decodeCursor(s: string | null | undefined): Cursor | null {
  if (!s) return null;
  try {
    const json = Buffer.from(s, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'at' in parsed &&
      'id' in parsed &&
      typeof (parsed as Cursor).at === 'string' &&
      typeof (parsed as Cursor).id === 'string'
    ) {
      return parsed as Cursor;
    }
    return null;
  } catch {
    return null;
  }
}

export interface PageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
}

export interface Connection<TNode> {
  nodes: TNode[];
  pageInfo: PageInfo;
}

export function buildConnection<TNode>(
  rows: TNode[],
  first: number,
  cursorFn: (n: TNode) => Cursor,
): Connection<TNode> {
  const hasNextPage = rows.length > first;
  const nodes = hasNextPage ? rows.slice(0, first) : rows;
  const last = nodes[nodes.length - 1];
  return {
    nodes,
    pageInfo: {
      hasNextPage,
      endCursor: last ? encodeCursor(cursorFn(last)) : null,
    },
  };
}
