import type { GraphqlModule } from '../types.js';
import { adminTypeDefs } from './admin.schema.js';
import { adminResolvers } from './admin.resolvers.js';

export const adminModule: GraphqlModule = {
  typeDefs: adminTypeDefs,
  resolvers: adminResolvers,
};
