export const notificationTypeDefs = /* GraphQL */ `
  enum NotificationType {
    POST_LIKE
    POST_COMMENT
    COMMENT_REPLY
    COLLAB_REQUEST
    COLLAB_RESPONSE
    COMMUNITY_INVITE
    MENTION
    SYSTEM
    NEW_FOLLOWER
    NEW_DM
  }

  type Notification {
    id: ID!
    type: NotificationType!
    payload: JSON!
    readAt: DateTime
    createdAt: DateTime!
    actor: PublicUser
  }

  extend type Query {
    notifications(unreadOnly: Boolean, limit: Int): [Notification!]!
    unreadNotificationCount: Int!
  }

  extend type Mutation {
    markNotificationRead(id: ID!): Notification!
    markAllNotificationsRead: Boolean!
  }
`;
