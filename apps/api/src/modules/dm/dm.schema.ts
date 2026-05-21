export const dmTypeDefs = /* GraphQL */ `
  type Conversation {
    id: ID!
    createdAt: DateTime!
    lastMessageAt: DateTime!
    otherParticipants: [PublicUser!]!
    lastMessage: DirectMessage
    unreadCount: Int!
  }

  type DirectMessage {
    id: ID!
    conversationId: ID!
    body: String!
    createdAt: DateTime!
    author: PublicUser!
  }

  type DirectMessageConnection {
    nodes: [DirectMessage!]!
    pageInfo: PageInfo!
  }

  extend type Query {
    conversations: [Conversation!]!
    conversation(id: ID!): Conversation!
    messages(conversationId: ID!, first: Int, after: String): DirectMessageConnection!
    unreadDMCount: Int!
  }

  extend type Mutation {
    openConversation(username: String!): Conversation!
    sendMessage(conversationId: ID!, body: String!): DirectMessage!
    markConversationRead(conversationId: ID!): Boolean!
  }
`;
