import type { GraphqlModule } from '../types.js';
import { dmTypeDefs } from './dm.schema.js';
import { dmResolvers } from './dm.resolvers.js';

export const dmModule: GraphqlModule = {
  typeDefs: dmTypeDefs,
  resolvers: dmResolvers,
};
