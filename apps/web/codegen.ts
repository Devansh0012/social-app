import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * Validates every GraphQL document in the web app against the API's SDL
 * (apps/api/schema.graphql, regenerated via `pnpm --filter @braventex/api
 * schema:print`) and emits operation types. Its real job is failing the
 * build when a query references a field or enum value the schema doesn't
 * have — the class of bug that silently blanked the notifications page.
 */
const config: CodegenConfig = {
  schema: '../api/schema.graphql',
  documents: ['src/**/*.{ts,tsx}'],
  generates: {
    'src/lib/gql-types.generated.ts': {
      // Schema types only: the drift gate is the document validation that
      // runs while loading `documents`. (typescript-operations currently
      // duplicates input-type declarations alongside the typescript plugin,
      // breaking typecheck — revisit if operation types are ever consumed.)
      plugins: ['typescript'],
    },
  },
};

export default config;
