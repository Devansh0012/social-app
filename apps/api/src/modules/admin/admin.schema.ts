export const adminTypeDefs = /* GraphQL */ `
  enum ReportTargetType {
    POST
    COMMENT
    USER
    COMMUNITY
  }
  enum ReportStatus {
    OPEN
    RESOLVED
    DISMISSED
  }

  type Report {
    id: ID!
    reporterId: ID!
    targetType: ReportTargetType!
    targetId: ID!
    targetUserId: ID
    reason: String!
    status: ReportStatus!
    createdAt: DateTime!
    resolvedAt: DateTime
    resolution: String
  }

  type AnalyticsSummary {
    users: Int!
    posts: Int!
    communities: Int!
    studyMaterials: Int!
    openReports: Int!
    eventsLast7d: Int!
  }

  input CreateReportInput {
    targetType: ReportTargetType!
    targetId: ID!
    reason: String!
  }

  extend type Query {
    reports(status: ReportStatus): [Report!]!
    analyticsSummary: AnalyticsSummary!
  }

  extend type Mutation {
    banUser(userId: ID!, reason: String!): Viewer!
    unbanUser(userId: ID!): Viewer!
    removePost(postId: ID!): Post!
    createReport(input: CreateReportInput!): Report!
    resolveReport(id: ID!, resolution: String!, status: ReportStatus!): Report!
  }
`;
