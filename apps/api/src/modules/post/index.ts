import type { GraphqlModule } from '../types.js';
import { postTypeDefs } from './post.schema.js';
import { postResolvers } from './post.resolvers.js';

export const postModule: GraphqlModule = {
  typeDefs: postTypeDefs,
  resolvers: postResolvers,
};
