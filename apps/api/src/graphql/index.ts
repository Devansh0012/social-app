import type { FastifyInstance } from 'fastify';
import mercurius from 'mercurius';
import { DateTimeResolver, JSONResolver } from 'graphql-scalars';
import { buildContext, type GqlContext } from './context.js';
import { AppError } from '../core/errors.js';

import { authModule } from '../modules/auth/index.js';
import { userModule } from '../modules/user/index.js';
import { communityModule } from '../modules/community/index.js';
import { postModule } from '../modules/post/index.js';
import { studyMaterialModule } from '../modules/studyMaterial/index.js';
import { studyRoomModule } from '../modules/studyRoom/index.js';
import { notificationModule } from '../modules/notification/index.js';
import { searchModule } from '../modules/search/index.js';
import { adminModule } from '../modules/admin/index.js';
import { followModule } from '../modules/follow/index.js';
import { dmModule } from '../modules/dm/index.js';

const modules = [
  authModule,
  userModule,
  communityModule,
  postModule,
  studyMaterialModule,
  studyRoomModule,
  notificationModule,
  searchModule,
  adminModule,
  followModule,
  dmModule,
];

const rootTypeDefs = /* GraphQL */ `
  scalar DateTime
  scalar JSON

  type Query {
    _health: String!
  }
  type Mutation {
    _noop: Boolean
  }
`;

const rootResolvers = {
  DateTime: DateTimeResolver,
  JSON: JSONResolver,
  Query: {
    _health: () => 'ok',
  },
  Mutation: {
    _noop: () => true,
  },
};

export async function registerGraphQL(app: FastifyInstance): Promise<void> {
  const schema = [rootTypeDefs, ...modules.map((m) => m.typeDefs)].join('\n');
  const resolvers = modules.reduce<Record<string, unknown>>(
    (acc, m) => mergeResolvers(acc, m.resolvers),
    rootResolvers as Record<string, unknown>,
  );

  await app.register(mercurius, {
    schema,
    resolvers: resolvers as never,
    graphiql: true,
    path: '/graphql',
    context: (request, reply) => buildContext(request, reply) as Promise<GqlContext>,
    errorFormatter: (execution) => {
      const errors = execution.errors?.map((err) => {
        const original = (err.originalError ?? err) as Error | AppError;
        if (original instanceof AppError) {
          return {
            ...err,
            message: original.message,
            extensions: {
              ...err.extensions,
              code: original.code,
              statusCode: original.statusCode,
              details: original.details,
            },
          };
        }
        return err;
      });
      return {
        statusCode: 200,
        response: {
          data: execution.data ?? null,
          errors: errors ?? execution.errors,
        },
      };
    },
  });
}

function mergeResolvers(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  for (const [key, val] of Object.entries(source)) {
    const existing = target[key];
    if (
      existing &&
      typeof existing === 'object' &&
      val &&
      typeof val === 'object' &&
      !Array.isArray(existing) &&
      !Array.isArray(val)
    ) {
      target[key] = { ...(existing as object), ...(val as object) };
    } else {
      target[key] = val;
    }
  }
  return target;
}
