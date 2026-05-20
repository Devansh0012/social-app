/**
 * Common module shape. Each feature module exports typeDefs + resolvers
 * and is composed in graphql/index.ts. Keep modules self-contained:
 * cross-module access goes through Prisma, not direct service imports
 * (except for shared core utilities).
 */
export interface GraphqlModule {
  typeDefs: string;
  resolvers: Record<string, unknown>;
}
