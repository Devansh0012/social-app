import type { GraphqlModule } from '../types.js';
import { authTypeDefs } from './auth.schema.js';
import { authResolvers } from './auth.resolvers.js';

export const authModule: GraphqlModule = {
  typeDefs: authTypeDefs,
  resolvers: authResolvers,
};
