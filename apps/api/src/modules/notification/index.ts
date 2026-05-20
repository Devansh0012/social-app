// Importing the service has the side effect of registering its event-bus
// listeners — keep this side-effect import.
import './notification.service.js';
import type { GraphqlModule } from '../types.js';
import { notificationTypeDefs } from './notification.schema.js';
import { notificationResolvers } from './notification.resolvers.js';

export const notificationModule: GraphqlModule = {
  typeDefs: notificationTypeDefs,
  resolvers: notificationResolvers,
};
