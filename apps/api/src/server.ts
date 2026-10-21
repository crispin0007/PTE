import { loadContent } from '@openpte/schema/node';
import { buildApp } from './app.ts';
import { createAuth } from './auth.ts';
import { loadConfig } from './config.ts';
import { connect } from './db/postgres.ts';
import { consoleMailer, smtpMailer } from './mail.ts';
import { seed } from './seed.ts';

const config = loadConfig();
const { db, close } = await connect(config.DATABASE_URL);
if (config.SEED_ON_START) {
  const result = await seed(db, loadContent(config.CONTENT_ROOT));
  console.log(`seeded ${result.questions} questions across ${result.itemTypes} types`);
}
const origins = config.CORS_ORIGIN.split(',').map((o) => o.trim());
const google =
  config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
    ? { clientId: config.GOOGLE_CLIENT_ID, clientSecret: config.GOOGLE_CLIENT_SECRET }
    : undefined;
const auth =
  config.CORS_ORIGIN === '*'
    ? undefined
    : createAuth({
        db,
        baseURL: config.PUBLIC_API_URL,
        secret: config.BETTER_AUTH_SECRET,
        mailer: config.SMTP_URL ? smtpMailer(config.SMTP_URL, config.MAIL_FROM) : consoleMailer,
        trustedOrigins: origins,
        google,
      });
const app = await buildApp({
  db,
  includeUnreviewed: config.INCLUDE_UNREVIEWED,
  corsOrigin: config.CORS_ORIGIN,
  logger: true,
  auth,
  googleEnabled: !!google,
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
