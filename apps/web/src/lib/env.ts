export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  graphqlUrl: process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000/ws',
};
