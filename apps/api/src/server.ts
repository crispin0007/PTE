import { loadContent } from '@openpte/schema/node';
import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { connect } from './db/postgres.ts';
import { seed } from './seed.ts';

const config = loadConfig();
const { db, close } = await connect(config.DATABASE_URL);
if (config.SEED_ON_START) {
  const result = await seed(db, loadContent(config.CONTENT_ROOT));
  console.log(`seeded ${result.questions} questions across ${result.itemTypes} types`);
}
const app = await buildApp({
  db,
  includeUnreviewed: config.INCLUDE_UNREVIEWED,
  corsOrigin: config.CORS_ORIGIN,
  logger: true,
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app
      .close()
      .then(close)
      .then(() => process.exit(0));
  });
}
await app.listen({ port: config.PORT, host: config.HOST });
