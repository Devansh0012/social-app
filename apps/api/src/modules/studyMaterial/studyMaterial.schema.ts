export const studyMaterialTypeDefs = /* GraphQL */ `
  type StudyMaterial {
    id: ID!
    title: String!
    description: String
    department: String
    semester: Int
    subject: String
    tags: [String!]!
    fileKey: String
    fileMime: String
    fileSize: Int
    externalUrl: String
    downloadCount: Int!
    createdAt: DateTime!
    uploader: PublicUser!
    college: College
    fileUrl: String
  }

  type StudyMaterialConnection {
    nodes: [StudyMaterial!]!
    pageInfo: PageInfo!
  }

  input CreateStudyMaterialInput {
    title: String!
    description: String
    collegeId: ID
    department: String
    semester: Int
    subject: String
    tags: [String!]
    fileKey: String
    fileMime: String
    fileSize: Int
    externalUrl: String
  }

  extend type Query {
    studyMaterial(id: ID!): StudyMaterial!
    studyMaterials(
      search: String
      collegeId: ID
      department: String
      semester: Int
      subject: String
      first: Int
      after: String
    ): StudyMaterialConnection!
  }

  extend type Mutation {
    createStudyMaterial(input: CreateStudyMaterialInput!): StudyMaterial!
  }
`;
