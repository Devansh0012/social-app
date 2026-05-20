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

  type AdminUserView {
    id: ID!
    email: String!
    username: String!
    fullName: String!
    avatarUrl: String
    college: College!
    department: String
    graduationYear: Int
    role: UserRole!
    status: UserStatus!
    emailVerified: Boolean!
    isVerifiedStudent: Boolean!
    onboardingCompleted: Boolean!
    reputationScore: Int!
    createdAt: DateTime!
  }

  type AdminUserConnection {
    nodes: [AdminUserView!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type AdminCollegeView {
    id: ID!
    name: String!
    domain: String!
    country: String
    createdAt: DateTime!
    userCount: Int!
  }

  input CreateReportInput {
    targetType: ReportTargetType!
    targetId: ID!
    reason: String!
  }

  input AdminCreateUserInput {
    email: String!
    password: String!
    fullName: String!
    username: String
    collegeId: ID!
    role: UserRole
    emailVerified: Boolean
  }

  input AdminCreateCollegeInput {
    name: String!
    domain: String!
    country: String
  }
  input AdminUpdateCollegeInput {
    name: String
    domain: String
    country: String
  }

  extend type Query {
    reports(status: ReportStatus): [Report!]!
    analyticsSummary: AnalyticsSummary!
    adminUsers(
      status: UserStatus
      search: String
      first: Int
      after: String
    ): AdminUserConnection!
    adminColleges(search: String): [AdminCollegeView!]!
  }

  extend type Mutation {
    banUser(userId: ID!, reason: String!): AdminUserView!
    unbanUser(userId: ID!): AdminUserView!
    removePost(postId: ID!): Post!
    createReport(input: CreateReportInput!): Report!
    resolveReport(id: ID!, resolution: String!, status: ReportStatus!): Report!

    adminCreateUser(input: AdminCreateUserInput!): AdminUserView!
    adminVerifyUser(userId: ID!): AdminUserView!
    adminSetUserRole(userId: ID!, role: UserRole!): AdminUserView!

    adminCreateCollege(input: AdminCreateCollegeInput!): College!
    adminUpdateCollege(id: ID!, input: AdminUpdateCollegeInput!): College!
    adminDeleteCollege(id: ID!): Boolean!
  }
`;
