export const searchTypeDefs = /* GraphQL */ `
  type SearchResult {
    users: [PublicUser!]!
    communities: [Community!]!
    posts: [Post!]!
    materials: [StudyMaterial!]!
  }

  extend type Query {
    search(query: String!): SearchResult!
  }
`;
