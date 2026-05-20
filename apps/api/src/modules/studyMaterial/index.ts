import type { GraphqlModule } from '../types.js';
import { studyMaterialTypeDefs } from './studyMaterial.schema.js';
import { studyMaterialResolvers } from './studyMaterial.resolvers.js';

export const studyMaterialModule: GraphqlModule = {
  typeDefs: studyMaterialTypeDefs,
  resolvers: studyMaterialResolvers,
};
