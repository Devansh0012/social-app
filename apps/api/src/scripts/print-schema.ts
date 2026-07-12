/**
 * Print the API's merged GraphQL SDL to stdout. Used to regenerate
 * schema.graphql, which the web app's codegen validates its documents
 * against (catches schema/query drift at build time).
 *
 *   pnpm --filter @braventex/api schema:print
 */

// The module graph imports core/config.js, which exits on missing env.
// Printing the schema needs no real services, so provide inert defaults.
process.env.DATABASE_URL ??= 'postgresql://print:print@localhost:5432/print';
process.env.JWT_ACCESS_SECRET ??= 'print-schema-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'print-schema-refresh-secret';

const { buildSchemaSDL } = await import('../graphql/index.js');
process.stdout.write(buildSchemaSDL());
