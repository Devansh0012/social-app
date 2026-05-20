export const studyRoomTypeDefs = /* GraphQL */ `
  enum PomodoroPhase {
    IDLE
    FOCUS
    SHORT_BREAK
    LONG_BREAK
  }

  type PomodoroState {
    phase: PomodoroPhase!
    startedAt: DateTime
    durationSeconds: Int!
    cycle: Int!
  }

  type StudyRoom {
    id: ID!
    name: String!
    description: String
    topic: String
    maxParticipants: Int!
    isActive: Boolean!
    createdAt: DateTime!
    creator: PublicUser!
    members: [StudyRoomMember!]!
    activePresence: Int!
    pomodoro: PomodoroState!
  }

  type StudyRoomMember {
    id: ID!
    user: PublicUser!
    joinedAt: DateTime!
  }

  type StudyRoomMessage {
    id: ID!
    body: String!
    createdAt: DateTime!
    author: PublicUser!
  }

  input CreateStudyRoomInput {
    name: String!
    description: String
    topic: String
    maxParticipants: Int
  }

  extend type Query {
    studyRoom(id: ID!): StudyRoom!
    studyRooms: [StudyRoom!]!
    studyRoomMessages(roomId: ID!): [StudyRoomMessage!]!
  }

  extend type Mutation {
    createStudyRoom(input: CreateStudyRoomInput!): StudyRoom!
    joinStudyRoom(roomId: ID!): StudyRoom!
    leaveStudyRoom(roomId: ID!): StudyRoom!
    sendStudyRoomMessage(roomId: ID!, body: String!): StudyRoomMessage!
    startPomodoro(roomId: ID!, phase: PomodoroPhase!, durationSeconds: Int!): PomodoroState!
    stopPomodoro(roomId: ID!): PomodoroState!
  }
`;
